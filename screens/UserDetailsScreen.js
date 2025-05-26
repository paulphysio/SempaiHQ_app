import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { getUserDetails, getUserActivity } from '../utils/userManagement';

const UserDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { userId } = route.params;
  
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userDetails, userActivity] = await Promise.all([
        getUserDetails(userId),
        getUserActivity(userId)
      ]);
      setUser(userDetails);
      setActivity(userActivity);
    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLink = (platform, value) => {
    let url;
    switch (platform) {
      case 'x':
        url = `https://x.com/${value.replace('@', '')}`;
        break;
      case 'discord':
        // Discord usernames can't be directly linked, show in alert
        alert(`Discord: ${value}`);
        return;
      case 'website':
        url = value.startsWith('http') ? value : `https://${value}`;
        break;
      default:
        return;
    }
    Linking.openURL(url).catch(err => 
      console.error('Error opening link:', err)
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
        <Text style={styles.loadingText}>Loading user details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color="#FF5252" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadUserData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="user-slash" size={48} color="#FF5252" />
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={20} color="#E67E22" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Details</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadUserData}
        >
          <Icon name="sync" size={20} color="#E67E22" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.profileHeader}>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user.name || 'Anonymous'}</Text>
              <Text style={styles.userDate}>
                Joined: {new Date(user.created_at).toLocaleDateString()}
              </Text>
            </View>
            {user.has_updated_profile && (
              <View style={styles.verifiedBadge}>
                <Icon name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {user.bio && (
            <Text style={styles.bio}>{user.bio}</Text>
          )}

          {/* Social Links */}
          <View style={styles.socialLinks}>
            {user.x_account && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialLink('x', user.x_account)}
              >
                <Icon name="twitter" size={20} color="#E67E22" />
                <Text style={styles.socialText}>{user.x_account}</Text>
              </TouchableOpacity>
            )}
            
            {user.discord && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialLink('discord', user.discord)}
              >
                <Icon name="discord" size={20} color="#E67E22" />
                <Text style={styles.socialText}>{user.discord}</Text>
              </TouchableOpacity>
            )}
            
            {user.website && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialLink('website', user.website)}
              >
                <Icon name="globe" size={20} color="#E67E22" />
                <Text style={styles.socialText}>{user.website}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Icon name="book-reader" size={24} color="#E67E22" />
              <Text style={styles.statNumber}>{user.totalPayments}</Text>
              <Text style={styles.statLabel}>Chapters Read</Text>
            </View>
            
            <View style={styles.statCard}>
              <Icon name="comments" size={24} color="#E67E22" />
              <Text style={styles.statNumber}>{user.totalComments}</Text>
              <Text style={styles.statLabel}>Comments</Text>
            </View>
            
            <View style={styles.statCard}>
              <Icon name="unlock" size={24} color="#E67E22" />
              <Text style={styles.statNumber}>{user.totalUnlocked}</Text>
              <Text style={styles.statLabel}>Unlocked</Text>
            </View>
          </View>
        </View>

        {/* Wallet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wallet</Text>
          {user.wallet_address ? (
            <View style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <Icon name="wallet" size={20} color="#E67E22" />
                <Text style={styles.walletLabel}>Address</Text>
              </View>
              <Text style={styles.walletAddress}>{user.wallet_address}</Text>
              <View style={styles.walletStats}>
                <View style={styles.walletStat}>
                  <Icon name="star" size={16} color="#E67E22" />
                  <Text style={styles.walletStatText}>
                    {user.weekly_points || 0} Points
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noWalletCard}>
              <Icon name="wallet" size={32} color="#666666" />
              <Text style={styles.noWalletText}>No wallet connected</Text>
            </View>
          )}
        </View>

        {/* Recent Activity Section */}
        {activity && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            
            {/* Recent Payments */}
            {activity.recentPayments?.length > 0 && (
              <View style={styles.activityGroup}>
                <Text style={styles.activityTitle}>Recent Payments</Text>
                {activity.recentPayments.map((payment, index) => (
                  <View key={payment.id} style={styles.activityItem}>
                    <Icon name="book" size={16} color="#E67E22" />
                    <Text style={styles.activityText}>
                      Paid {payment.amount} SMP for Chapter {payment.chapter_number}
                    </Text>
                    <Text style={styles.activityDate}>
                      {new Date(payment.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            
            {/* Recent Comments */}
            {activity.recentComments?.length > 0 && (
              <View style={styles.activityGroup}>
                <Text style={styles.activityTitle}>Recent Comments</Text>
                {activity.recentComments.map((comment, index) => (
                  <View key={comment.id} style={styles.activityItem}>
                    <Icon name="comment" size={16} color="#E67E22" />
                    <Text style={styles.activityText} numberOfLines={2}>
                      {comment.content}
                    </Text>
                    <Text style={styles.activityDate}>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userDate: {
    fontSize: 14,
    color: '#888888',
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A3E',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  verifiedText: {
    color: '#4CAF50',
    marginLeft: 4,
    fontSize: 12,
  },
  bio: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 16,
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A3E',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  socialText: {
    color: '#ffffff',
    marginLeft: 8,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2A2A3E',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E67E22',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#ffffff',
    marginTop: 4,
  },
  walletCard: {
    backgroundColor: '#2A2A3E',
    borderRadius: 8,
    padding: 16,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  walletLabel: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
  },
  walletAddress: {
    color: '#E67E22',
    fontSize: 14,
    marginBottom: 12,
  },
  walletStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  walletStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletStatText: {
    color: '#ffffff',
    marginLeft: 8,
    fontSize: 14,
  },
  noWalletCard: {
    backgroundColor: '#2A2A3E',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
  },
  noWalletText: {
    color: '#666666',
    marginTop: 8,
    fontSize: 16,
  },
  activityGroup: {
    marginBottom: 16,
  },
  activityTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A3E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  activityText: {
    flex: 1,
    color: '#ffffff',
    marginLeft: 8,
    fontSize: 14,
  },
  activityDate: {
    color: '#888888',
    fontSize: 12,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
  },
  loadingText: {
    marginTop: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#E67E22',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
  },
});

export default UserDetailsScreen; 