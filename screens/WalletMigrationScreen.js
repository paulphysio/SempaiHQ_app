import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/WalletMigrationStyles';

const API_BASE_URL = 'https://sempaihq.com/api';

const WalletMigrationScreen = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  
  const [migrationType, setMigrationType] = useState('seed-to-private'); // seed-to-private, email-link
  const [seedPhrase, setSeedPhrase] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  const handleSeedToPrivate = async () => {
    if (!seedPhrase.trim()) {
      Alert.alert('Error', 'Please enter your seed phrase');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/migrate-wallet/seed-to-private`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seedPhrase: seedPhrase.trim(),
          walletAddress: wallet?.publicKey
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMigrationResult({
        success: true,
        message: 'Migration successful',
        privateKey: data.privateKey
      });
      Alert.alert('Success', 'Wallet migrated successfully!');
      setSeedPhrase('');
    } catch (error) {
      console.error('[WalletMigrationScreen] Error migrating wallet:', error);
      Alert.alert('Error', 'Failed to migrate wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLink = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/migrate-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          walletAddress: wallet?.publicKey
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMigrationResult({
        success: true,
        message: 'Email linking initiated',
        verificationSent: data.verificationSent
      });
      Alert.alert('Success', 'Verification email sent!');
      setEmail('');
    } catch (error) {
      console.error('[WalletMigrationScreen] Error linking email:', error);
      Alert.alert('Error', 'Failed to link email');
    } finally {
      setLoading(false);
    }
  };

  if (!isWalletConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lockedContainer}>
          <FontAwesome5 name="wallet" size={48} color="#E74C3C" />
          <Text style={styles.lockedMessage}>Connect Wallet to Migrate</Text>
          <TouchableOpacity 
            style={styles.connectButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <FontAwesome5 name="wallet" size={16} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView>
          <View style={styles.infoCard}>
            <FontAwesome5 name="info-circle" size={24} color="#4A90E2" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Secure Wallet Migration</Text>
              <Text style={styles.infoDescription}>
                Migrate your wallet between platforms securely. Your private keys are never exposed.
              </Text>
            </View>
          </View>

          <View style={styles.migrationTypeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                migrationType === 'seed-to-private' && styles.activeTypeButton
              ]}
              onPress={() => setMigrationType('seed-to-private')}
            >
              <FontAwesome5 
                name="key" 
                size={18} 
                color={migrationType === 'seed-to-private' ? '#FFFFFF' : '#CCCCCC'} 
              />
              <Text style={[
                styles.typeButtonText,
                migrationType === 'seed-to-private' && styles.activeTypeButtonText
              ]}>
                Seed to Private Key
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                migrationType === 'email-link' && styles.activeTypeButton
              ]}
              onPress={() => setMigrationType('email-link')}
            >
              <FontAwesome5 
                name="envelope" 
                size={18} 
                color={migrationType === 'email-link' ? '#FFFFFF' : '#CCCCCC'} 
              />
              <Text style={[
                styles.typeButtonText,
                migrationType === 'email-link' && styles.activeTypeButtonText
              ]}>
                Link Email
              </Text>
            </TouchableOpacity>
          </View>

          {migrationType === 'seed-to-private' && (
            <View style={styles.migrationForm}>
              <Text style={styles.formTitle}>Seed Phrase Migration</Text>
              <Text style={styles.formDescription}>
                Convert your seed phrase to a private key for secure storage
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Seed Phrase</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your 12 or 24 word seed phrase"
                  placeholderTextColor="#888"
                  value={seedPhrase}
                  onChangeText={setSeedPhrase}
                  multiline
                  numberOfLines={4}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity 
                style={styles.migrateButton}
                onPress={handleSeedToPrivate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FontAwesome5 name="exchange-alt" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Migrate</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.warningBox}>
                <FontAwesome5 name="exclamation-triangle" size={16} color="#F39C12" />
                <Text style={styles.warningText}>
                  Your seed phrase will be processed securely and never stored. The resulting private key will be encrypted before storage.
                </Text>
              </View>
            </View>
          )}

          {migrationType === 'email-link' && (
            <View style={styles.migrationForm}>
              <Text style={styles.formTitle}>Email Linking</Text>
              <Text style={styles.formDescription}>
                Link your email to your wallet for account recovery and notifications
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email address"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity 
                style={styles.migrateButton}
                onPress={handleEmailLink}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FontAwesome5 name="paper-plane" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Send Verification</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <FontAwesome5 name="info-circle" size={16} color="#4A90E2" />
                <Text style={styles.infoBoxText}>
                  A verification email will be sent to confirm your email address. This allows you to recover your account and receive important notifications.
                </Text>
              </View>
            </View>
          )}

          {migrationResult && (
            <View style={styles.resultCard}>
              <LinearGradient
                colors={['#4CAF50', '#45A049']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.resultBanner}
              >
                <FontAwesome5 name="check-circle" size={24} color="#FFFFFF" />
                <Text style={styles.resultText}>{migrationResult.message}</Text>
              </LinearGradient>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default WalletMigrationScreen;
