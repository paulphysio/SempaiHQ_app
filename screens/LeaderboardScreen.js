import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/LeaderboardStyles';

const API_BASE_URL = 'https://sempaihq.com/api';

const LeaderboardScreen = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('reading'); // reading, kaito, general
  const [userRank, setUserRank] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      let endpoint = '';
      
      switch (activeTab) {
        case 'reading':
          endpoint = '/leaderboard/reading';
          break;
        case 'kaito':
          endpoint = '/kaito-leaderboard';
          break;
        case 'general':
          endpoint = '/leaderboard';
          break;
        default:
          endpoint = '/leaderboard';
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setLeaderboardData(data);

      // Find user's rank if connected
      if (isWalletConnected && wallet?.publicKey) {
        const userEntry = data.find(entry => 
          entry.wallet_address === wallet.publicKey.toString()
        );
        setUserRank(userEntry ? userEntry.rank : null);
      }
    } catch (error) {
      console.error('[LeaderboardScreen] Error loading leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboard();
  };

  const getRankColor = (rank) => {
    if (rank === 1) return '#FFD700'; // Gold
    if (rank === 2) return '#C0C0C0'; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return '#8B8B8B';
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return 'trophy';
    if (rank === 2) return 'medal';
    if (rank === 3) return 'award';
    return 'hashtag';
  };

  const renderLeaderboardItem = ({ item, index }) => {
    const rank = index + 1;
    const isCurrentUser = isWalletConnected && wallet?.publicKey && 
                          item.wallet_address === wallet.publicKey.toString();
    const rankColor = getRankColor(rank);
    const rankIcon = getRankIcon(rank);

    return (
      <View style={[
        styles.leaderboardItem,
        isCurrentUser && styles.currentUserItem
      ]}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <FontAwesome5 name={rankIcon} size={16} color="#FFFFFF" />
          <Text style={styles.rankNumber}>{rank}</Text>
        </View>

        <View style={styles.userInfo}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.userAvatar} />
          ) : (
            <View style={styles.placeholderAvatar}>
              <FontAwesome5 name="user" size={20} color="#CCCCCC" />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.name || item.wallet_address?.slice(0, 6) + '...' || 'Anonymous'}
            </Text>
            <Text style={styles.userScore}>
              {activeTab === 'reading' ? `${item.pages_read || 0} pages` : 
               activeTab === 'kaito' ? `${item.score || 0} points` : 
               `${item.points || 0} points`}
            </Text>
          </View>
        </View>

        {isCurrentUser && (
          <View style={styles.youBadge}>
            <Text style={styles.youBadgeText}>YOU</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reading' && styles.activeTab]}
          onPress={() => setActiveTab('reading')}
        >
          <FontAwesome5 
            name="book-open" 
            size={16} 
            color={activeTab === 'reading' ? '#FFFFFF' : '#CCCCCC'} 
          />
          <Text style={[styles.tabText, activeTab === 'reading' && styles.activeTabText]}>
            Reading
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'kaito' && styles.activeTab]}
          onPress={() => setActiveTab('kaito')}
        >
          <FontAwesome5 
            name="gamepad" 
            size={16} 
            color={activeTab === 'kaito' ? '#FFFFFF' : '#CCCCCC'} 
          />
          <Text style={[styles.tabText, activeTab === 'kaito' && styles.activeTabText]}>
            Kaito
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'general' && styles.activeTab]}
          onPress={() => setActiveTab('general')}
        >
          <FontAwesome5 
            name="star" 
            size={16} 
            color={activeTab === 'general' ? '#FFFFFF' : '#CCCCCC'} 
          />
          <Text style={[styles.tabText, activeTab === 'general' && styles.activeTabText]}>
            General
          </Text>
        </TouchableOpacity>
      </View>

      {userRank && (
        <View style={styles.userRankBanner}>
          <LinearGradient
            colors={['#9B59B6', '#8E44AD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rankBannerGradient}
          >
            <FontAwesome5 name="trophy" size={20} color="#FFFFFF" />
            <Text style={styles.userRankText}>
              Your Rank: #{userRank}
            </Text>
          </LinearGradient>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9B59B6" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboardData}
          renderItem={renderLeaderboardItem}
          keyExtractor={(item, index) => `leaderboard-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="trophy" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>No leaderboard data available</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default LeaderboardScreen;
