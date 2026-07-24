import React, { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, TextInput, Clipboard, ToastAndroid, ActivityIndicator, ScrollView, Animated } from 'react-native';
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
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const EmbeddedWalletContext = createContext();

const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');

const WALLET_TYPES = {
  EMBEDDED: 'embedded'
};

const secureStoreWrapper = {
  setItemAsync: async (key, value, useBiometrics = false) => {
    try {
      if (typeof value !== 'string') {
        throw new Error(`Value for ${key} must be a string, got ${typeof value}`);
      }
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else if (useBiometrics) {
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
      } else {
        await SecureStore.setItemAsync(key, value);
      }
      console.log(`[secureStoreWrapper] Set ${key}`);
    } catch (err) {
      console.error(`[secureStoreWrapper] Failed to set ${key}:`, err.message);
      throw err;
    }
  },
  getItemAsync: async (key, useBiometrics = false) => {
    try {
      if (Platform.OS === 'web') {
        const value = localStorage.getItem(key);
        console.log(`[secureStoreWrapper] Got ${key}: ${value ? 'exists' : 'null'}`);
        return value;
      } else if (useBiometrics) {
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
      } else {
        const value = await SecureStore.getItemAsync(key);
        console.log(`[secureStoreWrapper] Got ${key}: ${value ? 'exists' : 'null'}`);
        return value;
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
      // Non-fatal: key may not exist yet
      console.warn(`[secureStoreWrapper] Error deleting ${key} (may not exist):`, err.message);
    }
  },
};

// Kept outside the component so encryptPrivateKey helpers can call it
const invokeEncryptionFunction = async (action, data) => {
  try {
    const webApiUrl = 'https://www.sempaihq.com/api/wallet-encryption';
    const response = await fetch(webApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, data }),
    });
    const responseData = await response.json();
    if (!response.ok || responseData.error) {
      console.error('[invokeEncryptionFunction] Error response:', responseData.error);
      throw new Error(`Edge function error: ${responseData.error || 'Unknown error'}`);
    }
    if (!responseData.result) {
      console.error('[invokeEncryptionFunction] No result in response:', responseData);
      throw new Error('No result returned from edge function');
    }
    return responseData.result;
  } catch (err) {
    console.error(`[invokeEncryptionFunction] ${action} failed:`, err.message);
    throw err;
  }
};

