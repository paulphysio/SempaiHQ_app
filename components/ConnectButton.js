import React, { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import Modal from 'react-native-modal';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as solanaWeb3 from '@solana/web3.js';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { RPC_URL } from '../constants';
import { styles } from '../styles/ConnectButtonStyles';

// Embedded Wallet Context
export const EmbeddedWalletContext = createContext();

// SecureStore wrapper for web compatibility
const secureStoreWrapper = {
  setItemAsync: async (key, value) => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
        console.log(`[secureStoreWrapper] Set ${key} in localStorage`);
        return;
      } catch (err) {
        throw new Error(`Failed to set item in localStorage: ${err.message}`);
      }
    } else {
      try {
        await SecureStore.setItemAsync(key, value);
        console.log(`[secureStoreWrapper] Set ${key} in SecureStore`);
      } catch (err) {
        throw new Error(`Failed to set item in SecureStore: ${err.message}`);
      }
    }
  },
  getItemAsync: async (key) => {
    if (Platform.OS === 'web') {
      try {
        const value = localStorage.getItem(key);
        console.log(`[secureStoreWrapper] Got ${key} from localStorage: ${value ? 'found' : 'null'}`);
        return value;
      } catch (err) {
        throw new Error(`Failed to get item from localStorage: ${err.message}`);
      }
    } else {
      try {
        const value = await SecureStore.getItemAsync(key);
        console.log(`[secureStoreWrapper] Got ${key} from SecureStore: ${value ? 'found' : 'null'}`);
        return value;
      } catch (err) {
        throw new Error(`Failed to get item from SecureStore: ${err.message}`);
      }
    }
  },
  deleteItemAsync: async (key) => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
        console.log(`[secureStoreWrapper] Deleted ${key} from localStorage`);
        return;
      } catch (err) {
        throw new Error(`Failed to delete item from localStorage: ${err.message}`);
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(key);
        console.log(`[secureStoreWrapper] Deleted ${key} from SecureStore`);
      } catch (err) {
        throw new Error(`Failed to delete item in SecureStore: ${err.message}`);
      }
    }
  },
};

