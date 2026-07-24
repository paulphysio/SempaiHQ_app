import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

const LeaderboardModal = ({ connected, leaderboardData, toggleModal }) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [timeFrame, setTimeFrame] = useState('week');

  const handleShare = (entry) => {
    setSelectedEntry(entry);
    setShowShareModal(true);
  };

  const shareToX = () => {
    if (!selectedEntry) return;
    
    const username = selectedEntry.name || 'Anonymous';
    const rank = leaderboardData.findIndex(e => e.wallet_address === selectedEntry.wallet_address) + 1;
    const shareText = `⚔️ I'm ranked #${rank} on the Kaito Brewmaster League with ${selectedEntry.gold?.toLocaleString() || 0} points! Join the military campaign:`;
    const shareUrl = 'https://www.sempaihq.com/kaito-adventure';
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    
    Linking.openURL(twitterUrl);
    setShowShareModal(false);
  };

  const getTierColor = (tier) => {
    const tierColors = {
      'Seed': '#888',
      'Sprout': '#90ee90',
      'Sapling': '#00ced1',
      'Tree': '#32cd32',
      'Forest': '#228b22',
      'Ancient': '#ffd700',
    };
    return tierColors[tier] || '#888';
  };

  const renderLeaderboardItem = (item, index) => (
    <View style={militaryStyles.entry}>
      <View style={militaryStyles.rank}>
        {index < 3 ? (
          <View style={[militaryStyles.rankBadge, militaryStyles[`rank${index + 1}`]]}>
            {index === 0 && <Icon name="crown" size={14} color="#ffd700" />}
            {index === 1 && <Icon name="medal" size={14} color="#c0c0c0" />}
            {index === 2 && <Icon name="id-badge" size={14} color="#cd7f32" />}
            <Text style={militaryStyles.rankNumber}>{index + 1}</Text>
          </View>
        ) : (
          <Text style={militaryStyles.rankNumber}>{index + 1}</Text>
        )}
      </View>
      <View style={militaryStyles.player}>
        <View style={militaryStyles.avatar}>
          <Text style={militaryStyles.avatarText}>{item.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
        <View style={militaryStyles.playerInfo}>
          <Text style={militaryStyles.name}>{item.name || 'Anonymous'}</Text>
          <Text style={militaryStyles.address}>
            {item.wallet_address?.slice(0, 6)}...{item.wallet_address?.slice(-4)}
          </Text>
        </View>
      </View>
      <View style={militaryStyles.score}>
        <Text style={militaryStyles.scoreValue}>{item.gold?.toLocaleString() || 0}</Text>
      </View>
      <View style={militaryStyles.level}>
        <Text style={militaryStyles.levelValue}>Lv. {item.level || 0}</Text>
      </View>
      <View style={militaryStyles.tier}>
        <View style={[militaryStyles.tierBadge, { borderColor: getTierColor(item.tier) }]}>
          <Text style={[militaryStyles.tierText, { color: getTierColor(item.tier) }]}>
            {item.tier || 'Seed'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={militaryStyles.shareButton}
        onPress={() => handleShare(item)}
      >
        <Icon name="share-alt" size={14} color="#ffd700" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={militaryStyles.container}>
      {/* Campaign Header */}
      <View style={militaryStyles.campaignHeader}>
        <View style={militaryStyles.campaignBanner}>
          <View style={militaryStyles.campaignTitle}>
            <Icon name="shield-alt" size={20} color="#ffd700" />
            <Text style={militaryStyles.campaignTitleText}>Kaito Military Campaign</Text>
            <Icon name="flag" size={20} color="#ffd700" />
          </View>
          <Text style={militaryStyles.campaignSubtitle}>
            ⚔️ Rise Through the Ranks - Conquer the Leaderboard ⚔️
          </Text>
          <View style={militaryStyles.campaignBadges}>
            <View style={militaryStyles.campaignBadge}>
              <Icon name="crosshairs" size={12} color="#90ee90" />
              <Text style={militaryStyles.badgeText}>Tactical</Text>
            </View>
            <View style={militaryStyles.campaignBadge}>
              <Icon name="fire" size={12} color="#ff6b6b" />
              <Text style={militaryStyles.badgeText}>Elite</Text>
            </View>
            <View style={militaryStyles.campaignBadge}>
              <Icon name="dragon" size={12} color="#ffd700" />
              <Text style={militaryStyles.badgeText}>Legendary</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Time Frame Selector */}
      <View style={militaryStyles.timeFrameSelector}>
        <TouchableOpacity
          style={[militaryStyles.timeFrameButton, timeFrame === 'week' && militaryStyles.timeFrameActive]}
          onPress={() => setTimeFrame('week')}
        >
          <Text style={[militaryStyles.timeFrameText, timeFrame === 'week' && militaryStyles.timeFrameTextActive]}>This Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[militaryStyles.timeFrameButton, timeFrame === 'month' && militaryStyles.timeFrameActive]}
          onPress={() => setTimeFrame('month')}
        >
          <Text style={[militaryStyles.timeFrameText, timeFrame === 'month' && militaryStyles.timeFrameTextActive]}>This Month</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[militaryStyles.timeFrameButton, timeFrame === 'all' && militaryStyles.timeFrameActive]}
          onPress={() => setTimeFrame('all')}
        >
          <Text style={[militaryStyles.timeFrameText, timeFrame === 'all' && militaryStyles.timeFrameTextActive]}>All Time</Text>
        </TouchableOpacity>
      </View>

      {/* Leaderboard Header */}
      <View style={militaryStyles.leaderboardHeader}>
        <Text style={militaryStyles.headerCell}>Rank</Text>
        <Text style={militaryStyles.headerCell}>Player</Text>
        <Text style={militaryStyles.headerCell}>Score</Text>
        <Text style={militaryStyles.headerCell}>Level</Text>
        <Text style={militaryStyles.headerCell}>Tier</Text>
        <Text style={militaryStyles.headerCell}>Share</Text>
      </View>
      
      {leaderboardData.length === 0 ? (
        <Text style={militaryStyles.message}>Loading leaderboard...</Text>
      ) : (
        <ScrollView style={militaryStyles.list} nestedScrollEnabled={false}>
          {leaderboardData.map((item, index) => (
            <View key={item.walletAddress || index}>
              {renderLeaderboardItem(item, index)}
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity style={militaryStyles.closeButton} onPress={() => toggleModal('leaderboard')}>
        <Text style={militaryStyles.closeButtonText}>CLOSE</Text>
      </TouchableOpacity>

      {/* Share Modal */}
      {showShareModal && selectedEntry && (
        <View style={militaryStyles.shareModalOverlay}>
          <View style={militaryStyles.shareModalContent}>
            <TouchableOpacity style={militaryStyles.closeModalButton} onPress={() => setShowShareModal(false)}>
              <Icon name="times" size={20} color="#90ee90" />
            </TouchableOpacity>
            <Text style={militaryStyles.shareModalTitle}>Share Your Achievement</Text>
            
            <View style={militaryStyles.shareCard}>
              <Text style={militaryStyles.shareCardTitle}>Kaito Brewmaster League</Text>
              <View style={militaryStyles.shareCardRow}>
                <Text style={militaryStyles.shareCardLabel}>Rank:</Text>
                <Text style={militaryStyles.shareCardValue}>#{leaderboardData.findIndex(e => e.wallet_address === selectedEntry.wallet_address) + 1}</Text>
              </View>
              <View style={militaryStyles.shareCardRow}>
                <Text style={militaryStyles.shareCardLabel}>Score:</Text>
                <Text style={militaryStyles.shareCardValue}>{selectedEntry.gold?.toLocaleString() || 0}</Text>
              </View>
              <View style={militaryStyles.shareCardRow}>
                <Text style={militaryStyles.shareCardLabel}>Player:</Text>
                <Text style={militaryStyles.shareCardValue}>{selectedEntry.name || 'Anonymous'}</Text>
              </View>
            </View>

            <TouchableOpacity style={militaryStyles.shareButtonX} onPress={shareToX}>
              <Icon name="share-alt" size={16} color="#ffd700" style={militaryStyles.shareButtonIcon} />
              <Text style={militaryStyles.shareButtonText}>Share on X</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const militaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  campaignHeader: {
    marginBottom: 12,
  },
  campaignBanner: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  campaignTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  campaignTitleText: {
    fontSize: 16,
    
    color: '#ffd700',
  },
  campaignSubtitle: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 8,
  },
  campaignBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  campaignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  badgeText: {
    fontSize: 10,
    color: '#fff',
  },
  timeFrameSelector: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 4,
  },
  timeFrameButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  timeFrameActive: {
    backgroundColor: '#ff6200',
  },
  timeFrameText: {
    fontSize: 12,
    color: '#aaa',
  },
  timeFrameTextActive: {
    color: '#fff',
    
  },
  leaderboardHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  headerCell: {
    flex: 1,
    fontSize: 11,
    
    color: '#ffd700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  message: {
    fontSize: 14,
    color: '#90ee90',
    textAlign: 'center',
    paddingVertical: 24,
  },
  list: {
    flex: 1,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  rank: {
    width: 45,
    alignItems: 'center',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 36,
    height: 36,
    justifyContent: 'center',
    borderRadius: 18,
  },
  rank1: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  rank2: {
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
    borderWidth: 2,
    borderColor: '#c0c0c0',
  },
  rank3: {
    backgroundColor: 'rgba(205, 127, 50, 0.2)',
    borderWidth: 2,
    borderColor: '#cd7f32',
  },
  rankNumber: {
    fontSize: 16,
    
    color: '#fff',
  },
  player: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    backgroundColor: '#ff6200',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    
    color: '#fff',
  },
  playerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 11,
    
    color: '#fff',
  },
  address: {
    fontSize: 9,
    color: '#aaa',
  },
  score: {
    flex: 1,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 12,
    
    color: '#ffd700',
  },
  level: {
    flex: 1,
    alignItems: 'center',
  },
  levelValue: {
    fontSize: 11,
    color: '#fff',
  },
  tier: {
    flex: 1,
    alignItems: 'center',
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tierText: {
    fontSize: 10,
    
  },
  shareButton: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#ffd700',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#ff6200',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    
    color: '#fff',
  },
  shareModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  shareModalContent: {
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#ff6200',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 350,
  },
  closeModalButton: {
    alignSelf: 'flex-end',
    padding: 5,
  },
  shareModalTitle: {
    fontSize: 16,
    
    color: '#ffd700',
    marginBottom: 12,
    textAlign: 'center',
  },
  shareCard: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  shareCardTitle: {
    fontSize: 14,
    
    color: '#ff6200',
    marginBottom: 8,
    textAlign: 'center',
  },
  shareCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  shareCardLabel: {
    fontSize: 12,
    color: '#aaa',
  },
  shareCardValue: {
    fontSize: 12,
    
    color: '#fff',
  },
  shareButtonX: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#ff6200',
    borderRadius: 8,
  },
  shareButtonIcon: {
    fontSize: 16,
  },
  shareButtonText: {
    fontSize: 14,
    
    color: '#fff',
  },
});

export default LeaderboardModal;
