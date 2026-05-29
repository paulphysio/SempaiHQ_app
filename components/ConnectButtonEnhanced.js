import React, { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, TextInput, Clipboard, ToastAndroid, ActivityIndicator, ScrollView } from 'react-native';
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

// Import Mobile Wallet Adapter for Seeker support
import { 
  MobileWalletAdapter, 
  useMobileWalletAdapter,
  transact 
} from '@solana-mobile/mobile-wallet-adapter-protocol';
import { 
  SolanaMobileWalletAdapterWallet 
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

// Check if device supports Mobile Wallet Adapter (Seeker detection)
const isSeekerDevice = async () => {
  try {
    console.log('[isSeekerDevice] Starting detection...');
    
    // First check if we're on Android
    if (Platform.OS !== 'android') {
      console.log('[isSeekerDevice] Not on Android, returning false');
      return false;
    }
    
    console.log('[isSeekerDevice] On Android, checking MWA availability...');
    
    // For development, let's show the Seeker option on all Android devices
    // In production, you'd want more sophisticated detection
    const isAndroid = Platform.OS === 'android';
    console.log('[isSeekerDevice] Result:', isAndroid);
    
    return isAndroid;
  } catch (error) {
    console.log('[isSeekerDevice] Error during detection:', error.message);
    return false;
  }
};

// For immediate UI decisions, we'll use a simpler check
const isSeekerDeviceSync = () => {
  // For now, show on all Android devices for testing
  // In production, this should be more sophisticated
  const result = Platform.OS === 'android';
  console.log('[isSeekerDeviceSync] Quick check result:', result);
  return result;
};

export const EmbeddedWalletContext = createContext();

const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');

// Wallet types
const WALLET_TYPES = {
  EMBEDDED: 'embedded',
  SEEKER: 'seeker'
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
      console.error(`[secureStoreWrapper] Error deleting ${key}:`, err.message);
      throw err;
    }
  },
};

