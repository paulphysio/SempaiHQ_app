import React, { useState, useEffect, useMemo, useContext, useCallback, useRef } from 'react';
import { View, Text, FlatList, RefreshControl, Animated } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import MangaDetailCommentSection from '../components/MangaDetailCommentSection';
import { formatNumber } from '../utils/formatNumber';
import { getContentReadingProgress } from '../services/readingProgress';
import { useTheme } from '../context/ThemeContext';
import { EmptyState, Sheet, StatTile, GhostButton } from '../components/ui';
import ScreenSkeleton from '../components/ScreenSkeleton';
import { cacheSet, cacheValue } from '../services/localCache';
import { isErrorNetworkError } from '../services/offlineCache';
import { toast } from '../components/Toast';
import { space } from '../theme/tokens';
import { DetailHero, ChapterRow, TagRow, makeDetailStyles, STATUS, formatCount } from '../components/detail/DetailKit';
import { BOTTOM_NAV_CLEARANCE } from '../components/GlobalBottomNav';

/*
 * Same layout as Novel Detail (components/detail/DetailKit), which mirrors
 * <ScreenSkeleton variant="detail" /> block for block.
 */
const MangaDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {};
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => makeDetailStyles(colors, isDark), [colors, isDark]);
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
  const [loadError, setLoadError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [newestFirst, setNewestFirst] = useState(false);
  const [userId, setUserId] = useState(null);
  const [readingProgress, setReadingProgress] = useState(null);
  const contentFade = useRef(new Animated.Value(0)).current;
  const hasLoaded = useRef(false);

  const activePublicKey = useMemo(() => {
    try {
      return wallet?.publicKey ? new PublicKey(wallet.publicKey) : null;
    } catch (err) {
      console.error('Error creating PublicKey:', err);
      return null;
    }
  }, [wallet?.publicKey]);

  const fetchMangaDetails = async () => {
    try {
      // Series + chapters are independent: fetch them together.
      const [mangaRes, chaptersRes] = await Promise.all([
        supabase
          .from('manga')
          .select('id, title, cover_image, summary, user_id, users:user_id (name), tags, status, viewers_count')
          .eq('id', id)
          .eq('is_visible', true)
          .single(),
        supabase
          .from('manga_chapters')
          .select('id, chapter_number, title, is_premium')
          .eq('manga_id', id)
          .order('chapter_number', { ascending: true }),
      ]);
      if (mangaRes.error) throw mangaRes.error;
      if (chaptersRes.error) throw chaptersRes.error;

      setManga(mangaRes.data);
      setChapters(chaptersRes.data || []);
      setLoadError(null);
      Animated.timing(contentFade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      cacheSet(`manga:${id}`, { manga: mangaRes.data, chapters: chaptersRes.data || [] });
    } catch (e) {
      // Offline / flaky connection: open the last copy of this page we saw.
      const cached = await cacheValue(`manga:${id}`);
      if (cached?.manga) {
        setManga(cached.manga);
        setChapters(cached.chapters || []);
        setLoadError(null);
        Animated.timing(contentFade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
        if (hasLoaded.current) toast.info('You’re offline — showing the last saved copy of this page.');
        return;
      }
      console.warn('Error fetching manga details:', e.message);
      setLoadError(isErrorNetworkError(e) ? 'You’re offline and this series isn’t on your device yet.' : e.message);
      if (hasLoaded.current) toast.error(`Could not refresh — ${e.message}`);
    }
  };

  const checkBalance = async () => {
    if (!activePublicKey) return;
    try {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id, weekly_points')
        .eq('wallet_address', activePublicKey.toString())
        .single();
      if (userErr || !user) return;
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
    }
  };

  useEffect(() => {
    // Skeleton only on the first load — wallet changes refresh in place.
    if (!hasLoaded.current) setLoading(true);
    const jobs = [fetchMangaDetails()];
    if (isWalletConnected && activePublicKey) jobs.push(checkBalance());
    Promise.all(jobs).finally(() => {
      hasLoaded.current = true;
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isWalletConnected, activePublicKey]);

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
  const loadProgress = useCallback(async () => {
    if (!userId || !id) {
      setReadingProgress(null);
      return;
    }
    setReadingProgress(await getContentReadingProgress(userId, 'manga', id));
  }, [userId, id]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress, refreshing]);

  // Refresh progress when coming back from the reader.
  useEffect(() => navigation.addListener('focus', loadProgress), [navigation, loadProgress]);

  const openChapter = useCallback(
    (chapterId) => navigation.navigate('MangaChapter', { mangaId: id, chapterId }),
    [navigation, id]
  );

  const shownChapters = useMemo(() => (newestFirst ? [...chapters].reverse() : chapters), [chapters, newestFirst]);
  const first = chapters[0];
  const latest = chapters[chapters.length - 1];
  const resumeKey = readingProgress ? String(readingProgress.chapter_key) : null;
  const resumePct = readingProgress ? Math.max(0, Math.min(100, Number(readingProgress.scroll_pct) || 0)) : 0;

  /* ─────────────── states ─────────────── */
  if (loading) {
    return <ScreenSkeleton variant="detail" label="Loading manga" />;
  }

  if (!manga) {
    return (
      <View style={[styles.page, styles.center]}>
        <EmptyState
          icon="search"
          title="Manga not found"
          subtitle={loadError || 'This series may have been removed or is not public.'}
          action="Back to Home"
          onAction={() => navigation.navigate('Home')}
        />
      </View>
    );
  }

  const status = STATUS[manga.status || 'ongoing'];
  const statusColor = status ? colors[status.key] : null;
  const isAdult = manga.tags?.includes('Adult(18+)');
  const creatorName = manga.users?.name || 'Unknown';
  const openCreator = manga.user_id ? () => navigation.navigate('CreatorsProfile', { id: manga.user_id }) : undefined;

  const header = (
    <Animated.View style={{ opacity: contentFade }}>
      <DetailHero
        image={manga.cover_image}
        title={manga.title}
        author={{ name: creatorName, onPress: openCreator }}
        chips={[
          isAdult ? { label: '18+', color: colors.danger } : null,
          status ? { label: status.label, dot: true, color: statusColor } : null,
          { label: formatCount(manga.viewers_count), icon: 'eye', accessibilityLabel: String(manga.viewers_count || 0) + ' views' },
          isWalletConnected
            ? {
                label: `${formatNumber(balance)} SMP`,
                icon: 'coins',
                color: colors.gold,
                onPress: () => setWalletOpen(true),
                accessibilityLabel: `Wallet: ${formatNumber(balance)} SMP. Open wallet summary`,
              }
            : null,
        ]}
        primary={{
          icon: resumeKey !== null ? 'book-reader' : 'book-open',
          label: resumeKey !== null
            ? `Continue Ch. ${readingProgress.chapter_number ?? '—'}`
            : first
            ? 'Start reading'
            : 'No chapters yet',
          disabled: resumeKey === null && !first,
          onPress: () => (resumeKey !== null ? openChapter(readingProgress.chapter_key) : first && openChapter(first.id)),
        }}
        secondary={
          latest && chapters.length > 1
            ? { icon: 'fast-forward', label: `Latest Ch. ${latest.chapter_number}`, onPress: () => openChapter(latest.id) }
            : openCreator
            ? { icon: 'paint-brush', label: 'Creator', onPress: openCreator }
            : undefined
        }
        synopsis={manga.summary}
        more={
          manga.summary?.length > 180
            ? { label: expanded ? 'Show less' : 'Read more', icon: expanded ? 'chevron-up' : 'chevron-down', expanded, onPress: () => setExpanded((v) => !v) }
            : undefined
        }
        section={{
          title: 'Chapters',
          count: chapters.length,
          newestFirst,
          onToggleSort: () => setNewestFirst((v) => !v),
        }}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        styles={styles}
        colors={colors}
        isDark={isDark}
      >
        <TagRow tags={manga.tags || []} styles={styles} colors={colors} />
      </DetailHero>
    </Animated.View>
  );

  const footer = (
    <View style={{ paddingBottom: BOTTOM_NAV_CLEARANCE + 24 }}>
      <View style={[styles.pad, { marginTop: space.xl }]}>
        <MangaDetailCommentSection
          mangaId={manga.id}
          mangaTitle={manga.title}
          isWalletConnected={isWalletConnected}
          activePublicKey={activePublicKey}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      <FlatList
        data={shownChapters}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const resume = resumeKey !== null && resumeKey === String(item.id);
          return (
            <View style={styles.rowWrap}>
              <ChapterRow
                number={item.chapter_number}
                title={item.title || `Chapter ${item.chapter_number}`}
                state={resume ? 'resume' : item.is_premium ? 'premium' : 'free'}
                resumePct={resumePct}
                onPress={() => openChapter(item.id)}
                styles={styles}
                colors={colors}
              />
            </View>
          );
        }}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <EmptyState icon="paint-brush" title="No chapters yet" subtitle="The creator hasn’t published any chapters yet." />
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={14}
        windowSize={11}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      />

      <Sheet visible={walletOpen} onClose={() => setWalletOpen(false)} title="Your wallet">
        <View style={styles.statRow}>
          <StatTile icon="coins" label="SMP balance" value={formatNumber(balance)} color={colors.accent} />
          <StatTile icon="star" label="Weekly points" value={formatNumber(weeklyPoints)} color={colors.gold} />
        </View>
        <Text style={[styles.sheetText, { marginBottom: space.lg }]}>
          Withdrawals live on the Manga library’s wallet panel.
        </Text>
        <GhostButton
          label="Go to Manga library"
          icon="book-open"
          onPress={() => {
            setWalletOpen(false);
            navigation.navigate('MangaPage');
          }}
        />
        <View style={{ height: space.xl }} />
      </Sheet>
    </View>
  );
};

export default MangaDetailScreen;
