import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  StyleSheet,
  RefreshControl,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const LeaderboardScreen = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);

  const [readers, setReaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeFrame, setTimeFrame] = useState('week');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedReader, setSelectedReader] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query users and their weekly_points/balance
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, email, wallet_address, weekly_points, amethyst_count, balance")
        .or("weekly_points.gt.0,balance.gt.0")
        .order("weekly_points", { ascending: false, nullsFirst: false })
        .limit(50);

      if (usersError) throw usersError;

      // Get unlocked chapters count and cached Amethyst balances for each user
      const data = await Promise.all(
        (users || []).map(async (user) => {
          // Count unlocked story chapters
          const { data: storyChapters } = await supabase
            .from("unlocked_story_chapters")
            .select("chapters_unlocked_count")
            .eq("user_id", user.id);

          // Count unlocked manga chapters
          const { data: mangaChapters } = await supabase
            .from("unlocked_manga_chapters")
            .select("id")
            .eq("user_id", user.id);

          const storyCount = storyChapters?.reduce((sum, chapter) => sum + (chapter.chapters_unlocked_count || 1), 0) || 0;
          const mangaCount = mangaChapters?.length || 0;
          const totalUnlockedChapters = storyCount + mangaCount;

          // Get cached Amethyst balance from database
          const { data: amethystData } = await supabase
            .from("amethyst_balances")
            .select("amethyst_balance")
            .eq("user_id", user.id)
            .single();

          const cachedAmethystBalance = Number(amethystData?.amethyst_balance) || 0;

          return {
            ...user,
            total_points_read: totalUnlockedChapters,
            cached_amethyst_balance: cachedAmethystBalance
          };
        })
      );

      // Process readers with Amethyst multiplier using cached balances
      const processedReaders = (data || []).map(user => {
        const weeklyPoints = Number(user.weekly_points) || 0;
        const totalChaptersUnlocked = Number(user.total_points_read) || 0;
        const amethystCount = Number(user.cached_amethyst_balance) || 0;

        const basePoints = weeklyPoints > 0 ? weeklyPoints : (Number(user.balance) || 0);

        let amethystBonus = 0;

        if (amethystCount >= 5000000) amethystBonus = 250;
        else if (amethystCount >= 1000000) amethystBonus = 200;
        else if (amethystCount >= 500000) amethystBonus = 170;
        else if (amethystCount >= 250000) amethystBonus = 150;
        else if (amethystCount >= 100000) amethystBonus = 120;

        const effectivePoints = basePoints + amethystBonus;

        return {
          id: user.id,
          email: user.email,
          walletAddress: user.wallet_address,
          weeklyPoints: basePoints,
          totalPointsRead: totalChaptersUnlocked,
          amethystCount: amethystCount,
          multiplierBonus: amethystBonus,
          effectivePoints: effectivePoints,
          rank: 0
        };
      });

      // Assign ranks
      processedReaders.sort((a, b) => b.effectivePoints - a.effectivePoints);
      processedReaders.forEach((reader, index) => {
        reader.rank = index + 1;
      });

      setReaders(processedReaders);
    } catch (err) {
      console.error('[LeaderboardScreen] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return 'crown';
    if (rank === 2) return 'trophy';
    if (rank === 3) return 'medal';
    return 'star';
  };

  const getRankColor = (rank) => {
    if (rank === 1) return '#FFD84D';
    if (rank === 2) return '#D7DBE4';
    if (rank === 3) return '#E3A768';
    return '#75718F';
  };

  const handleShare = (reader) => {
    setSelectedReader(reader);
    setShowShareModal(true);
  };

  const shareToX = () => {
    if (!selectedReader) return;

    const username = selectedReader.email ? selectedReader.email.split('@')[0] : 'Anonymous';
    const shareUrl = 'https://sempaihq.com/leaderboard';
    const shareText = `🏆 I'm ranked #${selectedReader.rank} on the Sempai HQ Leaderboard with ${selectedReader.effectivePoints.toLocaleString()} points! Check out the full Top 50 leaderboard:`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    Linking.openURL(twitterUrl).catch(() => {
      console.error('Could not open Twitter');
    });
    setShowShareModal(false);
  };

  const getInitial = (reader) => {
    return reader.email ? reader.email.charAt(0).toUpperCase() : '?';
  };

  const getDisplayName = (reader) => {
    if (!reader.email) return 'Anonymous';
    const handle = reader.email.split('@')[0];
    return handle.length > 16 ? `${handle.slice(0, 16)}…` : handle;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F36316" />
          <Text style={styles.loadingText}>Loading leaderboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}>
            <FontAwesome5 name="exclamation" size={28} color="#FF6B6B" />
          </View>
          <Text style={styles.errorText}>Couldn't load the leaderboard</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchLeaderboard} activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const podium = readers.slice(0, 3);
  const rest = readers.slice(3);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1A1730', '#0A0A14']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <FontAwesome5 name="arrow-left" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.eyebrow}>SEMPAI HQ</Text>
            <Text style={styles.pageTitle}>Leaderboard</Text>
          </View>
          <View style={styles.headerTrophyWrap}>
            <FontAwesome5 name="trophy" size={18} color="#FFD84D" />
          </View>
        </View>

        {/* Time Frame Selector */}
        <View style={styles.timeFrameSelector}>
          {[
            { key: 'week', label: 'Weekly', icon: 'calendar-week' },
            { key: 'month', label: 'Monthly', icon: 'calendar-alt' },
            { key: 'all', label: 'All Time', icon: 'infinity' },
          ].map((tf) => (
            <TouchableOpacity
              key={tf.key}
              style={[styles.timeButton, timeFrame === tf.key && styles.timeButtonActive]}
              onPress={() => setTimeFrame(tf.key)}
              activeOpacity={0.85}
            >
              <FontAwesome5
                name={tf.icon}
                size={12}
                color={timeFrame === tf.key ? '#FFFFFF' : '#75718F'}
              />
              <Text style={[styles.timeButtonText, timeFrame === tf.key && styles.timeButtonTextActive]}>
                {tf.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F36316" />
        }
        showsVerticalScrollIndicator={false}
      >
        {readers.length === 0 ? (
          <View style={styles.noResults}>
            <View style={styles.noResultsIconWrap}>
              <FontAwesome5 name="book-reader" size={30} color="#75718F" />
            </View>
            <Text style={styles.noResultsTitle}>No readers yet</Text>
            <Text style={styles.noResultsText}>Start reading to earn points and claim a spot on the board.</Text>
          </View>
        ) : (
          <>
            {/* Podium — top 3 */}
            {podium.length > 0 && (
              <View style={styles.podiumRow}>
                {[podium[1], podium[0], podium[2]].map((reader, i) => {
                  if (!reader) return <View key={`empty-${i}`} style={styles.podiumSlot} />;
                  const isFirst = reader.rank === 1;
                  return (
                    <View
                      key={reader.id}
                      style={[styles.podiumSlot, isFirst && styles.podiumSlotFirst]}
                    >
                      <TouchableOpacity
                        style={styles.podiumShareTarget}
                        onPress={() => handleShare(reader)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={
                            isFirst
                              ? ['rgba(255,216,77,0.35)', 'rgba(255,216,77,0.02)']
                              : ['rgba(163,89,255,0.22)', 'rgba(163,89,255,0.02)']
                          }
                          style={[styles.podiumCard, isFirst && styles.podiumCardFirst]}
                        >
                          <View style={[styles.podiumBadge, { borderColor: getRankColor(reader.rank) }]}>
                            <FontAwesome5
                              name={getRankIcon(reader.rank)}
                              size={isFirst ? 20 : 15}
                              color={getRankColor(reader.rank)}
                            />
                          </View>
                          <View style={[styles.podiumAvatar, isFirst && styles.podiumAvatarFirst]}>
                            <Text style={styles.podiumAvatarText}>{getInitial(reader)}</Text>
                          </View>
                          <Text style={styles.podiumName} numberOfLines={1}>{getDisplayName(reader)}</Text>
                          <Text style={styles.podiumPoints}>{reader.effectivePoints.toLocaleString()}</Text>
                          <Text style={styles.podiumRank}>#{reader.rank}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Column legend for the list below */}
            {rest.length > 0 && (
              <View style={styles.legendRow}>
                <Text style={[styles.legendText, styles.legendRankWidth]}>Rank</Text>
                <Text style={[styles.legendText, styles.legendReaderWidth]}>Reader</Text>
                <Text style={[styles.legendText, styles.legendStatWidth]}>Effective</Text>
              </View>
            )}

            {/* Reader Rows */}
            <View style={styles.list}>
              {rest.map((reader) => (
                <View key={reader.id} style={styles.readerRow}>
                  <View style={styles.rankCell}>
                    <Text style={styles.rankNumber}>{reader.rank}</Text>
                  </View>

                  <View style={styles.avatarCell}>
                    <Text style={styles.avatarText}>{getInitial(reader)}</Text>
                  </View>

                  <View style={styles.readerCell}>
                    <Text style={styles.readerName} numberOfLines={1}>{getDisplayName(reader)}</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.walletChip}>
                        <FontAwesome5 name="wallet" size={9} color="#75718F" />
                        <Text style={styles.walletAddress}>
                          {reader.walletAddress
                            ? `${reader.walletAddress.slice(0, 4)}…${reader.walletAddress.slice(-4)}`
                            : 'No wallet'}
                        </Text>
                      </View>
                      <View style={styles.gemChip}>
                        <FontAwesome5 name="gem" size={9} color="#A359FF" />
                        <Text style={styles.gemChipText}>{reader.amethystCount.toLocaleString()}</Text>
                        {reader.multiplierBonus > 0 && (
                          <Text style={styles.gemChipBonus}>+{reader.multiplierBonus}</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.statsCell}>
                    <Text style={styles.effectivePoints}>{reader.effectivePoints.toLocaleString()}</Text>
                    <Text style={styles.subStat}>{reader.weeklyPoints.toLocaleString()} wk · {reader.totalPointsRead.toLocaleString()} ch</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => handleShare(reader)}
                    activeOpacity={0.8}
                  >
                    <FontAwesome5 name="share-alt" size={12} color="#A359FF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
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
          <View style={styles.shareModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>Share your rank</Text>
              <TouchableOpacity
                style={styles.shareModalClose}
                onPress={() => setShowShareModal(false)}
                activeOpacity={0.7}
              >
                <FontAwesome5 name="times" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Share Card */}
            <View style={styles.shareCard}>
              <LinearGradient
                colors={['#211D38', '#0A0A14']}
                style={styles.shareCardGradient}
              >
                <View style={[styles.shareCardBadge, { borderColor: getRankColor(selectedReader?.rank || 0) }]}>
                  <FontAwesome5
                    name={getRankIcon(selectedReader?.rank || 0)}
                    size={26}
                    color={getRankColor(selectedReader?.rank || 0)}
                  />
                </View>
                <Text style={styles.shareCardRank}>Rank #{selectedReader?.rank}</Text>
                <Text style={styles.shareCardUsername}>
                  {selectedReader?.email ? selectedReader.email.split('@')[0] : 'Anonymous'}
                </Text>
                <Text style={styles.shareCardPoints}>
                  {selectedReader?.effectivePoints?.toLocaleString() || 0} points
                </Text>
                <View style={styles.shareCardTimeFramePill}>
                  <Text style={styles.shareCardTimeFrame}>
                    {timeFrame === 'week' ? 'Weekly' : timeFrame === 'month' ? 'Monthly' : 'All Time'}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            <TouchableOpacity style={styles.shareButtonX} onPress={shareToX} activeOpacity={0.85}>
              <FontAwesome5 name="share-alt" size={15} color="#FFFFFF" />
              <Text style={styles.shareButtonXText}>Share on X</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const COLORS = {
  bg: '#0A0A14',
  surface: '#14131F',
  surfaceRaised: '#1C1A2B',
  line: 'rgba(255,255,255,0.08)',
  brand: '#F36316',
  gem: '#A359FF',
  textHi: '#F5F3FF',
  textMid: '#9C99B4',
  textLow: '#75718F',
  danger: '#FF6B6B',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMid,
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: COLORS.textHi,
    fontSize: 18,
     
    marginTop: 20,
    textAlign: 'center',
  },
  errorMessage: {
    color: COLORS.textMid,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
     
  },

  // Header
  header: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingBottom: 18,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 14,
  },
  eyebrow: {
    color: COLORS.brand,
    fontSize: 11,
     
    letterSpacing: 1.4,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 24,
     
    marginTop: 2,
    letterSpacing: -0.3,
  },
  headerTrophyWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,216,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,216,77,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeFrameSelector: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    flex: 1,
    justifyContent: 'center',
  },
  timeButtonActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  timeButtonText: {
    color: COLORS.textLow,
    fontSize: 13,
     
  },
  timeButtonTextActive: {
    color: '#FFFFFF',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  noResults: {
    alignItems: 'center',
    paddingVertical: 90,
  },
  noResultsIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsTitle: {
    color: COLORS.textHi,
    fontSize: 18,
     
    marginTop: 18,
  },
  noResultsText: {
    color: COLORS.textMid,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 260,
  },

  // Podium
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 28,
  },
  podiumSlot: {
    flex: 1,
  },
  podiumSlotFirst: {
    marginBottom: 14,
  },
  podiumShareTarget: {
    borderRadius: 18,
  },
  podiumCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  podiumCardFirst: {
    paddingVertical: 24,
    borderColor: 'rgba(255,216,77,0.35)',
  },
  podiumBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  podiumAvatarFirst: {
    width: 54,
    height: 54,
    borderRadius: 16,
  },
  podiumAvatarText: {
    color: COLORS.textHi,
    fontSize: 16,
     
  },
  podiumName: {
    color: COLORS.textHi,
    fontSize: 12,
     
    maxWidth: 90,
  },
  podiumPoints: {
    color: '#FFFFFF',
    fontSize: 15,
     
    marginTop: 4,
  },
  podiumRank: {
    color: COLORS.textLow,
    fontSize: 11,
     
    marginTop: 2,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  legendText: {
    color: COLORS.textLow,
    fontSize: 10,
     
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  legendRankWidth: { width: 30 },
  legendReaderWidth: { flex: 1, marginLeft: 44 },
  legendStatWidth: { width: 70, textAlign: 'right' },

  // List
  list: {
    gap: 8,
  },
  readerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rankCell: {
    width: 30,
    alignItems: 'center',
  },
  rankNumber: {
    color: COLORS.textLow,
    fontSize: 13,
     
  },
  avatarCell: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: COLORS.textHi,
    fontSize: 13,
     
  },
  readerCell: {
    flex: 1,
    gap: 6,
    marginRight: 8,
  },
  readerName: {
    color: COLORS.textHi,
    fontSize: 14,
     
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  walletAddress: {
    color: COLORS.textLow,
    fontSize: 10,
     
  },
  gemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(163,89,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(163,89,255,0.2)',
  },
  gemChipText: {
    color: COLORS.gem,
    fontSize: 10,
     
  },
  gemChipBonus: {
    color: COLORS.gem,
    fontSize: 9,
     
    opacity: 0.75,
  },
  statsCell: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  effectivePoints: {
    color: '#FFFFFF',
    fontSize: 15,
     
  },
  subStat: {
    color: COLORS.textLow,
    fontSize: 10,
     
    marginTop: 2,
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(163,89,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(163,89,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Share modal
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModalContent: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: 'rgba(163,89,255,0.25)',
    borderRadius: 22,
    width: '88%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  shareModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
     
  },
  shareModalClose: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCard: {
    margin: 20,
    borderRadius: 18,
    overflow: 'hidden',
  },
  shareCardGradient: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  shareCardBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  shareCardRank: {
    color: COLORS.textHi,
    fontSize: 15,
     
    letterSpacing: 0.5,
  },
  shareCardUsername: {
    color: '#FFFFFF',
    fontSize: 22,
     
    marginTop: 6,
  },
  shareCardPoints: {
    color: COLORS.textMid,
    fontSize: 15,
     
    marginTop: 6,
  },
  shareCardTimeFramePill: {
    marginTop: 14,
    backgroundColor: 'rgba(163,89,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(163,89,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  shareCardTimeFrame: {
    color: COLORS.gem,
    fontSize: 12,
     
    letterSpacing: 0.4,
  },
  shareButtonX: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    paddingVertical: 15,
  },
  shareButtonXText: {
    color: '#FFFFFF',
    fontSize: 16,
     
  },
});

export default LeaderboardScreen;