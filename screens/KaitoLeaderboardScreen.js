import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

const API_BASE_URL = 'https://sempaihq.com/api';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  // Military Campaign Header
  campaignHeader: {
    marginBottom: 16,
  },
  campaignBanner: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#ff6200',
  },
  campaignTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shieldIcon: {
    marginRight: 12,
  },
  flagIcon: {
    marginLeft: 12,
  },
  campaignTitleText: {
    color: '#ffd700',
    fontSize: 20,
     
    letterSpacing: 1,
  },
  campaignSubtitle: {
    color: '#8b949e',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  campaignBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  campaignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#21262d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  campaignBadgeText: {
    color: '#8b949e',
    fontSize: 12,
     
    marginLeft: 6,
  },
  // Time Frame Selector
  timeFrameSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#161b22',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  timeFrameButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  timeFrameButtonActive: {
    backgroundColor: '#ff6200',
  },
  timeFrameButtonText: {
    color: '#8b949e',
    fontSize: 13,
     
  },
  timeFrameButtonTextActive: {
    color: '#ffffff',
     
  },
  // Leaderboard Container
  leaderboardContainer: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  leaderboardHeader: {
    flexDirection: 'row',
    backgroundColor: '#21262d',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  headerRank: {
    width: 50,
    alignItems: 'center',
  },
  headerRankText: {
    color: '#8b949e',
    fontSize: 12,
     
  },
  headerPlayer: {
    flex: 1,
  },
  headerPlayerText: {
    color: '#8b949e',
    fontSize: 12,
     
  },
  headerScore: {
    width: 70,
    alignItems: 'center',
  },
  headerScoreText: {
    color: '#8b949e',
    fontSize: 12,
     
  },
  headerLevel: {
    width: 60,
    alignItems: 'center',
  },
  headerLevelText: {
    color: '#8b949e',
    fontSize: 12,
     
  },
  headerTier: {
    width: 60,
    alignItems: 'center',
  },
  headerTierText: {
    color: '#8b949e',
    fontSize: 12,
     
  },
  headerShare: {
    width: 40,
    alignItems: 'center',
  },
  // Leaderboard Row
  readerRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    alignItems: 'center',
  },
  rankCell: {
    width: 50,
    alignItems: 'center',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rankBadge1: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  rankBadge2: {
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
    borderWidth: 1,
    borderColor: '#c0c0c0',
  },
  rankBadge3: {
    backgroundColor: 'rgba(205, 127, 50, 0.2)',
    borderWidth: 1,
    borderColor: '#cd7f32',
  },
  rankIcon: {
    marginRight: 4,
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 12,
     
  },
  rankNumber: {
    color: '#8b949e',
    fontSize: 13,
     
  },
  playerCell: {
    flex: 1,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#21262d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  playerAvatarText: {
    color: '#ffd700',
    fontSize: 14,
     
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    color: '#ffffff',
    fontSize: 13,
     
    marginBottom: 2,
  },
  playerAddress: {
    color: '#8b949e',
    fontSize: 11,
  },
  scoreCell: {
    width: 70,
    alignItems: 'center',
  },
  scoreValue: {
    color: '#ffd700',
    fontSize: 13,
     
  },
  levelCell: {
    width: 60,
    alignItems: 'center',
  },
  levelValue: {
    color: '#8b949e',
    fontSize: 12,
     
  },
  tierCell: {
    width: 60,
    alignItems: 'center',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierBadgeText: {
    color: '#ffffff',
    fontSize: 10,
     
  },
  shareCell: {
    width: 40,
    alignItems: 'center',
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#21262d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Loading & Error States
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#8b949e',
    marginTop: 16,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#f85149',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
     
  },
  retryButton: {
    backgroundColor: '#ff6200',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
     
  },
  // Share Modal
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModal: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    borderWidth: 2,
    borderColor: '#ff6200',
  },
  closeModalButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  shareModalTitle: {
    color: '#ffd700',
    fontSize: 18,
     
    textAlign: 'center',
    marginBottom: 20,
  },
  shareCard: {
    backgroundColor: '#0d1117',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  shareCardIcon: {
    marginBottom: 12,
  },
  shareCardName: {
    color: '#ffffff',
    fontSize: 18,
     
    marginBottom: 8,
  },
  shareCardRank: {
    color: '#ffd700',
    fontSize: 32,
     
    marginBottom: 4,
  },
  shareCardPoints: {
    color: '#8b949e',
    fontSize: 14,
    marginBottom: 8,
  },
  shareCardTier: {
    color: '#238636',
    fontSize: 12,
     
  },
  shareToXButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1da1f2',
    borderRadius: 8,
    paddingVertical: 12,
  },
  shareToXButtonText: {
    color: '#ffffff',
    fontSize: 14,
     
    marginLeft: 8,
  },
});

