import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';

const LeaderboardShareCard = ({ 
  username, 
  profilePicture, 
  rank, 
  points, 
  leaderboardUrl = 'https://sempaihq.com/leaderboard',
  timeFrame = 'All Time'
}) => {
  return (
    <View style={styles.shareCard}>
      {/* Background with gradient */}
      <LinearGradient
        colors={['#1a1a2e', '#2d2d44', '#1a1a2e']}
        style={styles.cardBackground}
      >
        {/* Decorative elements */}
        <View style={[styles.glowOrb, styles.glowOrb1]} />
        <View style={[styles.glowOrb, styles.glowOrb2]} />
        <View style={[styles.glowOrb, styles.glowOrb3]} />
        
        {/* Card content */}
        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.logoSection}>
              <Image 
                source={{ uri: 'https://sempaihq.com/images/logo.jpeg' }}
                style={styles.logo}
              />
              <Text style={styles.logoText}>Sempai HQ</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>LEADERBOARD</Text>
            </View>
          </View>

          {/* User info section */}
          <View style={styles.userSection}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankNumber}>#{rank}</Text>
            </View>
            <View style={styles.userInfo}>
              <Image 
                source={{ uri: profilePicture || 'https://sempaihq.com/avatars/default.jpg' }}
                style={styles.profilePicture}
              />
              <View style={styles.userDetails}>
                <Text style={styles.username}>{username}</Text>
                <Text style={styles.timeFrame}>{timeFrame}</Text>
              </View>
            </View>
          </View>

          {/* Stats section */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Points</Text>
              <Text style={styles.statValue}>{points.toLocaleString()}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Rank</Text>
              <Text style={styles.statValue}>#{rank}</Text>
            </View>
          </View>

          {/* Footer with CTA */}
          <View style={styles.cardFooter}>
            <Text style={styles.ctaText}>View the full Top 50 Leaderboard</Text>
            <View style={styles.urlDisplay}>
              <Text style={styles.urlText}>{leaderboardUrl}</Text>
            </View>
          </View>
        </View>

        {/* Border effects */}
        <View style={[styles.border, styles.borderTop]} />
        <View style={[styles.border, styles.borderBottom]} />
        <View style={[styles.border, styles.borderLeft]} />
        <View style={[styles.border, styles.borderRight]} />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  shareCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9B59B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardBackground: {
    padding: 20,
    position: 'relative',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.1,
  },
  glowOrb1: {
    width: 150,
    height: 150,
    backgroundColor: '#9B59B6',
    top: -50,
    right: -50,
  },
  glowOrb2: {
    width: 100,
    height: 100,
    backgroundColor: '#3498DB',
    bottom: -30,
    left: -30,
  },
  glowOrb3: {
    width: 80,
    height: 80,
    backgroundColor: '#E74C3C',
    top: '50%',
    right: -20,
  },
  cardContent: {
    position: 'relative',
    zIndex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoText: {
    color: '#FFF',
    fontSize: 18,
    
    marginLeft: 12,
    fontFamily: 'AnimeAce',
  },
  badge: {
    backgroundColor: 'rgba(155, 89, 182, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#9B59B6',
  },
  badgeText: {
    color: '#9B59B6',
    fontSize: 12,
    
    fontFamily: 'AnimeAce',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rankBadge: {
    backgroundColor: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    borderRadius: 12,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rankNumber: {
    color: '#1a1a2e',
    fontSize: 24,
    
    fontFamily: 'AnimeAce',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#9B59B6',
  },
  userDetails: {
    flex: 1,
  },
  username: {
    color: '#FFF',
    fontSize: 18,
    
    fontFamily: 'AnimeAce',
  },
  timeFrame: {
    color: '#AAA',
    fontSize: 14,
    fontFamily: 'AnimeAce',
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#AAA',
    fontSize: 12,
    fontFamily: 'AnimeAce',
  },
  statValue: {
    color: '#9B59B6',
    fontSize: 20,
    
    fontFamily: 'AnimeAce',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(155, 89, 182, 0.3)',
  },
  cardFooter: {
    alignItems: 'center',
  },
  ctaText: {
    color: '#CCC',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'AnimeAce',
  },
  urlDisplay: {
    backgroundColor: 'rgba(155, 89, 182, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  urlText: {
    color: '#9B59B6',
    fontSize: 12,
    fontFamily: 'AnimeAce',
  },
  border: {
    position: 'absolute',
    backgroundColor: 'rgba(155, 89, 182, 0.5)',
  },
  borderTop: {
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  borderBottom: {
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  borderLeft: {
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
  borderRight: {
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
});

export default LeaderboardShareCard;
