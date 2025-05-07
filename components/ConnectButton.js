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
        return;
      } catch (err) {
        throw new Error(`Failed to set item in localStorage: ${err.message}`);
      }
    } else {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (err) {
        throw new Error(`Failed to set item in SecureStore: ${err.message}`);
      }
    }
  },
  getItemAsync: async (key) => {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (err) {
        throw new Error(`Failed to get item from localStorage: ${err.message}`);
      }
    } else {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (err) {
        throw new Error(`Failed to get item from SecureStore: ${err.message}`);
      }
    }
  },
  deleteItemAsync: async (key) => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
        return;
      } catch (err) {
        throw new Error(`Failed to delete item from localStorage: ${err.message}`);
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (err) {
        throw new Error(`Failed to delete item in SecureStore: ${err.message}`);
      }
    }
  },
};

export const EmbeddedWalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');

  // Restore wallet state on mount
  useEffect(() => {
    const restoreWallet = async () => {
      try {
        setIsLoading(true);
        const publicKey = await secureStoreWrapper.getItemAsync('walletPublicKey');
        const walletAddress = await secureStoreWrapper.getItemAsync('walletAddress');

        if (publicKey) {
          setWallet({ publicKey });
          setIsWalletConnected(true);
          console.log('Restored wallet from secureStoreWrapper:', publicKey);

          if (!walletAddress) {
            await AsyncStorage.setItem('walletAddress', publicKey);
            await secureStoreWrapper.setItemAsync('walletAddress', publicKey);
            console.log('Synced walletAddress to AsyncStorage and secureStoreWrapper:', publicKey);
          }
        }
      } catch (err) {
        console.error('Error restoring wallet:', err.message);
        setError('Failed to restore wallet: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    restoreWallet();
  }, []);

  const createEmbeddedWallet = async (password) => {
    try {
      setIsLoading(true);
      const keypair = solanaWeb3.Keypair.generate();
      const publicKey = keypair.publicKey.toString();
      const secretKey = keypair.secretKey;
      const secretKeyBase58 = bs58.encode(secretKey);

      const storageKey = `wallet-secret-${publicKey}-${password}`;
      await secureStoreWrapper.setItemAsync(storageKey, secretKeyBase58);
      await secureStoreWrapper.setItemAsync('walletPublicKey', publicKey);
      await secureStoreWrapper.setItemAsync('walletAddress', publicKey);
      await AsyncStorage.setItem('walletAddress', publicKey);

      setWallet({ publicKey });
      setIsWalletConnected(true);
      return { publicKey, privateKey: secretKeyBase58 };
    } catch (err) {
      setError('Failed to create wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const importEmbeddedWallet = async (privateKeyInput, password) => {
    try {
      setIsLoading(true);

      if (!privateKeyInput || typeof privateKeyInput !== 'string') {
        throw new Error('Private key is required and must be a string');
      }

      const cleanedInput = privateKeyInput.trim().replace(/^0x/i, '');
      let privateKeyBytes;

      try {
        const parsed = JSON.parse(cleanedInput);
        if (Array.isArray(parsed) && parsed.length === 64 && parsed.every(n => typeof n === 'number' && n >= 0 && n <= 255)) {
          privateKeyBytes = Buffer.from(parsed);
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
        } catch {
          if (!/^[0-9a-fA-F]+$/i.test(cleanedInput)) {
            throw new Error('Private key must be a valid hex string, base58 string, or JSON array of 64 bytes');
          }
          privateKeyBytes = Buffer.from(cleanedInput, 'hex');
          if (privateKeyBytes.length !== 64) {
            throw new Error(`Invalid hex private key size: expected 64 bytes, got ${privateKeyBytes.length} bytes`);
          }
        }
      }

      const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = keypair.publicKey.toString();
      const secretKeyBase58 = bs58.encode(privateKeyBytes);

      const storageKey = `wallet-secret-${publicKey}-${password}`;
      await secureStoreWrapper.setItemAsync(storageKey, secretKeyBase58);
      await secureStoreWrapper.setItemAsync('walletPublicKey', publicKey);
      await secureStoreWrapper.setItemAsync('walletAddress', publicKey);
      await AsyncStorage.setItem('walletAddress', publicKey);

      setWallet({ publicKey });
      setIsWalletConnected(true);
      return { publicKey, privateKey: secretKeyBase58 };
    } catch (err) {
      setError('Failed to import wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      await secureStoreWrapper.deleteItemAsync('walletPublicKey');
      await secureStoreWrapper.deleteItemAsync('walletAddress');
      await secureStoreWrapper.deleteItemAsync('embeddedWallet');
      await AsyncStorage.removeItem('walletAddress');
      setWallet(null);
      setIsWalletConnected(false);
      setError(null);
      console.log('Wallet disconnected, all storage cleared');
    } catch (err) {
      console.error('Disconnect wallet error:', err);
      setError('Failed to disconnect wallet: ' + err.message);
    }
  };

  const getSecretKey = async (password) => {
    if (!wallet?.publicKey) {
      throw new Error('No wallet connected');
    }
    const storageKey = `wallet-secret-${wallet.publicKey}-${password}`;
    const secretKeyBase58 = await secureStoreWrapper.getItemAsync(storageKey);
    if (!secretKeyBase58) {
      throw new Error('Invalid password or secret key not found');
    }
    try {
      const secretKeyBytes = bs58.decode(secretKeyBase58);
      if (secretKeyBytes.length !== 64) {
        throw new Error('Invalid secret key format');
      }
      return secretKeyBytes;
    } catch (err) {
      throw new Error('Failed to decode secret key: ' + err.message);
    }
  };

  const signAndSendTransaction = async (transaction, password) => {
    if (!wallet?.publicKey) {
      throw new Error('No wallet connected');
    }
    const secretKey = await getSecretKey(password);
    const keypair = solanaWeb3.Keypair.fromSecretKey(secretKey);
    transaction.sign([keypair]);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });
    return signature;
  };

  return (
    <EmbeddedWalletContext.Provider
      value={{
        wallet,
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

  const createUserAndBalance = useCallback(async (walletAddress) => {
    if (!walletAddress || !wallet?.publicKey) {
      console.warn('No active wallet, skipping user creation');
      return;
    }

    try {
      console.log('Attempting to create or fetch user for wallet:', walletAddress);

      // Check for existing user
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, referral_code, has_updated_profile')
        .eq('wallet_address', walletAddress)
        .single();

      if (existingUser) {
        console.log('User already exists:', existingUser);
        setUserCreated(true);
        if (!existingUser.has_updated_profile) {
          setShowReferralPrompt(true);
        }
        // Sync storage
        await AsyncStorage.setItem('walletAddress', walletAddress);
        await secureStoreWrapper.setItemAsync('walletAddress', walletAddress);
        return;
      }

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to check user: ${fetchError.message}`);
      }

      // Create new user
      console.log('No user found, creating new user...');
      let userId;
      const url = new URL(Platform.OS === 'web' ? window.location.href : 'http://localhost');
      const referralCodeFromUrl = url.searchParams.get('ref');
      let referredBy = null;

      if (referralCodeFromUrl) {
        const { data: referrer, error: referrerError } = await supabase
          .from('users')
          .select('wallet_address')
          .eq('referral_code', referralCodeFromUrl)
          .single();
        if (referrerError) {
          console.warn('Referrer lookup failed:', referrerError.message);
        } else {
          referredBy = referrer?.wallet_address || null;
        }
      }

      const newReferralCode = `${walletAddress.slice(0, 4)}${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
      const userData = {
        name: 'Testing',
        wallet_address: walletAddress,
        isWriter: false,
        isSuperuser: false,
        referral_code: newReferralCode,
        referred_by: referredBy,
        has_updated_profile: false,
      };
      console.log('Attempting to create user with data:', userData);

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert(userData)
        .select('id, referral_code')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          console.error('Duplicate key error. User data attempted:', userData);
          console.log('Fetching existing user due to race condition...');
          const { data: retryUser, error: retryError } = await supabase
            .from('users')
            .select('id, referral_code, has_updated_profile')
            .eq('wallet_address', walletAddress)
            .single();
          if (retryUser) {
            console.log('Existing user found after duplicate key error:', retryUser);
            setUserCreated(true);
            if (!retryUser.has_updated_profile) {
              setShowReferralPrompt(true);
            }
            // Sync storage
            await AsyncStorage.setItem('walletAddress', walletAddress);
            await secureStoreWrapper.setItemAsync('walletAddress', walletAddress);
            return;
          }
          throw new Error(`Failed to fetch user after duplicate key error: ${retryError?.message || 'Unknown error'}`);
        }
        throw new Error(`Failed to create user: ${insertError.message}`);
      }

      userId = newUser.id;
      console.log('New user created successfully:', newUser);
      setUserCreated(true);

      // Create wallet balance
      const { error: balanceError } = await supabase
        .from('wallet_balances')
        .insert({
          user_id: userId,
          wallet_address: walletAddress,
          chain: 'SOL',
          currency: 'SMP',
          decimals: 6,
          amount: 50000,
        });

      if (balanceError) {
        throw new Error(`Failed to create wallet balance: ${balanceError.message}`);
      }
      Alert.alert('Success', '50,000 SMP credited to your wallet!');

      // Sync storage
      await AsyncStorage.setItem('walletAddress', walletAddress);
      await secureStoreWrapper.setItemAsync('walletAddress', walletAddress);

      // Show referral prompt if referred
      if (referralCodeFromUrl) {
        setShowReferralPrompt(true);
      }
    } catch (err) {
      console.error('Error in createUserAndBalance:', err.message);
      Alert.alert('Error', err.message);
    }
  }, [wallet]);

  const handleCreateWallet = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long!');
      return;
    }
    const result = await createEmbeddedWallet(password);
    if (result) {
      await createUserAndBalance(result.publicKey);
      setPrivateKey(result.privateKey);
      setShowCreateForm(false);
      setPassword('');
      setConfirmPassword('');
    } else {
      Alert.alert('Error', error || 'Failed to create wallet');
    }
  };

  const handleImportWallet = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long!');
      return;
    }
    if (!privateKeyInput) {
      Alert.alert('Error', 'Please enter a private key!');
      return;
    }
    const result = await importEmbeddedWallet(privateKeyInput, password);
    if (result) {
      await createUserAndBalance(result.publicKey);
      setPrivateKey(null);
      setShowImportForm(false);
      setPassword('');
      setConfirmPassword('');
      setPrivateKeyInput('');
    } else {
      Alert.alert('Error', error || 'Failed to import wallet');
    }
  };

  const copyPrivateKey = async () => {
    await Clipboard.setStringAsync(privateKey);
    Alert.alert('Success', 'Private key copied to clipboard! Store it securely.');
    setPrivateKey(null);
  };

  const handlePromptClose = () => {
    setShowReferralPrompt(false);
    navigation.navigate('Home');
  };

  const handleProfileUpdate = () => {
    setShowReferralPrompt(false);
    navigation.navigate('EditProfile');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainerGradientStyle}>
        <Text style={styles.loadingTextGradientStyle}>Warping...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainerGradientStyle}>
        <Text style={styles.errorTextGradientStyle}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButtonGradientStyle} onPress={() => setError(null)}>
          <Text style={styles.retryButtonTextGradientStyle}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.containerGradientStyle}>
      {wallet ? (
        <View style={styles.walletInfoGradientStyle}>
          <Text style={styles.walletTextGradientStyle}>
            Wallet: {wallet.publicKey.slice(0, 4)}...{wallet.publicKey.slice(-4)}
          </Text>
          <TouchableOpacity style={styles.disconnectButton} onPress={disconnectWallet}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.connectButtonContainerGradientStyle}>
          <TouchableOpacity style={styles.connectButtonGradientStyle} onPress={() => setShowModal(true)}>
            <Text style={styles.connectButtonTextGradientStyle}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      )}
      {userCreated && (
        <Text style={styles.successMessageGradientStyle}>Welcome! Your wallet is ready.</Text>
      )}

      <Modal isVisible={showModal} onBackdropPress={() => setShowModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowModal(false)}>
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Choose Path</Text>
          <TouchableOpacity
            style={styles.submitButtonGradientStyle}
            onPress={() => {
              setShowModal(false);
              setShowCreateForm(true);
            }}
          >
            <Text style={styles.submitButtonTextGradientStyle}>Create Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.submitButtonGradientStyle}
            onPress={() => {
              setShowModal(false);
              setShowImportForm(true);
            }}
          >
            <Text style={styles.submitButtonTextGradientStyle}>Import Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButtonGradientStyle} onPress={() => setShowModal(false)}>
            <Text style={styles.cancelButtonTextGradientStyle}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal isVisible={showCreateForm} onBackdropPress={() => setShowCreateForm(false)}>
        <View style={styles.embeddedFormGradientStyle}>
          <TouchableOpacity style={styles.closeButtonGradientStyle} onPress={() => setShowCreateForm(false)}>
            <Text style={styles.cancelButtonTextGradientStyle}>X</Text>
          </TouchableOpacity>
          <Text style={styles.formTitleGradientStyle}>Create Wallet</Text>
          <Text style={styles.securityNoteGradientStyle}>Secure your cosmic key!</Text>
          <TextInput
            style={styles.inputGradientStyle}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.inputGradientStyle}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.submitButtonGradientStyle} onPress={handleCreateWallet}>
            <Text style={styles.submitButtonTextGradientStyle}>Create</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButtonGradientStyle} onPress={() => setShowCreateForm(false)}>
            <Text style={styles.cancelButtonTextGradientStyle}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal isVisible={showImportForm} onBackdropPress={() => setShowImportForm(false)}>
        <View style={styles.embeddedFormGradientStyle}>
          <TouchableOpacity style={styles.closeButtonGradientStyle} onPress={() => setShowImportForm(false)}>
            <Text style={styles.cancelButtonTextGradientStyle}>X</Text>
          </TouchableOpacity>
          <Text style={styles.formTitleGradientStyle}>Import Wallet</Text>
          <Text style={styles.securityNoteGradientStyle}>
            Enter your private key (hex, base58, or JSON array)
          </Text>
          <Text style={[styles.securityNoteGradientStyle, { fontSize: 12, marginBottom: 10 }]}>
            TIP: For Solana, private keys can be:
            {'\n'}- Hex: 128 characters (0-9, a-f)
            {'\n'}- Base58: ~88 characters (alphanumeric)
            {'\n'}- JSON: [64 numbers, 0-255]
          </Text>
          <TextInput
            style={[styles.inputGradientStyle, styles.privateKeyInput]}
            placeholder="Private Key (hex, base58, or JSON)"
            value={privateKeyInput}
            onChangeText={setPrivateKeyInput}
            multiline
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.inputGradientStyle}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.inputGradientStyle}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.submitButtonGradientStyle} onPress={handleImportWallet}>
            <Text style={styles.submitButtonTextGradientStyle}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButtonGradientStyle} onPress={() => setShowImportForm(false)}>
            <Text style={styles.cancelButtonTextGradientStyle}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {privateKey && (
        <Modal isVisible={!!privateKey} onBackdropPress={() => setPrivateKey(null)}>
          <View style={styles.privateKeyBoxGradientStyle}>
            <Text style={styles.formTitleGradientStyle}>Your Private Key</Text>
            <Text style={styles.securityNoteGradientStyle}>Guard this well! Copy and store securely.</Text>
            <TextInput
              style={[styles.privateKeyTextGradientStyle]}
              value={privateKey}
              editable={false}
              multiline
            />
            <TouchableOpacity style={styles.copyButtonGradientStyle} onPress={copyPrivateKey}>
              <Text style={styles.copyButtonTextGradientStyle}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButtonGradientStyle} onPress={() => setPrivateKey(null)}>
              <Text style={styles.cancelButtonTextGradientStyle}>Close</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      <Modal isVisible={showReferralPrompt} onBackdropPress={handlePromptClose}>
        <View style={styles.referralPromptGradientStyle}>
          <Text style={styles.promptTitleGradientStyle}>Greetings!</Text>
          <Text style={styles.promptMessageGradientStyle}>Update your profile for rewards!</Text>
          <TouchableOpacity style={styles.updateButtonGradientStyle} onPress={handleProfileUpdate}>
            <Text style={styles.updateButtonTextGradientStyle}>Update</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterButtonGradientStyle} onPress={handlePromptClose}>
            <Text style={styles.laterButtonTextGradientStyle}>Later</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

export default ConnectButton;