const KaitoLeaderboardScreen = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFrame, setTimeFrame] = useState('week');
  const [selectedReader, setSelectedReader] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/porp/leaderboard?limit=50`, {
        method: 'GET',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch leaderboard');

      setLeaderboard(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [timeFrame]);

  // Auto-refresh leaderboard every 30 seconds for live data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeaderboard();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [timeFrame]);

  const handleShare = (reader) => {
    setSelectedReader(reader);
    setShowShareModal(true);
  };

  const shareToX = () => {
    if (!selectedReader) return;
    
    const username = selectedReader.name || 'Anonymous';
    const rank = leaderboard.findIndex(r => r.walletAddress === selectedReader.walletAddress) + 1;
    const shareUrl = `https://www.sempaihq.com/kaito-leaderboard`;
    const shareText = `⚔️ I'm ranked #${rank} on the Kaito Brewmaster League with ${(selectedReader.score || 0).toLocaleString()} points! Join the military campaign:`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    
    Linking.openURL(twitterUrl).catch(() => {
      Alert.alert('Error', 'Could not open Twitter');
    });
    setShowShareModal(false);
  };

  const getRankIcon = (index) => {
    if (index === 0) return 'crown';
    if (index === 1) return 'medal';
    if (index === 2) return 'id-badge';
    return null;
  };

  const getRankColor = (index) => {
    if (index === 0) return '#ffd700';
    if (index === 1) return '#c0c0c0';
    if (index === 2) return '#cd7f32';
    return null;
  };

  const getRankBadgeStyle = (index) => {
    if (index === 0) return styles.rankBadge1;
    if (index === 1) return styles.rankBadge2;
    if (index === 2) return styles.rankBadge3;
    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ff6200" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Leaderboard Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchLeaderboard}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Military Campaign Header */}
        <View style={styles.campaignHeader}>
          <View style={styles.campaignBanner}>
            <View style={styles.campaignTitle}>
              <Icon name="shield-alt" size={24} color="#ff6200" style={styles.shieldIcon} />
              <Text style={styles.campaignTitleText}>Kaito Military Campaign</Text>
              <Icon name="flag" size={24} color="#ffd700" style={styles.flagIcon} />
            </View>
            <Text style={styles.campaignSubtitle}>
              ⚔️ Rise Through the Ranks - Conquer the Leaderboard ⚔️
            </Text>
            <View style={styles.campaignBadges}>
              <View style={styles.campaignBadge}>
                <Icon name="crosshairs" size={14} color="#ff6200" />
                <Text style={styles.campaignBadgeText}>Tactical</Text>
              </View>
              <View style={styles.campaignBadge}>
                <Icon name="fire" size={14} color="#ff6200" />
                <Text style={styles.campaignBadgeText}>Elite</Text>
              </View>
              <View style={styles.campaignBadge}>
                <Icon name="dragon" size={14} color="#ff6200" />
                <Text style={styles.campaignBadgeText}>Legendary</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Time Frame Selector */}
        <View style={styles.timeFrameSelector}>
          <TouchableOpacity
            style={[styles.timeFrameButton, timeFrame === 'week' && styles.timeFrameButtonActive]}
            onPress={() => setTimeFrame('week')}
          >
            <Text style={[styles.timeFrameButtonText, timeFrame === 'week' && styles.timeFrameButtonTextActive]}>
              This Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeFrameButton, timeFrame === 'month' && styles.timeFrameButtonActive]}
            onPress={() => setTimeFrame('month')}
          >
            <Text style={[styles.timeFrameButtonText, timeFrame === 'month' && styles.timeFrameButtonTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeFrameButton, timeFrame === 'all' && styles.timeFrameButtonActive]}
            onPress={() => setTimeFrame('all')}
          >
            <Text style={[styles.timeFrameButtonText, timeFrame === 'all' && styles.timeFrameButtonTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>
        </View>

        {/* Leaderboard Table */}
        <View style={styles.leaderboardContainer}>
          {/* Header */}
          <View style={styles.leaderboardHeader}>
            <View style={styles.headerRank}>
              <Text style={styles.headerRankText}>Rank</Text>
            </View>
            <View style={styles.headerPlayer}>
              <Text style={styles.headerPlayerText}>Player</Text>
            </View>
            <View style={styles.headerScore}>
              <Text style={styles.headerScoreText}>Score</Text>
            </View>
            <View style={styles.headerLevel}>
              <Text style={styles.headerLevelText}>Level</Text>
            </View>
            <View style={styles.headerTier}>
              <Text style={styles.headerTierText}>Tier</Text>
            </View>
            <View style={styles.headerShare}>
              <Text style={styles.headerRankText}>Share</Text>
            </View>
          </View>

          {/* Rows */}
          {leaderboard.map((reader, index) => (
            <View key={reader.walletAddress} style={styles.readerRow}>
              <View style={styles.rankCell}>
                {index < 3 ? (
                  <View style={[styles.rankBadge, getRankBadgeStyle(index)]}>
                    <Icon name={getRankIcon(index)} size={12} color={getRankColor(index)} style={styles.rankIcon} />
                    <Text style={styles.rankBadgeText}>{index + 1}</Text>
                  </View>
                ) : (
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                )}
              </View>
              <View style={styles.playerCell}>
                <View style={styles.playerInfo}>
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerAvatarText}>
                      {reader.name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.playerDetails}>
                    <Text style={styles.playerName}>{reader.name || 'Anonymous'}</Text>
                    <Text style={styles.playerAddress}>
                      {reader.walletAddress?.slice(0, 6)}...{reader.walletAddress?.slice(-4)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.scoreCell}>
                <Text style={styles.scoreValue}>{reader.score?.toLocaleString() || 0}</Text>
              </View>
              <View style={styles.levelCell}>
                <Text style={styles.levelValue}>Lv. {reader.level || 0}</Text>
              </View>
              <View style={styles.tierCell}>
                <View style={[styles.tierBadge, { backgroundColor: '#238636' }]}>
                  <Text style={styles.tierBadgeText}>{reader.tier || 'Seed'}</Text>
                </View>
              </View>
              <View style={styles.shareCell}>
                <TouchableOpacity style={styles.shareButton} onPress={() => handleShare(reader)}>
                  <Icon name="share-alt" size={14} color="#8b949e" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <TouchableOpacity
          style={styles.shareModalOverlay}
          activeOpacity={1}
          onPress={() => setShowShareModal(false)}
        >
          <View style={styles.shareModal} onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowShareModal(false)}
            >
              <Icon name="times" size={20} color="#8b949e" />
            </TouchableOpacity>
            <Text style={styles.shareModalTitle}>Share Your Achievement</Text>
            
            <View style={styles.shareCard}>
              <View style={styles.shareCardIcon}>
                <Icon name="trophy" size={48} color="#ffd700" />
              </View>
              <Text style={styles.shareCardName}>{selectedReader?.name || 'Anonymous'}</Text>
              <Text style={styles.shareCardRank}>
                Rank #{leaderboard.findIndex(r => r.walletAddress === selectedReader?.walletAddress) + 1}
              </Text>
              <Text style={styles.shareCardPoints}>
                {(selectedReader?.score || 0).toLocaleString()} points
              </Text>
              <Text style={styles.shareCardTier}>{selectedReader?.tier || 'Seed'}</Text>
            </View>

            <TouchableOpacity style={styles.shareToXButton} onPress={shareToX}>
              <Icon name="twitter" size={18} color="#ffffff" />
              <Text style={styles.shareToXButtonText}>Share on X</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default KaitoLeaderboardScreen;