export const EmbeddedWalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [secretKey, setSecretKey] = useState(null); // Store secret key in memory
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');

  // Restore wallet state on mount
  useEffect(() => {
    const restoreWallet = async () => {
      try {
        setIsLoading(true);
        console.log('[restoreWallet] Starting wallet restoration');
        const publicKey = await secureStoreWrapper.getItemAsync('walletPublicKey');
        const walletAddress = await secureStoreWrapper.getItemAsync('walletAddress');

        if (publicKey) {
          setWallet({ publicKey });
          setIsWalletConnected(true);
          console.log('[restoreWallet] Restored wallet:', { publicKey });
          // Note: We don't restore secretKey here to ensure passwordless transactions require fresh login
          if (!walletAddress) {
            await AsyncStorage.setItem('walletAddress', publicKey);
            await secureStoreWrapper.setItemAsync('walletAddress', publicKey);
            console.log('[restoreWallet] Synced walletAddress to AsyncStorage and secureStoreWrapper:', publicKey);
          }
        } else {
          console.log('[restoreWallet] No wallet found in storage');
        }
      } catch (err) {
        console.error('[restoreWallet] Error restoring wallet:', err.message);
        setError('Failed to restore wallet: ' + err.message);
      } finally {
        setIsLoading(false);
        console.log('[restoreWallet] Restoration complete, isLoading set to false');
      }
    };

    restoreWallet();
  }, []);

  const createEmbeddedWallet = async (password) => {
    try {
      setIsLoading(true);
      console.log('[createEmbeddedWallet] Generating new keypair');
      const keypair = solanaWeb3.Keypair.generate();
      const publicKey = keypair.publicKey.toString();
      const secretKeyBytes = keypair.secretKey;
      const secretKeyBase58 = bs58.encode(secretKeyBytes);

      const storageKey = `wallet-secret-${publicKey}-${password}`;
      console.log('[createEmbeddedWallet] Storing keys:', { publicKey, storageKey });
      await secureStoreWrapper.setItemAsync(storageKey, secretKeyBase58);
      await secureStoreWrapper.setItemAsync('walletPublicKey', publicKey);
      await secureStoreWrapper.setItemAsync('walletAddress', publicKey);
      await AsyncStorage.setItem('walletAddress', publicKey);

      setWallet({ publicKey });
      setSecretKey(secretKeyBytes); // Store secret key in memory
      setIsWalletConnected(true);
      console.log('[createEmbeddedWallet] Wallet created successfully:', { publicKey });
      return { publicKey, privateKey: secretKeyBase58 };
    } catch (err) {
      console.error('[createEmbeddedWallet] Error creating wallet:', err.message);
      setError('Failed to create wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
      console.log('[createEmbeddedWallet] Creation complete, isLoading set to false');
    }
  };

  const importEmbeddedWallet = async (privateKeyInput, password) => {
    try {
      setIsLoading(true);
      console.log('[importEmbeddedWallet] Importing wallet with private key input');

      if (!privateKeyInput || typeof privateKeyInput !== 'string') {
        throw new Error('Private key is required and must be a string');
      }

      const cleanedInput = privateKeyInput.trim().replace(/^0x/i, '');
      let privateKeyBytes;

      try {
        const parsed = JSON.parse(cleanedInput);
        if (Array.isArray(parsed) && parsed.length === 64 && parsed.every(n => typeof n === 'number' && n >= 0 && n <= 255)) {
          privateKeyBytes = Buffer.from(parsed);
          console.log('[importEmbeddedWallet] Parsed JSON array private key');
        }
      } catch {
        // Not a JSON array
      }

      if (!privateKeyBytes) {
        try {
          privateKeyBytes = bs58.decode(cleanedInput);
          if (privateKeyBytes.length !== 64) {
            throw new Error(`Invalid base58 private key size: expected 64 bytes, got ${privateKeyBytes.length} bytes`);
          }
          console.log('[importEmbeddedWallet] Parsed base58 private key');
        } catch {
          if (!/^[0-9a-fA-F]+$/i.test(cleanedInput)) {
            throw new Error('Private key must be a valid hex string, base58 string, or JSON array of 64 bytes');
          }
          privateKeyBytes = Buffer.from(cleanedInput, 'hex');
          if (privateKeyBytes.length !== 64) {
            throw new Error(`Invalid hex private key size: expected 64 bytes, got ${privateKeyBytes.length} bytes`);
          }
          console.log('[importEmbeddedWallet] Parsed hex private key');
        }
      }

      const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = keypair.publicKey.toString();
      const secretKeyBase58 = bs58.encode(privateKeyBytes);

      const storageKey = `wallet-secret-${publicKey}-${password}`;
      console.log('[importEmbeddedWallet] Storing keys:', { publicKey, storageKey });
      await secureStoreWrapper.setItemAsync(storageKey, secretKeyBase58);
      await secureStoreWrapper.setItemAsync('walletPublicKey', publicKey);
      await secureStoreWrapper.setItemAsync('walletAddress', publicKey);
      await AsyncStorage.setItem('walletAddress', publicKey);

      setWallet({ publicKey });
      setSecretKey(privateKeyBytes); // Store secret key in memory
      setIsWalletConnected(true);
      console.log('[importEmbeddedWallet] Wallet imported successfully:', { publicKey });
      return { publicKey, privateKey: secretKeyBase58 };
    } catch (err) {
      console.error('[importEmbeddedWallet] Error importing wallet:', err.message);
      setError('Failed to import wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
      console.log('[importEmbeddedWallet] Import complete, isLoading set to false');
    }
  };

  const disconnectWallet = async () => {
    try {
      console.log('[disconnectWallet] Disconnecting wallet');
      await secureStoreWrapper.deleteItemAsync('walletPublicKey');
      await secureStoreWrapper.deleteItemAsync('walletAddress');
      await secureStoreWrapper.deleteItemAsync('embeddedWallet');
      await AsyncStorage.removeItem('walletAddress');
      setWallet(null);
      setSecretKey(null); // Clear secret key from memory
      setIsWalletConnected(false);
      setError(null);
      console.log('[disconnectWallet] Wallet disconnected successfully');
    } catch (err) {
      console.error('[disconnectWallet] Error disconnecting wallet:', err.message);
      setError('Failed to disconnect wallet: ' + err.message);
    }
  };

  const getSecretKey = async (password) => {
    if (!wallet?.publicKey) {
      throw new Error('No wallet connected');
    }
    const storageKey = `wallet-secret-${wallet.publicKey}-${password}`;
    console.log('[getSecretKey] Retrieving secret key:', { storageKey });
    const secretKeyBase58 = await secureStoreWrapper.getItemAsync(storageKey);
    if (!secretKeyBase58) {
      throw new Error('Invalid password or secret key not found');
    }
    try {
      const secretKeyBytes = bs58.decode(secretKeyBase58);
      if (secretKeyBytes.length !== 64) {
        throw new Error('Invalid secret key format');
      }
      console.log('[getSecretKey] Secret key retrieved successfully');
      return secretKeyBytes;
    } catch (err) {
      console.error('[getSecretKey] Error decoding secret key:', err.message);
      throw new Error('Failed to decode secret key: ' + err.message);
    }
  };

  const signAndSendTransaction = async (transaction, password) => {
    if (!wallet?.publicKey) {
      throw new Error('No wallet connected');
    }
    console.log('[signAndSendTransaction] Signing transaction');
    let keypair;
    if (secretKey) {
      console.log('[signAndSendTransaction] Using in-memory secret key');
      keypair = solanaWeb3.Keypair.fromSecretKey(secretKey);
    } else if (password) {
      console.log('[signAndSendTransaction] Retrieving secret key with password');
      const secretKeyBytes = await getSecretKey(password);
      keypair = solanaWeb3.Keypair.fromSecretKey(secretKeyBytes);
    } else {
      throw new Error('No secret key or password provided');
    }
    transaction.sign([keypair]);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });
    console.log('[signAndSendTransaction] Transaction signed and sent:', { signature });
    return signature;
  };

  return (
    <EmbeddedWalletContext.Provider
      value={{
        wallet,
        secretKey, // Expose secretKey in context
        isWalletConnected,
        createEmbeddedWallet,
        importEmbeddedWallet,
        disconnectWallet,
        getSecretKey,
        signAndSendTransaction,
        isLoading,
        error,
      }}
    >
      {children}
    </EmbeddedWalletContext.Provider>
  );
};

