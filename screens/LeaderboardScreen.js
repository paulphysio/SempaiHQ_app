import React, { useState, useEffect, useContext, useMemo } from 'react';
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
import { useTheme } from '../context/ThemeContext';
import ScreenSkeleton from '../components/ScreenSkeleton';

const LeaderboardScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getLeaderboardStyles(colors), [isDark]);
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);

  const [readers, setReaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeFrame, setTimeFrame] = useState('week');
  const [myPoints, setMyPoints] = useState(null); // { weekly, monthly, all_time, weekly_rank }
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedReader, setSelectedReader] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call the SQL function with the selected time frame
      const { data: leaderboardData, error: rpcError } = await supabase
        .rpc('get_leaderboard_data', { p_timeframe: timeFrame });

      if (rpcError) throw rpcError;

      // Process the data
      const processedReaders = (leaderboardData || []).map((user, index) => ({
        id: user.user_id,
        email: user.email,
        name: user.name,
        walletAddress: user.wallet_address,
        weeklyPoints: user.base_points,
        amethystCount: user.amethyst_count,
        effectivePoints: user.effective_points,
        totalPointsRead: user.chapters_read,
        multiplierBonus: user.amethyst_bonus,
        rank: index + 1
      }));

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

    const username = getDisplayName(selectedReader);
    const shareUrl = 'https://sempaihq.com/leaderboard';
    const shareText = `🏆 I'm ranked #${selectedReader.rank} on the Sempai HQ Leaderboard with ${selectedReader.effectivePoints.toLocaleString()} points! Check out the full Top 50 leaderboard:`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    Linking.openURL(twitterUrl).catch(() => {
      console.error('Could not open Twitter');
    });
    setShowShareModal(false);
  };

  // Names come from profiles (emails are private).
  const getDisplayName = (reader) => {
    const name = String(reader.name || '').trim();
    if (name) return name.length > 18 ? `${name.slice(0, 18)}…` : name;
    const w = String(reader.walletAddress || '');
    return w ? `${w.slice(0, 4)}…${w.slice(-4)}` : 'Reader';
  };

  const getInitial = (reader) => getDisplayName(reader).charAt(0).toUpperCase() || '?';

  useEffect(() => {
    fetchLeaderboard();
  }, [timeFrame]);

  // Your own points: this week / this month / all time (signed-in readers)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data, error: e } = await supabase.rpc('get_my_points');
        if (!e && alive) setMyPoints(Array.isArray(data) ? data[0] : data);
      } catch {}
    })();
    return () => { alive = false; };
  }, [refreshing]);

  if (loading) {
    return <ScreenSkeleton variant="list" label="Loading leaderboard" />;
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
      <LinearGradient colors={[colors.bgCardAlt, colors.bg]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <FontAwesome5 name="arrow-left" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.eyebrow}>SEMPAI HQ</Text>
            <Text style={styles.pageTitle}>Leaderboard</Text>
          </View>
          <View style={styles.headerTrophyWrap}>
            <FontAwesome5 name="trophy" size={18} color={colors.accent} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {myPoints ? (
          <View style={styles.myPointsCard} accessibilityRole="summary">
            <View style={styles.myPointsHead}>
              <Text style={styles.myPointsTitle}>Your points</Text>
              {Number(myPoints.weekly) > 0 ? (
                <Text style={styles.myPointsRank}>#{Number(myPoints.weekly_rank).toLocaleString()} this week</Text>
              ) : null}
            </View>
            <View style={styles.myPointsRow}>
              {[
                ['This week', myPoints.weekly],
                ['This month', myPoints.monthly],
                ['All time', myPoints.all_time],
              ].map(([label, value]) => (
                <View key={label} style={styles.myPointsCell}>
                  <Text style={styles.myPointsValue}>{Number(value || 0).toLocaleString()}</Text>
                  <Text style={styles.myPointsLabel}>{label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.myPointsHint}>Read a new chapter (novel or manga) for +100. Weeks start Monday (UTC); points never reset.</Text>
          </View>
        ) : null}

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
                    <Text style={styles.subStat}>{reader.totalPointsRead.toLocaleString()} chapters read</Text>
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
                colors={[colors.bgCard, colors.bg]}
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
                  {selectedReader ? getDisplayName(selectedReader) : ''}
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
  bg: '#0B0B14',
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

export const getLeaderboardStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: c.textSecondary,
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
    color: c.textPrimary,
    fontSize: 18,
     
    marginTop: 20,
    textAlign: 'center',
  },
  errorMessage: {
    color: c.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: c.accent,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
     
  },

  // Header
  header: {
    borderBottomWidth: 1,
    borderBottomColor: c.border,
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
    backgroundColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 14,
  },
  eyebrow: {
    color: c.accent,
    fontSize: 11,
     
    letterSpacing: 1.4,
  },
  pageTitle: {
    color: c.textPrimary,
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
    backgroundColor: c.border,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    flex: 1,
    justifyContent: 'center',
  },
  timeButtonActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  timeButtonText: {
    color: c.textMuted,
    fontSize: 13,
     
  },
  timeButtonTextActive: {
    color: '#fff',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  myPointsCard: {
    backgroundColor: c.bgCardAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.borderStrong || 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 20,
  },
  myPointsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  myPointsTitle: { fontSize: 15, fontWeight: '800', color: c.textPrimary },
  myPointsRank: { fontSize: 12, fontWeight: '800', color: c.accent },
  myPointsRow: { flexDirection: 'row', gap: 10 },
  myPointsCell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: c.bg },
  myPointsValue: { fontSize: 18, fontWeight: '900', color: c.gold || c.accent },
  myPointsLabel: { fontSize: 11, fontWeight: '700', color: c.textSecondary, marginTop: 2 },
  myPointsHint: { fontSize: 11, lineHeight: 16, color: c.textSecondary, marginTop: 12 },

  noResults: {
    alignItems: 'center',
    paddingVertical: 90,
  },
  noResultsIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsTitle: {
    color: c.textPrimary,
    fontSize: 18,
     
    marginTop: 18,
  },
  noResultsText: {
    color: c.textSecondary,
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
    borderColor: c.border,
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
    backgroundColor: c.bgElevated,
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
    color: c.textPrimary,
    fontSize: 16,
     
  },
  podiumName: {
    color: c.textPrimary,
    fontSize: 12,
     
    maxWidth: 90,
  },
  podiumPoints: {
    color: c.textPrimary,
    fontSize: 15,
     
    marginTop: 4,
  },
  podiumRank: {
    color: c.textMuted,
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
    color: c.textMuted,
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
    backgroundColor: c.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rankCell: {
    width: 30,
    alignItems: 'center',
  },
  rankNumber: {
    color: c.textMuted,
    fontSize: 13,
     
  },
  avatarCell: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: c.textPrimary,
    fontSize: 13,
     
  },
  readerCell: {
    flex: 1,
    gap: 6,
    marginRight: 8,
  },
  readerName: {
    color: c.textPrimary,
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
    backgroundColor: c.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  walletAddress: {
    color: c.textMuted,
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
    color: c.sakura,
    fontSize: 10,
     
  },
  gemChipBonus: {
    color: c.sakura,
    fontSize: 9,
     
    opacity: 0.75,
  },
  statsCell: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  effectivePoints: {
    color: c.textPrimary,
    fontSize: 15,
     
  },
  subStat: {
    color: c.textMuted,
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
    backgroundColor: c.bg,
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
    borderBottomColor: c.border,
  },
  shareModalTitle: {
    color: c.textPrimary,
    fontSize: 17,
     
  },
  shareModalClose: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: c.border,
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
    color: c.textPrimary,
    fontSize: 15,
     
    letterSpacing: 0.5,
  },
  shareCardUsername: {
    color: c.textPrimary,
    fontSize: 22,
     
    marginTop: 6,
  },
  shareCardPoints: {
    color: c.textSecondary,
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
    color: c.sakura,
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
    backgroundColor: c.accent,
    borderRadius: 14,
    paddingVertical: 15,
  },
  shareButtonXText: {
    color: '#fff',
    fontSize: 16,
     
  },
});

export default LeaderboardScreen;