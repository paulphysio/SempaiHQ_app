// screens/WalletImportScreen.js
import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { LinearGradient } from 'expo-linear-gradient';

const WalletImportScreen = () => {
  const navigation = useNavigation();
  const { session } = useGoogleAuth();
  const { importWalletFromPrivateKey, isWalletConnected, isLoading } = useContext(EmbeddedWalletContext);
  const [importMode, setImportMode] = useState('google'); // 'google' or 'private-key'
  const [privateKey, setPrivateKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isWalletConnected) {
      navigation.replace('Home');
    }
  }, [isWalletConnected, navigation]);

  const handleImportWallet = async () => {
    if (!privateKey.trim()) {
      Alert.alert('Error', 'Please enter your private key');
      return;
    }
    if (!password || password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setImporting(true);
    try {
      const result = await importWalletFromPrivateKey(privateKey.trim(), password);
      if (result) {
        Alert.alert('Success', 'Wallet imported successfully!');
        navigation.replace('Home');
      } else {
        Alert.alert('Error', 'Failed to import wallet');
      }
    } catch (error) {
      console.error('[WalletImportScreen] Import error:', error);
      Alert.alert('Error', error.message || 'Failed to import wallet');
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Icon name="wallet" size={48} color="#E67E22" style={styles.icon} />
            <Text style={styles.title}>Connect to Sempai HQ</Text>
            <Text style={styles.subtitle}>Create a new wallet or import an existing one</Text>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, importMode === 'google' && styles.activeTab]}
              onPress={() => setImportMode('google')}
            >
              <Icon name="google" size={18} color={importMode === 'google' ? '#FFFFFF' : '#888'} />
              <Text style={[styles.tabText, importMode === 'google' && styles.activeTabText]}>
                Create Wallet
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, importMode === 'private-key' && styles.activeTab]}
              onPress={() => setImportMode('private-key')}
            >
              <Icon name="key" size={18} color={importMode === 'private-key' ? '#FFFFFF' : '#888'} />
              <Text style={[styles.tabText, importMode === 'private-key' && styles.activeTabText]}>
                Import Wallet
              </Text>
            </TouchableOpacity>
          </View>

          {importMode === 'google' ? (
            <View style={styles.formContainer}>
              <Text style={styles.formDescription}>
                Sign in with Google to create a new secure wallet with biometric protection
              </Text>
              <GoogleSignInButton />
            </View>
          ) : (
            <View style={styles.formContainer}>
              <Text style={styles.formDescription}>
                Import your existing wallet using your private key
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Private Key</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your Base58 private key"
                  placeholderTextColor="#888"
                  value={privateKey}
                  onChangeText={setPrivateKey}
                  multiline
                  numberOfLines={3}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Create a password (min 8 characters)"
                  placeholderTextColor="#888"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor="#888"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={styles.importButton}
                onPress={handleImportWallet}
                disabled={importing || isLoading}
              >
                {importing || isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Icon name="download" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Import Wallet</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.warningBox}>
                <Icon name="exclamation-triangle" size={16} color="#F39C12" />
                <Text style={styles.warningText}>
                  Your private key will be encrypted and stored securely. Never share your private key with anyone.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
    marginBottom: 30,
    width: '100%',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#E67E22',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  formDescription: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 14,
    fontSize: 14,
    minHeight: 50,
  },
  importButton: {
    backgroundColor: '#E67E22',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningBox: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderWidth: 1,
    borderColor: '#F39C12',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningText: {
    color: '#F39C12',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  backButton: {
    marginTop: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E67E22',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#E67E22',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default WalletImportScreen;