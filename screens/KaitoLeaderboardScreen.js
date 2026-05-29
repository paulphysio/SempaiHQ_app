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
} from 'react-native';
import { styles } from '../styles/KaitoLeaderboardStyles';

const API_BASE_URL = 'https://sempaihq.com/api';

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
      const res = await fetch(`${API_BASE_URL}/porp/leaderboard?timeFrame=${timeFrame}`, {
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

  const handleShare = (reader) => {
    setSelectedReader(reader);
    setShowShareModal(true);
  };

  const shareToX = () => {
    if (!selectedReader) return;
    
    const username = selectedReader.name || 'Anonymous';
    const shareUrl = `https://www.sempaihq.com/kaito-leaderboard?username=${encodeURIComponent(username)}&rank=${selectedReader.rank}&points=${selectedReader.score}&timeFrame=${timeFrame}`;
    const shareText = `⚔️ I'm ranked #${selectedReader.rank} on the Kaito Brewmaster League with ${selectedReader.score.toLocaleString()} points! Join the military campaign:`;
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
    if (index === 0) return '#FFD700';
    if (index === 1) return '#C0C0C0';
    if (index === 2) return '#CD7F32';
    return '#9B59B6';
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Military Campaign Header */}
        <View style={styles.campaignHeader}>
          <View style={styles.campaignBanner}>
            <View style={styles.campaignTitle}>
              <Icon name="shield-alt" size={24} color="#9B59B6" />
              <Text style={styles.campaignTitleText}>Kaito Military Campaign</Text>
              <Icon name="flag" size={24} color="#E74C3C" />
            </View>
            <Text style={styles.campaignSubtitle}>
              ⚔️ Rise Through the Ranks - Conquer the Leaderboard ⚔️
            </Text>
            <View style={styles.campaignBadges}>
              <View style={styles.campaignBadge}>
                <Icon name="crosshairs" size={16} color="#9B59B6" />
                <Text style={styles.campaignBadgeText}>Tactical</Text>
              </View>
              <View style={styles.campaignBadge}>
                <Icon name="fire" size={16} color="#E74C3C" />
                <Text style={styles.campaignBadgeText}>Elite</Text>
              </View>
              <View style={styles.campaignBadge}>
                <Icon name="dragon" size={16} color="#3498DB" />
                <Text style={styles.campaignBadgeText}>Legendary</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Time Frame Selector */}
        <View style={styles.timeFrameSelector}>
          {['week', 'month', 'all'].map((frame) => (
            <TouchableOpacity
              key={frame}
              style={[
                styles.timeFrameButton,
                timeFrame === frame && styles.timeFrameButtonActive,
              ]}
              onPress={() => setTimeFrame(frame)}
            >
              <Text
                style={[
                  styles.timeFrameButtonText,
                  timeFrame === frame && styles.timeFrameButtonTextActive,
                ]}
              >
                {frame === 'week' ? 'This Week' : frame === 'month' ? 'This Month' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#9B59B6" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchLeaderboard}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.leaderboardContainer}>
            <View style={styles.leaderboardHeader}>
              <Text style={styles.headerText}>Rank</Text>
              <Text style={styles.headerText}>Player</Text>
              <Text style={styles.headerText}>Score</Text>
              <Text style={styles.headerText}>Level</Text>
              <Text style={styles.headerText}>Tier</Text>
              <Text style={styles.headerText}>Share</Text>
            </View>

            {leaderboard.map((reader, index) => (
              <View key={reader.walletAddress} style={styles.readerRow}>
                <View style={styles.rankCell}>
                  {index < 3 ? (
                    <View style={[styles.rankBadge, { borderColor: getRankColor(index) }]}>
                      <Icon
                        name={getRankIcon(index)}
                        size={16}
                        color={getRankColor(index)}
                      />
                      <Text style={[styles.rankNumber, { color: getRankColor(index) }]}>
                        {index + 1}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.rankNumber}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.playerCell}>
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
                <View style={styles.scoreCell}>
                  <Text style={styles.scoreValue}>{reader.score?.toLocaleString() || 0}</Text>
                </View>
                <View style={styles.levelCell}>
                  <Text style={styles.levelValue}>Lv. {reader.level || 0}</Text>
                </View>
                <View style={styles.tierCell}>
                  <View style={styles.tierBadge}>
                    <Text style={styles.tierText}>{reader.tier || 'Seed'}</Text>
                  </View>
                </View>
                <View style={styles.shareCell}>
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => handleShare(reader)}
                  >
                    <Icon name="share-alt" size={16} color="#9B59B6" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
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
              <Icon name="times" size={20} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.shareModalTitle}>Share Your Achievement</Text>
            
            <View style={styles.shareCard}>
              <Text style={styles.shareCardTitle}>Kaito Brewmaster League</Text>
              <Text style={styles.shareCardName}>{selectedReader?.name || 'Anonymous'}</Text>
              <Text style={styles.shareCardRank}>Rank #{selectedReader?.rank || 0}</Text>
              <Text style={styles.shareCardPoints}>
                {selectedReader?.score?.toLocaleString() || 0} points
              </Text>
              <Text style={styles.shareCardTimeFrame}>{timeFrame}</Text>
            </View>

            <TouchableOpacity style={styles.shareToXButton} onPress={shareToX}>
              <Icon name="twitter" size={20} color="#FFF" />
              <Text style={styles.shareToXButtonText}>Share on X</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default KaitoLeaderboardScreen;
