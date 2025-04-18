import React, { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import Modal from 'react-native-modal';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as solanaWeb3 from '@solana/web3.js';
import { Buffer } from 'buffer';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/SupabaseClient';
import { styles } from '../styles/ConnectButtonStyles';

// Embedded Wallet Context
const EmbeddedWalletContext = createContext();

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
        throw new Error(`Failed to delete item from SecureStore: ${err.message}`);
      }
    }
  },
};

export const EmbeddedWalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const createEmbeddedWallet = async (password) => {
    try {
      setIsLoading(true);
      const keypair = solanaWeb3.Keypair.generate();
      const publicKey = keypair.publicKey.toString();
      const privateKey = Buffer.from(keypair.secretKey).toString('hex');

      await secureStoreWrapper.setItemAsync(
        'embeddedWallet',
        JSON.stringify({ publicKey, privateKey })
      );

      setWallet({ publicKey });
      return { publicKey, privateKey };
    } catch (err) {
      setError('Failed to create wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const importEmbeddedWallet = async (privateKey, password) => {
    try {
      setIsLoading(true);
      const privateKeyBytes = Buffer.from(privateKey, 'hex');
      const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = keypair.publicKey.toString();

      await secureStoreWrapper.setItemAsync(
        'embeddedWallet',
        JSON.stringify({ publicKey, privateKey })
      );

      setWallet({ publicKey });
      return { publicKey, privateKey };
    } catch (err) {
      setError('Failed to import wallet: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = async () => {
    await secureStoreWrapper.deleteItemAsync('embeddedWallet');
    setWallet(null);
  };

  useEffect(() => {
    const loadWallet = async () => {
      try {
        const storedWallet = await secureStoreWrapper.getItemAsync('embeddedWallet');
        if (storedWallet) {
          const { publicKey } = JSON.parse(storedWallet);
          setWallet({ publicKey });
        }
      } catch (err) {
        console.error('Failed to load wallet:', err);
      }
    };
    loadWallet();
  }, []);

  return (
    <EmbeddedWalletContext.Provider
      value={{
        wallet,
        createEmbeddedWallet,
        importEmbeddedWallet,
        disconnectWallet,
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
    if (!walletAddress) return;

    try {
      console.log('Wallet connected:', walletAddress);
      await secureStoreWrapper.setItemAsync('walletAddress', walletAddress);

      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, referral_code, has_updated_profile')
        .eq('wallet_address', walletAddress)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to check user: ${fetchError.message}`);
      }

      let userId = existingUser?.id;
      const url = new URL(Platform.OS === 'web' ? window.location.href : 'http://localhost');
      const referralCodeFromUrl = url.searchParams.get('ref');
      let referredBy = null;

      if (referralCodeFromUrl && !existingUser) {
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

      if (!existingUser) {
        const newReferralCode = `${walletAddress.slice(0, 4)}${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`;
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            name: "Testing",
            wallet_address: walletAddress,
            isWriter: false,
            isSuperuser: false,
            referral_code: newReferralCode,
            referred_by: referredBy,
            has_updated_profile: false,
          })
          .select('id, referral_code')
          .single();

        if (insertError) {
          throw new Error(`Failed to create user: ${insertError.message}`);
        }

        userId = newUser.id;
        console.log('New user created successfully:', newUser);
        setUserCreated(true);

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
          Alert.alert('Error', `Failed to credit 50,000 SMP: ${balanceError.message}`);
          throw new Error(`Failed to create wallet balance: ${balanceError.message}`);
        }
        Alert.alert('Success', '50,000 SMP credited to your wallet!');
      }

      if (referralCodeFromUrl && !existingUser?.has_updated_profile) {
        setShowReferralPrompt(true);
      }
    } catch (err) {
      console.error('Error in createUserAndBalance:', err.message);
      Alert.alert('Error', err.message);
    }
  }, []);

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
    }
  };

  const copyPrivateKey = async () => {
    await Clipboard.setStringAsync(privateKey);
സ്റ

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
          <Text style={styles.securityNoteGradientStyle}>Enter your private key</Text>
          <TextInput
            style={[styles.inputGradientStyle, styles.privateKeyInput]}
            placeholder="Private Key (hex)"
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