export const EmbeddedWalletProvider = ({ children }) => {
  // Original embedded wallet state
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
  
  // New wallet selection state
  const [walletType, setWalletType] = useState(null);
  const [showWalletSelection, setShowWalletSelection] = useState(false);
  const [seekerWallet, setSeekerWallet] = useState(null);
  const [isSeekerConnected, setIsSeekerConnected] = useState(false);

  const { user, isLoading: authLoading } = useAuth();

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

  // Enhanced Seeker Wallet connection with better error handling
  const connectSeekerWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[connectSeekerWallet] Connecting to Seeker Wallet...');
      setError(null);
      
      // Check if MWA is available
      if (!MobileWalletAdapter) {
        throw new Error('Mobile Wallet Adapter not available. Make sure you are on a Seeker device.');
      }
      
      const walletAdapter = new MobileWalletAdapter();
      
      const result = await transact(async (wallet) => {
        console.log('[connectSeekerWallet] Connected to wallet:', wallet);
        
        try {
          const publicKey = wallet.publicKey;
          const address = publicKey.toString();
          
          if (!publicKey || !address) {
            throw new Error('Invalid wallet public key received');
          }
          
          // Update user's wallet address in database if needed
          if (user && !user.isGuest) {
            const { error: updateError } = await supabase
              .from('users')
              .update({ wallet_address: address })
              .eq('id', user.id);
              
            if (updateError) {
              console.warn('[connectSeekerWallet] Failed to update wallet address:', updateError.message);
            }
          }
          
          setSeekerWallet(wallet);
          setIsSeekerConnected(true);
          setWalletType(WALLET_TYPES.SEEKER);
          setWallet({ publicKey });
          
          console.log('[connectSeekerWallet] Wallet connection successful:', { address, publicKey: publicKey.toString() });
          return { publicKey, address };
          
        } catch (innerError) {
          console.error('[connectSeekerWallet] Inner error during connection:', innerError);
          throw innerError;
        }
      });
      
      console.log('[connectSeekerWallet] Successfully connected to Seeker Wallet');
      return result;
    } catch (err) {
      console.error('[connectSeekerWallet] Connection error:', err.message);
      
      // Provide better error messages
      let errorMessage = 'Failed to connect to Seeker Wallet';
      if (err.message.includes('not available')) {
        errorMessage = 'Seeker Wallet not available. Make sure you are on a Seeker device with the Seeker Wallet app installed.';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'Connection timeout. Please try again.';
      } else if (err.message.includes('cancelled')) {
        errorMessage = 'Connection was cancelled.';
      } else if (err.message.includes('Invalid wallet')) {
        errorMessage = 'Invalid wallet response. Please restart the app and try again.';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Disconnect Seeker Wallet
  const disconnectSeekerWallet = useCallback(async () => {
    try {
      console.log('[disconnectSeekerWallet] Disconnecting Seeker Wallet');
      setSeekerWallet(null);
      setIsSeekerConnected(false);
      setWallet(null);
      setWalletType(null);
      setError(null);
      console.log('[disconnectSeekerWallet] Seeker Wallet disconnected');
    } catch (err) {
      console.error('[disconnectSeekerWallet] Error:', err.message);
      setError('Failed to disconnect Seeker Wallet: ' + err.message);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      console.log('[disconnectWallet] Disconnecting wallet');
      
      // Disconnect based on current wallet type
      if (walletType === WALLET_TYPES.SEEKER) {
        await disconnectSeekerWallet();
      } else {
        // Disconnect embedded wallet
        await secureStoreWrapper.deleteItemAsync('walletData');
        await secureStoreWrapper.deleteItemAsync('useBiometrics');
        await AsyncStorage.removeItem('walletAddress');
        setWallet(null);
        setSecretKey(null);
        setTransactionPassword(null);
        setUseBiometrics(false);
        setIsWalletConnected(false);
        setWalletType(null);
      }
      
      setError(null);
      console.log('[disconnectWallet] Wallet disconnected');
    } catch (err) {
      console.error('[disconnectWallet] Error:', err.message);
      setError('Failed to disconnect wallet: ' + err.message);
    }
  }, [walletType, disconnectSeekerWallet]);

  // Enhanced transaction signing with Seeker Wallet
  const signWithSeekerWallet = useCallback(async (transaction) => {
    if (!seekerWallet) {
      throw new Error('No Seeker Wallet connected');
    }
    
    try {
      console.log('[signWithSeekerWallet] Signing transaction with Seeker Wallet');
      console.log('[signWithSeekerWallet] Transaction details:', {
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer?.toString(),
        instructions: transaction.instructions.length
      });
      
      const result = await transact(async (wallet) => {
        try {
          // Validate transaction before signing
          if (!transaction.recentBlockhash) {
            throw new Error('Transaction missing recent blockhash');
          }
          
          if (!transaction.feePayer) {
            transaction.feePayer = wallet.publicKey;
          }
          
          // Sign the transaction
          const signedTransactions = await wallet.signTransactions([transaction]);
          
          if (!signedTransactions || signedTransactions.length === 0) {
            throw new Error('Failed to sign transaction');
          }
          
          console.log('[signWithSeekerWallet] Transaction signed successfully');
          
          // Send the transaction
          const signature = await connection.sendRawTransaction(
            signedTransactions[0].serialize(),
            {
              skipPreflight: false,
              preflightCommitment: 'confirmed'
            }
          );
          
          console.log('[signWithSeekerWallet] Transaction sent with signature:', signature);
          
          // Wait for confirmation
          const confirmation = await connection.confirmTransaction(signature, 'confirmed');
          
          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }
          
          console.log('[signWithSeekerWallet] Transaction confirmed:', signature);
          return signature;
          
        } catch (innerError) {
          console.error('[signWithSeekerWallet] Inner error during signing:', innerError);
          
          // Provide better error messages
          if (innerError.message.includes('insufficient funds')) {
            throw new Error('Insufficient funds for this transaction');
          } else if (innerError.message.includes('blockhash')) {
            throw new Error('Transaction expired. Please try again.');
          } else if (innerError.message.includes('cancelled')) {
            throw new Error('Transaction was cancelled');
          } else if (innerError.message.includes('timeout')) {
            throw new Error('Transaction timed out. Please try again.');
          }
          
          throw innerError;
        }
      });
      
      console.log('[signWithSeekerWallet] Transaction completed successfully:', result);
      return result;
    } catch (err) {
      console.error('[signWithSeekerWallet] Error:', err.message);
      
      // Enhanced error handling
      let errorMessage = 'Failed to sign transaction with Seeker Wallet';
      if (err.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL balance for this transaction';
      } else if (err.message.includes('expired')) {
        errorMessage = 'Transaction expired. Please try again.';
      } else if (err.message.includes('cancelled')) {
        errorMessage = 'Transaction was cancelled';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'Transaction timed out. Please check your connection and try again.';
      } else if (err.message.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      throw new Error(errorMessage);
    }
  }, [seekerWallet]);

  useEffect(() => {
    if (authLoading) return;
    
    const restoreWallet = async () => {
      if (!user || user.isGuest) {
        console.log('[restoreWallet] No authenticated user or guest user, skipping wallet restore');
        return;
      }
      
      try {
        setIsLoading(true);
        console.log('[restoreWallet] Restoring wallet for user:', user.email);
        
        // Check if user had a preferred wallet type
        const storedWalletType = await AsyncStorage.getItem('preferredWalletType');
        
        if (storedWalletType === WALLET_TYPES.SEEKER) {
          // For Seeker, we can't auto-connect, user must manually connect
          console.log('[restoreWallet] User prefers Seeker Wallet, waiting for manual connection');
          setWalletType(WALLET_TYPES.SEEKER);
        } else {
          // Restore embedded wallet (original logic)
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

          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, wallet_address')
            .eq('email', user.email)
            .single();
          if (userError) throw new Error(`Supabase user query failed: ${userError.message}`);

          if (userData && userData.wallet_address === publicKey) {
            setWallet({ publicKey: keypair.publicKey });
            setSecretKey(privateKeyBytes);
            setTransactionPassword(storedPassword);
            setIsWalletConnected(true);
            setWalletType(WALLET_TYPES.EMBEDDED);
            console.log('[restoreWallet] Embedded wallet restored:', publicKey);
          } else {
            console.log('[restoreWallet] Wallet mismatch, clearing');
            await disconnectWallet();
          }
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
  }, [user, authLoading, disconnectWallet]);

  const createEmbeddedWallet = useCallback(async (password) => {
    if (!user || user.isGuest) {
      throw new Error('Sign in with an account to create a wallet');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be a string and at least 8 characters long');
    }
    try {
      setIsLoading(true);
      console.log('[createEmbeddedWallet] Creating embedded wallet for:', user.email);

      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Auth error: ${authError.message}`);
      if (!authUser.user || authUser.user.id !== user.id) {
        throw new Error('Authenticated user mismatch');
      }

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
        referralCode = Array.from({ length: 8 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
        const { data } = await supabase.from('users').select('id').eq('referral_code', referralCode).maybeSingle();
        isUnique = !data;
      }

      const userMetadata = authUser.user.user_metadata || {};
      const name = userMetadata.full_name || user.email.split('@')[0];
      const email = user.email;
      const image = userMetadata.avatar_url || null;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({ id: user.id, email, name, image, wallet_address: publicKey.toString(), referral_code: referralCode, has_updated_profile: false }, { onConflict: 'id' })
        .select('id')
        .single();

      if (userError) throw new Error(`User upsert failed: ${userError.message}`);
      if (!userData) throw new Error('User upsert succeeded but returned no data');

      const { error: walletError } = await supabase.from('user_wallets').insert({ user_id: userData.id, address: publicKey.toString(), private_key: encryptedPrivateKey });
      if (walletError) throw new Error(`Wallet insert failed: ${walletError.message}`);

      const encryptedPrivateKeyForStore = await invokeEncryptionFunction('encrypt', secretKeyBase58);
      const walletData = { publicKey: publicKey.toString(), encryptedPrivateKey: encryptedPrivateKeyForStore, storedPassword: hashedPassword };
      const walletDataStr = JSON.stringify(walletData);

      await secureStoreWrapper.setItemAsync('walletData', walletDataStr, useBiometrics);
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

  const retrieveEmbeddedWallet = useCallback(async (password) => {
    if (!user || user.isGuest) throw new Error('Sign in with an account to retrieve a wallet');
    if (!password || typeof password !== 'string' || password.length < 8) throw new Error('Password must be a string and at least 8 characters long');
    
    try {
      setIsLoading(true);
      console.log('[retrieveEmbeddedWallet] Retrieving embedded wallet for:', user.email);

      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser.user || authUser.user.id !== user.id) throw new Error('Authenticated user mismatch');

      await disconnectWallet();

      const { data: userData, error: userError } = await supabase.from('users').select('id, wallet_address').eq('email', user.email).single();
      if (userError || !userData) throw new Error('User not found. Please ensure your account is registered.');
      if (!userData.wallet_address) throw new Error('No wallet address associated with this user. Please create a new wallet.');

      const { data: walletData, error: walletError } = await supabase.from('user_wallets').select('address, private_key').eq('user_id', userData.id).eq('address', userData.wallet_address).single();
      if (walletError || !walletData) throw new Error('No wallet found for this user. Please create a new wallet or contact support.');
      if (typeof walletData.address !== 'string' || typeof walletData.private_key !== 'string') throw new Error('Invalid wallet data format in database.');

      const privateKeyBase58 = await invokeEncryptionFunction('decrypt', walletData.private_key);
      const privateKeyBytes = bs58.decode(privateKeyBase58);
      if (privateKeyBytes.length !== 64) throw new Error(`Invalid private key format after decryption: length ${privateKeyBytes.length}`);

      const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = keypair.publicKey;
      const publicKeyStr = publicKey.toString();

      if (publicKeyStr !== walletData.address) throw new Error('Public key mismatch. Please contact support.');

      const hashedPassword = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
      const encryptedPrivateKeyForStore = await invokeEncryptionFunction('encrypt', privateKeyBase58);

      const walletDataObj = { publicKey: publicKeyStr, encryptedPrivateKey: encryptedPrivateKeyForStore, storedPassword: hashedPassword };
      const walletDataStr = JSON.stringify(walletDataObj);

      await secureStoreWrapper.setItemAsync('walletData', walletDataStr, useBiometrics);
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

  const verifyPassword = useCallback(async (password) => {
    if (!transactionPassword) return false;
    const hashedInput = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
    return hashedInput === transactionPassword;
  }, [transactionPassword]);

  const signAndSendTransaction = useCallback(async (transaction, inputPassword) => {
    try {
      console.log('[signAndSendTransaction] Starting transaction signing...');
      console.log('[signAndSendTransaction] Wallet type:', walletType);
      console.log('[signAndSendTransaction] Seeker connected:', isSeekerConnected);
      
      // Use Seeker Wallet if connected
      if (walletType === WALLET_TYPES.SEEKER && isSeekerConnected) {
        console.log('[signAndSendTransaction] Using Seeker Wallet for transaction');
        return await signWithSeekerWallet(transaction);
      }
      
      // Otherwise use embedded wallet
      console.log('[signAndSendTransaction] Using embedded wallet for transaction');
      const biometricsEnabled = (await AsyncStorage.getItem('useBiometrics')) === 'true';
      console.log(`[signAndSendTransaction] Embedded wallet - Biometrics enabled: ${biometricsEnabled}`);

      if (!biometricsEnabled && !inputPassword) {
        console.log('[signAndSendTransaction] Biometrics not enabled and no password, showing modal.');
        setPendingTransaction(transaction);
        setPasswordModalVisible(true);
        return new Promise((resolve, reject) => {
          setResolveTransaction({ resolve, reject });
        });
      }

      if (!wallet?.publicKey) throw new Error('No wallet connected');
      
      if (!transaction) throw new Error('No transaction provided');

      if (inputPassword) {
        const isValid = await verifyPassword(inputPassword);
        if (!isValid) throw new Error('Invalid transaction password');
      }

      let privateKeyBase58;
      try {
        const walletDataStr = await secureStoreWrapper.getItemAsync('walletData', biometricsEnabled);
        if (!walletDataStr) throw new Error('Wallet data unavailable');
        
        const walletData = JSON.parse(walletDataStr);
        if (!walletData.encryptedPrivateKey) throw new Error('Private key unavailable');
        
        privateKeyBase58 = await invokeEncryptionFunction('decrypt', walletData.encryptedPrivateKey);
      } catch (err) {
        console.error('[signAndSendTransaction] Error retrieving/decrypting wallet data:', err);
        throw new Error('Failed to retrieve or decrypt wallet data: ' + err.message);
      }

      const privateKeyBytes = bs58.decode(privateKeyBase58);
      const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);

      if (wallet.publicKey.toString() !== keypair.publicKey.toString()) {
        throw new Error('Private key does not match wallet public key');
      }

      // Set fee payer if not set
      if (!transaction.feePayer) {
        transaction.feePayer = keypair.publicKey;
      }

      // Sign and send transaction
      const signature = await connection.sendTransaction(transaction, [keypair]);
      
      console.log('[signAndSendTransaction] Embedded wallet transaction sent:', signature);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      console.log('[signAndSendTransaction] Embedded wallet transaction confirmed:', signature);
      return signature;
      
    } catch (err) {
      console.error('[signAndSendTransaction] Error:', err.message);
      
      // Enhanced error handling for both wallet types
      let errorMessage = 'Transaction failed';
      if (err.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL balance for this transaction';
      } else if (err.message.includes('Invalid transaction password')) {
        errorMessage = 'Invalid password. Please check your credentials.';
      } else if (err.message.includes('Private key does not match')) {
        errorMessage = 'Wallet security error. Please reconnect your wallet.';
      } else if (err.message.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'Transaction timed out. Please try again.';
      }
      
      throw new Error(errorMessage);
    }
  }, [walletType, isSeekerConnected, signWithSeekerWallet, wallet, verifyPassword]);

  return (
    <EmbeddedWalletContext.Provider
      value={{
        wallet,
        secretKey,
        isWalletConnected: isWalletConnected || isSeekerConnected,
        walletType,
        createEmbeddedWallet,
        retrieveEmbeddedWallet,
        connectSeekerWallet,
        disconnectWallet,
        signAndSendTransaction,
        isLoading,
        error,
        useBiometrics,
        setUseBiometrics,
        isSeekerConnected,
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
              const signature = await signAndSendTransaction(pendingTransaction, password);
              resolveTransaction.resolve(signature);
            } catch (error) {
              resolveTransaction.reject(error);
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
        onSelectSeeker={() => {
          setWalletType(WALLET_TYPES.SEEKER);
          setShowWalletSelection(false);
          AsyncStorage.setItem('preferredWalletType', WALLET_TYPES.SEEKER);
          connectSeekerWallet();
        }}
      />
    </EmbeddedWalletContext.Provider>
  );
};

const PasswordModal = ({ isVisible, onClose, onSubmit }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    onSubmit(password);
    setPassword('');
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
        <Text style={styles.modalTitle}>Enter Password</Text>
        <Text style={styles.modalText}>Please enter your password to sign the transaction.</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.actionButton} onPress={handleSubmit}>
          <Text style={styles.actionButtonText}>Submit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const WalletSelectionModal = ({ isVisible, onClose, onSelectEmbedded, onSelectSeeker }) => {
  const [showSeekerOption, setShowSeekerOption] = useState(false);
  
  useEffect(() => {
    const checkSeekerAvailability = async () => {
      console.log('[WalletSelectionModal] Checking Seeker availability...');
      const isSeeker = await isSeekerDevice();
      console.log('[WalletSelectionModal] Seeker available:', isSeeker);
      setShowSeekerOption(isSeeker);
    };
    
    if (isVisible) {
      checkSeekerAvailability();
    }
  }, [isVisible]);
  
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

        {/* Only show Seeker option on Seeker devices */}
        {showSeekerOption && (
          <TouchableOpacity style={styles.walletOption} onPress={onSelectSeeker}>
            <View style={styles.walletOptionHeader}>
              <MaterialCommunityIcons name="cellphone" size={24} color="#FF5733" />
              <Text style={styles.walletOptionTitle}>Seeker Wallet</Text>
            </View>
            <Text style={styles.walletOptionDescription}>
              Hardware-level security with Seed Vault technology. Biometric authentication at the hardware level.
            </Text>
            <View style={styles.walletOptionFeatures}>
              <Text style={styles.walletOptionFeature}>✓ Hardware Security</Text>
              <Text style={styles.walletOptionFeature}>✓ Double-tap Transactions</Text>
              <Text style={styles.walletOptionFeature}>✓ Seeker ID Support</Text>
              <Text style={styles.walletOptionFeature}>✓ Genesis Token Benefits</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// Compact, header-friendly wallet button
const ConnectButton = ({ compact = false, label }) => {
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const walletType = walletContext?.walletType;
  const isLoading = walletContext?.isLoading;
  const isSeekerConnected = walletContext?.isSeekerConnected;
  const disconnectWallet = walletContext?.disconnectWallet;
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showReferralPrompt, setShowReferralPrompt] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // If context is not available, show a simple connect button
  if (!walletContext) {
    return (
      <TouchableOpacity
        onPress={() => setShowModal(true)}
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
    );
  }

  const handleReferralPrompt = () => setShowReferralPrompt(false);

  const getWalletLabel = () => {
    if (walletType === WALLET_TYPES.SEEKER) {
      return 'Seeker';
    } else if (walletType === WALLET_TYPES.EMBEDDED) {
      return 'Embedded';
    }
    return null;
  };

  const renderDropdown = () => {
    if (!showDropdown || !wallet) return null;
    
    return (
      <View style={styles.dropdown}>
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
          onPress={() => {
            setShowDropdown(false);
            setShowDisconnectModal(true);
          }}
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
            onPress={async () => {
              await disconnectWallet();
              setShowDisconnectModal(false);
            }}
          >
            <Text style={styles.actionButtonText}>Disconnect</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => setShowDisconnectModal(false)}
          >
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
              setShowModal(true);
            }
          }}
          disabled={isLoading}
        >
          <LinearGradient
            colors={wallet ? ['#FF5733', '#FF7F50'] : ['#FF5733', '#FF7F50']}
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
                    name={walletType === WALLET_TYPES.SEEKER ? "cellphone" : "wallet-outline"} 
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
      
      {/* Wallet Creation/Connection Modal */}
      <WalletConnectionModal 
        isVisible={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

const WalletConnectionModal = ({ isVisible, onClose }) => {
  const walletContext = useContext(EmbeddedWalletContext);
  const createEmbeddedWallet = walletContext?.createEmbeddedWallet;
  const retrieveEmbeddedWallet = walletContext?.retrieveEmbeddedWallet;
  const connectSeekerWallet = walletContext?.connectSeekerWallet;
  const walletType = walletContext?.walletType;
  const setWalletType = walletContext?.setWalletType;
  const { user } = useAuth();
  const [mode, setMode] = useState('menu'); // menu, create, retrieve, seeker
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // If context is not available, show a simple message
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
  const [loading, setLoading] = useState(false);
  const [showSeekerOption, setShowSeekerOption] = useState(false);

  useEffect(() => {
    const checkSeekerAvailability = async () => {
      console.log('[WalletConnectionModal] Checking Seeker availability...');
      const isSeeker = await isSeekerDevice();
      console.log('[WalletConnectionModal] Seeker available:', isSeeker);
      setShowSeekerOption(isSeeker);
    };
    
    if (isVisible) {
      checkSeekerAvailability();
    }
  }, [isVisible]);

  const handleCreateWallet = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      const result = await createEmbeddedWallet(password);
      if (result) {
        Alert.alert('Success', 'Embedded wallet created successfully!');
        onClose();
      }
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
      if (result) {
        Alert.alert('Success', 'Embedded wallet retrieved successfully!');
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSeeker = async () => {
    setLoading(true);
    try {
      await connectSeekerWallet();
      Alert.alert('Success', 'Seeker Wallet connected successfully!');
      onClose();
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
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <ScrollView style={styles.modalScrollView}>
        <View style={styles.modalContent}>
          {mode === 'menu' && (
            <>
              <Text style={styles.modalTitle}>Wallet Options</Text>
              <Text style={styles.modalText}>Choose how you want to manage your crypto:</Text>
              
              <TouchableOpacity 
                style={styles.walletOption} 
                onPress={() => setMode('create')}
              >
                <View style={styles.walletOptionHeader}>
                  <MaterialCommunityIcons name="plus-circle" size={24} color="#FF5733" />
                  <Text style={styles.walletOptionTitle}>Create New Embedded Wallet</Text>
                </View>
                <Text style={styles.walletOptionDescription}>
                  Create a new secure wallet with password protection and biometric support.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.walletOption} 
                onPress={() => setMode('retrieve')}
              >
                <View style={styles.walletOptionHeader}>
                  <MaterialCommunityIcons name="download" size={24} color="#FF5733" />
                  <Text style={styles.walletOptionTitle}>Restore Embedded Wallet</Text>
                </View>
                <Text style={styles.walletOptionDescription}>
                  Access your existing embedded wallet with your password.
                </Text>
              </TouchableOpacity>

              {/* Only show Seeker option on Seeker devices */}
              {showSeekerOption && (
                <TouchableOpacity 
                  style={styles.walletOption} 
                  onPress={() => setMode('seeker')}
                >
                  <View style={styles.walletOptionHeader}>
                    <MaterialCommunityIcons name="cellphone" size={24} color="#FF5733" />
                    <Text style={styles.walletOptionTitle}>Connect Seeker Wallet</Text>
                  </View>
                  <Text style={styles.walletOptionDescription}>
                    Use your Seeker phone's built-in hardware wallet for maximum security.
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'create' && (
            <>
              <Text style={styles.modalTitle}>Create Embedded Wallet</Text>
              <Text style={styles.modalText}>Set a password to secure your wallet:</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Password (min 8 characters)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholderTextColor="#999"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholderTextColor="#999"
              />
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleCreateWallet}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.actionButtonText}>Create Wallet</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode('menu')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'retrieve' && (
            <>
              <Text style={styles.modalTitle}>Restore Embedded Wallet</Text>
              <Text style={styles.modalText}>Enter your password to access your wallet:</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholderTextColor="#999"
              />
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleRetrieveWallet}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.actionButtonText}>Restore Wallet</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode('menu')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'seeker' && (
            <>
              <Text style={styles.modalTitle}>Connect Seeker Wallet</Text>
              <Text style={styles.modalText}>
                Make sure you have the Seeker Wallet app installed and unlocked.
              </Text>
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleConnectSeeker}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.actionButtonText}>Connect Seeker Wallet</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode('menu')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </Modal>
  );
};

export default ConnectButton;
