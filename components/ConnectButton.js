import React, { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import * as Crypto from 'expo-crypto';
import Modal from 'react-native-modal';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { RPC_URL, SMP_MINT_ADDRESS } from '../constants';
import { styles } from '../styles/ConnectButtonStyles';
import TokenClaimModal from './TokenClaimModal';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

export const EmbeddedWalletContext = createContext();

const connection = new Connection(RPC_URL, 'confirmed');

// Use environment variable or fetch securely (avoid hardcoding)
const KEYPAIR_ENCRYPTION_SECRET = process.env.KEYPAIR_ENCRYPTION_SECRET || 'your-secure-secret-key-123'; // Replace with secure retrieval

// Encryption compatible with server-side aes-256-cbc
const encrypt = async (data) => {
  try {
    console.log('[encrypt] Starting encryption');
    // Generate 32-byte key from secret (matches server)
    const keyHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      KEYPAIR_ENCRYPTION_SECRET,
    );
    const key = Buffer.from(keyHex, 'hex');

    // Generate random 16-byte IV
    const iv = Buffer.from(
      await Crypto.getRandomBytesAsync(16)
    );

    // Convert input data (Uint8Array or Buffer) to Buffer
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Encrypt using aes-256-cbc
    const cipher = await Crypto.encryptAsync(
      Crypto.CryptoEncoding.AES_256_CBC,
      dataBuffer.toString('hex'),
      key.toString('hex'),
      { iv: iv.toString('hex'), padding: true }
    );

    // Return IV:encrypted in hex format (matches server)
    const encrypted = `${iv.toString('hex')}:${Buffer.from(cipher, 'hex').toString('hex')}`;
    console.log('[encrypt] Encryption successful');
    return encrypted;
  } catch (err) {
    console.error('[encrypt] Error:', err.message);
    throw new Error(`Encryption failed: ${err.message}`);
  }
};

