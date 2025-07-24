import React, { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, TextInput, Clipboard, ToastAndroid, ActivityIndicator } from 'react-native';
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

  const disconnectWallet = useCallback(async () => {
    try {
      console.log('[disconnectWallet] Disconnecting wallet');
      await secureStoreWrapper.deleteItemAsync('walletData');
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

  useEffect(() => {
    if (authLoading) return; // Wait for auth/session restore to finish
    const restoreWallet = async () => {
      if (!user || user.isGuest) {
        console.log('[restoreWallet] No authenticated user or guest user, skipping wallet restore');
        return;
      }
      try {
        setIsLoading(true);
        console.log('[restoreWallet] Restoring wallet for user:', user.email);
        const storedUseBiometrics = (await secureStoreWrapper.getItemAsync('useBiometrics', false)) === 'true';
        setUseBiometrics(storedUseBiometrics);

        const walletDataStr = await secureStoreWrapper.getItemAsync('walletData', storedUseBiometrics);
        if (!walletDataStr) {
          console.log('[restoreWallet] No wallet data in storage');
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
          console.log('[restoreWallet] Missing wallet data fields');
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
          console.log('[restoreWallet] Wallet restored:', publicKey);
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
      console.log('[createEmbeddedWallet] Creating wallet for:', user.email);

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

      setWallet({ publicKey });
      setSecretKey(secretKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      console.log('[createEmbeddedWallet] Wallet created:', publicKey.toString());
      return { publicKey: publicKey.toString(), privateKey: secretKeyBase58 };
    } catch (err) {
      console.error('[createEmbeddedWallet] Error:', err.message);
      setError('Failed to create wallet: ' + err.message);
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
      console.log('[retrieveEmbeddedWallet] Retrieving wallet for:', user.email);

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

      setWallet({ publicKey });
      setSecretKey(privateKeyBytes);
      setTransactionPassword(hashedPassword);
      setIsWalletConnected(true);
      console.log('[retrieveEmbeddedWallet] Wallet retrieved:', publicKeyStr);
      return { publicKey: publicKeyStr, privateKey: privateKeyBase58 };
    } catch (err) {
      console.error('[retrieveEmbeddedWallet] Error:', err.message);
      setError(`Failed to retrieve wallet: ${err.message}`);
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
    const biometricsEnabled = (await AsyncStorage.getItem('useBiometrics')) === 'true';
    console.log(`[signAndSendTransaction] Biometrics enabled: ${biometricsEnabled}`);

    if (!biometricsEnabled && !inputPassword) {
      console.log('[signAndSendTransaction] Biometrics not enabled and no password, showing modal.');
      setPendingTransaction(transaction);
      setPasswordModalVisible(true);
      return new Promise((resolve, reject) => {
        setResolveTransaction({ resolve, reject });
      });
    }

    if (!wallet?.publicKey) throw new Error('No wallet connected');
    
    try {
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

      const isVersionedTransaction = transaction.version !== undefined;

      if (!isVersionedTransaction) {
        transaction.feePayer = wallet.publicKey;
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
      }

      if (isVersionedTransaction) {
        transaction.sign([keypair]);
      } else {
        transaction.partialSign(keypair);
      }

      const serializedTx = transaction.serialize();
      const signature = await connection.sendRawTransaction(serializedTx, { skipPreflight: false, maxRetries: 2 });

      console.log('[signAndSendTransaction] Signature:', signature);
      return signature;
    } catch (err) {
      console.error('[signAndSendTransaction] Error:', err);
      if (resolveTransaction) {
        resolveTransaction.reject(err);
      }
      throw err;
    }
  }, [wallet, verifyPassword, resolveTransaction]);

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
        isLoading, // Expose wallet loading state
        error,
        useBiometrics,
        setUseBiometrics,
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
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const checkUserActivityTable = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('user_id')
        .limit(1);
      if (error && error.code === '42P01') {
        console.warn('[checkUserActivityTable] Table "user_activity" does not exist');
        return false;
      }
      if (error) {
        console.error('[checkUserActivityTable] Error checking table:', error.message);
        throw new Error(`Failed to check user_activity table: ${error.message}`);
      }
      console.log('[checkUserActivityTable] Table "user_activity" exists');
      return true;
    } catch (err) {
      console.error('[checkUserActivityTable] Unexpected error:', err.message);
      setModalError('Unable to verify token claim eligibility. Please try again or contact support.');
      return false;
    }
  }, []);

  const checkUserActivityEntry = useCallback(async (userId) => {
    if (!userId || typeof userId !== 'string') {
      console.error('[checkUserActivityEntry] Invalid userId:', userId);
      throw new Error('Invalid user ID');
    }
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('user_id, has_claimed_airdrop')
        .eq('user_id', userId)
        .single();
      if (error && error.code === 'PGRST116') {
        console.log('[checkUserActivityEntry] No entry for user:', userId);
        return false;
      }
      if (error) {
        console.error('[checkUserActivityEntry] Error checking user entry:', error.message);
        throw new Error(`User activity check failed: ${error.message}`);
      }
      console.log('[checkUserActivityEntry] Entry exists for user:', userId, 'has_claimed_airdrop:', data.has_claimed_airdrop);
      return !!data && data.has_claimed_airdrop;
    } catch (err) {
      console.error('[checkUserActivityEntry] Unexpected error:', err.message);
      setModalError('Unable to verify user activity. Please try again or contact support.');
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
      console.log('[handleCreateWallet] Creating wallet for user:', user?.email);
      const result = await createEmbeddedWallet(password);
      if (!result) {
        throw new Error('Wallet creation failed');
      }

      const userId = await createUserAndBalance(result.publicKey);
      setShowPasswordSetup(false);
      setShowCreateForm(false);
      setShowModal(false);
      setIsCreateMode(false);

      // Check eligibility for token claim
      const tableExists = await checkUserActivityTable();
      if (tableExists) {
        const hasActivityEntry = await checkUserActivityEntry(userId);
        if (!hasActivityEntry) {
          console.log('[handleCreateWallet] User eligible for token claim, showing TokenClaimModal');
          setShowTokenClaimModal(true);
        } else {
          console.log('[handleCreateWallet] User has activity entry or has claimed, skipping TokenClaimModal');
        }
      } else {
        console.warn('[handleCreateWallet] user_activity table missing, skipping token claim');
        Alert.alert(
          'Info',
          'Wallet created successfully, but token claiming is unavailable due to missing configuration. Please contact support.'
        );
      }

      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('[handleCreateWallet] Error:', err.message);
      setModalError(`Failed to create wallet: ${err.message}`);
    } finally {
      setIsCreatingWallet(false);
    }
  }, [password, confirmPassword, createEmbeddedWallet, createUserAndBalance, checkUserActivityTable, checkUserActivityEntry, user]);

  const handleRetrieveWallet = useCallback(async () => {
    if (password !== confirmPassword) {
      setModalError('Passwords do not match');
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      setModalError('Password must be at least 8 characters long');
      return;
    }
    try {
      setIsCreatingWallet(true);
      console.log('[handleRetrieveWallet] Retrieving wallet for user:', user?.email);
      const result = await retrieveEmbeddedWallet(password);
      if (!result) {
        throw new Error('Wallet retrieval failed');
      }

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

      // Check eligibility for token claim
      const tableExists = await checkUserActivityTable();
      if (tableExists) {
        const hasActivityEntry = await checkUserActivityEntry(userData.id);
        if (!hasActivityEntry) {
          console.log('[handleRetrieveWallet] User eligible for token claim, showing TokenClaimModal');
          setShowTokenClaimModal(true);
        } else {
          console.log('[handleRetrieveWallet] User has activity entry or has claimed, skipping TokenClaimModal');
        }
      } else {
        console.warn('[handleRetrieveWallet] user_activity table missing, skipping token claim');
        Alert.alert(
          'Info',
          'Wallet retrieved successfully, but token claiming is unavailable due to missing configuration. Please contact support.'
        );
      }

      setPassword('');
      setConfirmPassword('');
      console.log('[handleRetrieveWallet] Wallet retrieved successfully for publicKey:', result.publicKey);
    } catch (err) {
      console.error('[handleRetrieveWallet] Error:', err.message);
      setModalError(`Failed to retrieve wallet: ${err.message}`);
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

  const copyWalletAddress = useCallback(() => {
    if (wallet) {
      const address = wallet.publicKey.toString();
      Clipboard.setString(address);
      setCopySuccess(true);
      
      // Show toast on Android
      if (Platform.OS === 'android') {
        ToastAndroid.show('Wallet address copied!', ToastAndroid.SHORT);
      }
      
      // Reset the success state after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
      
      setShowDropdown(false);
    }
  }, [wallet]);

  const handleDisconnectRequest = () => {
    setShowDropdown(false);
    setShowDisconnectModal(true);
  };

  const confirmDisconnect = async () => {
    setShowDisconnectModal(false);
    try {
      await disconnectWallet();
      setUserCreated(false);
      setShowReferralPrompt(false);
    } catch (err) {
      console.error('[handleDisconnect] Error:', err.message);
      setModalError('Failed to disconnect wallet: ' + err.message);
    }
  };

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
    // console.log('[renderModalContent] States:', {
    //   showModal,
    //   showCreateForm,
    //   showRetrieveForm,
    //   showPasswordSetup,
    //   isCreateMode,
    // });

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
            {isCreateMode ? 'Create Wallet' : 'Retrieve Wallet'}
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

  // Render the dropdown menu when wallet is connected
  const renderDropdown = () => {
    if (!showDropdown || !wallet) return null;
    
    return (
      <View style={styles.dropdown}>
        <TouchableOpacity style={styles.dropdownItem} onPress={copyWalletAddress}>
          <MaterialCommunityIcons name="content-copy" size={18} color="#333" />
          <Text style={styles.dropdownText}>Copy Address</Text>
          {copySuccess && <Ionicons name="checkmark-circle" size={16} color="#FF5733" style={styles.successIcon} />}
        </TouchableOpacity>
        
        <View style={styles.dropdownDivider} />
        
        <TouchableOpacity style={styles.dropdownItem} onPress={handleDisconnectRequest}>
          <MaterialCommunityIcons name="logout" size={18} color="#f44336" />
          <Text style={[styles.dropdownText, styles.disconnectText]}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Disconnect confirmation modal
  const renderDisconnectModal = () => {
    return (
      <Modal
        isVisible={showDisconnectModal}
        onBackdropPress={() => setShowDisconnectModal(false)}
        backdropOpacity={0.5}
        animationIn="fadeIn"
        animationOut="fadeOut"
        style={styles.disconnectModal}
      >
        <View style={styles.disconnectModalContent}>
          <FontAwesome5 name="exclamation-circle" size={50} color="#FF5733" style={styles.warningIcon} />
          <Text style={styles.disconnectModalTitle}>Disconnect Wallet?</Text>
          <Text style={styles.disconnectModalText}>
            Are you sure you want to disconnect your wallet? You will need your password to reconnect.
          </Text>
          <View style={styles.disconnectModalButtons}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowDisconnectModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={confirmDisconnect}
            >
              <Text style={styles.confirmButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.connectButtonWrapper}
          onPress={() => {
            console.log('[ConnectButton] Pressed:', wallet ? 'Toggle dropdown' : 'Connect');
            if (wallet) {
              setShowDropdown(!showDropdown);
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
            style={styles.connectButtonGradient}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={styles.connectButtonText}>Load</Text>
              </View>
            ) : wallet ? (
              <View style={styles.walletInfoContainer}>
                <View style={styles.walletAddressContainer}>
                  <MaterialCommunityIcons name="wallet-outline" size={14} color="#ffffff" style={styles.walletIcon} />
                  <Text style={styles.connectButtonText}>
                    {`${wallet.publicKey.toString().slice(0, 2)}...${wallet.publicKey.toString().slice(-2)}`}
                  </Text>
                </View>
                <Ionicons
                  name={showDropdown ? "chevron-up" : "chevron-down"}
                  size={12}
                  color="#ffffff"
                  style={styles.dropdownIcon}
                />
              </View>
            ) : (
              <View style={styles.walletInfoContainer}>
                <MaterialCommunityIcons name="wallet-plus-outline" size={14} color="#ffffff" style={styles.walletIcon} />
                <Text style={styles.connectButtonText}>
                  {user && !user.isGuest ? 'Connect' : 'Sign In'}
                </Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
        {renderDropdown()}
      </View>

      <Modal
        isVisible={showModal}
        onBackdropPress={handleCloseModal}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        {renderModalContent()}
      </Modal>

      {renderDisconnectModal()}

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
        userId={user?.id}
        onTokenClaim={async () => {
          try {
            console.log('[TokenClaimModal] Invoking airdrop-function/airdrop for user:', user?.id);
            if (!user?.id) {
              throw new Error('User not available');
            }
            const { data, error } = await supabase.functions.invoke('airdrop-function/airdrop', {
              body: JSON.stringify({ user_id: user.id }),
              method: 'POST',
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