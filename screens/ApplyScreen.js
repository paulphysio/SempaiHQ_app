// screens/ApplyScreen.js
import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient'; // Adjust path if needed
import { EmbeddedWalletContext } from '../components/ConnectButton'; // Adjust path if needed
import Popup from '../components/Popup';

const ApplyScreen = () => {
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
        let { data: user, error: fetchError } = await supabase
          .from('users')
          .select('id, email, name')
          .eq('wallet_address', publicKeyStr)
          .single();

        if (fetchError && fetchError.code === 'PGRST116') {
          console.log('[ApplyScreen] No profile found. Creating new user.');
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({ wallet_address: publicKeyStr })
            .select('id, email, name')
            .single();

          if (insertError) throw insertError;
          user = newUser;
          console.log('[ApplyScreen] New user created:', user);
        } else if (fetchError) {
          throw fetchError;
        }

        if (user) {
          console.log('[ApplyScreen] Profile synced successfully:', user);
          setUserId(user.id);
          setEmail(user.email || '');
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

    try {
      // 1. Grant the role to the user
      const roleUpdate = {};
      if (role === 'writer') {
        roleUpdate.isWriter = true;
      } else if (role === 'artist') {
        roleUpdate.isArtist = true;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(roleUpdate)
        .eq('id', userId);

      if (updateError) throw updateError;

      // 2. Log the application as approved
      const { error: insertError } = await supabase.from('creator_applications').insert([
        {
          user_id: userId,
          name,
          email,
          role,
          reason,
          submission_link: submissionLink || null,
          application_status: 'approved',
        },
      ]);

      if (insertError) throw insertError;

      setSuccess(`Application approved! You are now a ${role}.`);
      Alert.alert('Success', `Your application has been approved! You have been granted the ${role} role.`);
      setReason('');
      setSubmissionLink('');
    } catch (err) {
      setError(err.message);
      Alert.alert('Error', `Failed to process application: ${err.message}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Apply to Become a Creator</Text>

      {!isWalletConnected ? (
        <View style={styles.connectContainer}>
          <Text style={styles.message}>Please connect your wallet to apply.</Text>
          {/* The global ConnectButton should be used, or place one here if needed */}
        </View>
      ) : wallet?.publicKey ? (
        <Text style={styles.walletConnected}>
          Wallet: {`${wallet.publicKey.toString().substring(0, 6)}...${wallet.publicKey.toString().substring(wallet.publicKey.toString().length - 4)}`}
        </Text>
      ) : null}

      <View style={styles.formGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your Name"
          placeholderTextColor="#888"
          editable={isWalletConnected}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor="#888"
          keyboardType="email-address"
          editable={isWalletConnected}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Applying as a...</Text>
        <View style={styles.roleContainer}>
          <TouchableOpacity
            style={[styles.roleButton, role === 'writer' && styles.roleButtonActive]}
            onPress={() => setRole('writer')}
            disabled={!isWalletConnected}
          >
            <Text style={styles.roleButtonText}>Writer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleButton, role === 'artist' && styles.roleButtonActive]}
            onPress={() => setRole('artist')}
            disabled={!isWalletConnected}
          >
            <Text style={styles.roleButtonText}>Artist</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Why do you want to be a {role}?</Text>
        <TouchableOpacity
          style={styles.reasonButton}
          onPress={() => setShowPopup(true)}
          disabled={!isWalletConnected}
        >
          <Text style={styles.reasonButtonText}>Add Reason</Text>
        </TouchableOpacity>
        {reason ? <Text style={styles.reasonPreview}>📝 Reason Added</Text> : null}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          {role === 'writer' ? 'Novel Link (Optional)' : 'Manga/Art Link (Optional)'}
        </Text>
        <TextInput
          style={styles.input}
          value={submissionLink}
          onChangeText={setSubmissionLink}
          placeholder="https://example.com/your-work"
          placeholderTextColor="#888"
          editable={isWalletConnected}
        />
      </View>

      {error ? <Text style={styles.alertDanger}>{error}</Text> : null}
      {success ? <Text style={styles.alertSuccess}>{success}</Text> : null}

      <TouchableOpacity
        style={[styles.submitButton, (!isWalletConnected || isLoading) && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={!isWalletConnected || isLoading}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Application</Text>}
      </TouchableOpacity>

      <Popup visible={showPopup} onClose={() => setShowPopup(false)} onSubmit={handlePopupSubmit} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  connectContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  message: {
    color: '#ccc',
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
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2c2c2c',
    color: '#fff',
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
    backgroundColor: '#333',
    marginHorizontal: 5,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#FF5733',
  },
  roleButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  reasonButton: {
    backgroundColor: '#FF5733',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  reasonButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
    backgroundColor: '#FF5733',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#555',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});

export default ApplyScreen;