const ConnectButton = () => {
  const { wallet, createEmbeddedWallet, importEmbeddedWallet, disconnectWallet, isLoading, error } = useContext(EmbeddedWalletContext);
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [privateKey, setPrivateKey] = useState(null);
  const [userCreated, setUserCreated] = useState(false);
  const [showReferralPrompt, setShowReferralPrompt] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false); // For debouncing

  const createUserAndBalance = useCallback(async (publicKey) => {
    if (!publicKey) {
      console.warn('[createUserAndBalance] No publicKey provided, skipping user creation:', { publicKey });
      return;
    }

    if (isCreatingUser) {
      console.log('[createUserAndBalance] User creation already in progress, skipping:', { publicKey });
      return;
    }

    setIsCreatingUser(true);
    try {
      console.log('[createUserAndBalance] Starting user creation for publicKey:', publicKey);

      // Check for existing user
      console.log('[createUserAndBalance] Checking for existing user in Supabase');
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, referral_code, has_updated_profile')
        .eq('wallet_address', publicKey)
        .single();

      if (existingUser) {
        console.log('[createUserAndBalance] User already exists:', {
          id: existingUser.id,
          referral_code: existingUser.referral_code,
          has_updated_profile: existingUser.has_updated_profile,
        });
        setUserCreated(true);
        if (!existingUser.has_updated_profile) {
          console.log('[createUserAndBalance] User has not updated profile, showing referral prompt');
          setShowReferralPrompt(true);
        }
        // Sync storage
        console.log('[createUserAndBalance] Syncing walletAddress to storage');
        await AsyncStorage.setItem('walletAddress', publicKey);
        await secureStoreWrapper.setItemAsync('walletAddress', publicKey);
        return;
      }

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[createUserAndBalance] Error checking user:', fetchError);
        throw new Error(`Failed to check user: ${fetchError.message}`);
      }

      // Create new user with upsert
      console.log('[createUserAndBalance] No user found, creating new user');
      let userId;
      const url = new URL(Platform.OS === 'web' ? window.location.href : 'http://localhost');
      const referralCodeFromUrl = url.searchParams.get('ref');
      console.log('[createUserAndBalance] Referral code from URL:', referralCodeFromUrl);
      let referredBy = null;

      if (referralCodeFromUrl) {
        console.log('[createUserAndBalance] Looking up referral code:', referralCodeFromUrl);
        const { data: referrer, error: referrerError } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referralCodeFromUrl)
          .single();
        if (referrerError) {
          console.warn('[createUserAndBalance] Error fetching referrer:', referrerError.message);
        } else if (referrer) {
          referredBy = referrer.id;
          console.log('[createUserAndBalance] Found referrer:', referrer.id);
        }
      }

      // Generate unique referral code
      let referralCode;
      let isUnique = false;
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      console.log('[createUserAndBalance] Generating unique referral code');
      while (!isUnique) {
        referralCode = Array.from({ length: 8 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
        console.log('[createUserAndBalance] Checking referral code:', referralCode);
        const { data: existingCode, error: codeError } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referralCode)
          .single();
        if (codeError && codeError.code === 'PGRST116') {
          isUnique = true;
          console.log('[createUserAndBalance] Referral code is unique:', referralCode);
        } else if (codeError) {
          console.error('[createUserAndBalance] Error checking referral code:', codeError);
          throw new Error(`Failed to check referral code: ${codeError.message}`);
        }
      }

      // Upsert user
      console.log('[createUserAndBalance] Upserting user with wallet_address:', publicKey);
      const { data: user, error: userError } = await supabase
        .from('users')
        .upsert(
          {
            wallet_address: publicKey,
            referral_code: referralCode,
            referred_by: referredBy,
            has_updated_profile: false,
          },
          { onConflict: 'wallet_address' }
        )
        .select('id')
        .single();

      if (userError) {
        console.error('[createUserAndBalance] Error creating user:', userError);
        throw new Error(`Failed to create user: ${userError.message}`);
      }

      userId = user.id;
      console.log('[createUserAndBalance] User created successfully:', { userId, referral_code: referralCode });

      // Create initial wallet balance
      console.log('[createUserAndBalance] Creating initial wallet balance');
      const { error: balanceError } = await supabase.from('wallet_balances').insert([
        {
          user_id: userId,
          chain: 'SOL',
          currency: 'SMP',
          amount: 0,
          decimals: 0,
          wallet_address: publicKey,
        },
      ]);

      if (balanceError) {
        console.error('[createUserAndBalance] Error creating wallet balance:', balanceError);
        throw new Error(`Failed to create wallet balance: ${balanceError.message}`);
      }

      console.log('[createUserAndBalance] Wallet balance created successfully');
      setUserCreated(true);
      setShowReferralPrompt(true); // Prompt for profile update
      // Sync storage
      console.log('[createUserAndBalance] Syncing walletAddress to storage');
      await AsyncStorage.setItem('walletAddress', publicKey);
      await secureStoreWrapper.setItemAsync('walletAddress', publicKey);
    } catch (err) {
      console.error('[createUserAndBalance] Error in createUserAndBalance:', err.message);
      setError(`Failed to initialize user: ${err.message}`);
    } finally {
      setIsCreatingUser(false);
      console.log('[createUserAndBalance] User creation complete, isCreatingUser set to false');
    }
  }, [isCreatingUser]);

  const handleCreateWallet = useCallback(async () => {
    if (!password || !confirmPassword) {
      setError('Please fill in both password fields.');
      console.log('[handleCreateWallet] Missing password or confirmPassword');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      console.log('[handleCreateWallet] Passwords do not match');
      return;
    }
    try {
      console.log('[handleCreateWallet] Creating embedded wallet');
      const result = await createEmbeddedWallet(password);
      if (result) {
        setPrivateKey(result.privateKey);
        console.log('[handleCreateWallet] Wallet created, privateKey stored');
        await createUserAndBalance(result.publicKey);
        setShowCreateForm(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        setError('Failed to create wallet. Please try again.');
        console.log('[handleCreateWallet] Wallet creation failed');
      }
    } catch (err) {
      console.error('[handleCreateWallet] Error creating wallet:', err.message);
      setError(`Failed to create wallet: ${err.message}`);
    }
  }, [password, confirmPassword, createEmbeddedWallet, createUserAndBalance]);

  const handleImportWallet = useCallback(async () => {
    if (!privateKeyInput || !password) {
      setError('Please provide both private key and password.');
      console.log('[handleImportWallet] Missing privateKeyInput or password');
      return;
    }
    try {
      console.log('[handleImportWallet] Importing embedded wallet');
      const result = await importEmbeddedWallet(privateKeyInput, password);
      if (result) {
        setPrivateKey(result.privateKey);
        console.log('[handleImportWallet] Wallet imported, privateKey stored');
        await createUserAndBalance(result.publicKey);
        setShowImportForm(false);
        setPrivateKeyInput('');
        setPassword('');
      } else {
        setError('Failed to import wallet. Please check your private key and password.');
        console.log('[handleImportWallet] Wallet import failed');
      }
    } catch (err) {
      console.error('[handleImportWallet] Error importing wallet:', err.message);
      setError(`Failed to import wallet: ${err.message}`);
    }
  }, [privateKeyInput, password, importEmbeddedWallet, createUserAndBalance]);

  const handleCopyPrivateKey = useCallback(async () => {
    if (privateKey) {
      try {
        await Clipboard.setStringAsync(privateKey);
        console.log('[handleCopyPrivateKey] Private key copied to clipboard');
        Alert.alert('Success', 'Private key copied to clipboard. Store it securely.');
      } catch (err) {
        console.error('[handleCopyPrivateKey] Error copying private key:', err.message);
        setError('Failed to copy private key.');
      }
    }
  }, [privateKey]);

  const handleDisconnect = useCallback(async () => {
    try {
      console.log('[handleDisconnect] Initiating wallet disconnection');
      await disconnectWallet();
      setPrivateKey(null);
      setUserCreated(false);
      setShowReferralPrompt(false);
      console.log('[handleDisconnect] Wallet disconnected, state reset');
      Alert.alert('Success', 'Wallet disconnected.');
    } catch (err) {
      console.error('[handleDisconnect] Error disconnecting wallet:', err.message);
      setError('Failed to disconnect wallet.');
    }
  }, [disconnectWallet]);

  const handleReferralPrompt = async () => {
    try {
      const hasReferralCode = await AsyncStorage.getItem('hasReferralCode');
      if (!hasReferralCode) {
        Alert.alert(
          'Referral Code',
          'Would you like to add a referral code to earn rewards?',
          [
            {
              text: 'Yes',
              onPress: () => {
                console.log('[handleReferralPrompt] Navigating to profile for update');
                navigation.navigate('EditProfile');
              },
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
    setShowImportForm(false);
    setPassword('');
    setConfirmPassword('');
    setPrivateKeyInput('');
    setError(null);
    console.log('[handleCloseModal] Modal closed, state reset');
  }, []);

  const renderModalContent = () => {
    if (privateKey) {
      return (
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Wallet Created</Text>
          <Text style={styles.modalText}>Your wallet has been created successfully!</Text>
          <Text style={styles.modalText}>
            Public Key: {wallet?.publicKey?.slice(0, 6)}...{wallet?.publicKey?.slice(-4)}
          </Text>
          <TouchableOpacity style={styles.actionButton} onPress={handleCopyPrivateKey}>
            <Text style={styles.actionButtonText}>Copy Private Key</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCloseModal}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (showCreateForm) {
      return (
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create New Wallet</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Password input"
          />
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Confirm Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            accessibilityLabel="Confirm password input"
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity style={styles.actionButton} onPress={handleCreateWallet} disabled={isLoading}>
            <Text style={styles.actionButtonText}>{isLoading ? 'Creating...' : 'Create Wallet'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowCreateForm(false)}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (showImportForm) {
      return (
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Import Wallet</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Private Key (Base58, Hex, or JSON)"
            placeholderTextColor="#888"
            value={privateKeyInput}
            onChangeText={setPrivateKeyInput}
            accessibilityLabel="Private key input"
          />
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Password input"
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity style={styles.actionButton} onPress={handleImportWallet} disabled={isLoading}>
            <Text style={styles.actionButtonText}>{isLoading ? 'Importing...' : 'Import Wallet'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowImportForm(false)}>
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
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowImportForm(true)}>
          <Text style={styles.actionButtonText}>Import Wallet</Text>
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
        <Text style={styles.connectButtonText}>
          {isLoading
            ? 'Loading...'
            : wallet
            ? `${wallet.publicKey.slice(0, 6)}...${wallet.publicKey.slice(-4)}`
            : 'Connect Wallet'}
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
          <Text style={styles.modalText}>
            Please update your profile to continue and unlock referral benefits.
          </Text>
          <TouchableOpacity style={styles.actionButton} onPress={handleReferralPrompt}>
            <Text style={styles.actionButtonText}>Update Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowReferralPrompt(false)}>
            <Text style={styles.secondaryButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

export default ConnectButton;
