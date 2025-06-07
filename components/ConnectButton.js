import React, { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, TextInput } from 'react-native';
import Modal from 'react-native-modal';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as solanaWeb3 from '@solana/web3.js';
import * as Crypto from 'expo-crypto';
import bs58 from 'bs58';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { RPC_URL } from '../constants';
import { styles } from '../styles/ConnectButtonStyles';
import TokenClaimModal from './TokenClaimModal';

export const EmbeddedWalletContext = createContext();

const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');

const secureStoreWrapper = {
  setItemAsync: async (key, value) => {
    try {
      if (typeof value !== 'string') {
        throw new Error(`Value for ${key} must be a string, got ${typeof value}`);
      }
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        try {
          await SecureStore.setItemAsync(key, value, {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to access your wallet',
            authenticationType: SecureStore.AUTHENTICATION_TYPE?.BIOMETRIC,
          });
        } catch (biometricError) {
          console.warn('[secureStoreWrapper] Biometric failed, using fallback:', biometricError.message);
          await SecureStore.setItemAsync(key, value);
        }
      }
      console.log(`[secureStoreWrapper] Set ${key}`);
    } catch (err) {
      console.error(`[secureStoreWrapper] Failed to set ${key}:`, err.message);
      throw err;
    }
  },
  getItemAsync: async (key) => {
    try {
      if (Platform.OS === 'web') {
        const value = localStorage.getItem(key);
        console.log(`[secureStoreWrapper] Got ${key}: ${value ? 'exists' : 'null'}`);
        return value;
      } else {
        try {
          const value = await SecureStore.getItemAsync(key, {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to access your wallet',
            authenticationType: SecureStore.AUTHENTICATION_TYPE?.BIOMETRIC,
          });
          console.log(`[secureStoreWrapper] Got ${key}: ${value ? 'exists' : 'null'}`);
          return value;
        } catch (biometricError) {
          console.warn('[secureStoreWrapper] Biometric failed, using fallback:', biometricError.message);
          const value = await SecureStore.getItemAsync(key);
          console.log(`[secureStoreWrapper] Got ${key} (fallback): ${value ? 'exists' : 'null'}`);
          return value;
        }
      }
    } catch (err) {
      console.error(`[secureStoreWrapper] Failed to get ${key}:`, err.message);
      throw err;
    }
  },
  deleteItemAsync: async (key) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
      console.log(`[secureStoreWrapper] Deleted ${key}`);
    } catch (err) {
      console.error(`[secureStoreWrapper] Error deleting ${key}:`, err.message);
      throw err;
    }
  },
};

