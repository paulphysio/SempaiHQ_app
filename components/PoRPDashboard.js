import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, TextInput, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { getUserReputation } from '../services/porp/ReadingTracker';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { styles } from '../styles/PoRPDashboardStyles';

const API_BASE_URL = 'https://sempaihq.com/api';

const TIER_COLORS = {
  seed: ['#8B8B8B', '#6B6B6B'],
  reader: ['#4A90E2', '#357ABD'],
  scholar: ['#9B59B6', '#8E44AD'],
  sage: ['#F39C12', '#E67E22']
};

const TIER_ICONS = {
  seed: 'seedling',
  reader: 'book-open',
  scholar: 'graduation-cap',
  sage: 'crown'
};

const TIER_REQUIREMENTS = {
  seed: { min: 0, max: 99 },
  reader: { min: 100, max: 999 },
  scholar: { min: 1000, max: 4999 },
  sage: { min: 5000, max: Infinity }
};

const PoRPDashboard = ({ visible, onClose }) => {
  const { wallet } = useContext(EmbeddedWalletContext);
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stakeAmount, setStakeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
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
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet?.publicKey)
        .single();
      
      if (userData) {
        const repData = await getUserReputation(userData.id);
        setReputation(repData);
      }
    } catch (error) {
      console.error('[PoRPDashboard] Error loading reputation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || isNaN(stakeAmount)) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet?.publicKey)
        .single();

      if (userData) {
        const response = await fetch(`${API_BASE_URL}/porp/stake`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.id,
            amountSmp: parseInt(stakeAmount)
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        Alert.alert('Success', 'Staked successfully!');
        setStakeAmount('');
        loadReputation();
      }
    } catch (error) {
      console.error('[PoRPDashboard] Error staking:', error);
      Alert.alert('Error', 'Failed to stake');
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(withdrawAmount)) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet?.publicKey)
        .single();

      if (userData) {
        const response = await fetch(`${API_BASE_URL}/porp/withdraw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.id,
            amountSmp: parseInt(withdrawAmount)
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const tier = reputation?.current_tier || 'seed';
        const cooldownHours = {
          seed: 24,
          reader: 12,
          scholar: 6,
          sage: 1
        }[tier];
        
        Alert.alert('Success', `Withdrawal requested. Cooldown: ${cooldownHours} hours`);
        setWithdrawAmount('');
      }
    } catch (error) {
      console.error('[PoRPDashboard] Error requesting withdrawal:', error);
      Alert.alert('Error', 'Failed to request withdrawal');
    }
  };

  if (!visible) return null;

  const tier = reputation?.current_tier || 'seed';
  const tierColors = TIER_COLORS[tier];
  const tierIcon = TIER_ICONS[tier];
  const requirements = TIER_REQUIREMENTS[tier];
  const progress = requirements.max === Infinity 
    ? 100 
    : ((reputation?.reputation_score || 0) - requirements.min) / (requirements.max - requirements.min) * 100;

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
          <FontAwesome5 name={tierIcon} size={50} color="#FFFFFF" />
          <Text style={styles.tierTitle}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
          <Text style={styles.tierSubtitle}>Reading Reputation</Text>
        </LinearGradient>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <FontAwesome5 name="chart-line" size={16} color={activeTab === 'overview' ? '#FFFFFF' : '#CCCCCC'} />
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'stake' && styles.activeTab]}
            onPress={() => setActiveTab('stake')}
          >
            <FontAwesome5 name="lock" size={16} color={activeTab === 'stake' ? '#FFFFFF' : '#CCCCCC'} />
            <Text style={[styles.tabText, activeTab === 'stake' && styles.activeTabText]}>Stake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'withdraw' && styles.activeTab]}
            onPress={() => setActiveTab('withdraw')}
          >
            <FontAwesome5 name="wallet" size={16} color={activeTab === 'withdraw' ? '#FFFFFF' : '#CCCCCC'} />
            <Text style={[styles.tabText, activeTab === 'withdraw' && styles.activeTabText]}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading ? (
            <Text style={styles.loadingText}>Loading reputation data...</Text>
          ) : (
            <>
              {activeTab === 'overview' && (
                <>
                  <View style={styles.statCard}>
                    <FontAwesome5 name="book" size={24} color="#4A90E2" />
                    <View style={styles.statInfo}>
                      <Text style={styles.statLabel}>Pages Read</Text>
                      <Text style={styles.statValue}>{reputation?.total_pages_read || 0}</Text>
                    </View>
                  </View>

                  <View style={styles.statCard}>
                    <FontAwesome5 name="clock" size={24} color="#9B59B6" />
                    <View style={styles.statInfo}>
                      <Text style={styles.statLabel}>Reading Time</Text>
                      <Text style={styles.statValue}>
                        {Math.floor((reputation?.total_reading_time_seconds || 0) / 60)} min
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statCard}>
                    <FontAwesome5 name="star" size={24} color="#F39C12" />
                    <View style={styles.statInfo}>
                      <Text style={styles.statLabel}>Reputation Score</Text>
                      <Text style={styles.statValue}>{reputation?.reputation_score || 0}</Text>
                    </View>
                  </View>

                  <View style={styles.statCard}>
                    <FontAwesome5 name="percentage" size={24} color="#E74C3C" />
                    <View style={styles.statInfo}>
                      <Text style={styles.statLabel}>Reward Multiplier</Text>
                      <Text style={styles.statValue}>{reputation?.reward_multiplier || 1.0}x</Text>
                    </View>
                  </View>

                  <View style={styles.progressCard}>
                    <Text style={styles.progressLabel}>Progress to Next Tier</Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {reputation?.reputation_score || 0} / {requirements.max === Infinity ? '∞' : requirements.max}
                    </Text>
                  </View>

                  <View style={styles.challengesCard}>
                    <FontAwesome5 name="brain" size={20} color="#9B59B6" />
                    <View style={styles.challengesInfo}>
                      <Text style={styles.challengesLabel}>Challenges</Text>
                      <Text style={styles.challengesValue}>
                        {reputation?.challenges_passed || 0} / {reputation?.challenges_attempted || 0} passed
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {activeTab === 'stake' && (
                <>
                  <View style={styles.infoCard}>
                    <FontAwesome5 name="info-circle" size={20} color="#4A90E2" />
                    <Text style={styles.infoText}>
                      Stake SMP tokens to increase your reward multiplier. Higher stakes = higher multipliers.
                    </Text>
                  </View>

                  <View style={styles.inputCard}>
                    <Text style={styles.inputLabel}>Amount to Stake (SMP)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter amount"
                      placeholderTextColor="#888"
                      value={stakeAmount}
                      onChangeText={setStakeAmount}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity style={styles.actionButton} onPress={handleStake}>
                      <FontAwesome5 name="lock" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                      <Text style={styles.buttonText}>Stake Tokens</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.multiplierCard}>
                    <Text style={styles.multiplierTitle}>Reward Multipliers</Text>
                    <View style={styles.multiplierRow}>
                      <Text style={styles.multiplierLabel}>100 SMP</Text>
                      <Text style={styles.multiplierValue}>1.1x</Text>
                    </View>
                    <View style={styles.multiplierRow}>
                      <Text style={styles.multiplierLabel}>500 SMP</Text>
                      <Text style={styles.multiplierValue}>1.2x</Text>
                    </View>
                    <View style={styles.multiplierRow}>
                      <Text style={styles.multiplierLabel}>1000 SMP</Text>
                      <Text style={styles.multiplierValue}>1.3x</Text>
                    </View>
                    <View style={styles.multiplierRow}>
                      <Text style={styles.multiplierLabel}>5000 SMP</Text>
                      <Text style={styles.multiplierValue}>1.5x</Text>
                    </View>
                  </View>
                </>
              )}

              {activeTab === 'withdraw' && (
                <>
                  <View style={styles.infoCard}>
                    <FontAwesome5 name="info-circle" size={20} color="#4A90E2" />
                    <Text style={styles.infoText}>
                      Withdrawal cooldowns apply based on your reputation tier. Higher tiers = shorter cooldowns.
                    </Text>
                  </View>

                  <View style={styles.cooldownCard}>
                    <Text style={styles.cooldownTitle}>Your Cooldown: {
                      {
                        seed: '24 hours',
                        reader: '12 hours',
                        scholar: '6 hours',
                        sage: '1 hour'
                      }[tier]
                    }</Text>
                  </View>

                  <View style={styles.inputCard}>
                    <Text style={styles.inputLabel}>Amount to Withdraw (SMP)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter amount"
                      placeholderTextColor="#888"
                      value={withdrawAmount}
                      onChangeText={setWithdrawAmount}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity style={styles.actionButton} onPress={handleWithdraw}>
                      <FontAwesome5 name="wallet" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                      <Text style={styles.buttonText}>Request Withdrawal</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.tierCard}>
                    <Text style={styles.tierCardTitle}>Tier Benefits</Text>
                    <View style={styles.tierRow}>
                      <FontAwesome5 name="seedling" size={16} color="#8B8B8B" />
                      <Text style={styles.tierText}>Seed: 24h cooldown, 1.0x multiplier</Text>
                    </View>
                    <View style={styles.tierRow}>
                      <FontAwesome5 name="book-open" size={16} color="#4A90E2" />
                      <Text style={styles.tierText}>Reader: 12h cooldown, 1.1x multiplier</Text>
                    </View>
                    <View style={styles.tierRow}>
                      <FontAwesome5 name="graduation-cap" size={16} color="#9B59B6" />
                      <Text style={styles.tierText}>Scholar: 6h cooldown, 1.3x multiplier</Text>
                    </View>
                    <View style={styles.tierRow}>
                      <FontAwesome5 name="crown" size={16} color="#F39C12" />
                      <Text style={styles.tierText}>Sage: 1h cooldown, 1.5x multiplier</Text>
                    </View>
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Animated.View>
  );
};

export default PoRPDashboard;
