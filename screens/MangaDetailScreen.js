import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { View, Text, Image, FlatList, SafeAreaView, StatusBar, Alert, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import ConnectButton from '../components/ConnectButtonEnhanced';
import MangaDetailCommentSection from '../components/MangaDetailCommentSection';
import { formatNumber } from '../utils/formatNumber';
import { getContentReadingProgress } from '../services/readingProgress';
import { useTheme } from '../context/ThemeContext';
import {
  Screen, AppBar, IconButton, Chip, Tap, StatusBadge, AdultBadge, GradientButton, GhostButton,
  SectionHeader, Toast, Skeleton, EmptyState, WalletPill, Sheet, StatTile, Divider,
} from '../components/ui';
import { radius, space, layout, glow, useMangaTheme } from '../theme/theme';
import { getStyles as getDetailStyles } from '../styles/MangaDetailStyles';

const MangaDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {};
  const { isDark, colors: themeColors } = useTheme();
  const mangaTheme = useMangaTheme();
  const { colors, gradients, type } = mangaTheme;
  const styles = useMemo(() => getDetailStyles(mangaTheme), [mangaTheme]);
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = !!wallet?.publicKey;

  const [manga, setManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [newestFirst, setNewestFirst] = useState(false);
  const [userId, setUserId] = useState(null);
  const [readingProgress, setReadingProgress] = useState(null);

  const flashError = (msg) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const activePublicKey = useMemo(() => {
    try {
      if (!wallet?.publicKey) return null;
      return new PublicKey(wallet.publicKey);
    } catch (err) {
      console.error('Error creating PublicKey:', err);
      flashError('Invalid wallet public key.');
      return null;
    }
  }, [wallet?.publicKey]);

  const fetchMangaDetails = async () => {
    try {
      const { data: mangaData, error: mangaError } = await supabase
        .from('manga')
        .select('id, title, cover_image, summary, user_id, users:user_id (name), tags, status')
        .eq('id', id)
        .eq('is_visible', true)
        .single();
      if (mangaError) throw mangaError;

      const { data: chaptersData, error: chaptersError } = await supabase
        .from('manga_chapters')
        .select('id, chapter_number, title, is_premium')
        .eq('manga_id', id)
        .order('chapter_number', { ascending: true });
      if (chaptersError) throw chaptersError;

      setManga(mangaData);
      setChapters(chaptersData || []);
    } catch (e) {
      console.error('Error fetching manga details:', e.message);
      flashError(e.message);
    }
  };

  const checkBalance = async () => {
    if (!wallet?.publicKey || !activePublicKey) return;
    try {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id, weekly_points')
        .eq('wallet_address', activePublicKey.toString())
        .single();
      if (userErr || !user) throw new Error('User not found');
      setUserId(user.id);
      setWeeklyPoints(user.weekly_points || 0);

      const { data: walletBalance, error: balanceError } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('user_id', user.id)
        .eq('currency', 'SMP')
        .eq('chain', 'SOL')
        .single();
      if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;
      setBalance(walletBalance?.amount || 0);
    } catch (e) {
      console.error('Error checking balance:', e.message);
      flashError(e.message);
    }
  };

  useEffect(() => {
    setLoading(true);
    const jobs = [fetchMangaDetails()];
    if (isWalletConnected && activePublicKey) jobs.push(checkBalance());
    Promise.all(jobs).finally(() => setLoading(false));
  }, [id, isWalletConnected, activePublicKey]);

  // Pull-to-refresh: same jobs as the mount effect, without touching `loading`.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const jobs = [fetchMangaDetails()];
      if (isWalletConnected && activePublicKey) jobs.push(checkBalance());
      await Promise.all(jobs);
    } finally {
      setRefreshing(false);
    }
  };

  // Reading progress: last-read chapter + page position for this series.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId || !id) {
        if (alive) setReadingProgress(null);
        return;
      }
      const row = await getContentReadingProgress(userId, 'manga', id);
      if (alive) setReadingProgress(row);
    })();
    return () => { alive = false; };
  }, [userId, id, refreshing]);

  const openChapter = useCallback(
    (chapterId) => navigation.navigate('MangaChapter', { mangaId: id, chapterId }),
    [navigation, id]
  );

  const shownChapters = useMemo(() => (newestFirst ? [...chapters].reverse() : chapters), [chapters, newestFirst]);
  const freeCount = chapters.filter((c) => !c.is_premium).length;
  const premiumCount = chapters.length - freeCount;
  const first = chapters[0];
  const latest = chapters[chapters.length - 1];

  /* ───── header (hero) ───── */
  const hero = manga ? (
    <View>
      <View style={styles.heroWrap}>
        <Image source={{ uri: manga.cover_image }} style={styles.heroBackdrop} blurRadius={22} />
        <LinearGradient colors={gradients.hero} style={StyleSheet_abs} />
        <Animated.View entering={FadeInDown.duration(450)} style={styles.heroBody}>
          <View style={[styles.coverShadow, glow(colors.primary, 0.4)]}>
            <Image source={{ uri: manga.cover_image }} style={styles.cover} resizeMode="cover" />
          </View>
          <Text style={styles.title}>{manga.title}</Text>
          <Tap onPress={() => navigation.navigate('CreatorsProfile', { userId: manga.user_id })} style={styles.authorRow}>
            <Icon name="paint-brush" size={12} color={colors.primaryHi} />
            <Text style={styles.author}>{manga.users?.name || 'Unknown'}</Text>
            <Icon name="chevron-right" size={9} color={colors.textMute} style={{ marginLeft: 6 }} />
          </Tap>
          <View style={styles.badgeRow}>
            <StatusBadge value={manga.status || 'ongoing'} />
            {manga.tags?.includes('Adult(18+)') ? <AdultBadge /> : null}
          </View>
        </Animated.View>
      </View>

      <View style={styles.section}>
        <View style={styles.statRow}>
          <StatTile icon="layer-group" label="Chapters" value={chapters.length} color={colors.electric} />
          <View style={{ width: space.sm }} />
          <StatTile icon="unlock" label="Free" value={freeCount} color={colors.mint} />
          <View style={{ width: space.sm }} />
          <StatTile icon="crown" label="Premium" value={premiumCount} color={colors.gold} />
        </View>

        <View style={styles.ctaRow}>
          <View style={{ flex: 1 }}>
            <GradientButton
              size="lg"
              icon={readingProgress ? 'play' : 'book-open'}
              label={
                readingProgress
                  ? `Continue · Ch.${readingProgress.chapter_number ?? '—'}`
                  : first
                  ? 'Start Reading'
                  : 'No chapters yet'
              }
              disabled={!readingProgress && !first}
              onPress={() =>
                readingProgress ? openChapter(readingProgress.chapter_key) : first && openChapter(first.id)
              }
            />
          </View>
          {latest && chapters.length > 1 ? (
            <View style={{ marginLeft: space.sm }}>
              <GhostButton
                full={false}
                label="Latest"
                icon="fast-forward"
                style={styles.latestBtn}
                onPress={() => openChapter(latest.id)}
              />
            </View>
          ) : null}
        </View>

        <Text style={type.label}>Synopsis</Text>
        <Text style={styles.summary} numberOfLines={expanded ? undefined : 4}>{manga.summary}</Text>
        {manga.summary?.length > 180 ? (
          <Tap onPress={() => setExpanded((v) => !v)} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
            <Text style={styles.more}>{expanded ? 'Show less' : 'Read more'}</Text>
          </Tap>
        ) : null}

        {manga.tags?.length ? (
          <View style={styles.tagWrap}>
            {manga.tags.map((tag) => (
              <Chip key={tag} label={tag} color={tag === 'Adult(18+)' ? colors.danger : colors.primary} />
            ))}
          </View>
        ) : null}

        <Divider />
        <SectionHeader
          title="Chapters"
          icon="list-ul"
          accent={colors.electric}
          action={chapters.length > 1 ? (newestFirst ? 'Oldest first' : 'Newest first') : undefined}
          onAction={() => setNewestFirst((v) => !v)}
        />
      </View>
    </View>
  ) : null;

  const renderChapter = useCallback(
    ({ item, index }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 35).duration(300)} style={styles.chapterWrap}>
        <Tap onPress={() => openChapter(item.id)} scaleTo={0.985} style={styles.chapterRow} accessibilityLabel={`Open chapter ${item.chapter_number}`}>
          <View style={[styles.chapterNum, item.is_premium && { backgroundColor: colors.gold + '22', borderColor: colors.gold + '88' }]}>
            <Text style={[styles.chapterNumText, item.is_premium && { color: colors.gold }]}>{item.chapter_number}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.chapterTitle}>{item.title || `Chapter ${item.chapter_number}`}</Text>
            {readingProgress && String(readingProgress.chapter_key) === String(item.id) ? (
              <Text style={{ ...type.caption, color: colors.primaryHi, fontWeight: '700' }}>
                Resume · {Math.round(Math.max(0, Math.min(100, Number(readingProgress.scroll_pct) || 0)))}%
              </Text>
            ) : (
              <Text style={type.caption}>{item.is_premium ? 'Premium · unlock to read' : 'Free to read'}</Text>
            )}
          </View>
          <Icon name={item.is_premium ? 'lock' : 'chevron-right'} size={14} color={item.is_premium ? colors.gold : colors.textMute} solid />
        </Tap>
      </Animated.View>
    ),
    [openChapter, readingProgress]
  );

  const footer = manga ? (
    <View>
      <MangaDetailCommentSection
        mangaId={manga.id}
        mangaTitle={manga.title}
        isWalletConnected={isWalletConnected}
        activePublicKey={activePublicKey}
      />
      <View style={styles.footer}>
        <Icon name="star" size={11} color={colors.gold} solid />
        <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
      </View>
    </View>
  ) : null;

  /* ───── states ───── */
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
        <Screen style={{ backgroundColor: themeColors.bg }}>
          <View style={{ alignItems: 'center', padding: space.xl }}>
            <Skeleton width={layout.SCREEN_W * 0.5} height={layout.SCREEN_W * 0.75} r={radius.lg} />
            <Skeleton width="60%" height={24} style={{ marginTop: space.xl }} />
            <Skeleton width="35%" height={14} style={{ marginTop: space.sm }} />
            <Skeleton height={52} r={radius.lg} style={{ marginTop: space.xl }} />
            <Skeleton height={14} style={{ marginTop: space.xl }} />
            <Skeleton width="85%" height={14} style={{ marginTop: space.sm }} />
          </View>
        </Screen>
      </SafeAreaView>
    );
  }

  if (!manga) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
        <Screen style={{ backgroundColor: themeColors.bg }}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="search" title="Manga not found" subtitle={error || 'This series may have been removed or is not public.'} action="Back to Home" onAction={() => navigation.navigate('Home')} />
          </View>
        </Screen>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
      <Screen style={{ backgroundColor: themeColors.bg }}>
        <FlatList
          data={shownChapters}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderChapter}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={
            <View>
              {hero}
              <Toast message={error} type="error" />
            </View>
          }
          ListEmptyComponent={<Text style={styles.noChapters}>No chapters available yet.</Text>}
          ListFooterComponent={footer}
          contentContainerStyle={{ paddingBottom: isWalletConnected ? 96 : space.xl }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          windowSize={9}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.accent} colors={[themeColors.accent]} />
          }
        />

        {isWalletConnected ? (
          <View style={styles.pillWrap} pointerEvents="box-none">
            <WalletPill smp={formatNumber(balance)} points={formatNumber(weeklyPoints)} open={walletOpen} onPress={() => setWalletOpen(true)} />
          </View>
        ) : null}
      </Screen>

      <Sheet visible={walletOpen} onClose={() => setWalletOpen(false)} title="Your Wallet">
        <View style={{ flexDirection: 'row', paddingBottom: space.md }}>
          <StatTile icon="coins" label="SMP balance" value={formatNumber(balance)} color={colors.primary} />
          <View style={{ width: space.sm }} />
          <StatTile icon="star" label="Weekly points" value={formatNumber(weeklyPoints)} color={colors.gold} />
        </View>
        <Text style={{ ...type.caption, marginBottom: space.lg }}>
          Withdrawals live on the Library screen's wallet panel.
        </Text>
        <GhostButton label="Go to Library" icon="book-open" onPress={() => { setWalletOpen(false); navigation.navigate('Manga'); }} />
        <View style={{ height: space.xl }} />
      </Sheet>
    </SafeAreaView>
  );
};

// Absolute-fill helper for gradient overlay (StyleSheet.absoluteFill without an extra import)
const StyleSheet_abs = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

export default MangaDetailScreen;
