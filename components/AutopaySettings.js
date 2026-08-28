import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';

const KA_COLORS = {
  bgPrimary: '#0c0c0c',
  bgCard: '#141210',
  bgElevated: '#1a1714',
  orangePrimary: '#cc5500',
  orangeBright: '#ff6b35',
  gold: '#c9a84c',
  goldBright: '#ffd700',
  ivory: '#f5e6d3',
  border: '#2d2418',
  success: '#4a7c59',
};

const AutopaySettings = ({ onAutopayToggle }) => {
  const { activeWalletAddress } = useContext(EmbeddedWalletContext);
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAutopayPreference();
  }, [activeWalletAddress]);

  const fetchAutopayPreference = async () => {
    if (!activeWalletAddress) {
      setLoading(false);
      return;
    }

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id, autopay_enabled')
        .eq('wallet_address', activeWalletAddress)
        .single();

      if (userData) {
        setAutopayEnabled(userData.autopay_enabled || false);
      }
    } catch (error) {
      console.error('[AutopaySettings] Error fetching preference:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutopay = async () => {
    if (!activeWalletAddress) return;

    setSaving(true);
    try {
      const newValue = !autopayEnabled;
      
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', activeWalletAddress)
        .single();

      if (userData) {
        const { error } = await supabase
          .from('users')
          .update({ autopay_enabled: newValue })
          .eq('id', userData.id);

        if (error) throw error;
      }

      setAutopayEnabled(newValue);
      if (onAutopayToggle) onAutopayToggle(newValue);
    } catch (error) {
      console.error('[AutopaySettings] Error toggling autopay:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FontAwesome5 name="shield-alt" size={20} color={KA_COLORS.orangePrimary} style={styles.icon} />
        <Text style={styles.title}>Autopay Settings</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.description}>
          Enable autopay to automatically unlock chapters using your SMP balance.
        </Text>
        <TouchableOpacity
          onPress={toggleAutopay}
          disabled={saving}
          style={[styles.toggleButton, autopayEnabled && styles.toggleButtonEnabled]}
        >
          <FontAwesome5
            name={autopayEnabled ? 'toggle-on' : 'toggle-off'}
            size={24}
            color={autopayEnabled ? KA_COLORS.success : '#666'}
          />
          <Text style={[styles.toggleText, autopayEnabled && styles.toggleTextEnabled]}>
            {saving ? 'Saving...' : autopayEnabled ? 'Autopay Enabled' : 'Autopay Disabled'}
          </Text>
        </TouchableOpacity>
        {autopayEnabled && (
          <View style={styles.benefits}>
            <FontAwesome5 name="check-circle" size={16} color={KA_COLORS.success} style={styles.benefitIcon} />
            <Text style={styles.benefitText}>Chapters will unlock automatically</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KA_COLORS.ivory,
  },
  content: {
    gap: 12,
  },
  description: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  toggleButtonEnabled: {
    backgroundColor: KA_COLORS.success,
    borderColor: KA_COLORS.success,
  },
  toggleText: {
    fontSize: 14,
    color: '#ccc',
    fontWeight: '600',
  },
  toggleTextEnabled: {
    color: '#fff',
  },
  benefits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: 'rgba(74, 124, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.3)',
    borderRadius: 8,
    marginTop: 4,
  },
  benefitIcon: {
    fontSize: 16,
  },
  benefitText: {
    fontSize: 14,
    color: KA_COLORS.success,
    fontWeight: '500',
  },
});

export default AutopaySettings;
