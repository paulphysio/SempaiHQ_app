import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const LeaderboardModal = ({ connected, leaderboardData, toggleModal }) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const handleShare = (entry) => {
    setSelectedEntry(entry);
    setShowShareModal(true);
  };

  const shareToX = () => {
    if (!selectedEntry) return;
    
    const username = selectedEntry.name || 'Anonymous';
    const rank = leaderboardData.findIndex(e => e.wallet_address === selectedEntry.wallet_address) + 1;
    const shareText = `⚔️ I'm ranked #${rank} on the Kaito Brewmaster League with ${selectedEntry.gold.toLocaleString()} Gold! Join the military campaign:`;
    const shareUrl = 'https://www.sempaihq.com/kaito-adventure';
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    
    // In React Native, you would use Linking.openURL
    // Linking.openURL(twitterUrl);
    setShowShareModal(false);
  };

  const renderLeaderboardItem = ({ item, index }) => (
    <View style={leaderboardModalStyles.entry}>
      <View style={leaderboardModalStyles.rank}>
        {index < 3 ? (
          <View style={[leaderboardModalStyles.rankBadge, leaderboardModalStyles[`rank${index + 1}`]]}>
            {index === 0 && <Icon name="crown" size={16} color={KA_COLORS.gold} />}
            {index === 1 && <Icon name="medal" size={16} color={KA_COLORS.gold} />}
            {index === 2 && <Icon name="id-badge" size={16} color={KA_COLORS.gold} />}
            <Text style={leaderboardModalStyles.rankNumber}>{index + 1}</Text>
          </View>
        ) : (
          <Text style={leaderboardModalStyles.rankNumber}>{index + 1}</Text>
        )}
      </View>
      <View style={leaderboardModalStyles.player}>
        <View style={leaderboardModalStyles.avatar}>
          <Text style={leaderboardModalStyles.avatarText}>{item.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
        <View style={leaderboardModalStyles.playerInfo}>
          <Text style={leaderboardModalStyles.name}>{item.name}</Text>
          <Text style={leaderboardModalStyles.address}>
            {item.wallet_address.slice(0, 6)}...{item.wallet_address.slice(-4)}
          </Text>
        </View>
      </View>
      <View style={leaderboardModalStyles.stats}>
        <View style={leaderboardModalStyles.stat}>
          <Icon name="crosshairs" size={14} color={KA_COLORS.ivoryDim} />
          <Text style={leaderboardModalStyles.statText}>Lv. {item.level}</Text>
        </View>
        <View style={leaderboardModalStyles.stat}>
          <Icon name="star" size={14} color={KA_COLORS.ivoryDim} />
          <Text style={leaderboardModalStyles.statText}>{item.gold.toLocaleString()} Gold</Text>
        </View>
      </View>
      <TouchableOpacity
        style={leaderboardModalStyles.shareButton}
        onPress={() => handleShare(item)}
      >
        <Icon name="share-alt" size={14} color={KA_COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={leaderboardModalStyles.container}>
      <View style={leaderboardModalStyles.header}>
        <Icon name="shield-alt" size={24} color={KA_COLORS.orangeSoft} style={leaderboardModalStyles.headerIcon} />
        <Text style={leaderboardModalStyles.headerTitle}>Military Campaign Leaderboard</Text>
        <Icon name="flag" size={24} color={KA_COLORS.orangeSoft} style={leaderboardModalStyles.headerIcon} />
      </View>
      
      {!connected ? (
        <Text style={leaderboardModalStyles.message}>Please connect your wallet to view the leaderboard.</Text>
      ) : leaderboardData.length === 0 ? (
        <Text style={leaderboardModalStyles.message}>Loading leaderboard...</Text>
      ) : (
        <FlatList
          data={leaderboardData}
          renderItem={renderLeaderboardItem}
          keyExtractor={(item) => item.wallet_address}
          style={leaderboardModalStyles.list}
        />
      )}

      <TouchableOpacity style={leaderboardModalStyles.closeButton} onPress={() => toggleModal('leaderboard')}>
        <Text style={leaderboardModalStyles.closeButtonText}>Close</Text>
      </TouchableOpacity>

      {/* Share Modal */}
      {showShareModal && selectedEntry && (
        <View style={leaderboardModalStyles.shareModalOverlay}>
          <View style={leaderboardModalStyles.shareModalContent}>
            <View style={leaderboardModalStyles.shareModalHeader}>
              <Text style={leaderboardModalStyles.shareModalTitle}>Share Your Achievement</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Icon name="times" size={20} color={KA_COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={leaderboardModalStyles.shareModalBody}>
              <Text style={leaderboardModalStyles.shareCardText}>
                Rank: {leaderboardData.findIndex(e => e.wallet_address === selectedEntry.wallet_address) + 1}
              </Text>
              <Text style={leaderboardModalStyles.shareCardText}>
                Gold: {selectedEntry.gold.toLocaleString()}
              </Text>
            </View>

            <TouchableOpacity style={leaderboardModalStyles.shareButtonX} onPress={shareToX}>
              <Icon name="share-alt" size={16} color={KA_COLORS.ivory} style={leaderboardModalStyles.shareButtonIcon} />
              <Text style={leaderboardModalStyles.shareButtonText}>Share on X</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const leaderboardModalStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerIcon: {
    color: KA_COLORS.orangeSoft,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: KA_COLORS.gold,
    letterSpacing: 2,
  },
  message: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 32,
  },
  list: {
    maxHeight: 400,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  rank: {
    width: 40,
    alignItems: 'center',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rank1: {
    backgroundColor: 'rgba(201, 168, 76, 0.2)',
    borderWidth: 1,
    borderColor: KA_COLORS.gold,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rank2: {
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
    borderWidth: 1,
    borderColor: '#c0c0c0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rank3: {
    backgroundColor: 'rgba(205, 127, 50, 0.2)',
    borderWidth: 1,
    borderColor: '#cd7f32',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: KA_COLORS.orangePrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: KA_COLORS.ivory,
  },
  playerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
  },
  address: {
    fontSize: 12,
    color: KA_COLORS.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: KA_COLORS.ivoryDim,
  },
  shareButton: {
    padding: 8,
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
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
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: KA_COLORS.gold,
  },
  shareModalBody: {
    marginBottom: 16,
  },
  shareCardText: {
    fontSize: 14,
    color: KA_COLORS.ivoryDim,
    marginBottom: 8,
  },
  shareButtonX: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
  },
  shareButtonIcon: {
    fontSize: 16,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
  },
});

export default LeaderboardModal;
