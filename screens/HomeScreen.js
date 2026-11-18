import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ScrollView,
  Animated,
  Dimensions,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOnline } from '../hooks/useOnline';
import { cacheSet, cacheValue } from '../services/localCache';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { supabase } from '../services/supabaseClient';
import { getAllReadingProgress } from '../services/readingProgress';
import { getCachedNovelsOffline, isErrorNetworkError, clearOldCache, clearCorruptedFiles } from '../services/offlineCache';
import { useTheme } from '../context/ThemeContext';
import ScreenSkeleton, { HOME } from '../components/ScreenSkeleton';
import { EmptyState } from '../components/ui';
import GelOrb from '../components/nav/GelOrb';
import { ActionButton, makeDetailStyles, formatCount } from '../components/detail/DetailKit';
import { PosterCard, SectionHeader } from '../components/page/PageKit';
import { BOTTOM_NAV_CLEARANCE } from '../components/GlobalBottomNav';
import { toast } from '../components/Toast';
import { coverSource, radius, space } from '../theme/tokens';

/*
 * Home — same design language as the detail pages and the gel navigation.
 * Layout mirrors <ScreenSkeleton variant="home" /> block for block:
 *
 *   spotlight card 300 + dots ─ 2 × 44 shortcuts ─ Continue Reading rail
 *   ─ Featured Novels rail ─ Featured Manga rail ─ Explore 2×2
 */
const { width: SCREEN_W } = Dimensions.get('window');
const GUTTER = space.lg;
const SPOT_W = SCREEN_W - GUTTER * 2;
const SPOT_GAP = space.md;

const EXPLORE = [
  { key: 'kaiji', title: 'Kaiji', desc: 'Card battles — stake and win SMP', icon: 'chess-knight', path: 'Kaiji', requiresWallet: true, image: require('../assets/kaiji/kaiji.png') },
  { key: 'dao', title: 'DAO Governance', desc: 'Vote on what SempaiHQ builds next', icon: 'landmark', path: 'DAOGovernance', requiresWallet: true, image: require('../assets/images/dao.jpg') },
  { key: 'bazaar', title: 'Bazaar', desc: 'Buy and sell indie books', icon: 'store', path: 'Bazaar', requiresWallet: false, image: require('../assets/images/novel-3.jpg') },
  { key: 'kiss', title: 'Start Here', desc: 'How SempaiHQ works', icon: 'compass', path: 'KeepItSimple', requiresWallet: false, image: require('../assets/images/novel-4.jpg') },
];

/* ───────────────────────────── pieces ───────────────────────────── */