export const EmbeddedWalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [secretKey, setSecretKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [transactionPassword, setTransactionPassword] = useState(null);
  const [useBiometrics, setUseBiometrics] = useState(false);
  const { user } = useAuth();

  const invokeEncryptionFunction = async (action, data) => {
    try {
      const { data: response, error } = await supabase.functions.invoke('wallet-encryption', {
        body: { action, data },
      });
      if (error) {
        console.error('[invokeEncryptionFunction] Error response:', error);
        throw new Error(`Edge function error: ${error.message || 'Unknown error'}`);
      }
      if (!response.result) {
        console.error('[invokeEncryptionFunction] No result in response:', response);
        throw new Error('No result returned from edge function');
      }
      return response.result;
    } catch (err) {
      console.error(`[invokeEncryptionFunction] ${action} failed:`, err.message);
      throw err;
    }
  };

  useEffect(() => {
    const restoreWallet = async () => {
      if (!user || user.isGuest) {
        console.log('[restoreWallet] No authenticated user or guest user, clearing wallet');
        await disconnectWallet();
        return;
      }
      try {
        setIsLoading(true);
        console.log('[restoreWallet] Restoring wallet for user:', user.email);
        const publicKeyStr = await secureStoreWrapper.getItemAsync('walletPublicKey');
        const encryptedPrivateKey = await secureStoreWrapper.getItemAsync('walletPrivateKey');
        const storedPassword = await secureStoreWrapper.getItemAsync('transactionPassword');
        const biometricsEnabled = (await SecureStore.getItemAsync('useBiometrics')) === 'true';

        if (!publicKeyStr || !encryptedPrivateKey || !storedPassword) {
          console.log('[restoreWallet] Missing wallet data in storage');
          return;
        }

        let privateKeyBase58;
        try {
          privateKeyBase58 = await invokeEncryptionFunction('decrypt', encryptedPrivateKey);
          console.log('[restoreWallet] Private key decrypted via edge function');
        } catch (decryptionError) {
          console.error('[restoreWallet] Decryption failed:', decryptionError.message);
          throw new Error('Failed to decrypt stored private key');
        }

        const privateKeyBytes = bs58.decode(privateKeyBase58);
        if (privateKeyBytes.length !== 64) {
          throw new Error(`Invalid private key format: length ${privateKeyBytes.length}`);
        }

        const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
        if (keypair.publicKey.toString() !== publicKeyStr) {
          console.error('[restoreWallet] Public key mismatch:', {
            stored: publicKeyStr,
            derived: keypair.publicKey.toString(),
          });
          throw new Error('Private key does not match stored public key');
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('wallet_address')
          .eq('email', user.email)
          .single();
        if (userError) throw new Error(`Supabase user query failed: ${userError.message}`);

        if (userData && userData.wallet_address === publicKeyStr) {
          setWallet({ publicKey: keypair.publicKey });
          setSecretKey(privateKeyBytes);
          setTransactionPassword(storedPassword);
          setUseBiometrics(biometricsEnabled);
          setIsWalletConnected(true);
          console.log('[restoreWallet] Wallet restored:', publicKeyStr);
        } else {
          console.log('[restoreWallet] Wallet mismatch, clearing');
          await disconnectWallet();
        }
      } catch (err) {
        console.error('[restoreWallet] Error:', err.message);
        setError('Failed to restore wallet: ' + err.message);
        await disconnectWallet();
      } finally {
        setIsLoading(false);
      }
    };

    restoreWallet();
  }, [user]);

  const createEmbeddedWallet = useCallback(async (password) => {
    if (!user || user.isGuest) {
      throw new Error('Sign in with an account to create a wallet');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be a string and at least 8 characters long');
    }
    try {
      setIsLoading(true);
      console.log('[createEmbeddedWallet] Creating wallet for:', user.email);

      // Verify authenticated user
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Auth error: ${authError.message}`);
      if (!authUser.user || authUser.user.id !== user.id) {
        console.error('[createEmbeddedWallet] Auth user mismatch:', {
          authUserId: authUser.user?.id,
          contextUserId: user.id,
        });
        throw new Error('Authenticated user mismatch');
      }

      // Generate wallet
      const keypair = solanaWeb3.Keypair.generate();
      const publicKey = keypair.publicKey;
      const secretKeyBytes = keypair.secretKey;
      const secretKeyBase58 = bs58.encode(secretKeyBytes);

      // Encrypt private key
      let encryptedPrivateKey;
      try {
        encryptedPrivateKey = await invokeEncryptionFunction('encrypt', secretKeyBase58);
        console.log('[createEmbeddedWallet] Private key encrypted for database via edge function');
      } catch (encryptionError) {
        console.error('[createEmbeddedWallet] Encryption failed:', encryptionError.message);
        throw new Error('Failed to encrypt private key');
      }

      let encryptedPrivateKeyForStore;
      try {
        encryptedPrivateKeyForStore = await invokeEncryptionFunction('encrypt', secretKeyBase58);
        console.log('[createEmbeddedWallet] Private key encrypted for SecureStore via edge function');
      } catch (encryptionError) {
        console.error('[createEmbeddedWallet] SecureStore encryption failed:', encryptionError.message);
        throw new Error('Failed to encrypt private key for storage');
      }

      // Hash password
      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      // Generate unique referral code
      let referralCode;
      let isUnique = false;
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      while (!isUnique) {
        referralCode = Array.from({ length: 8 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referralCode)
          .maybeSingle();
        isUnique = !data;
      }

      // Prepare user data
      const userMetadata = authUser.user.user_metadata || {};
      const name = userMetadata.full_name || user.email.split('@')[0];
      const email = user.email;
      const image = userMetadata.avatar_url || null;

      // Upsert user
      console.log('[createEmbeddedWallet] Upserting user:', { id: user.id, email });
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert(
          {
            id: user.id,
            email,
            name,
            image,
            wallet_address: publicKey.toString(),
            referral_code: referralCode,
            has_updated_profile: false,
          },
          { onConflict: 'id' }
        )
        .select('id')
        .single();
      if (userError) {
        console.error('[createEmbeddedWallet] User upsert error:', userError);
        throw new Error(`User upsert failed: ${userError.message}`);
      }
      if (!userData || !userData.id) {
        console.error('[createEmbeddedWallet] User upsert returned no data:', userData);
        throw new Error('User upsert succeeded but returned no data');
      }
      console.log('[createEmbeddedWallet] User upserted:', userData.id);

      // Insert wallet
      console.log('[createEmbeddedWallet] Inserting wallet for user_id:', userData.id);
      const { error: walletError } = await supabase
        .from('user_wallets')
        .insert({
          user_id: userData.id,
          address: publicKey.toString(),
          private_key: encryptedPrivateKey,
        });
      if (walletError) {
        console.error('[createEmbeddedWallet] Wallet insert error:', walletError);
        throw new Error(`Wallet insert failed: ${walletError.message}`);
      }
      console.log('[createEmbeddedWallet] Wallet inserted for address:', publicKey.toString());

      // Store wallet data
      const publicKeyStr = publicKey.toString();
      console.log('[createEmbeddedWallet] Storing publicKey:', publicKeyStr, typeof publicKeyStr);
      await secureStoreWrapper.setItemAsync('walletPublicKey', publicKeyStr);
      await secureStoreWrapper.setItemAsync('walletPrivateKey', encryptedPrivateKeyForStore);
      await secureStoreWrapper.setItemAsync('walletAddress', publicKeyStr);
      await secureStoreWrapper.setItemAsync('transactionPassword', hashedPassword);
      await AsyncStorage.setItem('walletAddress', publicKeyStr);

      setWallet({ publicKey });
      setSecretKey(secretKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      console.log('[createEmbeddedWallet] Wallet created:', publicKeyStr);
      return { publicKey: publicKeyStr, privateKey: secretKeyBase58 };
    } catch (err) {
      console.error('[createEmbeddedWallet] Error:', err.message);
      setError('Failed to create wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const retrieveEmbeddedWallet = useCallback(async (password) => {
    if (!user || user.isGuest) {
      throw new Error('Sign in with an account to retrieve a wallet');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be a string and at least 8 characters long');
    }
    try {
      setIsLoading(true);
      console.log('[retrieveEmbeddedWallet] Retrieving wallet for:', user.email);
      await disconnectWallet();

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, wallet_address')
        .eq('email', user.email)
        .single();
      if (userError || !userData) {
        throw new Error('User or wallet not found');
      }
      if (typeof userData.wallet_address !== 'string') {
        throw new Error('Invalid wallet_address format in users table');
      }

      const { data: walletData, error: walletError } = await supabase
        .from('user_wallets')
        .select('address, private_key')
        .eq('user_id', userData.id)
        .eq('address', userData.wallet_address)
        .single();
      if (walletError || !walletData) {
        throw new Error('Wallet not found in user_wallets table');
      }
      if (typeof walletData.address !== 'string' || typeof walletData.private_key !== 'string') {
        console.error('[retrieveEmbeddedWallet] Invalid wallet data:', walletData);
        throw new Error('Invalid wallet data format from user_wallets table');
      }

      let privateKeyBase58;
      try {
        console.log('[retrieveEmbeddedWallet] Private key to decrypt:', walletData.private_key.slice(0, 10) + '...');
        privateKeyBase58 = await invokeEncryptionFunction('decrypt', walletData.private_key);
        console.log('[retrieveEmbeddedWallet] Private key decrypted from database via edge function');
      } catch (decryptionError) {
        console.error('[retrieveEmbeddedWallet] Decryption failed:', decryptionError.message);
        throw new Error('Failed to decrypt private key from database');
      }

      const privateKeyBytes = bs58.decode(privateKeyBase58);
      if (privateKeyBytes.length !== 64) {
        throw new Error(`Invalid private key format after decryption: length ${privateKeyBytes.length}`);
      }

      const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = keypair.publicKey;
      const publicKeyStr = publicKey.toString();

      if (publicKeyStr !== walletData.address) {
        console.error('[retrieveEmbeddedWallet] Public key mismatch:', {
          stored: walletData.address,
          derived: publicKeyStr,
        });
        throw new Error('Public key mismatch between keypair and stored address');
      }

      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      let encryptedPrivateKeyForStore;
      try {
        encryptedPrivateKeyForStore = await invokeEncryptionFunction('encrypt', privateKeyBase58);
        console.log('[retrieveEmbeddedWallet] Private key encrypted for SecureStore via edge function');
      } catch (encryptionError) {
        console.error('[retrieveEmbeddedWallet] SecureStore encryption failed:', encryptionError.message);
        throw new Error('Failed to encrypt private key for storage');
      }

      console.log('[retrieveEmbeddedWallet] Storing publicKey:', publicKeyStr, typeof publicKeyStr);
      await secureStoreWrapper.setItemAsync('walletPublicKey', publicKeyStr);
      await secureStoreWrapper.setItemAsync('walletPrivateKey', encryptedPrivateKeyForStore);
      await secureStoreWrapper.setItemAsync('walletAddress', publicKeyStr);
      await secureStoreWrapper.setItemAsync('transactionPassword', hashedPassword);
      await AsyncStorage.setItem('walletAddress', publicKeyStr);

      setWallet({ publicKey });
      setSecretKey(privateKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      console.log('[retrieveEmbeddedWallet] Wallet retrieved:', publicKeyStr);
      return { publicKey: publicKeyStr, privateKey: privateKeyBase58 };
    } catch (err) {
      console.error('[retrieveEmbeddedWallet] Error:', err.message);
      setError('Failed to retrieve wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const disconnectWallet = async () => {
    try {
      console.log('[disconnectWallet] Disconnecting wallet');
      await secureStoreWrapper.deleteItemAsync('walletPublicKey');
      await secureStoreWrapper.deleteItemAsync('walletPrivateKey');
      await secureStoreWrapper.deleteItemAsync('walletAddress');
      await secureStoreWrapper.deleteItemAsync('transactionPassword');
      await secureStoreWrapper.deleteItemAsync('useBiometrics');
      await AsyncStorage.removeItem('walletAddress');
      setWallet(null);
      setSecretKey(null);
      setTransactionPassword(null);
      setUseBiometrics(false);
      setIsWalletConnected(false);
      setError(null);
      console.log('[disconnectWallet] Wallet disconnected');
    } catch (err) {
      console.error('[disconnectWallet] Error:', err.message);
      setError('Failed to disconnect wallet: ' + err.message);
    }
  };

  const verifyPassword = useCallback(async (inputPassword) => {
    try {
      if (!inputPassword || typeof inputPassword !== 'string') {
        throw new Error('Input password must be a string');
      }
      const storedPassword = await secureStoreWrapper.getItemAsync('transactionPassword');
      if (!storedPassword) {
        throw new Error('No transaction password set');
      }
      const hashedInput = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        inputPassword
      );
      const isValid = hashedInput === storedPassword;
      console.log('[verifyPassword] Password verification:', isValid ? 'valid' : 'invalid');
      return isValid;
    } catch (err) {
      console.error('[verifyPassword] Error:', err.message);
      throw err;
    }
  }, []);

  const signAndSendTransaction = useCallback(async (transaction, inputPassword) => {
    if (!wallet?.publicKey) {
      throw new Error('No wallet connected');
    }
    try {
      if (!transaction) {
        throw new Error('No transaction provided');
      }
      console.log('[signAndSendTransaction] Starting with wallet:', {
        publicKey: wallet.publicKey.toString(),
        type: typeof wallet.publicKey,
      });

      let walletPubKey;
      try {
        walletPubKey = wallet.publicKey instanceof solanaWeb3.PublicKey
          ? wallet.publicKey
          : new solanaWeb3.PublicKey(wallet.publicKey);
      } catch (err) {
        console.error('[signAndSendTransaction] Invalid public key:', err);
        throw new Error('Invalid wallet public key');
      }

      const isVersionedTransaction = transaction.version !== undefined;

      if (!isVersionedTransaction) {
        if (!transaction.instructions || !Array.isArray(transaction.instructions)) {
          throw new Error('Invalid transaction: missing or invalid instructions');
        }
      }

      console.log('[signAndSendTransaction] Transaction before signing:', {
        isVersioned: isVersionedTransaction,
        hasRecentBlockhash: !!transaction.recentBlockhash,
        hasFeePayer: !!transaction.feePayer,
        instructions: isVersionedTransaction ? transaction.message.compiledInstructions.length : transaction.instructions?.length || 0,
        signatures: isVersionedTransaction ? transaction.signatures.length : transaction.signatures?.length || 0,
      });

      let privateKeyBase58;
      try {
        const encryptedPrivateKey = await secureStoreWrapper.getItemAsync('walletPrivateKey');
        if (!encryptedPrivateKey) {
          throw new Error('Private key unavailable');
        }
        privateKeyBase58 = await invokeEncryptionFunction('decrypt', encryptedPrivateKey);
        console.log('[signAndSendTransaction] Private key decrypted (first 4 chars):', privateKeyBase58.slice(0, 4));
      } catch (err) {
        console.error('[signAndSendTransaction] Error retrieving/decrypting private key:', err);
        throw new Error('Failed to retrieve or decrypt private key: ' + err.message);
      }

      if (!useBiometrics && !inputPassword) {
        throw new Error('Password required for transaction');
      }

      if (!useBiometrics) {
        const isValid = await verifyPassword(inputPassword);
        if (!isValid) {
          throw new Error('Invalid transaction password');
        }
      }

      const privateKeyBytes = bs58.decode(privateKeyBase58);
      if (privateKeyBytes.length !== 64) {
        throw new Error(`Invalid private key format: ${privateKeyBytes.length}`);
      }

      const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const keypairPubKeyStr = keypair.publicKey.toString();

      console.log('[signAndSendTransaction] Comparing public keys:', {
        wallet: `${walletPubKey.toString().slice(0, 4)}...${walletPubKey.toString().slice(-4)}`,
        keypair: `${keypairPubKeyStr.slice(0, 4)}...${keypairPubKeyStr.slice(-4)}`,
      });

      if (walletPubKey.toString() !== keypairPubKeyStr) {
        console.error('[signAndSendTransaction] Public key mismatch:', {
          wallet: walletPubKey.toString(),
          keypair: keypairPubKeyStr,
        });
        throw new Error('Private key does not match wallet public key');
      }

      if (!isVersionedTransaction) {
        if (!transaction.recentBlockhash) {
          console.log('[signAndSendTransaction] Getting recent blockhash...');
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
        }

        if (!transaction.feePayer) {
          console.log('[signAndSendTransaction] Setting fee payer...');
          transaction.feePayer = walletPubKey;
        }
      }

      console.log('[signAndSendTransaction] Signing transaction...');
      try {
        if (isVersionedTransaction) {
          transaction.sign([keypair]);
        } else {
          transaction.partialSign(keypair);
        }
      } catch (err) {
        console.error('[signAndSendTransaction] Error signing transaction:', err);
        throw new Error('Failed to sign transaction: ' + err.message);
      }

      console.log('[signAndSendTransaction] Transaction after signing:', {
        isVersioned: isVersionedTransaction,
        hasRecentBlockhash: !!transaction.recentBlockhash,
        hasFeePayer: !!transaction.feePayer,
        instructions: isVersionedTransaction ? transaction.message.compiledInstructions.length : transaction.instructions?.length || 0,
        signatures: isVersionedTransaction ? transaction.signatures.length : transaction.signatures?.length || 0,
      });

      console.log('[signAndSendTransaction] Serializing transaction...');
      let serializedTx;
      try {
        serializedTx = transaction.serialize();
      } catch (err) {
        console.error('[signAndSendTransaction] Error serializing transaction:', err);
        throw new Error('Failed to serialize transaction: ' + err.message);
      }

      console.log('[signAndSendTransaction] Sending transaction...');
      const signature = await connection.sendRawTransaction(serializedTx, {
        skipPreflight: false,
        maxRetries: 2,
      });
      console.log('[signAndSendTransaction] Signature:', signature);
      return signature;
    } catch (err) {
      console.error('[signAndSendTransaction] Error:', err);
      throw err;
    }
  }, [wallet, useBiometrics, verifyPassword]);

  return (
    <EmbeddedWalletContext.Provider
      value={{
        wallet,
        secretKey,
        isWalletConnected,
        createEmbeddedWallet,
        retrieveEmbeddedWallet,
        disconnectWallet,
        signAndSendTransaction,
        isLoading,
        error,
        useBiometrics,
        setUseBiometrics,
      }}
    >
      {children}
    </EmbeddedWalletContext.Provider>
  );
};

const ConnectButton = () => {
  const {
    wallet,
    createEmbeddedWallet,
    retrieveEmbeddedWallet,
    disconnectWallet,
    isLoading,
    error,
    useBiometrics,
    setUseBiometrics,
  } = useContext(EmbeddedWalletContext);
  const { user } = useAuth();
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRetrieveForm, setShowRetrieveForm] = useState(false);
  const [showTokenClaimModal, setShowTokenClaimModal] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [userCreated, setUserCreated] = useState(false);
  const [showReferralPrompt, setShowReferralPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);

  const checkUserActivityTable = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('user_id')
        .limit(1);
      if (error && error.code === '42P01') {
        console.log('[checkUserActivityTable] Table does not exist');
        return false;
      }
      if (error) throw new Error(`Table check failed: ${error.message}`);
      console.log('[checkUserActivityTable] Table exists');
      return true;
    } catch (err) {
      console.error('[checkUserActivityTable] Error:', err.message);
      return false;
    }
  }, []);

  const checkUserActivityEntry = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('user_id')
        .eq('user_id', userId)
        .single();
      if (error && error.code === 'PGRST116') {
        console.log('[checkUserActivityEntry] No entry for user:', userId);
        return false;
      }
      if (error) throw new Error(`User activity check failed: ${error.message}`);
      console.log('[checkUserActivityEntry] Entry exists for user:', userId);
      return !!data;
    } catch (err) {
      console.error('[checkUserActivityEntry] Error:', err.message);
      return false;
    }
  }, []);

  const createUserAndBalance = useCallback(async (publicKey) => {
    if (!user || !publicKey) {
      setModalError('Invalid user or wallet');
      throw new Error('Invalid user or wallet');
    }
    if (typeof publicKey !== 'string') {
      throw new Error(`Invalid publicKey type: ${typeof publicKey}`);
    }
    try {
      // Verify authenticated user
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Auth error: ${authError.message}`);
      if (!authUser.user || authUser.user.id !== user.id) {
        console.error('[createUserAndBalance] Auth user mismatch:', {
          authUserId: authUser.user?.id,
          contextUserId: user.id,
        });
        throw new Error('Authenticated user mismatch');
      }
      console.log('[createUserAndBalance] Auth UID:', authUser.user.id);

      const { data: existingUser, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      let userId;

      if (!existingUser) {
        const userMetadata = authUser.user.user_metadata || {};
        console.log('[createUserAndBalance] Creating new user for:', user.email);
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            name: userMetadata.full_name || user.email.split('@')[0],
            image: userMetadata.avatar_url,
            wallet_address: publicKey,
            has_updated_profile: false,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('[createUserAndBalance] User creation error:', createError);
          throw new Error(`User creation failed: ${createError.message}`);
        }
        if (!newUser || !newUser.id) {
          console.error('[createUserAndBalance] User creation returned no data:', newUser);
          throw new Error('User creation succeeded but returned no data');
        }
        userId = newUser.id;
        console.log('[createUserAndBalance] User created:', userId);

        console.log('[createUserAndBalance] Inserting balance for user_id:', userId);
        const { error: balanceError } = await supabase
          .from('wallet_balances')
          .insert({
            user_id: userId,
            chain: 'SOL',
            currency: 'SMP',
            amount: 0,
            decimals: 6,
            wallet_address: publicKey,
          });

        if (balanceError) {
          console.error('[createUserAndBalance] Balance insert error:', balanceError);
          throw new Error(`Balance insert failed: ${balanceError.message}`);
        }
        console.log('[createUserAndBalance] Balance inserted for:', publicKey);
      } else {
        console.log('[createUserAndBalance] Updating existing user:', existingUser.id);
        const { error: updateError } = await supabase
          .from('users')
          .update({ wallet_address: publicKey })
          .eq('id', existingUser.id);

        if (updateError) {
          console.error('[createUserAndBalance] User update error:', updateError);
          throw new Error(`User update failed: ${updateError.message}`);
        }
        userId = existingUser.id;

        const { data: existingBalance, error: balanceCheckError } = await supabase
          .from('wallet_balances')
          .select('id')
          .eq('user_id', userId)
          .eq('chain', 'SOL')
          .eq('currency', 'SMP')
          .single();

        if (!existingBalance) {
          console.log('[createUserAndBalance] Inserting balance for user_id:', userId);
          const { error: balanceInsertError } = await supabase
            .from('wallet_balances')
            .insert({
              user_id: userId,
              chain: 'SOL',
              currency: 'SMP',
              amount: 0,
              decimals: 6,
              wallet_address: publicKey,
            });

          if (balanceInsertError) {
            console.error('[createUserAndBalance] Balance insert error:', balanceInsertError);
            throw new Error(`Balance insert failed: ${balanceInsertError.message}`);
          }
          console.log('[createUserAndBalance] Balance inserted for:', publicKey);
        } else {
          console.log('[createUserAndBalance] Balance already exists for:', userId);
        }
      }

      setUserCreated(true);
      setShowReferralPrompt(true);
      console.log('[createUserAndBalance] User and balance created/updated for:', publicKey);
      return userId;
    } catch (err) {
      console.error('[createUserAndBalance] Error:', err.message);
      setModalError('Failed to initialize user: ' + err.message);
      throw err;
    }
  }, [user]);

  const handleCreateWallet = useCallback(async () => {
    if (password !== confirmPassword) {
      setModalError('Passwords do not match');
      return;
    }
    if (!password || password.length < 8) {
      setModalError('Password must be at least 8 characters long');
      return;
    }
    try {
      setIsCreatingWallet(true);
      console.log('[handleCreateWallet] Creating wallet');
      const result = await createEmbeddedWallet(password);
      if (result) {
        await SecureStore.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false');
        const userId = await createUserAndBalance(result.publicKey);
        setShowPasswordSetup(false);
        setShowCreateForm(false);
        setShowModal(false);
        setIsCreateMode(false);

        const tableExists = await checkUserActivityTable();
        if (tableExists) {
          const hasActivityEntry = await checkUserActivityEntry(userId);
          if (!hasActivityEntry) {
            setShowTokenClaimModal(true);
            console.log('[handleCreateWallet] Showing TokenClaimModal for user:', userId);
          } else {
            console.log('[handleCreateWallet] User activity entry exists, skipping TokenClaimModal');
          }
        } else {
          Alert.alert('Info', 'Wallet created, but token claiming unavailable. Contact support.');
        }

        setPassword('');
        setConfirmPassword('');
      } else {
        setModalError('Failed to create wallet');
      }
    } catch (err) {
      console.error('[handleCreateWallet] Error:', err.message);
      setModalError('Failed to create wallet: ' + err.message);
    } finally {
      setIsCreatingWallet(false);
    }
  }, [password, confirmPassword, createEmbeddedWallet, useBiometrics, createUserAndBalance, checkUserActivityTable, checkUserActivityEntry]);

  const handleRetrieveWallet = useCallback(async () => {
    if (password !== confirmPassword) {
      setModalError('Passwords do not match');
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      setModalError('Password must be a string and at least 8 characters long');
      return;
    }
    try {
      setIsCreatingWallet(true);
      console.log('[handleRetrieveWallet] Starting wallet retrieval');
      const result = await retrieveEmbeddedWallet(password);
      if (result) {
        await SecureStore.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false');
        console.log('[handleRetrieveWallet] Biometrics preference stored:', useBiometrics);

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();
        if (userError || !userData) {
          throw new Error('User not found during retrieval');
        }

        setShowPasswordSetup(false);
        setShowRetrieveForm(false);
        setShowModal(false);
        setIsCreateMode(false);

        const tableExists = await checkUserActivityTable();
        if (tableExists) {
          const hasActivityEntry = await checkUserActivityEntry(userData.id);
          if (!hasActivityEntry) {
            setShowTokenClaimModal(true);
            console.log('[handleRetrieveWallet] Showing TokenClaimModal for user:', userData.id);
          } else {
            console.log('[handleRetrieveWallet] User activity entry exists, skipping TokenClaimModal');
          }
        } else {
          Alert.alert('Info', 'Wallet retrieved, but token claiming unavailable. Contact support.');
        }

        setPassword('');
        setConfirmPassword('');
        console.log('[handleRetrieveWallet] Wallet retrieved successfully for publicKey:', result.publicKey);
      } else {
        setModalError('Failed to retrieve wallet. Please ensure your account has a wallet or create a new one.');
        console.log('[handleRetrieveWallet] No result from retrieveEmbeddedWallet');
      }
    } catch (err) {
      console.error('[handleRetrieveWallet] Error:', err.message);
      setModalError('Failed to retrieve wallet: ' + err.message);
    } finally {
      setIsCreatingWallet(false);
    }
  }, [password, confirmPassword, retrieveEmbeddedWallet, useBiometrics, checkUserActivityTable, checkUserActivityEntry, user]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectWallet();
      setUserCreated(false);
      setShowReferralPrompt(false);
      Alert.alert('Success', 'Wallet disconnected');
    } catch (err) {
      console.error('[handleDisconnect] Error:', err.message);
      setModalError('Failed to disconnect wallet: ' + err.message);
    }
  }, [disconnectWallet]);

  const handleReferralPrompt = useCallback(async () => {
    try {
      const hasReferralCode = await AsyncStorage.getItem('hasReferralCode');
      if (!hasReferralCode) {
        Alert.alert(
          'Referral Code',
          'Add a referral code to earn rewards?',
          [
            {
              text: 'Yes',
              onPress: () => navigation.navigate('EditProfile'),
            },
            {
              text: 'No',
              onPress: () => AsyncStorage.setItem('hasReferralCode', 'skipped'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('[handleReferralPrompt] Error:', error.message);
    }
  }, [navigation]);

  const handleCloseModal = useCallback(() => {
    console.log('[handleCloseModal] Closing modal, resetting states');
    setShowModal(false);
    setShowCreateForm(false);
    setShowRetrieveForm(false);
    setShowPasswordSetup(false);
    setModalError(null);
    setPassword('');
    setConfirmPassword('');
    setUseBiometrics(false);
    setIsCreateMode(false);
  }, []);

  const renderModalContent = () => {
    console.log('[renderModalContent] States:', {
      showModal,
      showCreateForm,
      showRetrieveForm,
      showPasswordSetup,
      isCreateMode,
    });

    if (!user || user.isGuest) {
      return (
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Sign In Required</Text>
          <Text style={styles.modalText}>Sign in with an account to manage wallets.</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.actionButtonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCloseModal}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (showPasswordSetup) {
      return (
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {isCreateMode ? 'Create Wallet - Set Password' : 'Retrieve Wallet - Set Password'}
          </Text>
          <Text style={styles.modalText}>Set a password for transaction signing (minimum 8 characters).</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#888"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholderTextColor="#888"
          />
          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={[styles.checkbox, useBiometrics ? styles.checkboxSelected : null]}
              onPress={() => setUseBiometrics(!useBiometrics)}
            >
              {useBiometrics && <Text style={styles.checkboxText}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>Use biometrics for transaction signing</Text>
          </View>
          {modalError && <Text style={styles.errorText}>{modalError}</Text>}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={isCreateMode ? handleCreateWallet : handleRetrieveWallet}
            disabled={isCreatingWallet}
          >
            <Text style={styles.actionButtonText}>
              {isCreatingWallet ? 'Processing...' : 'Confirm'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCloseModal}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (showCreateForm) {
      return (
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create New Wallet</Text>
          <Text style={styles.modalText}>Creating wallet for {user.email}</Text>
          {modalError && <Text style={styles.errorText}>{modalError}</Text>}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              console.log('[Create Wallet] Transitioning to password setup for creation');
              setShowCreateForm(false);
              setShowRetrieveForm(false);
              setShowPasswordSetup(true);
              setIsCreateMode(true);
            }}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>{isLoading ? 'Creating...' : 'Create Wallet'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              console.log('[Create Wallet] Back to main modal');
              setShowCreateForm(false);
              setIsCreateMode(false);
            }}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (showRetrieveForm) {
      return (
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Retrieve Wallet</Text>
          <Text style={styles.modalText}>Retrieving wallet for {user.email}</Text>
          {modalError && <Text style={styles.errorText}>{modalError}</Text>}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              console.log('[Retrieve Wallet] Transitioning to password setup for retrieval');
              setShowRetrieveForm(false);
              setShowCreateForm(false);
              setShowPasswordSetup(true);
              setIsCreateMode(false);
            }}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>{isLoading ? 'Retrieving...' : 'Retrieve Wallet'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              console.log('[Retrieve Wallet] Back to main modal');
              setShowRetrieveForm(false);
              setIsCreateMode(false);
            }}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Connect Wallet</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            console.log('[Main Modal] Opening Create Wallet');
            setShowCreateForm(true);
            setShowRetrieveForm(false);
            setShowPasswordSetup(false);
            setIsCreateMode(true);
          }}
        >
          <Text style={styles.actionButtonText}>Create New Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            console.log('[Main Modal] Opening Retrieve Wallet');
            setShowRetrieveForm(true);
            setShowCreateForm(false);
            setShowPasswordSetup(false);
            setIsCreateMode(false);
          }}
        >
          <Text style={styles.actionButtonText}>Retrieve Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleCloseModal}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.connectButton, wallet ? styles.connectedButton : null]}
        onPress={() => {
          console.log('[ConnectButton] Pressed:', wallet ? 'Disconnect' : 'Connect');
          wallet ? handleDisconnect() : setShowModal(true);
        }}
        disabled={isLoading}
      >
        <Text style={styles.connectButtonText}>
          {isLoading
            ? 'Loading...'
            : wallet
            ? `${wallet.publicKey.toString().slice(0, 4)}...${wallet.publicKey.toString().slice(-4)}`
            : user && !user.isGuest
            ? 'Connect Wallet'
            : 'Sign In'}
        </Text>
      </TouchableOpacity>
      <Modal
        isVisible={showModal}
        onBackdropPress={handleCloseModal}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        {renderModalContent()}
      </Modal>
      <Modal
        isVisible={showReferralPrompt}
        onBackdropPress={() => setShowReferralPrompt(false)}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Complete Your Profile</Text>
          <Text style={styles.modalText}>Update your profile to unlock exclusive benefits.</Text>
          <TouchableOpacity style={styles.actionButton} onPress={handleReferralPrompt}>
            <Text style={styles.actionButtonText}>Update Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowReferralPrompt(false)}
          >
            <Text style={styles.secondaryButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <TokenClaimModal
        visible={showTokenClaimModal}
        onClose={() => setShowTokenClaimModal(false)}
        onTokenClaim={async () => {
          try {
            console.log('[TokenClaimModal] Invoking airdrop-function/airdrop for user:', user.id);
            if (!user?.id || !wallet?.publicKey) {
              throw new Error('User or wallet not available');
            }
            const { data, error } = await supabase.functions.invoke('airdrop-function/airdrop', {
              body: {
                user_id: user.id,
                wallet_address: wallet.publicKey.toString(),
              },
            });
            if (error) {
              console.error('[TokenClaimModal] Airdrop error details:', JSON.stringify(error, null, 2));
              throw new Error(error.message || 'Airdrop failed with non-2xx status code');
            }
            if (!data?.signature) {
              console.error('[TokenClaimModal] No signature in response:', JSON.stringify(data, null, 2));
              throw new Error('No transaction signature returned');
            }
            console.log('[TokenClaimModal] Airdrop signature:', data.signature);
            // Insert into airdrop_transactions
            const { error: txError } = await supabase
              .from('airdrop_transactions')
              .insert({
                user_id: user.id,
                wallet_address: wallet.publicKey.toString(),
                transaction_signature: data.signature,
                amount: 1000000, // 1 million Sempai Tokens
              });
            if (txError) {
              console.error('[TokenClaimModal] Failed to log airdrop transaction:', JSON.stringify(txError, null, 2));
              throw new Error(`Failed to log transaction: ${txError.message}`);
            }
            // Update wallet_balances
            const { error: balanceError } = await supabase
              .from('wallet_balances')
              .upsert(
                {
                  user_id: user.id,
                  chain: 'SOL',
                  currency: 'SMP',
                  amount: 1000000,
                  decimals: 6,
                  wallet_address: wallet.publicKey.toString(),
                },
                { onConflict: 'user_id,chain,currency' }
              );
            if (balanceError) {
              console.error('[TokenClaimModal] Failed to update balance:', JSON.stringify(balanceError, null, 2));
              throw new Error(`Failed to update balance: ${balanceError.message}`);
            }
            console.log('[TokenClaimModal] Wallet balance updated for user:', user.id);
            return data.signature;
          } catch (err) {
            console.error('[TokenClaimModal] onTokenClaim error:', err.message);
            throw err;
          }
        }}
      />
    </>
  );
};

export default ConnectButton;