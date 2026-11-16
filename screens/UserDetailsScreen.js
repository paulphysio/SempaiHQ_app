import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { getUserDetails, getUserActivity } from '../utils/userManagement';
import { useTheme } from '../context/ThemeContext';

const UserDetailsScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getUserDetailsStyles(colors), [isDark]);
  const route = useRoute();
  const navigation = useNavigation();
  const { userId } = route.params;
  
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
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
      if (showLoader) setLoading(false);
    }
  };

  // Pull-to-refresh: silent reload — keeps the profile visible.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserData(false);
    } finally {
      setRefreshing(false);
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
        <ActivityIndicator size="large" color={colors.accent} />
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
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
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
                <Icon name="twitter" size={20} color={colors.accent} />
                <Text style={styles.socialText}>{user.x_account}</Text>
              </TouchableOpacity>
            )}
            
            {user.discord && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialLink('discord', user.discord)}
              >
                <Icon name="discord" size={20} color={colors.accent} />
                <Text style={styles.socialText}>{user.discord}</Text>
              </TouchableOpacity>
            )}
            
            {user.website && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialLink('website', user.website)}
              >
                <Icon name="globe" size={20} color={colors.accent} />
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
              <Icon name="book-reader" size={24} color={colors.accent} />
              <Text style={styles.statNumber}>{user.totalPayments}</Text>
              <Text style={styles.statLabel}>Chapters Read</Text>
            </View>
            
            <View style={styles.statCard}>
              <Icon name="comments" size={24} color={colors.accent} />
              <Text style={styles.statNumber}>{user.totalComments}</Text>
              <Text style={styles.statLabel}>Comments</Text>
            </View>
            
            <View style={styles.statCard}>
              <Icon name="unlock" size={24} color={colors.accent} />
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
                <Icon name="wallet" size={20} color={colors.accent} />
                <Text style={styles.walletLabel}>Address</Text>
              </View>
              <Text style={styles.walletAddress}>{user.wallet_address}</Text>
              <View style={styles.walletStats}>
                <View style={styles.walletStat}>
                  <Icon name="star" size={16} color={colors.accent} />
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
                    <Icon name="book" size={16} color={colors.accent} />
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
                    <Icon name="comment" size={16} color={colors.accent} />
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

export const getUserDetailsStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bgCard,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'c.bgCard',
  },
  headerTitle: {
    fontSize: 20,
     
    color: c.textPrimary,
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
    borderBottomColor: 'c.bgCard',
  },
  sectionTitle: {
    fontSize: 18,
     
    color: c.textPrimary,
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
     
    color: c.textPrimary,
  },
  userDate: {
    fontSize: 14,
    color: c.textMuted,
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'c.bgCard',
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
    color: c.textPrimary,
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
    backgroundColor: 'c.bgCard',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  socialText: {
    color: c.textPrimary,
    marginLeft: 8,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'c.bgCard',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
     
    color: c.accent,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: c.textPrimary,
    marginTop: 4,
  },
  walletCard: {
    backgroundColor: 'c.bgCard',
    borderRadius: 8,
    padding: 16,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  walletLabel: {
    color: c.textPrimary,
    fontSize: 16,
    marginLeft: 8,
  },
  walletAddress: {
    color: c.accent,
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
    color: c.textPrimary,
    marginLeft: 8,
    fontSize: 14,
  },
  noWalletCard: {
    backgroundColor: 'c.bgCard',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
  },
  noWalletText: {
    color: c.textMuted,
    marginTop: 8,
    fontSize: 16,
  },
  activityGroup: {
    marginBottom: 16,
  },
  activityTitle: {
    color: c.textPrimary,
    fontSize: 16,
     
    marginBottom: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'c.bgCard',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  activityText: {
    flex: 1,
    color: c.textPrimary,
    marginLeft: 8,
    fontSize: 14,
  },
  activityDate: {
    color: c.textMuted,
    fontSize: 12,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.bgCard,
  },
  loadingText: {
    marginTop: 16,
    color: c.textPrimary,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.bgCard,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: c.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retryText: {
    color: c.textPrimary,
    fontSize: 16,
  },
});

export default UserDetailsScreen; 