import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/AdminStyles';

const API_BASE_URL = 'https://sempaihq.com/api';

const AdminScreen = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState(null);
  const [pendingWriters, setPendingWriters] = useState([]);
  const [weeklyRewards, setWeeklyRewards] = useState([]);

  useEffect(() => {
    checkAdminStatus();
    loadAdminData();
  }, [activeTab]);

  const checkAdminStatus = async () => {
    try {
      if (!isWalletConnected) {
        setIsAdmin(false);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('isSuperuser')
        .eq('wallet_address', wallet?.publicKey)
        .single();

      setIsAdmin(userData?.isSuperuser || false);
    } catch (error) {
      console.error('[AdminScreen] Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const loadAdminData = async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);

      switch (activeTab) {
        case 'overview':
          await loadStats();
          break;
        case 'writers':
          await loadPendingWriters();
          break;
        case 'rewards':
          await loadWeeklyRewards();
          break;
      }
    } catch (error) {
      console.error('[AdminScreen] Error loading admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('[AdminScreen] Error loading stats:', error);
    }
  };

  const loadPendingWriters = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/writers-approval`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setPendingWriters(data);
    } catch (error) {
      console.error('[AdminScreen] Error loading pending writers:', error);
    }
  };

  const loadWeeklyRewards = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/weekly-reward`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setWeeklyRewards(data);
    } catch (error) {
      console.error('[AdminScreen] Error loading weekly rewards:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAdminData();
  };

  const handleApproveWriter = async (writerId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/writers-approval/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ writerId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      Alert.alert('Success', 'Writer approved successfully');
      loadPendingWriters();
    } catch (error) {
      console.error('[AdminScreen] Error approving writer:', error);
      Alert.alert('Error', 'Failed to approve writer');
    }
  };

  const handleRejectWriter = async (writerId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/writers-approval/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ writerId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      Alert.alert('Success', 'Writer rejected successfully');
      loadPendingWriters();
    } catch (error) {
      console.error('[AdminScreen] Error rejecting writer:', error);
      Alert.alert('Error', 'Failed to reject writer');
    }
  };

  if (!isWalletConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lockedContainer}>
          <FontAwesome5 name="shield-alt" size={48} color="#E74C3C" />
          <Text style={styles.lockedMessage}>Connect Wallet to Access Admin</Text>
          <TouchableOpacity 
            style={styles.connectButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <FontAwesome5 name="wallet" size={16} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lockedContainer}>
          <FontAwesome5 name="lock" size={48} color="#E74C3C" />
          <Text style={styles.lockedMessage}>Admin Access Required</Text>
          <Text style={styles.lockedSubtext}>You don't have admin privileges</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <FontAwesome5 name="home" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <FontAwesome5 
            name="chart-line" 
            size={16} 
            color={activeTab === 'overview' ? '#FFFFFF' : '#CCCCCC'} 
          />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'writers' && styles.activeTab]}
          onPress={() => setActiveTab('writers')}
        >
          <FontAwesome5 
            name="user-edit" 
            size={16} 
            color={activeTab === 'writers' ? '#FFFFFF' : '#CCCCCC'} 
          />
          <Text style={[styles.tabText, activeTab === 'writers' && styles.activeTabText]}>
            Writers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'rewards' && styles.activeTab]}
          onPress={() => setActiveTab('rewards')}
        >
          <FontAwesome5 
            name="gift" 
            size={16} 
            color={activeTab === 'rewards' ? '#FFFFFF' : '#CCCCCC'} 
          />
          <Text style={[styles.tabText, activeTab === 'rewards' && styles.activeTabText]}>
            Rewards
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9B59B6" />
          <Text style={styles.loadingText}>Loading admin data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activeTab === 'overview' && stats && (
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <FontAwesome5 name="users" size={32} color="#4A90E2" />
                <Text style={styles.statValue}>{stats.totalUsers || 0}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>

              <View style={styles.statCard}>
                <FontAwesome5 name="book" size={32} color="#9B59B6" />
                <Text style={styles.statValue}>{stats.totalNovels || 0}</Text>
                <Text style={styles.statLabel}>Total Novels</Text>
              </View>

              <View style={styles.statCard}>
                <FontAwesome5 name="pen-fancy" size={32} color="#F39C12" />
                <Text style={styles.statValue}>{stats.activeWriters || 0}</Text>
                <Text style={styles.statLabel}>Active Writers</Text>
              </View>

              <View style={styles.statCard}>
                <FontAwesome5 name="wallet" size={32} color="#E74C3C" />
                <Text style={styles.statValue}>{stats.totalTransactions || 0}</Text>
                <Text style={styles.statLabel}>Transactions</Text>
              </View>
            </View>
          )}

          {activeTab === 'writers' && (
            <View style={styles.writersContainer}>
              <Text style={styles.sectionTitle}>Pending Writer Applications</Text>
              {pendingWriters.length === 0 ? (
                <Text style={styles.emptyText}>No pending applications</Text>
              ) : (
                pendingWriters.map((writer) => (
                  <View key={writer.id} style={styles.writerCard}>
                    <View style={styles.writerInfo}>
                      <Text style={styles.writerName}>{writer.name || 'Anonymous'}</Text>
                      <Text style={styles.writerEmail}>{writer.email || 'No email'}</Text>
                      <Text style={styles.writerDate}>
                        Applied: {new Date(writer.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.writerActions}>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => handleApproveWriter(writer.id)}
                      >
                        <FontAwesome5 name="check" size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleRejectWriter(writer.id)}
                      >
                        <FontAwesome5 name="times" size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'rewards' && (
            <View style={styles.rewardsContainer}>
              <Text style={styles.sectionTitle}>Weekly Rewards</Text>
              {weeklyRewards.length === 0 ? (
                <Text style={styles.emptyText}>No rewards data available</Text>
              ) : (
                weeklyRewards.map((reward) => (
                  <View key={reward.id} style={styles.rewardCard}>
                    <FontAwesome5 name="trophy" size={24} color="#F39C12" />
                    <View style={styles.rewardInfo}>
                      <Text style={styles.rewardUser}>{reward.user_name || 'Anonymous'}</Text>
                      <Text style={styles.rewardAmount}>{reward.amount || 0} SMP</Text>
                      <Text style={styles.rewardDate}>
                        Week: {reward.week || 'N/A'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default AdminScreen;