export const EmbeddedWalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [secretKey, setSecretKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [transactionPassword, setTransactionPassword] = useState(null);
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [resolveTransaction, setResolveTransaction] = useState(null);
  const [pendingMode, setPendingMode] = useState('send'); // 'send' | 'sign'

  const [walletType, setWalletType] = useState(null);
  const [showWalletSelection, setShowWalletSelection] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { user, isLoading: authLoading } = useAuth();

  // ─── Disconnect ─────────────────────────────────────────────────────────────

  const disconnectWallet = useCallback(async () => {
    try {
      console.log('[disconnectWallet] Disconnecting wallet');
      // Gracefully handle keys that may not exist yet
      await secureStoreWrapper.deleteItemAsync('walletData');
      await secureStoreWrapper.deleteItemAsync('useBiometrics');
      try { await AsyncStorage.removeItem('walletAddress'); } catch (_) {}
      setWallet(null);
      setSecretKey(null);
      setTransactionPassword(null);
      setUseBiometrics(false);
      setIsWalletConnected(false);
      setWalletType(null);
      setError(null);
      console.log('[disconnectWallet] Wallet disconnected');
    } catch (err) {
      console.error('[disconnectWallet] Error:', err.message);
      setError('Failed to disconnect wallet: ' + err.message);
    }
  }, []);

  // ─── Restore wallet on mount ─────────────────────────────────────────────────
  // Runs for ALL users (authenticated or not). Authenticated users additionally
  // verify the stored public key matches the database record.

  useEffect(() => {
    if (authLoading) return;

    const restoreWallet = async () => {
      try {
        setIsLoading(true);
        console.log('[restoreWallet] Starting restore. User:', user?.email ?? 'unauthenticated');

        const storedWalletType = await AsyncStorage.getItem('preferredWalletType');

        // Try to read stored wallet data (works for both auth states)
        const storedUseBiometrics = (await secureStoreWrapper.getItemAsync('useBiometrics', false)) === 'true';
        setUseBiometrics(storedUseBiometrics);

        const walletDataStr = await secureStoreWrapper.getItemAsync('walletData', storedUseBiometrics);
        if (!walletDataStr) {
          console.log('[restoreWallet] No embedded wallet data in storage');
          return;
        }

        let walletData;
        try {
          walletData = JSON.parse(walletDataStr);
        } catch (parseError) {
          console.error('[restoreWallet] Failed to parse wallet data:', parseError.message);
          throw new Error('Invalid wallet data format');
        }

        const { publicKey, encryptedPrivateKey, storedPassword } = walletData;
        if (!publicKey || !encryptedPrivateKey || !storedPassword) {
          console.log('[restoreWallet] Missing embedded wallet data fields');
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
        if (keypair.publicKey.toString() !== publicKey) {
          console.error('[restoreWallet] Public key mismatch:', {
            stored: publicKey,
            derived: keypair.publicKey.toString(),
          });
          throw new Error('Private key does not match stored public key');
        }

        // For authenticated users, verify the wallet still matches their DB record
        if (user && !user.isGuest) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, wallet_address')
            .eq('email', user.email)
            .single();

          if (userError) {
            console.warn('[restoreWallet] Supabase query failed, restoring anyway:', userError.message);
          } else if (userData && userData.wallet_address && userData.wallet_address !== publicKey) {
            console.log('[restoreWallet] Wallet mismatch with DB record, clearing');
            await disconnectWallet();
            return;
          }
        }

        setWallet({ publicKey: keypair.publicKey });
        setSecretKey(privateKeyBytes);
        setTransactionPassword(storedPassword);
        setIsWalletConnected(true);
        setWalletType(WALLET_TYPES.EMBEDDED);
        console.log('[restoreWallet] Embedded wallet restored:', publicKey);

      } catch (err) {
        console.error('[restoreWallet] Error:', err.message);
        setError('Failed to restore wallet: ' + err.message);
        // Only wipe if the data is genuinely corrupt; non-fatal read errors are
        // handled above. Here we still clear to avoid a broken state.
        try { await disconnectWallet(); } catch (_) {}
      } finally {
        setIsLoading(false);
      }
    };

    restoreWallet();
  }, [user, authLoading]); // intentionally omitting disconnectWallet to avoid loop

  // ─── Create ─────────────────────────────────────────────────────────────────

  const createEmbeddedWallet = useCallback(async (password) => {
    if (!user) throw new Error('Sign in with an account to create a wallet');
    if (user.isGuest) throw new Error('Guest accounts cannot create wallets. Please sign in with a full account.');
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be a string and at least 8 characters long');
    }
    try {
      setIsLoading(true);
      console.log('[createEmbeddedWallet] Creating embedded wallet for:', user.email);

      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Auth error: ${authError.message}`);
      if (!authUser.user || authUser.user.id !== user.id) throw new Error('Authenticated user mismatch');

      const keypair = solanaWeb3.Keypair.generate();
      const publicKey = keypair.publicKey;
      const secretKeyBytes = keypair.secretKey;
      const secretKeyBase58 = bs58.encode(secretKeyBytes);

      const encryptedPrivateKey = await invokeEncryptionFunction('encrypt', secretKeyBase58);
      const hashedPassword = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);

      let referralCode;
      let isUnique = false;
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      while (!isUnique) {
        referralCode = Array.from({ length: 8 }, () =>
          characters.charAt(Math.floor(Math.random() * characters.length))
        ).join('');
        const { data } = await supabase.from('users').select('id').eq('referral_code', referralCode).maybeSingle();
        isUnique = !data;
      }

      const userMetadata = authUser.user.user_metadata || {};
      const name  = userMetadata.full_name || user.email.split('@')[0];
      const email = user.email;
      const image = userMetadata.avatar_url || null;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert(
          { id: user.id, email, name, image, wallet_address: publicKey.toString(), referral_code: referralCode, has_updated_profile: false },
          { onConflict: 'id' }
        )
        .select('id')
        .single();

      if (userError) throw new Error(`User upsert failed: ${userError.message}`);
      if (!userData) throw new Error('User upsert succeeded but returned no data');

      const { error: walletError } = await supabase
        .from('user_wallets')
        .insert({ user_id: userData.id, address: publicKey.toString(), private_key: encryptedPrivateKey });
      if (walletError) throw new Error(`Wallet insert failed: ${walletError.message}`);

      const encryptedPrivateKeyForStore = await invokeEncryptionFunction('encrypt', secretKeyBase58);
      const walletData = {
        publicKey: publicKey.toString(),
        encryptedPrivateKey: encryptedPrivateKeyForStore,
        storedPassword: hashedPassword,
      };

      await secureStoreWrapper.setItemAsync('walletData', JSON.stringify(walletData), useBiometrics);
      await secureStoreWrapper.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false', false);
      await AsyncStorage.setItem('walletAddress', publicKey.toString());
      await AsyncStorage.setItem('preferredWalletType', WALLET_TYPES.EMBEDDED);

      setWallet({ publicKey });
      setSecretKey(secretKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      setWalletType(WALLET_TYPES.EMBEDDED);
      console.log('[createEmbeddedWallet] Embedded wallet created:', publicKey.toString());
      return { publicKey: publicKey.toString(), privateKey: secretKeyBase58 };
    } catch (err) {
      console.error('[createEmbeddedWallet] Error:', err.message);
      setError('Failed to create embedded wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, useBiometrics]);

  // ─── Retrieve ────────────────────────────────────────────────────────────────

  const retrieveEmbeddedWallet = useCallback(async (password) => {
    if (!user) throw new Error('Sign in with an account to retrieve a wallet');
    if (user.isGuest) throw new Error('Guest accounts cannot retrieve wallets. Please sign in with a full account.');
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be a string and at least 8 characters long');
    }
    try {
      setIsLoading(true);
      console.log('[retrieveEmbeddedWallet] Retrieving embedded wallet for:', user.email);

      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser.user || authUser.user.id !== user.id) {
        throw new Error('Authenticated user mismatch');
      }

      try { await disconnectWallet(); } catch (_) {}

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, wallet_address')
        .eq('email', user.email)
        .single();
      if (userError || !userData) throw new Error('User not found. Please ensure your account is registered.');
      if (!userData.wallet_address) throw new Error('No wallet address associated with this user. Please create a new wallet.');

      const { data: walletData, error: walletError } = await supabase
        .from('user_wallets')
        .select('address, private_key')
        .eq('user_id', userData.id)
        .eq('address', userData.wallet_address)
        .single();
      if (walletError || !walletData) throw new Error('No wallet found for this user. Please create a new wallet or contact support.');
      if (typeof walletData.address !== 'string' || typeof walletData.private_key !== 'string') {
        throw new Error('Invalid wallet data format in database.');
      }

      const privateKeyBase58 = await invokeEncryptionFunction('decrypt', walletData.private_key);
      const privateKeyBytes  = bs58.decode(privateKeyBase58);
      if (privateKeyBytes.length !== 64) {
        throw new Error(`Invalid private key format after decryption: length ${privateKeyBytes.length}`);
      }

      const keypair      = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const publicKey    = keypair.publicKey;
      const publicKeyStr = publicKey.toString();

      if (publicKeyStr !== walletData.address) throw new Error('Public key mismatch. Please contact support.');

      const hashedPassword = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);

      const encryptedPrivateKeyForStore = await invokeEncryptionFunction('encrypt', privateKeyBase58);

      const walletDataObj = {
        publicKey: publicKeyStr,
        encryptedPrivateKey: encryptedPrivateKeyForStore,
        storedPassword: hashedPassword,
      };

      await secureStoreWrapper.setItemAsync('walletData', JSON.stringify(walletDataObj), useBiometrics);
      await secureStoreWrapper.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false', false);
      await AsyncStorage.setItem('walletAddress', publicKeyStr);
      await AsyncStorage.setItem('preferredWalletType', WALLET_TYPES.EMBEDDED);

      setWallet({ publicKey });
      setSecretKey(privateKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      setWalletType(WALLET_TYPES.EMBEDDED);
      console.log('[retrieveEmbeddedWallet] Embedded wallet retrieved:', publicKeyStr);
      return { publicKey: publicKeyStr, privateKey: privateKeyBase58 };
    } catch (err) {
      console.error('[retrieveEmbeddedWallet] Error:', err.message);
      setError(`Failed to retrieve embedded wallet: ${err.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, useBiometrics, disconnectWallet]);

  // ─── Import wallet ───────────────────────────────────────────────────────────

  const importWalletFromPrivateKey = useCallback(async (privateKeyInput, password) => {
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be a string and at least 8 characters long');
    }
    if (!privateKeyInput || typeof privateKeyInput !== 'string') {
      throw new Error('Private key is required');
    }

    try {
      setIsLoading(true);
      console.log('[importWalletFromPrivateKey] Importing wallet');

      try { await disconnectWallet(); } catch (_) {}

      // Validate private key
      let privateKeyBytes;
      try {
        privateKeyBytes = bs58.decode(privateKeyInput.trim());
      } catch (decodeError) {
        throw new Error('Invalid private key format. Please enter a valid Base58 private key.');
      }

      if (privateKeyBytes.length !== 64) {
        throw new Error(`Invalid private key length: expected 64 bytes, got ${privateKeyBytes.length}`);
      }

      const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = keypair.publicKey;
      const publicKeyStr = publicKey.toString();
      const privateKeyBase58 = bs58.encode(privateKeyBytes);

      const hashedPassword = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);

      // Use edge function for encryption
      const encryptedPrivateKey = await invokeEncryptionFunction('encrypt', privateKeyBase58);

      // Only perform database operations if user is authenticated
      if (user && !user.isGuest) {
        try {
          const { data: authUser, error: authError } = await supabase.auth.getUser();
          if (authError || !authUser.user || authUser.user.id !== user.id) {
            console.log('[importWalletFromPrivateKey] Skipping database linking - user not authenticated');
          } else {
            const { data: existingWallet } = await supabase
              .from('user_wallets')
              .select('id, user_id')
              .eq('address', publicKeyStr)
              .maybeSingle();

            if (!existingWallet) {
              const { error: walletError } = await supabase
                .from('user_wallets')
                .insert({ user_id: user.id, address: publicKeyStr, private_key: encryptedPrivateKey });
              if (walletError) {
                console.log('[importWalletFromPrivateKey] Database insert failed (non-fatal):', walletError.message);
              } else {
                const { error: userUpdateError } = await supabase
                  .from('users')
                  .update({ wallet_address: publicKeyStr })
                  .eq('id', user.id);
                if (userUpdateError) {
                  console.log('[importWalletFromPrivateKey] User update failed (non-fatal):', userUpdateError.message);
                } else {
                  console.log('[importWalletFromPrivateKey] Wallet linked to account:', publicKeyStr);
                }
              }
            } else {
              console.log('[importWalletFromPrivateKey] Wallet already exists in database:', publicKeyStr);
            }
          }
        } catch (dbError) {
          console.log('[importWalletFromPrivateKey] Database linking skipped (non-fatal):', dbError.message);
        }
      }

      // Store wallet locally
      const encryptedPrivateKeyForStore = await invokeEncryptionFunction('encrypt', privateKeyBase58);
      const walletData = {
        publicKey: publicKeyStr,
        encryptedPrivateKey: encryptedPrivateKeyForStore,
        storedPassword: hashedPassword,
      };

      await secureStoreWrapper.setItemAsync('walletData', JSON.stringify(walletData), useBiometrics);
      await secureStoreWrapper.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false', false);
      await AsyncStorage.setItem('walletAddress', publicKeyStr);
      await AsyncStorage.setItem('preferredWalletType', WALLET_TYPES.EMBEDDED);

      setWallet({ publicKey });
      setSecretKey(privateKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      setWalletType(WALLET_TYPES.EMBEDDED);
      console.log('[importWalletFromPrivateKey] Wallet imported and connected:', publicKeyStr);
      return { publicKey: publicKeyStr, privateKey: privateKeyBase58 };
    } catch (err) {
      console.error('[importWalletFromPrivateKey] Error:', err.message);
      setError(`Failed to import wallet: ${err.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, useBiometrics, disconnectWallet]);

  // ─── Password verification ───────────────────────────────────────────────────

  const verifyPassword = useCallback(async (password) => {
    if (!transactionPassword) return false;
    const hashedInput = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
    return hashedInput === transactionPassword;
  }, [transactionPassword]);

  // ─── Sign & send ─────────────────────────────────────────────────────────────

  const signAndSendTransaction = useCallback(async (transaction, inputPassword) => {
    try {
      console.log('[signAndSendTransaction] Starting. Wallet type:', walletType);

      console.log('[signAndSendTransaction] Using embedded wallet');
      const biometricsEnabled = (await AsyncStorage.getItem('useBiometrics')) === 'true';

      if (!biometricsEnabled && !inputPassword) {
        console.log('[signAndSendTransaction] No password provided, showing modal');
        setPendingTransaction(transaction);
        setPendingMode('send');
        setPasswordModalVisible(true);
        return new Promise((resolve, reject) => {
          setResolveTransaction({ resolve, reject });
        });
      }

      if (!wallet?.publicKey) throw new Error('No wallet connected');
      if (!transaction)       throw new Error('No transaction provided');

      // Only verify password if biometrics is not enabled
      if (!biometricsEnabled && inputPassword) {
        const isValid = await verifyPassword(inputPassword);
        if (!isValid) throw new Error('Invalid transaction password');
      }

      // Retrieve and decrypt stored private key
      // When biometrics is enabled, this will trigger biometric authentication
      let privateKeyBase58;
      try {
        const walletDataStr = await secureStoreWrapper.getItemAsync('walletData', biometricsEnabled);
        if (!walletDataStr) throw new Error('Wallet data unavailable');

        const walletData = JSON.parse(walletDataStr);
        if (!walletData.encryptedPrivateKey) throw new Error('Private key unavailable');

        // Use edge function for decryption
        privateKeyBase58 = await invokeEncryptionFunction('decrypt', walletData.encryptedPrivateKey);
      } catch (err) {
        console.error('[signAndSendTransaction] Error retrieving/decrypting wallet data:', err);
        throw new Error('Failed to retrieve or decrypt wallet data: ' + err.message);
      }

      const privateKeyBytes = bs58.decode(privateKeyBase58);
      const keypair         = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);

      if (wallet.publicKey.toString() !== keypair.publicKey.toString()) {
        throw new Error('Private key does not match wallet public key');
      }

      if (!transaction.feePayer) {
        transaction.feePayer = keypair.publicKey;
      }

      if (transaction instanceof solanaWeb3.VersionedTransaction) {
        console.log('[signAndSendTransaction] Handling VersionedTransaction');
        transaction.sign([keypair]);
        const serializedTx = transaction.serialize();
        const signature    = await connection.sendRawTransaction(serializedTx, { skipPreflight: false, maxRetries: 3 });
        console.log('[signAndSendTransaction] VersionedTransaction sent:', signature);
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        console.log('[signAndSendTransaction] VersionedTransaction confirmed:', signature);
        return signature;
      } else {
        console.log('[signAndSendTransaction] Handling legacy transaction');
        const signature    = await connection.sendTransaction(transaction, [keypair]);
        console.log('[signAndSendTransaction] Legacy transaction sent:', signature);
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        console.log('[signAndSendTransaction] Legacy transaction confirmed:', signature);
        return signature;
      }

    } catch (err) {
      console.error('[signAndSendTransaction] Error:', err.message);
      let errorMessage = 'Transaction failed';
      if (err.message.includes('insufficient funds'))          errorMessage = 'Insufficient SOL balance for this transaction';
      else if (err.message.includes('Invalid transaction password')) errorMessage = 'Invalid password. Please check your credentials.';
      else if (err.message.includes('Private key does not match'))   errorMessage = 'Wallet security error. Please reconnect your wallet.';
      else if (err.message.includes('network'))               errorMessage = 'Network error. Please check your internet connection.';
      else if (err.message.includes('timeout'))               errorMessage = 'Transaction timed out. Please try again.';
      throw new Error(errorMessage);
    }
  }, [walletType, wallet, verifyPassword]);

  // ─── Sign only (without sending) ──────────────────────────────────────────────

  const signTransactionOnly = useCallback(async (transaction, inputPassword) => {
    try {
      console.log('[signTransactionOnly] Starting. Wallet type:', walletType);

      const biometricsEnabled = (await AsyncStorage.getItem('useBiometrics')) === 'true';

      if (!biometricsEnabled && !inputPassword) {
        console.log('[signTransactionOnly] No password provided, showing modal');
        setPendingTransaction(transaction);
        setPendingMode('sign');
        setPasswordModalVisible(true);
        return new Promise((resolve, reject) => {
          setResolveTransaction({ resolve, reject });
        });
      }

      if (!wallet?.publicKey) throw new Error('No wallet connected');
      if (!transaction)       throw new Error('No transaction provided');

      // Only verify password if biometrics is not enabled
      if (!biometricsEnabled && inputPassword) {
        const isValid = await verifyPassword(inputPassword);
        if (!isValid) throw new Error('Invalid transaction password');
      }

      // Retrieve and decrypt stored private key
      let privateKeyBase58;
      try {
        const walletDataStr = await secureStoreWrapper.getItemAsync('walletData', biometricsEnabled);
        if (!walletDataStr) throw new Error('Wallet data unavailable');

        const walletData = JSON.parse(walletDataStr);
        if (!walletData.encryptedPrivateKey) throw new Error('Private key unavailable');

        // Use edge function for decryption
        privateKeyBase58 = await invokeEncryptionFunction('decrypt', walletData.encryptedPrivateKey);
      } catch (err) {
        console.error('[signTransactionOnly] Error retrieving/decrypting wallet data:', err);
        throw new Error('Failed to retrieve or decrypt wallet data: ' + err.message);
      }

      const privateKeyBytes = bs58.decode(privateKeyBase58);
      const keypair         = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);

      if (wallet.publicKey.toString() !== keypair.publicKey.toString()) {
        throw new Error('Private key does not match wallet public key');
      }

      if (!transaction.feePayer) {
        transaction.feePayer = keypair.publicKey;
      }

      if (transaction instanceof solanaWeb3.VersionedTransaction) {
        console.log('[signTransactionOnly] Handling VersionedTransaction');
        transaction.sign([keypair]);
        return Buffer.from(transaction.serialize()).toString('base64');
      } else {
        console.log('[signTransactionOnly] Handling legacy transaction');
        transaction.partialSign(keypair);
        return transaction.serialize().toString('base64');
      }

    } catch (err) {
      console.error('[signTransactionOnly] Error:', err.message);
      let errorMessage = 'Transaction signing failed';
      if (err.message.includes('Invalid transaction password')) errorMessage = 'Invalid password. Please check your credentials.';
      else if (err.message.includes('Private key does not match'))   errorMessage = 'Wallet security error. Please reconnect your wallet.';
      else if (err.message.includes('network'))               errorMessage = 'Network error. Please check your internet connection.';
      throw new Error(errorMessage);
    }
  }, [walletType, wallet, verifyPassword]);

  // ─── Provider ────────────────────────────────────────────────────────────────

  return (
    <EmbeddedWalletContext.Provider
      value={{
        wallet,
        secretKey,
        isWalletConnected,
        walletType,
        createEmbeddedWallet,
        retrieveEmbeddedWallet,
        importWalletFromPrivateKey,
        disconnectWallet,
        signAndSendTransaction,
        signTransactionOnly,
        isLoading,
        error,
        useBiometrics,
        setUseBiometrics,
        showModal,
        setShowModal,
      }}
    >
      {children}
      <PasswordModal
        isVisible={isPasswordModalVisible}
        onClose={() => {
          setPasswordModalVisible(false);
          if (resolveTransaction) {
            resolveTransaction.reject(new Error('Password entry cancelled'));
          }
        }}
        onSubmit={async (password) => {
          setPasswordModalVisible(false);
          if (pendingTransaction && resolveTransaction) {
            try {
              const result = pendingMode === 'sign'
                ? await signTransactionOnly(pendingTransaction, password)
                : await signAndSendTransaction(pendingTransaction, password);
              resolveTransaction.resolve(result);
            } catch (error) {
              resolveTransaction.reject(error);
            }
          }
        }}
        onUseBiometrics={async () => {
          if (pendingTransaction && resolveTransaction) {
            try {
              console.log('[onUseBiometrics] Starting biometric authentication...');

              // Enable biometrics for this transaction
              await setUseBiometrics(true);
              await AsyncStorage.setItem('useBiometrics', 'true');
              console.log('[onUseBiometrics] Biometrics enabled in state');

              setPasswordModalVisible(false);
              console.log('[onUseBiometrics] Modal closed, signing transaction...');
              const result = pendingMode === 'sign'
                ? await signTransactionOnly(pendingTransaction)
                : await signAndSendTransaction(pendingTransaction);
              console.log('[onUseBiometrics] Transaction signed:', result);
              resolveTransaction.resolve(result);
            } catch (error) {
              console.error('[onUseBiometrics] Error:', error);
              // Re-open modal to allow password entry as fallback
              setPasswordModalVisible(true);
              // Don't reject yet - let user try password
              // Only reject if they cancel the modal
            }
          }
        }}
      />
      <WalletSelectionModal
        isVisible={showWalletSelection}
        onClose={() => setShowWalletSelection(false)}
        onSelectEmbedded={() => {
          setWalletType(WALLET_TYPES.EMBEDDED);
          setShowWalletSelection(false);
          AsyncStorage.setItem('preferredWalletType', WALLET_TYPES.EMBEDDED);
        }}
      />
      <WalletConnectionModal
        isVisible={showModal}
        onClose={() => setShowModal(false)}
      />
    </EmbeddedWalletContext.Provider>
  );
};

// ─── Password Modal ───────────────────────────────────────────────────────────

const PasswordModal = ({ isVisible, onClose, onSubmit, onUseBiometrics }) => {
  const [password, setPassword] = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const hasHardware = await SecureStore.isAvailableAsync();
        setBiometricsAvailable(hasHardware);
      } catch (error) {
        setBiometricsAvailable(false);
      }
    };
    if (isVisible) {
      checkBiometrics();
    }
  }, [isVisible]);

  const handleSubmit = () => {
    onSubmit(password);
    setPassword('');
  };

  const handleBiometrics = () => {
    if (onUseBiometrics) {
      onUseBiometrics();
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Authenticate Transaction</Text>
        <Text style={styles.modalText}>Choose your authentication method:</Text>
        
        {biometricsAvailable && onUseBiometrics && (
          <TouchableOpacity style={styles.actionButton} onPress={handleBiometrics}>
            <FontAwesome5 name="fingerprint" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.actionButtonText}>Use Fingerprint</Text>
          </TouchableOpacity>
        )}
        
        <Text style={[styles.modalText, { marginTop: biometricsAvailable && onUseBiometrics ? 16 : 8, marginBottom: 8 }]}>
          {biometricsAvailable && onUseBiometrics ? 'Or enter password:' : 'Enter your password:'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.actionButton} onPress={handleSubmit}>
          <Text style={styles.actionButtonText}>Submit Password</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ─── Wallet Selection Modal ───────────────────────────────────────────────────

const WalletSelectionModal = ({ isVisible, onClose, onSelectEmbedded }) => {

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Choose Wallet Type</Text>
        <Text style={styles.modalText}>Select how you want to manage your crypto assets:</Text>

        <TouchableOpacity style={styles.walletOption} onPress={onSelectEmbedded}>
          <View style={styles.walletOptionHeader}>
            <MaterialCommunityIcons name="wallet-outline" size={24} color="#FF5733" />
            <Text style={styles.walletOptionTitle}>Sempai Embedded Wallet</Text>
          </View>
          <Text style={styles.walletOptionDescription}>
            Secure, password-protected wallet with biometric support. Easy backup and recovery through your account.
          </Text>
          <View style={styles.walletOptionFeatures}>
            <Text style={styles.walletOptionFeature}>✓ Password & Biometric Protection</Text>
            <Text style={styles.walletOptionFeature}>✓ Account-based Recovery</Text>
            <Text style={styles.walletOptionFeature}>✓ Cross-device Sync</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ─── Connect Button ───────────────────────────────────────────────────────────

const ConnectButton = ({ compact = false, label }) => {
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet          = walletContext?.wallet;
  const walletType      = walletContext?.walletType;
  const isLoading       = walletContext?.isLoading;
  const disconnectWallet  = walletContext?.disconnectWallet;
  const { user } = useAuth();
  const [showDropdown, setShowDropdown]           = useState(false);
  const [showReferralPrompt, setShowReferralPrompt] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  if (!walletContext) {
    const [localShowModal, setLocalShowModal] = useState(false);
    return (
      <>
        <TouchableOpacity
          onPress={() => setLocalShowModal(true)}
          style={[styles.connectButtonWrapper, compact && styles.connectButtonWrapperCompact]}
        >
          <LinearGradient
            colors={['#FF5733', '#F36316']}
            style={styles.connectButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.connectButtonText}>Connect Wallet</Text>
          </LinearGradient>
        </TouchableOpacity>
        <WalletConnectionModal
          isVisible={localShowModal}
          onClose={() => setLocalShowModal(false)}
        />
      </>
    );
  }

  const handleReferralPrompt = () => setShowReferralPrompt(false);

  const getWalletLabel = () => {
    if (walletType === WALLET_TYPES.EMBEDDED) return 'Embedded';
    return null;
  };

  const renderDropdown = () => {
    if (!showDropdown || !wallet) return null;
    return (
      <View style={styles.dropdown} pointerEvents="auto">
        <View style={styles.dropdownHeader}>
          <Text style={styles.dropdownTitle}>Wallet Options</Text>
          <TouchableOpacity onPress={() => setShowDropdown(false)}>
            <MaterialCommunityIcons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={styles.dropdownItem}>
          <Text style={styles.dropdownItemText}>Type: {getWalletLabel()}</Text>
        </View>
        <View style={styles.dropdownItem}>
          <Text style={styles.dropdownItemText}>
            Address: {wallet.publicKey.toString().slice(0, 4)}...{wallet.publicKey.toString().slice(-4)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.dropdownAction}
          onPress={() => {
            Clipboard.setString(wallet.publicKey.toString());
            Alert.alert('Copied', 'Wallet address copied to clipboard');
          }}
        >
          <Text style={styles.dropdownActionText}>Copy Address</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dropdownAction, styles.disconnectAction]}
          onPress={() => { setShowDropdown(false); setShowDisconnectModal(true); }}
        >
          <Text style={[styles.dropdownActionText, styles.disconnectActionText]}>Disconnect Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDisconnectModal = () => {
    if (!showDisconnectModal) return null;
    return (
      <Modal
        isVisible={showDisconnectModal}
        onBackdropPress={() => setShowDisconnectModal(false)}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Disconnect Wallet</Text>
          <Text style={styles.modalText}>
            Are you sure you want to disconnect your {getWalletLabel()} wallet?
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={async () => { await disconnectWallet(); setShowDisconnectModal(false); }}
          >
            <Text style={styles.actionButtonText}>Disconnect</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowDisconnectModal(false)}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.connectButtonWrapper, compact && styles.connectButtonWrapperCompact]}
          onPress={() => {
            if (wallet) {
              setShowDropdown((prev) => !prev);
            } else {
              walletContext?.setShowModal?.(true);
            }
          }}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#FF5733', '#FF7F50']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.connectButtonGradient, compact && styles.connectButtonGradientCompact]}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={[styles.connectButtonText, compact && styles.connectButtonTextCompact]}>Load</Text>
              </View>
            ) : wallet ? (
              <View style={styles.walletInfoContainer}>
                <View style={styles.walletAddressContainer}>
                  <MaterialCommunityIcons
                    name="wallet-outline"
                    size={14}
                    color="#ffffff"
                    style={styles.walletIcon}
                  />
                  <Text style={[styles.connectButtonText, compact && styles.connectButtonTextCompact]}>
                    {getWalletLabel()}: {wallet.publicKey.toString().slice(0, 2)}...{wallet.publicKey.toString().slice(-2)}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={showDropdown ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#ffffff"
                  style={styles.dropdownIcon}
                />
              </View>
            ) : (
              <View style={styles.walletInfoContainer}>
                <MaterialCommunityIcons name="wallet-plus-outline" size={14} color="#ffffff" style={styles.walletIcon} />
                <Text style={[styles.connectButtonText, compact && styles.connectButtonTextCompact]}>
                  {label ? label : (user && !user.isGuest ? 'Connect' : 'Sign In')}
                </Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
        {renderDropdown()}
        {renderDisconnectModal()}
      </View>
    </>
  );
};

// ─── Wallet Connection Modal ──────────────────────────────────────────────────

const WalletConnectionModal = ({ isVisible, onClose }) => {
  const walletContext = useContext(EmbeddedWalletContext);
  const createEmbeddedWallet  = walletContext?.createEmbeddedWallet;
  const retrieveEmbeddedWallet = walletContext?.retrieveEmbeddedWallet;
  const importWalletFromPrivateKey = walletContext?.importWalletFromPrivateKey;
  const { user } = useAuth();

  const [mode, setMode]                   = useState('menu');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [hasExistingWallet, setHasExistingWallet] = useState(false);
  const [loading, setLoading]             = useState(false);
  const [fadeAnim]  = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  if (!walletContext) {
    return (
      <Modal isVisible={isVisible} onBackdropPress={onClose}>
        <View style={styles.container}>
          <Text style={styles.modalTitle}>Wallet Context Not Available</Text>
          <Text style={styles.modalText}>Please restart the app and try again.</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalButton}>
            <Text style={styles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  useEffect(() => {
    const checkExistingWallet = async () => {
      if (user && !user.isGuest) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('email', user.email)
            .single();
          const hasWallet = !!userData?.wallet_address;
          setHasExistingWallet(hasWallet);

          if (hasWallet) {
            try {
              const storedWalletData = await AsyncStorage.getItem('walletAddress');
              const storedWalletType = await AsyncStorage.getItem('preferredWalletType');
              if (storedWalletData !== userData.wallet_address || storedWalletType !== WALLET_TYPES.EMBEDDED) {
                setMode('retrieve');
              }
            } catch (error) {
              console.log('[WalletConnectionModal] Error checking local wallet:', error.message);
            }
          }
        } catch (error) {
          console.log('[WalletConnectionModal] Error checking existing wallet:', error.message);
        }
      }
    };

    if (isVisible) {
      checkExistingWallet();
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      scaleAnim.setValue(0.9);
      setMode('menu');
    }
  }, [isVisible, user]);

  const handleModeChange = (newMode) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,    duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setMode(newMode);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleCreateWallet = async () => {
    if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    if (hasExistingWallet) {
      Alert.alert('Wallet Exists', 'You already have a wallet linked to this account. Please use the Restore option instead.');
      return;
    }
    setLoading(true);
    try {
      const result = await createEmbeddedWallet(password);
      if (result) { Alert.alert('Success', 'Embedded wallet created successfully!'); onClose(); }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieveWallet = async () => {
    setLoading(true);
    try {
      const result = await retrieveEmbeddedWallet(password);
      if (result) { Alert.alert('Success', 'Embedded wallet retrieved successfully!'); onClose(); }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };


  const handleImportWallet = async () => {
    if (!password || password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }
    if (!confirmPassword || password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const result = await importWalletFromPrivateKey(privateKeyInput, password);
      if (result) {
        Alert.alert('Success', 'Wallet imported successfully!');
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      style={styles.modal}
      animationIn="fadeIn"
      animationOut="fadeOut"
      backdropOpacity={0.6}
    >
      <Animated.View
        style={[
          styles.modalContent,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }
        ]}
      >
        {mode === 'menu' && (
          <>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="wallet-outline" size={48} color="#FF5733" />
              <Text style={styles.modalTitle}>Choose Your Wallet</Text>
              <Text style={styles.modalSubtitle}>Select how you want to manage your crypto assets</Text>
            </View>

            <TouchableOpacity style={styles.walletOption} onPress={() => handleModeChange('create')} activeOpacity={0.7}>
              <LinearGradient colors={['rgba(255, 87, 51, 0.1)', 'rgba(255, 87, 51, 0.05)']} style={styles.walletOptionGradient}>
                <View style={styles.walletOptionHeader}>
                  <View style={styles.walletIconContainer}>
                    <MaterialCommunityIcons name="plus-circle" size={28} color="#FF5733" />
                  </View>
                  <View style={styles.walletOptionTextContainer}>
                    <Text style={styles.walletOptionTitle}>Create New Wallet</Text>
                    <Text style={styles.walletOptionDescription}>Generate a new secure wallet with password protection</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#FF5733" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.walletOption} onPress={() => handleModeChange('retrieve')} activeOpacity={0.7}>
              <LinearGradient colors={['rgba(76, 175, 80, 0.1)', 'rgba(76, 175, 80, 0.05)']} style={styles.walletOptionGradient}>
                <View style={styles.walletOptionHeader}>
                  <View style={[styles.walletIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
                    <MaterialCommunityIcons name="download" size={28} color="#4CAF50" />
                  </View>
                  <View style={styles.walletOptionTextContainer}>
                    <Text style={[styles.walletOptionTitle, { color: '#4CAF50' }]}>Restore Wallet</Text>
                    <Text style={styles.walletOptionDescription}>
                      {hasExistingWallet ? 'Access your existing wallet linked to this account' : 'Access your existing wallet with your password'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#4CAF50" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.walletOption} onPress={() => handleModeChange('import')} activeOpacity={0.7}>
              <LinearGradient colors={['rgba(156, 39, 176, 0.1)', 'rgba(156, 39, 176, 0.05)']} style={styles.walletOptionGradient}>
                <View style={styles.walletOptionHeader}>
                  <View style={[styles.walletIconContainer, { backgroundColor: 'rgba(156, 39, 176, 0.15)' }]}>
                    <MaterialCommunityIcons name="key" size={28} color="#9C27B0" />
                  </View>
                  <View style={styles.walletOptionTextContainer}>
                    <Text style={[styles.walletOptionTitle, { color: '#9C27B0' }]}>Import Wallet</Text>
                    <Text style={styles.walletOptionDescription}>Import an existing wallet using your private key</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#9C27B0" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'create' && (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => handleModeChange('menu')}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FF5733" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <View style={styles.formHeader}>
              <View style={[styles.formIconContainer, { backgroundColor: 'rgba(255, 87, 51, 0.15)' }]}>
                <MaterialCommunityIcons name="plus-circle" size={32} color="#FF5733" />
              </View>
              <Text style={styles.modalTitle}>Create New Wallet</Text>
              <Text style={styles.modalSubtitle}>Set a secure password to protect your wallet</Text>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput style={styles.input} placeholder="Min 8 characters" secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor="#999" />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput style={styles.input} placeholder="Re-enter password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholderTextColor="#999" />
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={handleCreateWallet} disabled={loading} activeOpacity={0.8}>
              <LinearGradient colors={['#FF5733', '#FF7F50']} style={styles.actionButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.actionButtonText}>Create Wallet</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {mode === 'retrieve' && (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => handleModeChange('menu')}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#4CAF50" />
              <Text style={[styles.backButtonText, { color: '#4CAF50' }]}>Back</Text>
            </TouchableOpacity>
            <View style={styles.formHeader}>
              <View style={[styles.formIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
                <MaterialCommunityIcons name="download" size={32} color="#4CAF50" />
              </View>
              <Text style={[styles.modalTitle, { color: '#4CAF50' }]}>Restore Wallet</Text>
              <Text style={styles.modalSubtitle}>
                {hasExistingWallet ? 'Enter your password to access your wallet' : 'Enter your password to access your existing wallet'}
              </Text>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput style={styles.input} placeholder="Enter your wallet password" secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor="#999" />
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={handleRetrieveWallet} disabled={loading} activeOpacity={0.8}>
              <LinearGradient colors={['#4CAF50', '#66BB6A']} style={styles.actionButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.actionButtonText}>Restore Wallet</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {mode === 'import' && (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => handleModeChange('menu')}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#9C27B0" />
              <Text style={[styles.backButtonText, { color: '#9C27B0' }]}>Back</Text>
            </TouchableOpacity>
            <View style={styles.formHeader}>
              <View style={[styles.formIconContainer, { backgroundColor: 'rgba(156, 39, 176, 0.15)' }]}>
                <MaterialCommunityIcons name="key" size={32} color="#9C27B0" />
              </View>
              <Text style={[styles.modalTitle, { color: '#9C27B0' }]}>Import Wallet</Text>
              <Text style={styles.modalSubtitle}>Enter your private key and set a password to secure your wallet</Text>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Private Key</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter your private key (base58)" 
                value={privateKeyInput} 
                onChangeText={setPrivateKeyInput} 
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput style={styles.input} placeholder="Min 8 characters" secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor="#999" />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput style={styles.input} placeholder="Re-enter password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholderTextColor="#999" />
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={handleImportWallet} disabled={loading} activeOpacity={0.8}>
              <LinearGradient colors={['#9C27B0', '#BA68C8']} style={styles.actionButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.actionButtonText}>Import Wallet</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </Modal>
  );
};

export default ConnectButton;
