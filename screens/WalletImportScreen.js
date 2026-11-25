// screens/WalletImportScreen.js
import React, { useEffect, useState, useContext, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, ScrollView, Platform } from 'react-native';
import KeyboardAvoidingView from '../components/KeyboardSafe';
import { useNavigation } from '@react-navigation/native';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';

import { gelAlert } from '../components/gel/GelAlert';
import GelOrb from '../components/nav/GelOrb';
import { GelGlass, GelInput, GelButton } from '../components/gel/GelKit';
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
      gelAlert('Error', 'Please enter your private key');
      return;
    }
    if (!password || password.length < 8) {
      gelAlert('Error', 'Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      gelAlert('Error', 'Passwords do not match');
      return;
    }

    setImporting(true);
    try {
      const result = await importWalletFromPrivateKey(privateKey.trim(), password);
      if (result) {
        toast.success('Wallet imported successfully!');
        navigation.replace('Home');
      } else {
        toast.error('Failed to import wallet');
      }
    } catch (error) {
      console.error('[WalletImportScreen] Import error:', error);
      toast.error(`Import Failed — ${error.message || 'Failed to import wallet. Check your private key and try again.'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 16 }}>
          <View pointerEvents="none"><GelOrb icon="key" size={60} lit breathe={false} /></View>
          <Text style={{ fontFamily: 'Yoruka', fontSize: 28, color: colors.textPrimary, marginTop: 12 }}>Import a wallet</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6, maxWidth: 340 }}>
            Paste a private key from another Solana wallet, then choose a password to lock it on this phone.
          </Text>
        </View>
        <GelGlass radius={28} glow={false} padding={18}>
          <GelInput label="Private key" placeholder="Base58 private key" value={privateKey} onChangeText={setPrivateKey} multiline secureTextEntry autoCapitalize="none" autoCorrect={false} style={{ marginTop: 0 }} />
          <GelInput label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry />
          <GelInput label="Confirm password" placeholder="Type it again" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          <GelButton label="Import wallet" icon="file-import" loading={importing || isLoading} onPress={handleImportWallet} style={{ marginTop: 18 }} />
        </GelGlass>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)' }}>
          <Icon name="alert" size={16} color={colors.warning} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: colors.warning, fontSize: 13, lineHeight: 19 }}>
            Your key is locked with your password and stays on this phone. Never share a private key with anyone — not even SempaiHQ.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    borderRadius: 999,
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