/** Spotlight page: blurred art, sharp cover on the right, copy + CTA on the left. */
const SpotlightCard = React.memo(({ item, onOpen, onEdit, styles, colors, isDark }) => (
  <View>
  <Pressable
    onPress={() => onOpen(item)}
    style={({ pressed }) => [styles.spot, pressed && { transform: [{ scale: 0.985 }] }]}
    accessibilityRole="button"
    accessibilityLabel={`Spotlight ${item.kind}: ${item.title}. Open`}
  >
    <Image source={coverSource(item.image)} style={styles.spotBg} blurRadius={16} resizeMode="cover" />
    <LinearGradient
      colors={isDark ? ['rgba(11,11,20,0.35)', 'rgba(11,11,20,0.92)'] : ['rgba(253,251,212,0.35)', 'rgba(253,251,212,0.94)']}
      start={{ x: 0.7, y: 0 }}
      end={{ x: 0.2, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={[`rgba(${colors.accentRgb},${isDark ? 0.28 : 0.16})`, 'rgba(0,0,0,0)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.7, y: 0.6 }}
      style={StyleSheet.absoluteFill}
    />

    <View style={styles.spotBody}>
      <View style={styles.spotText}>
        <View style={styles.eyebrow}>
          <FontAwesome5 name="fire" size={9} color={colors.accent} solid />
          <Text style={styles.eyebrowText}>SPOTLIGHT · {item.kind === 'novel' ? 'NOVEL' : 'MANGA'}</Text>
        </View>
        <Text style={styles.spotTitle} numberOfLines={2}>{item.title}</Text>
        {item.author ? <Text style={styles.spotAuthor} numberOfLines={1}>by {item.author}</Text> : null}
        {item.summary ? <Text style={styles.spotSummary} numberOfLines={3}>{item.summary}</Text> : null}
        <View style={styles.spotFoot}>
          <LinearGradient
            colors={[colors.accentHi, colors.accent, colors.accentDeep]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[styles.spotCta, { shadowColor: colors.accent }]}
          >
            <FontAwesome5 name="book-open" size={12} color="#FFFFFF" solid />
            <Text style={styles.spotCtaText}>Read now</Text>
          </LinearGradient>
          <View style={styles.spotViews}>
            <FontAwesome5 name="eye" size={10} color={colors.textMuted} />
            <Text style={styles.spotViewsText}>{formatCount(item.views)}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.spotCover, { shadowColor: '#000' }]}>
        <Image source={coverSource(item.image)} style={styles.fill} resizeMode="cover" />
        {item.isAdult ? (
          <View style={[styles.adult, { backgroundColor: colors.danger }]}>
            <Text style={styles.adultText}>18+</Text>
          </View>
        ) : null}
      </View>
    </View>
  </Pressable>
  {onEdit && item.kind === 'novel' ? (
    <Pressable
      onPress={() => onEdit(item)}
      hitSlop={10}
      style={({ pressed }) => [styles.spotEdit, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.title}`}
    >
      <FontAwesome5 name="pen" size={10} color={colors.accent} solid />
      <Text style={styles.spotEditText}>Edit</Text>
    </Pressable>
  ) : null}
  </View>
));
SpotlightCard.displayName = 'SpotlightCard';

const ContinueCard = React.memo(({ item, onOpen, styles, colors }) => {
  const pct = Math.max(0, Math.min(100, Number(item.scroll_pct) || 0));
  const chapter =
    item.kind === 'manga'
      ? `Ch. ${item.chapter_number ?? '—'}`
      : `Ch. ${Number.isNaN(parseInt(item.chapter_key, 10)) ? '—' : parseInt(item.chapter_key, 10) + 1}`;
  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.continueCard, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Continue ${item.title}, ${chapter}, ${Math.round(pct)} percent`}
    >
      <Image source={coverSource(item.image)} style={styles.continueCover} resizeMode="cover" />
      <View style={styles.flex}>
        <Text style={styles.continueTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.continueMeta}>{chapter} · {Math.round(pct)}%</Text>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <LinearGradient
            colors={[colors.accentHi, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.trackFill, { width: `${pct}%` }]}
          />
        </View>
      </View>
      <View style={[styles.resumeOrb, { backgroundColor: colors.accentSoft }]}>
        <FontAwesome5 name="play" size={10} color={colors.accent} solid />
      </View>
    </Pressable>
  );
});
ContinueCard.displayName = 'ContinueCard';

/** Explore card: artwork fading into the card, gel icon riding the seam. */
const ExploreTile = ({ item, locked, onPress, styles, colors, isDark }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.97 }] }]}
    accessibilityRole="button"
    accessibilityLabel={`${item.title}. ${item.desc}${locked ? '. Requires a wallet' : ''}`}
  >
    <View style={styles.tileArt}>
      <Image source={item.image} style={styles.fill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0)', isDark ? 'rgba(21,22,31,0.55)' : 'rgba(255,255,255,0.45)', colors.bgCard]}
        locations={[0.35, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`rgba(${colors.accentRgb},0.25)`, 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      {locked ? (
        <View style={[styles.lockChip, { borderColor: `${colors.gold}88` }]}>
          <FontAwesome5 name="lock" size={8} color={colors.gold} solid />
          <Text style={[styles.lockText, { color: colors.gold }]}>Wallet</Text>
        </View>
      ) : null}
    </View>
    <View style={styles.tileOrb} pointerEvents="none">
      <GelOrb icon={item.icon} size={38} lit={!locked} breathe={false} />
    </View>
    <View style={styles.tileBody}>
      <Text style={styles.tileTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.tileDesc} numberOfLines={2}>{item.desc}</Text>
    </View>
  </Pressable>
);

/* ═════════════════════════════════════════════════════════════ screen ═══ */
const Home = () => {
  const navigation = useNavigation();
  const walletCtx = useContext(EmbeddedWalletContext);
  const wallet = walletCtx?.wallet;
  const isWalletConnected = walletCtx?.isWalletConnected || !!wallet?.publicKey;
  const { session } = useGoogleAuth();
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const kit = useMemo(() => makeDetailStyles(colors, isDark), [colors, isDark]);

  const [novels, setNovels] = useState([]);
  const [manga, setManga] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [novelsLoading, setNovelsLoading] = useState(true);
  const [mangaLoading, setMangaLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const isOnline = useOnline(); // shared monitor — also flips on real request failures
  const [loadError, setLoadError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [continueItems, setContinueItems] = useState([]);
  const [spotIndex, setSpotIndex] = useState(0);
  const isMounted = useRef(true);
  const contentFade = useRef(new Animated.Value(0)).current;
  const revealed = useRef(false);

  useEffect(() => () => { isMounted.current = false; }, []);

  /* ── one-time offline cache housekeeping ── */
  useEffect(() => {
    clearCorruptedFiles().catch((e) => console.warn('[Home] clearCorruptedFiles:', e?.message));
    clearOldCache();
  }, []);

  /* ── user id: restore offline copy, then sync with wallet/session ── */
  useEffect(() => {
    AsyncStorage.getItem('offline_user_id')
      .then((stored) => { if (stored && isMounted.current) setUserId((cur) => cur || stored); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Resolves users.id for the signed-in session or connected wallet, and
    // links a newly connected wallet to the session's user row.
    const syncWallet = async () => {
      try {
        if (isOnline === false) return;

        if (session?.user?.id) {
          const { data: authUser, error: authUserError } = await supabase
            .from('users')
            .select('id, wallet_address')
            .eq('id', session.user.id)
            .single();
          if (authUserError && authUserError.code !== 'PGRST116') throw authUserError;
          if (authUser && isMounted.current) {
            setUserId(authUser.id);
            if (authUser.wallet_address) await AsyncStorage.setItem('walletAddress', authUser.wallet_address.toString());
            return;
          }
        }

        if (wallet?.publicKey && isWalletConnected) {
          const key = typeof wallet.publicKey === 'string' ? wallet.publicKey : wallet.publicKey?.toString();
          if (!key) return;
          await AsyncStorage.setItem('walletAddress', key);

          const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', key)
            .maybeSingle();
          if (userError && userError.code !== 'PGRST116') throw userError;

          if (user && isMounted.current) {
            setUserId(user.id);
          } else if (session?.user?.id) {
            const { data: updatedUser, error: updateError } = await supabase
              .from('users')
              .update({ wallet_address: key })
              .eq('id', session.user.id)
              .select('id')
              .single();
            if (updateError) throw updateError;
            if (updatedUser && isMounted.current) setUserId(updatedUser.id);
          }
          return;
        }

        const key = await AsyncStorage.getItem('walletAddress');
        if (!key) return;
        const { data: user } = await supabase.from('users').select('id').eq('wallet_address', key).maybeSingle();
        if (user && isMounted.current) setUserId(user.id);
      } catch (err) {
        if (isErrorNetworkError(err)) return; // offline: silently skip
        console.error('[Home] wallet sync:', err.message);
      }
    };
    syncWallet();
  }, [wallet?.publicKey, isWalletConnected, session?.user?.id, isOnline]);

  /* ── featured novels (cache when offline) ── */
  useEffect(() => {
    let alive = true;
    // Wait for the first network reading: avoids a cache pass followed by a
    // network pass (two visible swaps) on every launch.
    if (isOnline === null) return undefined;
    const run = async () => {
      setNovelsLoading(true);
      try {
        if (isOnline === false) {
          const cached = (await getCachedNovelsOffline(userId || 'guest')) || [];
          cached.sort((a, b) => (b.viewers_count || 0) - (a.viewers_count || 0));
          if (alive) setNovels(cached);
          return;
        }

        let { data, error } = await supabase
          .from('novels')
          .select('id, title, image, summary, user_id, tags, viewers_count, status, writer:users (name, isWriter)')
          .eq('is_visible', true)
          .eq('featured', true);

        if (isErrorNetworkError(error)) {
          const cached = (await getCachedNovelsOffline(userId || 'guest')) || [];
          if (alive) setNovels(cached.slice(0, 8));
          return;
        }
        if (error) throw error;
        data = data || [];

        // Ratings for these novels only (was: every novel rating in the DB).
        const ids = data.map((n) => n.id);
        const { data: ratings } = ids.length
          ? await supabase
              .from('chapter_ratings')
              .select('content_id, averageRating:rating.avg()')
              .eq('content_type', 'novel')
              .in('content_id', ids)
          : { data: [] };
        const ratingMap = new Map((ratings || []).map((r) => [r.content_id, r.averageRating]));

        const list = data
          .map((n) => ({ ...n, averageRating: Number(ratingMap.get(n.id) || 0) }))
          .sort((a, b) => (b.viewers_count || 0) - (a.viewers_count || 0))
          .slice(0, 8);
        if (alive) {
          setNovels(list);
          setLoadError(null);
        }
      } catch (err) {
        console.warn('[Home] novels:', err.message);
        const cached = (await getCachedNovelsOffline(userId || 'guest').catch(() => null)) || [];
        if (alive) {
          if (cached.length) setNovels(cached.slice(0, 8));
          else setLoadError(err.message);
        }
      } finally {
        if (alive) setNovelsLoading(false);
      }
    };
    run();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, refreshKey]);

  /* ── featured manga ── */
  useEffect(() => {
    let alive = true;
    if (isOnline === null) return undefined;
    const run = async () => {
      setMangaLoading(true);
      try {
        if (isOnline === false) {
          if (alive) setManga([]);
          return;
        }
        const { data, error } = await supabase
          .from('manga')
          .select('id, title, cover_image, summary, user_id, status, tags, viewers_count, users:user_id (name)')
          .eq('is_visible', true)
          .eq('featured', true)
          .in('status', ['ongoing', 'completed'])
          .limit(8);
        if (isErrorNetworkError(error)) {
          // Connection dropped mid-request: show the last rows we had.
          if (alive) setManga(await cacheValue('home:manga', []));
          return;
        }
        if (error) throw error;

        // Ratings for these titles only (was: a scan of every rating + every interaction).
        const ids = (data || []).map((m) => m.id);
        const { data: ratings } = ids.length
          ? await supabase.from('chapter_ratings').select('content_id, rating').eq('content_type', 'manga').in('content_id', ids)
          : { data: [] };
        const sums = {};
        (ratings || []).forEach((r) => {
          sums[r.content_id] = sums[r.content_id] || [0, 0];
          sums[r.content_id][0] += Number(r.rating) || 0;
          sums[r.content_id][1] += 1;
        });

        const list = (data || [])
          .map((m) => ({ ...m, averageRating: sums[m.id] ? sums[m.id][0] / sums[m.id][1] : 0 }))
          .sort((a, b) => (b.viewers_count || 0) - (a.viewers_count || 0));
        if (alive) setManga(list);
        cacheSet('home:manga', list);
      } catch (err) {
        console.warn('[Home] manga:', err.message);
        if (alive) setManga(await cacheValue('home:manga', []));
      } finally {
        if (alive) setMangaLoading(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [isOnline, refreshKey]);

  /* ── continue reading ── */
  const loadContinue = useCallback(async () => {
    if (!userId || isOnline === false) {
      setContinueItems([]);
      return;
    }
    try {
      const rows = await getAllReadingProgress(userId);
      const novelRows = rows.filter((r) => r.content_type === 'novel');
      const mangaRows = rows.filter((r) => r.content_type === 'manga');
      const [novelRes, mangaRes] = await Promise.all([
        novelRows.length ? supabase.from('novels').select('id, title, image').in('id', novelRows.map((r) => r.content_id)) : { data: [] },
        mangaRows.length ? supabase.from('manga').select('id, title, cover_image').in('id', mangaRows.map((r) => r.content_id)) : { data: [] },
      ]);
      const nMap = Object.fromEntries((novelRes.data || []).map((n) => [n.id, n]));
      const mMap = Object.fromEntries((mangaRes.data || []).map((m) => [m.id, m]));
      const items = [];
      rows.forEach((row) => {
        if (row.content_type === 'novel' && nMap[row.content_id]) {
          items.push({ ...row, kind: 'novel', title: nMap[row.content_id].title, image: nMap[row.content_id].image });
        } else if (row.content_type === 'manga' && mMap[row.content_id]) {
          items.push({ ...row, kind: 'manga', title: mMap[row.content_id].title, image: mMap[row.content_id].cover_image });
        }
      });
      if (isMounted.current) setContinueItems(items.slice(0, 10));
    } catch (err) {
      console.error('[Home] continue reading:', err.message);
    }
  }, [userId, isOnline]);

  useEffect(() => {
    loadContinue();
  }, [loadContinue, refreshKey]);

  // Back from a reader → progress may have moved.
  useEffect(() => navigation.addListener('focus', loadContinue), [navigation, loadContinue]);

  /* ── refresh ── */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Mark both loads in flight in the same tick, so the spinner can't be
    // cleared by the check below before the fetches start.
    setNovelsLoading(true);
    setMangaLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);
  useEffect(() => {
    if (refreshing && !novelsLoading && !mangaLoading) setRefreshing(false);
  }, [refreshing, novelsLoading, mangaLoading]);

  /* ── derived ── */
  const novelCards = useMemo(
    () =>
      novels.map((n) => ({
        id: n.id,
        kind: 'novel',
        title: n.title,
        image: n.image,
        summary: n.summary,
        author: n.writer?.name || n.users?.name,
        status: n.status,
        views: n.viewers_count,
        rating: n.averageRating,
        isAdult: !!n.tags?.includes?.('Adult(18+)'),
      })),
    [novels]
  );
  const mangaCards = useMemo(
    () =>
      manga.map((m) => ({
        id: m.id,
        kind: 'manga',
        title: m.title,
        image: m.cover_image,
        summary: m.summary,
        author: m.users?.name,
        status: m.status,
        views: m.viewers_count,
        rating: m.averageRating,
        isAdult: !!m.tags?.includes?.('Adult(18+)'),
      })),
    [manga]
  );
  // Interleave the top novels and manga for the spotlight.
  const spotlight = useMemo(() => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      if (novelCards[i]) out.push(novelCards[i]);
      if (mangaCards[i] && out.length < 5) out.push(mangaCards[i]);
    }
    return out.slice(0, 5);
  }, [novelCards, mangaCards]);

  const offline = isOnline === false;
  const firstLoad = (novelsLoading || mangaLoading) && novels.length === 0 && manga.length === 0;

  useEffect(() => {
    if (!firstLoad && !revealed.current) {
      revealed.current = true;
      Animated.timing(contentFade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    }
  }, [firstLoad, contentFade]);

  /* ── admins get an Edit button on spotlight novels ── */
  useEffect(() => {
    let cancelled = false;
    const uid = session?.user?.id;
    if (!uid) { setIsAdmin(false); return; }
    supabase.from('users').select('"isSuperuser"').eq('id', uid).maybeSingle()
      .then(({ data }) => { if (!cancelled) setIsAdmin(!!data?.isSuperuser); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const editSpotlight = useCallback(
    (item) => navigation.navigate('NovelDashboard', { editNovelId: item.id }),
    [navigation]
  );

  /* ── navigation ── */
  const openItem = useCallback(
    (item) => navigation.navigate(item.kind === 'manga' ? 'MangaDetail' : 'NovelDetail', { id: item.id }),
    [navigation]
  );
  const openContinue = useCallback(
    (item) =>
      item.kind === 'novel'
        ? navigation.navigate('Chapter', { novelId: item.content_id, chapterId: item.chapter_key })
        : navigation.navigate('MangaChapter', { mangaId: item.content_id, chapterId: item.chapter_key }),
    [navigation]
  );
  const openExplore = (item) => {
    if (item.requiresWallet && !isWalletConnected) {
      toast.info(`Connect a wallet to open ${item.title}`);
      walletCtx?.setShowModal?.(true);
      return;
    }
    navigation.navigate(item.path);
  };

  /* ─────────────── render ─────────────── */
  if (firstLoad && !offline) {
    return <ScreenSkeleton variant="home" label="Loading home" />;
  }

  const background = (
    <LinearGradient
      pointerEvents="none"
      colors={[`rgba(${colors.accentRgb},${isDark ? 0.14 : 0.08})`, 'rgba(0,0,0,0)']}
      style={styles.glow}
    />
  );

  const refresh = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
  );

  /* ── offline: same design, saved novels only ── */
  if (offline) {
    const posterW = (SCREEN_W - GUTTER * 2 - space.md) / 2;
    return (
      <View style={styles.page}>
        {background}
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.offlineCard, { borderColor: `${colors.warning}55` }]}>
            <View pointerEvents="none">
              <GelOrb icon="wifi" size={44} tone={colors.warning} lit breathe={false} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.offlineTitle}>You're offline</Text>
              <Text style={styles.offlineSub}>
                {novels.length ? `${novels.length} saved novel${novels.length === 1 ? '' : 's'} ready to read` : 'Saved novels will appear here'}
              </Text>
            </View>
          </View>

          {novelsLoading && novels.length === 0 ? null : novels.length === 0 ? (
            <EmptyState
              icon="cloud-download-alt"
              title="No saved novels yet"
              subtitle="While online, open a novel and tap “Save offline” to read it anywhere."
            />
          ) : (
            <>
              <SectionHeader title="Your saved novels" styles={styles} colors={colors} />
              <View style={styles.grid}>
                {novelCards.map((item) => (
                  <PosterCard key={item.id} item={item} width={posterW} onOpen={openItem} styles={styles} colors={colors} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  /* ── nothing loaded at all ── */
  if (!novels.length && !manga.length && loadError) {
    return (
      <View style={[styles.page, { justifyContent: 'center' }]}>
        <EmptyState
          icon="exclamation-triangle"
          title="Couldn't load stories"
          subtitle="Check your connection and try again."
          action="Try again"
          onAction={onRefresh}
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {background}
      <Animated.ScrollView
        style={{ opacity: contentFade }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
      >
        {/* spotlight */}
        {spotlight.length ? (
          <>
            <FlatList
              data={spotlight}
              keyExtractor={(item) => `${item.kind}-${item.id}`}
              renderItem={({ item }) => (
                <SpotlightCard item={item} onOpen={openItem} onEdit={isAdmin ? editSpotlight : null} styles={styles} colors={colors} isDark={isDark} />
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={SPOT_W + SPOT_GAP}
              decelerationRate="fast"
              disableIntervalMomentum
              style={styles.bleed}
              contentContainerStyle={{ paddingHorizontal: GUTTER, gap: SPOT_GAP }}
              onMomentumScrollEnd={(e) =>
                setSpotIndex(Math.round(e.nativeEvent.contentOffset.x / (SPOT_W + SPOT_GAP)))
              }
            />
            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {spotlight.map((s, i) => (
                <View
                  key={`${s.kind}-${s.id}`}
                  style={[styles.dotPage, i === spotIndex && { width: 18, backgroundColor: colors.accent }]}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* shortcuts */}
        <View style={kit.actions}>
          <ActionButton
            lit
            icon="book-open"
            label="Browse novels"
            onPress={() => navigation.navigate('NovelsPage')}
            styles={kit}
            colors={colors}
            isDark={isDark}
          />
          <ActionButton
            icon="images"
            label="Browse manga"
            onPress={() => navigation.navigate('MangaPage')}
            styles={kit}
            colors={colors}
            isDark={isDark}
          />
        </View>

        {/* continue reading */}
        {continueItems.length ? (
          <>
            <SectionHeader title="Continue reading" styles={styles} colors={colors} />
            <FlatList
              data={continueItems}
              keyExtractor={(item) => `${item.content_type}-${item.content_id}`}
              renderItem={({ item }) => <ContinueCard item={item} onOpen={openContinue} styles={styles} colors={colors} />}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.rail}
            />
          </>
        ) : null}

        {/* featured novels */}
        {novelCards.length ? (
          <>
            <SectionHeader title="Featured novels" action="See all" onAction={() => navigation.navigate('NovelsPage')} styles={styles} colors={colors} />
            <FlatList
              data={novelCards}
              keyExtractor={(item) => `n-${item.id}`}
              renderItem={({ item }) => <PosterCard item={item} onOpen={openItem} styles={styles} colors={colors} />}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.rail}
            />
          </>
        ) : null}

        {/* featured manga */}
        {mangaCards.length ? (
          <>
            <SectionHeader title="Featured manga" action="See all" onAction={() => navigation.navigate('MangaPage')} styles={styles} colors={colors} />
            <FlatList
              data={mangaCards}
              keyExtractor={(item) => `m-${item.id}`}
              renderItem={({ item }) => <PosterCard item={item} onOpen={openItem} styles={styles} colors={colors} />}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.rail}
            />
          </>
        ) : null}

        {/* explore */}
        <SectionHeader title="Explore" styles={styles} colors={colors} />
        <View style={styles.tiles}>
          {EXPLORE.map((item) => (
            <ExploreTile
              key={item.key}
              item={item}
              locked={item.requiresWallet && !isWalletConnected}
              onPress={() => openExplore(item)}
              styles={styles}
              colors={colors}
              isDark={isDark}
            />
          ))}
        </View>

        <Text style={styles.footer}>© {new Date().getFullYear()} SempaiHQ</Text>
      </Animated.ScrollView>
    </View>
  );
};

/* ─────────────────────────────── styles ─────────────────────────────── */
const makeStyles = (c, isDark) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.bg },
    glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
    scroll: { paddingHorizontal: GUTTER, paddingTop: GUTTER, paddingBottom: BOTTOM_NAV_CLEARANCE + 32 },
    bleed: { marginHorizontal: -GUTTER },
    rail: { paddingHorizontal: GUTTER, gap: space.md },
    flex: { flex: 1 },
    fill: { width: '100%', height: '100%' },

    // spotlight — Block h=300 r=xl
    spot: {
      width: SPOT_W,
      height: HOME.spotlightH,
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: c.bgCardAlt,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    spotBg: { ...StyleSheet.absoluteFillObject, transform: [{ scale: 1.2 }] },
    spotEdit: {
      position: 'absolute',
      top: space.md,
      right: space.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: c.bgCardAlt,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    spotEditText: { fontSize: 12, fontWeight: '800', color: c.textPrimary },
    spotBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', padding: space.lg, gap: space.md },
    spotText: { flex: 1 },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.borderAccent,
      marginBottom: 10,
    },
    eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: c.accent },
    spotTitle: { fontFamily: 'Yoruka', fontSize: 26, lineHeight: 31, color: c.textPrimary },
    spotAuthor: { fontSize: 14, fontWeight: '600', color: c.accent, marginTop: 4 },
    spotSummary: { fontSize: 13, lineHeight: 19, color: c.textSecondary, marginTop: 8 },
    spotFoot: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
    spotCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 38,
      paddingHorizontal: 16,
      borderRadius: 19,
      shadowOpacity: 0.55,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    spotCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    spotViews: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    spotViewsText: { fontSize: 12, fontWeight: '700', color: c.textMuted },
    spotCover: {
      width: 104,
      height: 156,
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.25)',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 14,
      elevation: 10,
    },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.md },
    dotPage: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.borderStrong },

    // section header — Block 45% h20 at mt24
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xxl, marginBottom: space.md },
    sectionTitle: { fontFamily: 'Yoruka', fontSize: 21, color: c.textPrimary, letterSpacing: 0.3 },
    seeAll: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    seeAllText: { fontSize: 13, fontWeight: '700', color: c.accent },

    // continue — 236 × 96
    continueCard: {
      width: HOME.continueW,
      height: HOME.continueH,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: 10,
      borderRadius: radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    continueCover: { width: 56, height: 76, borderRadius: radius.sm, backgroundColor: c.bgCardAlt },
    continueTitle: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
    continueMeta: { fontSize: 12, fontWeight: '600', color: c.accent, marginTop: 4 },
    track: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
    trackFill: { height: '100%', borderRadius: 2 },
    resumeOrb: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

    // posters — 128 × 192
    poster: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: c.bgCardAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    posterShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
    posterTop: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' },
    posterRating: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    posterRatingText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    posterTitle: { fontSize: 14, fontWeight: '700', color: c.textPrimary, marginTop: 10 },
    posterMeta: { fontSize: 12, color: c.textMuted, marginTop: 3 },
    overlayChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.overlayChip,
      borderWidth: 1,
    },
    overlayChipText: { fontSize: 10, fontWeight: '800' },
    dot: { width: 5, height: 5, borderRadius: 3 },
    adult: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 6, height: 20, borderRadius: 6, justifyContent: 'center' },
    adultText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },

    // explore — 2 × 2 artwork cards
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
    tile: {
      width: (SCREEN_W - GUTTER * 2 - space.md) / 2,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    tileArt: { height: 104, backgroundColor: c.bgCardAlt },
    tileOrb: { position: 'absolute', top: 104 - 31, left: 6 },
    tileBody: { paddingHorizontal: space.md, paddingTop: 16, paddingBottom: space.md },
    lockChip: {
      position: 'absolute',
      top: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      backgroundColor: c.overlayChip,
    },
    lockText: { fontSize: 10, fontWeight: '800' },
    tileTitle: { fontFamily: 'Yoruka', fontSize: 17, color: c.textPrimary },
    tileDesc: { fontSize: 12, lineHeight: 17, color: c.textSecondary, marginTop: 3 },

    // offline
    offlineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      backgroundColor: c.bgCard,
    },
    offlineTitle: { fontFamily: 'Yoruka', fontSize: 19, color: c.textPrimary },
    offlineSub: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, rowGap: space.lg },

    footer: { textAlign: 'center', fontSize: 12, color: c.textFaint, marginTop: space.xxl },
  });

export default Home;
