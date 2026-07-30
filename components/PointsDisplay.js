import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';

const API_BASE_URL = 'https://sempaihq.com/api';

const PointsDisplay = () => {
  const { wallet: embeddedWallet } = useContext(EmbeddedWalletContext);
  const [pointsData, setPointsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const activePublicKey = embeddedWallet?.publicKey;
  const isWalletConnected = !!activePublicKey;

  const fetchPointsData = async () => {
    if (!isWalletConnected) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/user/points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: activePublicKey.toString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const weeklyPoints = data.weekly_points || 0;
      const amethystCount = data.amethyst_count || 0;
      const multiplierBonus = amethystCount * 2;
      const effectivePoints = weeklyPoints + multiplierBonus;

      setPointsData({
        weeklyPoints,
        totalPointsRead: data.total_points_read || 0,
        amethystCount,
        multiplierBonus,
        effectivePoints
      });

    } catch (error) {
      console.error('[PointsDisplay] Error fetching points:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshPoints = () => {
    setRefreshing(true);
    fetchPointsData();
  };

  useEffect(() => {
    if (isWalletConnected) {
      fetchPointsData();
    } else {
      setPointsData(null);
      setLoading(false);
    }
  }, [isWalletConnected]);

  if (!isWalletConnected) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#9B59B6" />
        <Text style={styles.loadingText}>Loading points...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading points</Text>
        <TouchableOpacity onPress={refreshPoints} style={styles.retryButton}>
          <Icon name="sync" size={16} color="#FFF" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!pointsData) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          <Icon name="trophy" size={18} color="#9B59B6" /> Your Points
        </Text>
        <TouchableOpacity 
          onPress={refreshPoints} 
          style={styles.refreshButton}
          disabled={refreshing}
        >
          <Icon name="sync" size={16} color="#9B59B6" />
        </TouchableOpacity>
      </View>

      <View style={styles.pointsGrid}>
        <View style={styles.pointsCard}>
          <View style={styles.cardHeader}>
            <Icon name="star" size={16} color="#9B59B6" />
            <Text style={styles.cardTitle}>Weekly Points</Text>
          </View>
          <Text style={styles.cardValue}>{pointsData.weeklyPoints.toLocaleString()}</Text>
          <Text style={styles.cardSubtitle}>Earned this week</Text>
        </View>

        <View style={styles.pointsCard}>
          <View style={styles.cardHeader}>
            <Icon name="trophy" size={16} color="#9B59B6" />
            <Text style={styles.cardTitle}>Total Points</Text>
          </View>
          <Text style={styles.cardValue}>{pointsData.totalPointsRead.toLocaleString()}</Text>
          <Text style={styles.cardSubtitle}>All-time reading</Text>
        </View>

        <View style={styles.pointsCard}>
          <View style={styles.cardHeader}>
            <Icon name="gem" size={16} color="#9B59B6" />
            <Text style={styles.cardTitle}>Amethyst</Text>
          </View>
          <Text style={styles.cardValue}>{pointsData.amethystCount.toLocaleString()}</Text>
          <Text style={styles.cardSubtitle}>×2 multiplier</Text>
        </View>

        <View style={[styles.pointsCard, styles.effectiveCard]}>
          <View style={styles.cardHeader}>
            <Icon name="trophy" size={16} color="#FFD700" />
            <Text style={styles.cardTitle}>Effective Points</Text>
          </View>
          <Text style={styles.cardValue}>{pointsData.effectivePoints.toLocaleString()}</Text>
          <Text style={styles.cardSubtitle}>{pointsData.weeklyPoints} + {pointsData.multiplierBonus} bonus</Text>
        </View>
      </View>

      <View style={styles.breakdown}>
        <Text style={styles.breakdownTitle}>Points Breakdown</Text>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>Base Points:</Text>
          <Text style={styles.breakdownValue}>+{pointsData.weeklyPoints.toLocaleString()}</Text>
        </View>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>Amethyst Bonus:</Text>
          <Text style={[styles.breakdownValue, styles.bonus]}>+{pointsData.multiplierBonus.toLocaleString()}</Text>
        </View>
        <View style={[styles.breakdownItem, styles.totalBreakdown]}>
          <Text style={styles.breakdownLabel}>Total Effective:</Text>
          <Text style={styles.breakdownValue}>{pointsData.effectivePoints.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    
    fontFamily: ' Yoruka',
  },
  refreshButton: {
    padding: 8,
  },
  loadingText: {
    color: '#AAA',
    fontSize: 14,
    marginLeft: 8,
    fontFamily: ' Yoruka',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 14,
    fontFamily: ' Yoruka',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    marginLeft: 8,
    fontFamily: ' Yoruka',
  },
  pointsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  pointsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    width: '48%',
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.2)',
  },
  effectiveCard: {
    borderColor: 'rgba(255, 215, 0, 0.3)',
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#9B59B6',
    fontSize: 12,
    
    marginLeft: 8,
    fontFamily: ' Yoruka',
  },
  cardValue: {
    color: '#FFF',
    fontSize: 24,
    
    marginBottom: 4,
    fontFamily: ' Yoruka',
  },
  cardSubtitle: {
    color: '#AAA',
    fontSize: 12,
    fontFamily: ' Yoruka',
  },
  breakdown: {
    backgroundColor: 'rgba(155, 89, 182, 0.05)',
    borderRadius: 12,
    padding: 12,
  },
  breakdownTitle: {
    color: '#9B59B6',
    fontSize: 14,
    
    marginBottom: 8,
    fontFamily: ' Yoruka',
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    color: '#CCC',
    fontSize: 14,
    fontFamily: ' Yoruka',
  },
  breakdownValue: {
    color: '#FFF',
    fontSize: 14,
    
    fontFamily: ' Yoruka',
  },
  bonus: {
    color: '#2ECC71',
  },
  totalBreakdown: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(155, 89, 182, 0.3)',
    paddingTop: 8,
    marginTop: 4,
  },
});

export default PointsDisplay;
