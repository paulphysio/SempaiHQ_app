import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';

const AutopaySettings = ({ onAutopayToggle, walletAddress: propWalletAddress }) => {
  const { activeWalletAddress: contextWalletAddress } = useContext(EmbeddedWalletContext);
  const { colors, isDark } = useTheme();
  const activeWalletAddress = propWalletAddress || contextWalletAddress;
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const themedStyles = getThemedStyles(colors, isDark);

  useEffect(() => {
    fetchAutopayPreference();
  }, [activeWalletAddress]);

  const fetchAutopayPreference = async () => {
    if (!activeWalletAddress) {
      setLoading(false);
      return;
    }

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, autopay_enabled')
        .eq('wallet_address', activeWalletAddress)
        .maybeSingle();

      if (userError) throw userError;

      if (userData) {
        setAutopayEnabled(userData.autopay_enabled || false);
      } else {
        setAutopayEnabled(false);
      }
    } catch (error) {
      console.error('[AutopaySettings] Error fetching preference:', error);
      setAutopayEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutopay = async () => {
    if (!activeWalletAddress) {
      console.error('[AutopaySettings] No wallet address provided');
      return;
    }

    setSaving(true);
    try {
      const newValue = !autopayEnabled;
      console.log('[AutopaySettings] Attempting to toggle autopay to:', newValue);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', activeWalletAddress)
        .maybeSingle();

      console.log('[AutopaySettings] User data:', userData);
      console.log('[AutopaySettings] User error:', userError);

      if (userError) throw userError;

      if (userData) {
        console.log('[AutopaySettings] Updating existing user:', userData.id);
        const { error } = await supabase
          .from('users')
          .update({ autopay_enabled: newValue })
          .eq('id', userData.id);

        if (error) throw error;

        setAutopayEnabled(newValue);
        if (onAutopayToggle) onAutopayToggle(newValue);
        console.log('[AutopaySettings] Autopay updated successfully to:', newValue);
      } else {
        console.log('[AutopaySettings] User not found in database, cannot toggle autopay');
      }
    } catch (error) {
      console.error('[AutopaySettings] Error toggling autopay:', error);
      console.error('[AutopaySettings] Error details:', JSON.stringify(error, null, 2));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <View style={themedStyles.container}>
      <View style={themedStyles.header}>
        <FontAwesome5 name="shield-alt" size={20} color={colors.accent} style={themedStyles.icon} />
        <Text style={themedStyles.title}>Autopay Settings</Text>
      </View>
      <View style={themedStyles.content}>
        <Text style={themedStyles.description}>
          Enable autopay to automatically unlock chapters using your SMP balance.
        </Text>
        <TouchableOpacity
          onPress={toggleAutopay}
          disabled={saving}
          style={[themedStyles.toggleButton, autopayEnabled && themedStyles.toggleButtonEnabled]}
        >
          {saving ? (
            <ActivityIndicator size={20} color={autopayEnabled ? colors.textPrimary : colors.textMuted} />
          ) : (
            <FontAwesome5
              name={autopayEnabled ? 'toggle-on' : 'toggle-off'}
              size={24}
              color={autopayEnabled ? colors.textPrimary : colors.textMuted}
            />
          )}
          <Text style={[themedStyles.toggleText, autopayEnabled && themedStyles.toggleTextEnabled]}>
            {saving ? 'Saving...' : autopayEnabled ? 'Autopay Enabled' : 'Autopay Disabled'}
          </Text>
        </TouchableOpacity>
        {autopayEnabled && (
          <View style={themedStyles.benefits}>
            <FontAwesome5 name="check-circle" size={16} color={colors.accent} style={themedStyles.benefitIcon} />
            <Text style={themedStyles.benefitText}>Chapters will unlock automatically</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const getThemedStyles = (colors, isDark) => {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textPrimary,
    },
    content: {
      gap: 12,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.bgElevated,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 30,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    toggleButtonEnabled: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    toggleText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    toggleTextEnabled: {
      color: colors.textPrimary,
    },
    benefits: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.borderAccent,
      borderRadius: 8,
      marginTop: 4,
    },
    benefitIcon: {
      fontSize: 16,
    },
    benefitText: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
  });
};

export default AutopaySettings;
