import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';

const KaijiScreen = () => {
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = walletContext?.isWalletConnected;
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        if (!isWalletConnected) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('isSuperuser')
          .eq('wallet_address', wallet?.publicKey)
          .single();

        setIsAdmin(userData?.isSuperuser || false);
        setLoading(false);
      } catch (error) {
        console.error('[KaijiScreen] Error checking admin status:', error);
        setIsAdmin(false);
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [isWalletConnected, wallet]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Access Denied</Text>
        <Text style={styles.subtext}>This page is only accessible to administrators</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Empty screen with orange background - Admin only */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F36316', // SempaiHQ orange
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtext: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.8,
  },
});

export default KaijiScreen;
