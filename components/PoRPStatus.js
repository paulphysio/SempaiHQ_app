import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { getUserReputation } from '../services/porp/ReadingTracker';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { supabase } from '../services/supabaseClient';
import { styles } from '../styles/PoRPStyles';

const API_BASE_URL = 'https://sempaihq.com/api';

const TIER_COLORS = {
  seed: ['#8B8B8B', '#6B6B6B'], // Gray
  reader: ['#4A90E2', '#357ABD'], // Blue
  scholar: ['#9B59B6', '#8E44AD'], // Purple
  sage: ['#F39C12', '#E67E22'] // Gold
};

const TIER_ICONS = {
  seed: 'seedling',
  reader: 'book-open',
  scholar: 'graduation-cap',
  sage: 'crown'
};

const PoRPStatus = ({ visible, onClose }) => {
  const { wallet } = useContext(EmbeddedWalletContext);
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible && wallet) {
      loadReputation();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, wallet]);

  const loadReputation = async () => {
    try {
      setLoading(true);
      // Get user ID from wallet
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet.publicKey)
        .single();
      
      if (userData) {
        const repData = await getUserReputation(userData.id);
        setReputation(repData);
      }
    } catch (error) {
      console.error('[PoRPStatus] Error loading reputation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const tier = reputation?.current_tier || 'seed';
  const tierColors = TIER_COLORS[tier];
  const tierIcon = TIER_ICONS[tier];

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.container}>
        <LinearGradient
          colors={tierColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome5 name="times" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <FontAwesome5 name={tierIcon} size={40} color="#FFFFFF" />
          <Text style={styles.tierTitle}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
          <Text style={styles.tierSubtitle}>Reading Reputation</Text>
        </LinearGradient>

        <View style={styles.content}>
          {loading ? (
            <Text style={styles.loadingText}>Loading reputation...</Text>
          ) : (
            <>
              <View style={styles.statRow}>
                <FontAwesome5 name="book" size={24} color="#4A90E2" />
                <View style={styles.statInfo}>
                  <Text style={styles.statLabel}>Pages Read</Text>
                  <Text style={styles.statValue}>{reputation?.total_pages_read || 0}</Text>
                </View>
              </View>

              <View style={styles.statRow}>
                <FontAwesome5 name="clock" size={24} color="#9B59B6" />
                <View style={styles.statInfo}>
                  <Text style={styles.statLabel}>Reading Time</Text>
                  <Text style={styles.statValue}>
                    {Math.floor((reputation?.total_reading_time_seconds || 0) / 60)} min
                  </Text>
                </View>
              </View>

              <View style={styles.statRow}>
                <FontAwesome5 name="star" size={24} color="#F39C12" />
                <View style={styles.statInfo}>
                  <Text style={styles.statLabel}>Reputation Score</Text>
                  <Text style={styles.statValue}>{reputation?.reputation_score || 0}</Text>
                </View>
              </View>

              <View style={styles.statRow}>
                <FontAwesome5 name="percentage" size={24} color="#E74C3C" />
                <View style={styles.statInfo}>
                  <Text style={styles.statLabel}>Reward Multiplier</Text>
                  <Text style={styles.statValue}>{reputation?.reward_multiplier || 1.0}x</Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <Text style={styles.progressLabel}>Next Tier Progress</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${Math.min((reputation?.reputation_score || 0) / 100, 100)}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {reputation?.reputation_score || 0} / 100 points
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

export default PoRPStatus;
