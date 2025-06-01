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
        return localStorage.getItem(key);
      } else {
        try {
          return await SecureStore.getItemAsync(key, {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to access your wallet',
            authenticationType: SecureStore.AUTHENTICATION_TYPE?.BIOMETRIC,
          });
        } catch (biometricError) {
          console.warn('[secureStoreWrapper] Biometric failed, using fallback:', biometricError.message);
          return await SecureStore.getItemAsync(key);
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
        const privateKeyBase58 = await secureStoreWrapper.getItemAsync('walletPrivateKey');
        const storedPassword = await secureStoreWrapper.getItemAsync('transactionPassword');
        const biometricsEnabled = await SecureStore.getItemAsync('useBiometrics') === 'true';

        if (publicKeyStr && privateKeyBase58 && storedPassword) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('email', user.email)
            .single();
          if (userError) throw new Error(`Supabase user query failed: ${userError.message}`);
          if (userData && userData.wallet_address === publicKeyStr) {
            const privateKeyBytes = bs58.decode(privateKeyBase58);
            if (privateKeyBytes.length !== 64) {
              throw new Error('Invalid private key format');
            }
            const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
            if (keypair.publicKey.toString() !== publicKeyStr) {
              throw new Error('Private key mismatch');
            }
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
        } else {
          console.log('[restoreWallet] No wallet in storage');
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
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    try {
      setIsLoading(true);
      console.log('[createEmbeddedWallet] Creating wallet for:', user.email);
      const keypair = solanaWeb3.Keypair.generate();
      const publicKey = keypair.publicKey;
      const secretKeyBytes = keypair.secretKey;
      const secretKeyBase58 = bs58.encode(secretKeyBytes);
      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

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

      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userMetadata = authUser.user.user_metadata || {};
      const name = userMetadata.full_name || user.email.split('@')[0];
      const email = user.email;
      const image = userMetadata.avatar_url || null;

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
      if (userError) throw userError;

      const { error: walletError } = await supabase
        .from('user_wallets')
        .insert({
          user_id: userData.id,
          address: publicKey.toString(),
          private_key: secretKeyBase58,
        });
      if (walletError) throw walletError;

      const publicKeyStr = publicKey.toString();
      console.log('[createEmbeddedWallet] Storing publicKey:', publicKeyStr, typeof publicKeyStr);
      await secureStoreWrapper.setItemAsync('walletPublicKey', publicKeyStr);
      await secureStoreWrapper.setItemAsync('walletPrivateKey', secretKeyBase58);
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
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
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

      const privateKeyBytes = bs58.decode(walletData.private_key);
      if (privateKeyBytes.length !== 64) {
        throw new Error('Invalid private key format');
      }
      const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = keypair.publicKey;
      const publicKeyStr = publicKey.toString();

      if (publicKeyStr !== walletData.address) {
        throw new Error('Public key mismatch between keypair and stored address');
      }

      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      console.log('[retrieveEmbeddedWallet] Storing publicKey:', publicKeyStr, typeof publicKeyStr);
      await secureStoreWrapper.setItemAsync('walletPublicKey', publicKeyStr);
      await secureStoreWrapper.setItemAsync('walletPrivateKey', walletData.private_key);
      await secureStoreWrapper.setItemAsync('walletAddress', publicKeyStr);
      await secureStoreWrapper.setItemAsync('transactionPassword', hashedPassword);
      await AsyncStorage.setItem('walletAddress', publicKeyStr);

      setWallet({ publicKey });
      setSecretKey(privateKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      console.log('[retrieveEmbeddedWallet] Wallet retrieved:', publicKeyStr);
      return { publicKey: publicKeyStr, privateKey: walletData.private_key };
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
      const storedPassword = await secureStoreWrapper.getItemAsync('transactionPassword');
      if (!storedPassword) {
        throw new Error('No transaction password set');
      }
      const hashedInput = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        inputPassword
      );
      return hashedInput === storedPassword;
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

      // Check if it's a versioned transaction
      const isVersionedTransaction = transaction.version !== undefined;

      if (!isVersionedTransaction) {
        // Validate legacy transaction object
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
        privateKeyBase58 = await secureStoreWrapper.getItemAsync('walletPrivateKey');
        if (!privateKeyBase58) {
          throw new Error('Private key unavailable');
        }
        console.log('[signAndSendTransaction] Retrieved private key (first 4 chars):', privateKeyBase58.slice(0, 4));
      } catch (err) {
        console.error('[signAndSendTransaction] Error retrieving private key:', err);
        throw err;
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
        throw new Error(`Invalid private key format: length ${privateKeyBytes.length}`);
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

  const checkUserActivityTable = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('id')
        .limit(1);
      if (error && error.code === '42P01') {
        return false;
      }
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[checkUserActivityTable] Error:', err.message);
      return false;
    }
  }, []);

  const createUserAndBalance = useCallback(async (publicKey) => {
    if (!user || !publicKey) {
      setModalError('Invalid user or wallet');
      return;
    }
    try {
      if (typeof publicKey !== 'string') {
        throw new Error(`Invalid publicKey type: ${typeof publicKey}`);
      }
      const { data: existingUser, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      let userId;

      if (!existingUser) {
        const { data: authUser, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const userMetadata = authUser.user.user_metadata || {};
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

        if (createError) throw createError;
        userId = newUser.id;

        // Only initialize balance to 0 for new users
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

        if (balanceError) throw balanceError;
      } else {
        const { error: updateError } = await supabase
          .from('users')
          .update({ wallet_address: publicKey })
          .eq('id', existingUser.id);

        if (updateError) throw updateError;
        userId = existingUser.id;

        // For existing users, only update wallet_address in wallet_balances if needed
        const { data: existingBalance, error: balanceCheckError } = await supabase
          .from('wallet_balances')
          .select('*')
          .eq('user_id', userId)
          .eq('chain', 'SOL')
          .eq('currency', 'SMP')
          .single();

        if (existingBalance) {
          // Update only the wallet_address if it's different
          if (existingBalance.wallet_address !== publicKey) {
            const { error: balanceUpdateError } = await supabase
              .from('wallet_balances')
              .update({ wallet_address: publicKey })
              .eq('user_id', userId)
              .eq('chain', 'SOL')
              .eq('currency', 'SMP');

            if (balanceUpdateError) throw balanceUpdateError;
          }
        } else {
          // If no balance record exists, create one with 0 balance
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

          if (balanceInsertError) throw balanceInsertError;
        }
      }

      setUserCreated(true);
      setShowReferralPrompt(true);
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
    if (password.length < 8) {
      setModalError('Password must be at least 8 characters long');
      return;
    }
    try {
      setIsCreatingWallet(true);
      const result = await createEmbeddedWallet(password);
      if (result) {
        await SecureStore.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false');
        await createUserAndBalance(result.publicKey);
        setShowPasswordSetup(false);
        setShowCreateForm(false);
        const tableExists = await checkUserActivityTable();
        if (tableExists) {
          setShowTokenClaimModal(true);
        } else {
          Alert.alert('Info', 'Wallet created, but token claiming unavailable. Contact support.');
        }
        setPassword('');
        setConfirmPassword('');
      } else {
        setModalError('Failed to create wallet');
      }
    } catch (err) {
      setModalError('Failed to create wallet: ' + err.message);
    } finally {
      setIsCreatingWallet(false);
    }
  }, [password, confirmPassword, createEmbeddedWallet, useBiometrics, createUserAndBalance, checkUserActivityTable]);

  const handleRetrieveWallet = useCallback(async () => {
    if (password !== confirmPassword) {
      setModalError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setModalError('Password must be at least 8 characters long');
      return;
    }
    try {
      setIsCreatingWallet(true);
      const result = await retrieveEmbeddedWallet(password);
      if (result) {
        await SecureStore.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false');
        await createUserAndBalance(result.publicKey);
        setShowPasswordSetup(false);
        setShowRetrieveForm(false);
        const tableExists = await checkUserActivityTable();
        if (tableExists) {
          setShowTokenClaimModal(true);
        } else {
          Alert.alert('Info', 'Wallet retrieved, but token claiming unavailable. Contact support.');
        }
        setPassword('');
        setConfirmPassword('');
      } else {
        setModalError('Failed to retrieve wallet. Please ensure your account has a wallet or create a new one.');
      }
    } catch (err) {
      setModalError('Failed to retrieve wallet: ' + err.message);
    } finally {
      setIsCreatingWallet(false);
    }
  }, [password, confirmPassword, retrieveEmbeddedWallet, useBiometrics, createUserAndBalance, checkUserActivityTable]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectWallet();
      setUserCreated(false);
      setShowReferralPrompt(false);
      Alert.alert('Success', 'Wallet disconnected');
    } catch (err) {
      setModalError('Failed to disconnect wallet');
    }
  }, [disconnectWallet]);

  const handleReferralPrompt = async () => {
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
      console.error('[handleReferralPrompt] Error:', error);
    }
  };

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setShowCreateForm(false);
    setShowRetrieveForm(false);
    setShowPasswordSetup(false);
    setModalError(null);
    setPassword('');
    setConfirmPassword('');
    setUseBiometrics(false);
  }, []);

  const renderModalContent = () => {
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
            {showCreateForm ? 'Create Wallet - Set Password' : 'Retrieve Wallet - Set Password'}
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
            onPress={showCreateForm ? handleCreateWallet : handleRetrieveWallet}
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
              setShowCreateForm(false);
              setShowPasswordSetup(true);
            }}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>{isLoading ? 'Creating...' : 'Create Wallet'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowCreateForm(false)}>
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
              setShowRetrieveForm(false);
              setShowPasswordSetup(true);
            }}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>{isLoading ? 'Retrieving...' : 'Retrieve Wallet'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowRetrieveForm(false)}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Connect Wallet</Text>
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowCreateForm(true)}>
          <Text style={styles.actionButtonText}>Create New Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowRetrieveForm(true)}>
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
        onPress={() => (wallet ? handleDisconnect() : setShowModal(true))}
        disabled={isLoading}
      >
        <Text style={styles.label}>
          {isLoading
            ? 'Loading...'
            : wallet
            ? `${wallet.publicKey.toString().slice(0, 6)}...${wallet.publicKey.toString().slice(-4)}`
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
          <Text style={styles.modalText}>Update your profile to unlock referral benefits.</Text>
          <TouchableOpacity style={styles.actionButton} onPress={handleReferralPrompt}>
            <Text style={styles.actionButtonText}>Update Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowReferralPrompt(false)}>
            <Text style={styles.secondaryButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <TokenClaimModal
        visible={showTokenClaimModal}
        onClose={() => setShowTokenClaimModal(false)}
      />
    </>
  );
};

export default ConnectButton;