// Decryption compatible with server-side aes-256-cbc
const decrypt = async (data) => {
  try {
    console.log('[decrypt] Starting decryption');
    // Parse IV:encrypted format
    const [ivHex, encryptedHex] = data.split(':');
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }

    // Generate 32-byte key from secret (matches server)
    const keyHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      KEYPAIR_ENCRYPTION_SECRET,
    );
    const key = Buffer.from(keyHex, 'hex');

    // Convert IV and encrypted data to Buffers
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedHex, 'hex');

    // Decrypt using aes-256-cbc
    const decryptedHex = await Crypto.decryptAsync(
      Crypto.CryptoEncoding.AES_256_CBC,
      encryptedData.toString('hex'),
      key.toString('hex'),
      { iv: iv.toString('hex'), padding: true }
    );

    // Convert hex to Buffer and validate length
    const decrypted = Buffer.from(decryptedHex, 'hex');
    if (decrypted.length !== 64) {
      throw new Error(`Invalid private key length: ${decrypted.length}`);
    }

    console.log('[decrypt] Decryption successful');
    return decrypted;
  } catch (err) {
    console.error('[decrypt] Error:', err.message);
    throw new Error(`Decryption failed: ${err.message}`);
  }
};

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
      }
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
        const privateKeyEncrypted = await secureStoreWrapper.getItemAsync('walletPrivateKey');
        const storedPassword = await secureStoreWrapper.getItemAsync('transactionPassword');
        const biometricsEnabled = (await SecureStore.getItemAsync('useBiometrics')) === 'true';

        if (publicKeyStr && privateKeyEncrypted && storedPassword) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('id', user.id)
            .single();
          if (userError) throw new Error(`Supabase user query failed: ${userError.message}`);
          if (userData && userData.wallet_address === publicKeyStr) {
            const privateKeyBytes = await decrypt(privateKeyEncrypted);
            const keypair = Keypair.fromSecretKey(privateKeyBytes);
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
        }
      } catch (err) {
        console.error('[restoreWallet] Error:', err.message);
        setError('Failed to retrieve wallet: ' + err.message);
        await disconnectWallet();
      } finally {
        setIsLoading(false);
      }
    };

    restoreWallet();
  }, [user]);

  const createEmbeddedWallet = useCallback(
    async (password) => {
      if (!user || user.isGuest) {
        throw new Error('Sign in required to create a wallet');
      }
      if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      try {
        setIsLoading(true);
        console.log('[createEmbeddedWallet] Creating wallet for user:', user.email);
        const { data, error } = await supabase.functions.invoke('airdrop-function/get-or-create', {
          body: { user_id: user.id },
        });

        console.log('[createEmbeddedWallet] Edge function response:', { data, error });

        if (error) {
          console.error('[createEmbeddedWallet] Error from server:', error.message);
          throw new Error(error.message || 'Failed to create wallet');
        }
        if (!data || !data.userPublicKey) {
          console.error('[createEmbeddedWallet] Invalid response:', data);
          throw new Error('No wallet address returned');
        }

        const publicKeyStr = data.userPublicKey;
        const hashedPassword = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          password,
        );

        const { error: userError } = await supabase
          .from('users')
          .update({ wallet_address: publicKeyStr })
          .eq('id', user.id);
        if (userError) {
          console.error('[createEmbeddedWallet] Failed to update user:', userError.message);
          throw new Error(`Failed to update user: ${userError.message}`);
        }

        await secureStoreWrapper.setItemAsync('walletPublicKey', publicKeyStr);
        await secureStoreWrapper.setItemAsync('walletAddress', publicKeyStr);
        await secureStoreWrapper.setItemAsync('transactionPassword', hashedPassword);
        await AsyncStorage.setItem('walletAddress', publicKeyStr);

        setWallet({ publicKey: new PublicKey(publicKeyStr) });
        setTransactionPassword(hashedPassword);
        setIsWalletConnected(true);
        console.log('[createEmbeddedWallet] Wallet created:', publicKeyStr);
        return { publicKey: publicKeyStr };
      } catch (err) {
        console.error('[createEmbeddedWallet] Error:', err.message);
        setError('Failed to create wallet: ' + err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const retrieveEmbeddedWallet = useCallback(
    async (password) => {
      if (!user || user.isGuest) {
        throw new Error('Sign in required to retrieve a wallet');
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
          .select('wallet_address')
          .eq('id', user.id)
          .single();
        if (userError || !userData) {
          throw new Error('User or wallet not found');
        }

        const { data: walletData, error: walletError } = await supabase.functions.invoke('airdrop-function/retrieve', {
          body: { user_id: user.id },
        });
        if (walletError || !walletData) {
          throw new Error('Wallet retrieval failed: ' + (walletError?.message || 'No wallet data'));
        }

        const privateKeyBytes = new Uint8Array(walletData.privateKey);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        const publicKeyStr = keypair.publicKey.toString();

        if (publicKeyStr !== walletData.userPublicKey) {
          throw new Error('Public key mismatch');
        }

        // Re-encrypt private key for local storage
        const privateKeyEncrypted = await encrypt(privateKeyBytes);

        const hashedPassword = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          password,
        );

        await secureStoreWrapper.setItemAsync('walletPublicKey', publicKeyStr);
        await secureStoreWrapper.setItemAsync('walletPrivateKey', privateKeyEncrypted);
        await secureStoreWrapper.setItemAsync('walletAddress', publicKeyStr);
        await secureStoreWrapper.setItemAsync('transactionPassword', hashedPassword);
        await AsyncStorage.setItem('walletAddress', publicKeyStr);

        setWallet({ publicKey: keypair.publicKey });
        setSecretKey(privateKeyBytes);
        setTransactionPassword(hashedPassword);
        setIsWalletConnected(true);
        console.log('[retrieveEmbeddedWallet] Wallet retrieved:', publicKeyStr);
        return { publicKey: publicKeyStr, privateKey: privateKeyEncrypted };
      } catch (err) {
        console.error('[retrieveEmbeddedWallet] Error:', err.message);
        setError('Failed to retrieve wallet: ' + err.message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const disconnectWallet = useCallback(async () => {
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
  }, []);

  const verifyPassword = useCallback(async (inputPassword) => {
    try {
      const storedPassword = await secureStoreWrapper.getItemAsync('transactionPassword');
      if (!storedPassword) {
        throw new Error('No transaction password set');
      }
      const hashedInput = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, inputPassword);
      return hashedInput === storedPassword;
    } catch (err) {
      console.error('[verifyPassword] Error:', err.message);
      throw err;
    }
  }, []);

  const getClaimCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('airdrop_transactions')
        .select('id', { count: 'exact' });
      if (error) throw error;
      console.log('[getClaimCount] Claim count:', count);
      return count || 0;
    } catch (err) {
      console.error('[getClaimCount] Error loading claim count:', err.message);
      throw err;
    }
  }, []);

  const claimTokens = useCallback(
    async () => {
      if (!user || user.isGuest) {
        throw new Error('No user authenticated');
      }
      try {
        console.log('[claimTokens] Invoking airdrop for user:', user.id);
        const { data, error, status } = await supabase.functions.invoke('airdrop-function/airdrop', {
          body: { user_id: user.id },
        });

        if (error || status !== 200) {
          console.error('[claimTokens] Edge function response:', { status, data, error });
          throw new Error(data?.error || error?.message || `Airdrop failed: Status ${status}`);
        }
        if (data.confirmationError) {
          console.error('[claimTokens] Transaction confirmation error:', data.confirmationError);
          throw new Error(`Airdrop transaction failed: ${data.confirmationError}`);
        }
        if (!data.signature) {
          console.error('[claimTokens] No signature in response:', data);
          throw new Error('Airdrop failed: No transaction signature returned');
        }
        console.log('[claimTokens] Airdrop successful:', data.signature);
        return data.signature;
      } catch (err) {
        console.error('[claimTokens] Error claiming tokens:', err.message);
        throw err;
      }
    },
    [user],
  );

  const signAndSendTransaction = useCallback(
    async (transaction, inputPassword) => {
      if (!wallet?.publicKey) {
        throw new Error('No wallet connected');
      }
      try {
        if (!transaction) {
          throw new Error('No transaction provided');
        }
        console.log('[signAndSendTransaction] Starting with wallet:', wallet.publicKey.toString());

        const walletPubKey = wallet.publicKey instanceof PublicKey ? wallet.publicKey : new PublicKey(wallet.publicKey);

        const isVersionedTransaction = transaction.version !== undefined;
        if (!isVersionedTransaction && (!transaction.instructions || !Array.isArray(transaction.instructions))) {
          throw new Error('Invalid transaction: missing or invalid instructions');
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

        const privateKeyEncrypted = await secureStoreWrapper.getItemAsync('walletPrivateKey');
        if (!privateKeyEncrypted) {
          throw new Error('Private key unavailable');
        }

        const privateKeyBytes = await decrypt(privateKeyEncrypted);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        if (walletPubKey.toString() !== keypair.publicKey.toString()) {
          throw new Error('Private key does not match wallet public key');
        }

        if (!isVersionedTransaction) {
          if (!transaction.recentBlockhash) {
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
          }
          if (!transaction.feePayer) {
            transaction.feePayer = walletPubKey;
          }
        }

        console.log('[signAndSendTransaction] Signing transaction...');
        if (isVersionedTransaction) {
          transaction.sign([keypair]);
        } else {
          transaction.partialSign(keypair);
        }

        console.log('[signAndSendTransaction] Serializing transaction...');
        const serializedTx = transaction.serialize();

        console.log('[signAndSendTransaction] Sending transaction...');
        const signature = await connection.sendRawTransaction(serializedTx, {
          skipPreflight: false,
          maxRetries: 2,
        });
        console.log('[signAndSendTransaction] Signature:', signature);
        return signature;
      } catch (err) {
        console.error('[signAndSendTransaction] Error:', err.message);
        throw err;
      }
    },
    [wallet, useBiometrics, verifyPassword],
  );

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
        claimTokens,
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
    claimTokens,
    isLoading,
    error: walletError,
    useBiometrics,
    setUseBiometrics,
  } = useContext(EmbeddedWalletContext);
  const { user, isAuthenticated, error: authError } = useAuth();
  const navigation = useNavigation();
  const [isModalVisible, setModalVisible] = useState(false);
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
  const [isCreating, setIsCreating] = useState(false);

  const checkUserActivityTable = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('user_activity').select('user_id').limit(1);
      if (error && error.code === '42P01') {
        return null;
      }
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[checkUserActivityTable] Error:', err.message);
      return null;
    }
  }, []);

  const createUserAndBalance = useCallback(
    async (publicKey) => {
      if (!user || !publicKey) {
        setModalError('Invalid user or wallet');
        return;
      }
      try {
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();
        if (userCheckError && userCheckError.code !== 'PGRST116') {
          throw userCheckError;
        }

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
              name: userMetadata.name || user.email.split('@')[0],
              image: userMetadata.avatar_url || '',
              wallet_address: publicKey,
              has_updated_profile: false,
            })
            .select('id')
            .single();
          if (createError) throw createError;
          userId = newUser.id;
        } else {
          userId = existingUser.id;
        }

        setUserCreated(true);
        setShowReferralPrompt(true);
      } catch (err) {
        console.error('[createUserAndBalance] Error:', err.message);
        setModalError('Failed to initialize user: ' + err.message);
      }
    },
    [user],
  );

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
        await secureStoreWrapper.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false');
        await createUserAndBalance(result.publicKey);
        setShowPasswordSetup(false);
        setShowCreateForm(false);
        const tableExists = await checkUserActivityTable();
        if (tableExists) {
          setShowTokenClaimModal(true);
        } else {
          Alert.alert('Error', 'Token claiming unavailable. Contact support.');
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
    if (password !== '') {
      setModalError('Passwords do not match');
      return null;
    }
    if (password.length < 8) {
      setModalError('Password must be at least 8 characters long');
      return false;
    }
    try {
      setIsCreatingWallet(true);
      const result = await retrieveEmbeddedWallet(password);
      if (result) {
        await secureStoreWrapper.setItemAsync('useBiometrics', useBiometrics ? 'true' : 'false');
        await createUserAndBalance(result.publicKey);
        setShowPasswordSetup(false);
        setShowRetrieveForm(false);
        const tableExists = await checkUserActivityTable();
        if (tableExists) {
          setShowTokenClaimModal(true);
        } else {
          Alert.alert('Error', 'Token claiming unavailable. Contact support.');
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
      console.error('[handleDisconnect] Failed to disconnect wallet:', err.message);
      setModalError('Failed to disconnect wallet: ' + err.message);
    }
  }, [disconnectWallet]);

  const handleReferralPrompt = useCallback(async () => {
    try {
      const hasReferralCode = await AsyncStorage.getItem('hasReferralCode');
      if (!hasReferralCode) {
        Alert.alert('Success', 'Add a referral code to earn rewards?', [
          {
            text: 'Yes',
            onPress: () => navigation.navigate('EditProfile'),
          },
          {
            text: 'No',
            onPress: () => AsyncStorage.setItem('hasReferralCode', 'true'),
          },
        ]);
      }
    } catch (err) {
      console.error('[handleReferralPrompt] Error:', err.message);
      setModalError('Failed to handle referral prompt: ' + err.message);
    }
  }, [navigation]);

  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    setShowCreateForm(false);
    setShowRetrieveForm(false);
    setShowPasswordSetup(false);
    setModalError(null);
    setPassword('');
    setConfirmPassword('');
    setUseBiometrics(false);
    setIsCreating(false);
  }, []);
  

  const renderModalContent = () => {
    if (!isAuthenticated) {
      return (
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Sign In Required</Text>
          <Text style={styles.modalText}>Sign in with an account to manage wallets.</Text>
          {authError && <Text style={styles.modalErrorText}>{authError}</Text>}
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
            {isCreating ? 'Create Wallet - Set Password' : 'Retrieve Wallet - Enter Password'}
          </Text>
          <Text style={styles.modalText}>
            {'Set a password for transaction signing (minimum 8 characters).'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Password"
            secureTextEntry
            value={password}
            onChangeText={(text) => setPasswordText(text)}
            placeholderTextColor="#888"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={(text) => setConfirmPassword(text)}
            placeholderTextColor="#888"
          />
          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={[styles.checkbox, useBiometrics ? styles.checkboxSelected : null]}
              onPress={() => setUseBiometrics(!useBiometrics)}
            >
              {useBiometrics && <Text style={styles.checkboxText}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>Use Biometrics for authentication</Text>
          </View>
          {modalError && <Text style={styles.modalErrorText}>{modalError}</Text>}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={isCreating ? handleCreateWallet : handleRetrieveWallet}
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
          {modalError && <Text style={styles.modalErrorText}>{modalError}</Text>}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setShowCreateForm(false);
              setShowPasswordSetup(true);
              setIsCreating(true);
            }}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>
              {isLoading ? 'Creating...' : 'Create Wallet'}
            </Text>
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
          {modalError && <Text style={styles.modalErrorText}>{modalError}</Text>}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setShowRetrieveForm(false);
              setShowPasswordSetup(true);
              setIsCreating(false);
            }}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>
              {isLoading ? 'Retrieving...' : 'Retrieve Wallet'}
            </Text>
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
          <Text style={styles.actionButtonText}>Retrieve Existing Wallet</Text>
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
        onPress={() => (wallet ? handleDisconnect() : setModalVisible(true))}
        disabled={isLoading}
      >
        <Text style={styles.label}>
          {isLoading
            ? 'Loading...'
            : wallet
            ? `${wallet.publicKey?.toString()?.slice(0, 6)}...${wallet.publicKey?.toString()?.slice(-6)}`
            : isAuthenticated
            ? 'Connect Wallet'
            : 'Sign In'}
        </Text>
      </TouchableOpacity>
      <Modal
        isVisible={isModalVisible}
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
          <Text style={styles.modalText}>Update your profile to unlock referral rewards.</Text>
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
        onTokenClaim={claimTokens}
      />
    </>
  );
};

export default ConnectButton;