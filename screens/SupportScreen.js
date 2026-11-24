import React, {useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert,
} from 'react-native';
import KeyboardAvoidingView from '../components/KeyboardSafe';
import { supabase } from '../services/supabaseClient';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { getSupportStyles } from '../styles/SupportStyles';
import { useTheme } from '../context/ThemeContext';
import GelOrb from '../components/nav/GelOrb';
import { GelGlass, GelInput, GelButton } from '../components/gel/GelKit';

const API_BASE_URL = 'https://sempaihq.com/api';

const SupportScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getSupportStyles(colors), [isDark]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('All fields are required.');
      setIsSubmitting(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/support/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSuccess('Your support request has been submitted successfully!');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err.message);
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 16 }}>
          <View pointerEvents="none"><GelOrb icon="life-ring" size={60} lit breathe={false} /></View>
          <Text style={{ fontFamily: 'Yoruka', fontSize: 28, color: colors.textPrimary, marginTop: 12 }}>Help & support</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6, maxWidth: 340 }}>
            Have a problem or a question? Tell us and we'll get back to you by email.
          </Text>
        </View>
        <GelGlass radius={28} glow={false} padding={18}>
          <GelInput label="Your name" value={name} onChangeText={setName} placeholder="Name" editable={!isSubmitting} style={{ marginTop: 0 }} />
          <GelInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" editable={!isSubmitting} />
          <GelInput label="Subject" value={subject} onChangeText={setSubject} placeholder="What is it about?" editable={!isSubmitting} />
          <GelInput label="Message" value={message} onChangeText={setMessage} placeholder="Describe the problem or question" multiline editable={!isSubmitting} />
          {error ? <Text style={{ color: colors.danger, marginTop: 12, textAlign: 'center' }}>{error}</Text> : null}
          {success ? <Text style={{ color: colors.success, marginTop: 12, textAlign: 'center' }}>{success}</Text> : null}
          <GelButton label="Send" icon="paper-plane" loading={isSubmitting} onPress={handleSubmit} style={{ marginTop: 18 }} />
        </GelGlass>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SupportScreen;
