// screens/WalletImportScreen.js
import React, { useEffect, useState, useContext, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';

const WalletImportScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getWalletImportStyles(colors), [isDark]);
  const navigation = useNavigation();
  const { importWalletFromPrivateKey, isWalletConnected, isLoading } = useContext(EmbeddedWalletContext);
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
      Alert.alert('Import Failed', error.message || 'Failed to import wallet. Check your private key and try again.');
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
            <Icon name="wallet" size={48} color={colors.accent} style={styles.icon} />
            <Text style={styles.title}>Import Wallet</Text>
            <Text style={styles.subtitle}>Import your existing Solana wallet using your private key</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formDescription}>
              Enter your Base58-encoded private key and set a password to secure your wallet locally.
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
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Min 8 characters"
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
                placeholder="Re-enter password"
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
                  <Icon name="import" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Import Wallet</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.warningBox}>
              <Icon name="exclamation-triangle" size={16} color={colors.accent} />
              <Text style={styles.warningText}>
                Your private key will be encrypted and stored securely. Never share your private key with anyone.
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home')}>
            <Icon name="arrow-left" size={24} color={colors.accent} />
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const getWalletImportStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  icon: {
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
     
    color: c.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: c.bgCard,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  formDescription: {
    fontSize: 14,
    color: c.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
     
    color: c.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: c.bg,
    borderRadius: 10,
    padding: 15,
    color: c.textPrimary,
    fontSize: 14,
    minHeight: 50,
  },
  importButton: {
    backgroundColor: c.accent,
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
     
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderRadius: 10,
    padding: 15,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#F39C12',
    lineHeight: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  backButtonText: {
    color: c.accent,
    fontSize: 16,
     
    marginLeft: 8,
  },
});

export default WalletImportScreen;
