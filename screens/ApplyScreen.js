// screens/ApplyScreen.js
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient'; // Adjust path if needed
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced'; // Adjust path if needed
import Popup from '../components/Popup';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';
import { readerAction } from '../services/readerActions';
import { GelGate } from '../components/gel/GelGate';
import GelOrb from '../components/nav/GelOrb';
import { GelGlass, GelInput, GelButton, GelChips } from '../components/gel/GelKit';

const ApplyScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getApplyStyles(colors), [isDark]);
  const { wallet, isWalletConnected, activePublicKey } = useContext(EmbeddedWalletContext);
  const [userId, setUserId] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('writer');
  const [reason, setReason] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const syncWallet = async () => {
      console.log('[ApplyScreen] syncWallet triggered. Wallet connected:', isWalletConnected);
      if (!isWalletConnected || !wallet?.publicKey) {
        console.log('[ApplyScreen] Wallet not ready. Aborting sync.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');
      const publicKeyStr = wallet.publicKey.toString();
      console.log('[ApplyScreen] Wallet ready. Syncing profile for public key:', publicKeyStr);

      try {
        // Your account comes from your Google sign-in (the role is granted to
        // that account on the server), not from the wallet alone.
        const { data: { session } } = await supabase.auth.getSession();
        const authId = session?.user?.id;
        if (!authId) {
          setError('Please sign in with Google to apply as a creator.');
          return;
        }
        let { data: user, error: fetchError } = await supabase
          .from('users')
          .select('id, name')
          .eq('id', authId)
          .maybeSingle();
        if (fetchError) throw fetchError;
        if (!user) {
          ({ data: user } = await supabase
            .from('users')
            .select('id, name')
            .eq('wallet_address', publicKeyStr)
            .maybeSingle());
        }

        if (user) {
          console.log('[ApplyScreen] Profile synced successfully:', user);
          setUserId(user.id);
          setEmail(session?.user?.email || '');
          setName(user.name || '');
        } else {
          console.warn('[ApplyScreen] User profile is null after sync.');
        }
      } catch (err) {
        setError('Failed to sync wallet profile. Please try again.');
        console.error('[ApplyScreen] Sync wallet error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    syncWallet();
  }, [wallet, isWalletConnected]);

  const handlePopupSubmit = (reasonText) => {
    setReason(reasonText);
    setShowPopup(false);
  };

  const handleSubmit = async () => {
    console.log('[ApplyScreen] handleSubmit triggered. Current userId:', userId);
    setError('');
    setSuccess('');

    if (!reason) {
      setError('A reason for applying is required.');
      return;
    }

    if (!userId) {
      setError('Could not verify user. Please ensure your wallet is connected.');
      return;
    }

    if (sending) return;
    setSending(true);
    try {
      // The server records the application and grants the role.
      const res = await readerAction('apply_creator', { role, name, email, reason, submissionLink });
      if (!res.ok) throw new Error(res.error);

      if (res.approved) {
        setSuccess(`Application approved! You are now a ${role}.`);
        toast.success(`Your application has been approved! You have been granted the ${role} role.`);
      } else {
        setSuccess('Application sent! An admin will review it soon.');
        toast.success('Application sent — we’ll let you know once it’s reviewed.');
      }
      setReason('');
      setSubmissionLink('');
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to process application: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  if (!isWalletConnected) {
    return <GelGate icon="feather-alt" headerTitle="Become a creator" subtitle="Connect a wallet to apply as a writer or artist." />;
  }

  const addr = wallet?.publicKey?.toString();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 16 }}>
        <View pointerEvents="none"><GelOrb icon="feather-alt" size={60} lit breathe={false} /></View>
        <Text style={{ fontFamily: 'Yoruka', fontSize: 28, color: colors.textPrimary, marginTop: 12, textAlign: 'center' }}>Become a creator</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6, maxWidth: 340 }}>
          Publish your novels or manga on SempaiHQ and earn from every reader.
        </Text>
        {addr ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>Wallet {addr.slice(0, 6)}…{addr.slice(-4)}</Text> : null}
      </View>
      <GelGlass radius={28} glow={false} padding={18}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>I'm applying as a</Text>
        <GelChips options={[{ value: 'writer', label: 'Writer' }, { value: 'artist', label: 'Artist' }]} value={role} onChange={setRole} style={{ marginTop: 8 }} />
        <GelInput label="Name" value={name} onChangeText={setName} placeholder="Your name or pen name" />
        <GelInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <GelInput label={`Why do you want to be a ${role}?`} value={reason} onChangeText={setReason} placeholder="What do you create, and what drives you?" multiline />
        <GelInput
          label={role === 'writer' ? 'Link to your writing (optional)' : 'Link to your art or manga (optional)'}
          value={submissionLink}
          onChangeText={setSubmissionLink}
          placeholder="https://…"
          autoCapitalize="none"
        />
        {error ? <Text style={{ color: colors.danger, textAlign: 'center', marginTop: 12 }}>{error}</Text> : null}
        {success ? <Text style={{ color: colors.success, textAlign: 'center', marginTop: 12 }}>{success}</Text> : null}
        <GelButton label="Send application" icon="paper-plane" loading={sending} disabled={isLoading || !reason.trim()} onPress={handleSubmit} style={{ marginTop: 18 }} />
      </GelGlass>
    </ScrollView>
  );
};

export const getApplyStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    color: c.textPrimary,
    fontSize: 28,
     
    marginBottom: 20,
    textAlign: 'center',
  },
  connectContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  message: {
    color: c.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  walletConnected: {
    color: '#0f0',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    color: c.textPrimary,
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2c2c2c',
    color: c.textPrimary,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  roleButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: c.textPrimary,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: c.accent,
  },
  roleButtonText: {
    color: '#fff',
     
  },
  reasonButton: {
    backgroundColor: c.accent,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  reasonButtonText: {
    color: '#fff',
     
    fontSize: 16,
  },
  reasonPreview: {
    color: '#0f0',
    marginTop: 10,
    textAlign: 'center',
  },
  alertDanger: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
  alertSuccess: {
    color: 'green',
    textAlign: 'center',
    marginBottom: 10,
  },
  submitButton: {
    backgroundColor: c.accent,
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: c.textMuted,
  },
  submitButtonText: {
    color: '#fff',
     
    fontSize: 18,
  },
});

export default ApplyScreen;