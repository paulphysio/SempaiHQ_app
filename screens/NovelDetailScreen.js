import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Animated,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useOnline } from '../hooks/useOnline';
import { cacheGet, cacheSet, cacheValue } from '../services/localCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import { deleteNovelForOffline, getNovelForOffline, isErrorNetworkError, isNovelSavedOffline, saveNovelForOffline } from '../services/offlineCache';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import NovelCommentSection from '../components/Comments/NovelCommentSection';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { getContentReadingProgress } from '../services/readingProgress';
import { useTheme } from '../context/ThemeContext';
import ScreenSkeleton from '../components/ScreenSkeleton';
import { Sheet, EmptyState } from '../components/ui';
import { toast } from '../components/Toast';
import { space } from '../theme/tokens';
import { DetailHero, ChapterRow, makeDetailStyles, formatCount, STATUS } from '../components/detail/DetailKit';
import { BOTTOM_NAV_CLEARANCE } from '../components/GlobalBottomNav';

const FREE_CHAPTERS = 3; // indices 0–2 are always free

/* ═════════════════════════════════════════════════════════════ screen ═══ */
const NovelDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => makeDetailStyles(colors, isDark), [colors, isDark]);

  const [novel, setNovel] = useState(null);
  const [novelChapters, setNovelChapters] = useState(null);
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showConnectPopup, setShowConnectPopup] = useState(false);
  const [unlockedChapters, setUnlockedChapters] = useState([]);
  const [readingProgress, setReadingProgress] = useState(null);
  const isOnline = useOnline(); // flips offline on real request failures too
  const [newestFirst, setNewestFirst] = useState(false);
  const contentFade = useRef(new Animated.Value(0)).current;
  const { session } = useGoogleAuth();
  const [userId, setUserId] = useState(session?.user?.id || null);

  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey || null;
  const offline = isOnline === false || isOnline === null;

  // Restore user ID from AsyncStorage (works offline)
  useEffect(() => {
    (async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('offline_user_id');
        if (storedUserId && !userId) setUserId(storedUserId);
      } catch (e) {
        console.error('[NovelDetailScreen] Failed to restore user ID:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session?.user?.id) setUserId(session.user.id);
  }, [session?.user?.id]);

  const reveal = useCallback(() => {
    Animated.timing(contentFade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [contentFade]);

  // Offline fallbacks, best first: the full saved copy (readable chapters),
  // then the last-seen page (info + chapter list) kept on this device.
  const loadFromDevice = useCallback(async () => {
    const saved = await getNovelForOffline(id, userId || 'guest');
    if (saved?.novel) {
      setNovel(saved.novel);
      setNovelChapters(saved.chapters);
      return 'saved';
    }
    const seen = await cacheValue(`novel:${id}`);
    if (seen) {
      setNovel(seen);
      setNovelChapters([]);
      return 'seen';
    }
    return null;
  }, [id, userId]);

  const fetchNovel = useCallback(async () => {
    if (isOnline === null) return; // wait a beat for the first connection reading
    try {
      if (isOnline === false) {
        const from = await loadFromDevice();
        if (from) {
          setError(null);
          reveal();
        } else {
          setError('This novel isn’t on your device yet. Open or save it while you’re online to read it offline.');
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('novels')
        .select('*, users:user_id(name)')
        .eq('id', id)
        .eq('is_visible', true)
        .single();

      if (fetchError || !data) {
        if (isErrorNetworkError(fetchError)) {
          // The phone said "online" but the request failed: use the device copy.
          const from = await loadFromDevice();
          if (from) {
            setError(null);
            reveal();
            return;
          }
          setError('You’re offline and this novel isn’t on your device yet.');
          return;
        }
        throw new Error('Novel not found');
      }

      setNovel(data);
      setError(null);
      reveal();
      // Keep a light copy (no chapter text) so this page opens offline next time.
      const { chaptercontents, ...light } = data;
      cacheSet(`novel:${id}`, light);
    } catch (e) {
      console.warn('[NovelDetailScreen] load failed:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, isOnline, reveal, loadFromDevice]);

  const updateViewCount = useCallback(async () => {
    if (!isWalletConnected || !activePublicKey) return;
    if (isOnline !== true) return;
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', activePublicKey)
        .single();
      if (userError || !user) return;

      const { data: existingInteraction } = await supabase
        .from('novel_interactions')
        .select('id')
        .eq('novel_id', id)
        .eq('user_id', user.id)
        .single();
      if (existingInteraction) return;

      const { error: rpcError } = await supabase.rpc('increment_novel_view', { novel_id: id, user_id: user.id });
      if (rpcError) console.error('Error in increment_novel_view:', rpcError.message);
    } catch (e) {
      console.error('Error in updateViewCount:', e.message);
    }
  }, [id, isWalletConnected, activePublicKey, isOnline]);

  const fetchUnlockedChapters = useCallback(async () => {
    if (!isWalletConnected || !activePublicKey) {
      setUnlockedChapters([]);
      return;
    }
    if (isOnline === null) return;
    const cacheKey = `unlocked:${id}:${activePublicKey}`;

    const fromDevice = async () => {
      const saved = await getNovelForOffline(id, userId || 'guest');
      if (saved?.chapters?.length) {
        setNovelChapters(saved.chapters);
        setUnlockedChapters(saved.chapters.map((c) => String(c.chapter_number)));
        return;
      }
      setUnlockedChapters(await cacheValue(cacheKey, []));
    };

    if (isOnline === false) {
      await fromDevice();
      return;
    }

    try {
      const { data: payments, error: paymentsError } = await supabase
        .from('chapter_payments')
        .select('chapter_number')
        .eq('wallet_address', activePublicKey)
        .eq('novel_id', id);
      if (paymentsError) throw paymentsError;
      const ids = (payments || []).map((p) => String(p.chapter_number));
      setUnlockedChapters(ids);
      cacheSet(cacheKey, ids);
    } catch (e) {
      if (isErrorNetworkError(e)) await fromDevice();
      else {
        console.warn('[NovelDetailScreen] unlocked chapters:', e?.message);
        setUnlockedChapters(await cacheValue(cacheKey, []));
      }
    }
  }, [id, isWalletConnected, activePublicKey, isOnline, userId]);

  useEffect(() => {
    fetchNovel();
    updateViewCount();
    fetchUnlockedChapters();
  }, [fetchNovel, updateViewCount, fetchUnlockedChapters]);

  // Reading progress: which chapter the user last read + how far through it.
  const loadReadingProgress = useCallback(async () => {
    if (!userId || !id) {
      setReadingProgress(null);
      return;
    }
    setReadingProgress(await getContentReadingProgress(userId, 'novel', id));
  }, [userId, id]);

  useEffect(() => {
    loadReadingProgress();
  }, [loadReadingProgress]);

  // Refresh progress when coming back from the reader.
  useEffect(() => navigation.addListener('focus', loadReadingProgress), [navigation, loadReadingProgress]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchNovel(), fetchUnlockedChapters(), loadReadingProgress()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    isNovelSavedOffline(id).then(setIsSavedOffline).catch(() => {});
  }, [id]);

  const handleSaveOffline = useCallback(async () => {
    if (isSavedOffline) {
      Alert.alert('Remove download?', 'Saved chapters will no longer be readable offline.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteNovelForOffline(id);
            setIsSavedOffline(false);
            toast.info('Removed from downloads');
          },
        },
      ]);
      return;
    }
    if (!novel) return;
    setSavingOffline(true);
    try {
      await saveNovelForOffline(novel, unlockedChapters, userId);
      setIsSavedOffline(true);
      toast.success('Saved for offline reading');
    } catch (e) {
      console.error('[NovelDetailScreen] could not save novel:', e);
      if (e.message && e.message.includes('timeout')) {
        // Content is cached even if the cover image timed out.
        setIsSavedOffline(true);
        toast.success('Saved for offline reading');
      } else {
        toast.error(`Could not save offline — ${e.message}`);
      }
    } finally {
      setSavingOffline(false);
    }
  }, [isSavedOffline, novel, unlockedChapters, id, userId]);

  const handleNavigation = async (screen, params) => {
    const chapterNum = params?.chapterId ? parseInt(params.chapterId, 10) : null;

    // First 3 chapters (indices 0, 1, 2) are ALWAYS free - no wallet check needed
    if (chapterNum !== null && chapterNum <= 2) {
      navigation.navigate(screen, params);
      return;
    }

    if (chapterNum !== null && chapterNum > 2 && isWalletConnected !== false) {
      if (isOnline === false || isOnline === null) {
        const cachedData = await getNovelForOffline(id, userId);
        if (cachedData && cachedData.chapters) {
          const offlineChapter = cachedData.chapters.find((c) => c.chapter_number === params.chapterId);
          if (offlineChapter && offlineChapter.content) {
            navigation.navigate(screen, params);
            return;
          }
        }
      }
      if (!isWalletConnected) {
        setShowConnectPopup(true);
        return;
      }
    }

    navigation.navigate(screen, params);
  };

  /* ─────────────── derived data ─────────────── */
  const chapters = useMemo(() => {
    if (!novel) return [];
    let list;
    if (offline) {
      // offline: only what's saved on the device
      list = (novelChapters || []).map((c, i) => [String(c.chapter_number), c.title || `Chapter ${i + 1}`]);
    } else {
      list = novel.chaptertitles
        ? Object.entries(novel.chaptertitles).sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
        : [];
    }
    return newestFirst ? [...list].reverse() : list;
  }, [novel, novelChapters, offline, newestFirst]);

  const resumeKey = readingProgress ? String(readingProgress.chapter_key) : null;
  const resumePct = readingProgress ? Math.max(0, Math.min(100, Number(readingProgress.scroll_pct) || 0)) : 0;

  const chapterState = useCallback(
    (chapterId) => {
      const n = parseInt(chapterId, 10);
      if (resumeKey !== null && resumeKey === String(chapterId)) return 'resume';
      if (offline) return 'unlocked';
      if (n < FREE_CHAPTERS) return 'free';
      return unlockedChapters.includes(chapterId) ? 'unlocked' : 'locked';
    },
    [resumeKey, offline, unlockedChapters]
  );

  const firstChapterId = useMemo(() => {
    if (!novel) return null;
    if (offline) return novelChapters?.[0] ? String(novelChapters[0].chapter_number) : null;
    const keys = novel.chaptertitles ? Object.keys(novel.chaptertitles).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)) : [];
    return keys[0] ?? null;
  }, [novel, novelChapters, offline]);

  const readTarget = resumeKey ?? firstChapterId;
  const readLabel = resumeKey !== null ? `Continue Ch. ${parseInt(resumeKey, 10) + 1}` : 'Start reading';
  const openChapter = useCallback(
    (chapterId) => handleNavigation('Chapter', { novelId: novel?.id || id, chapterId: String(chapterId) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [novel?.id, id, isOnline, isWalletConnected, userId]
  );

  /* ─────────────── states ─────────────── */
  if (loading) {
    return <ScreenSkeleton variant="detail" label="Loading novel" />;
  }

  if (!novel || error) {
    return (
      <View style={[styles.page, styles.center]}>
        <EmptyState
          icon={offline ? 'wifi' : 'book-dead'}
          title={offline ? "You're offline" : 'Novel not found'}
          subtitle={error || 'This novel may have been removed or hidden by its author.'}
          action="Back to Home"
          onAction={() => navigation.navigate('Home')}
        />
      </View>
    );
  }

  const authorName = novel?.users?.name || novel?.writer?.name || 'Unknown';
  const status = STATUS[novel.status];
  const statusColor = status ? colors[status.key] : null;

  /* ─────────────── header (everything above the chapter rows) ─────────────── */
  const header = (
    <Animated.View style={{ opacity: contentFade }}>
      <DetailHero
        image={novel.image}
        title={novel.title}
        author={{
          name: authorName,
          onPress: novel.user_id ? () => navigation.navigate('CreatorsProfile', { id: novel.user_id }) : undefined,
        }}
        chips={[
          offline ? { label: 'Offline', icon: 'wifi', color: colors.warning } : null,
          status ? { label: status.label, dot: true, color: statusColor } : null,
          { label: formatCount(novel.viewers_count), icon: 'eye', accessibilityLabel: `${novel.viewers_count || 0} views` },
        ]}
        primary={{
          icon: resumeKey !== null ? 'book-reader' : 'book-open',
          label: readTarget === null ? 'No chapters yet' : readLabel,
          disabled: readTarget === null,
          onPress: () => readTarget !== null && openChapter(readTarget),
        }}
        secondary={{
          icon: savingOffline ? 'spinner' : isSavedOffline ? 'check-circle' : 'arrow-circle-down',
          label: savingOffline ? 'Saving…' : isSavedOffline ? 'Downloaded' : 'Save offline',
          accessibilityLabel: isSavedOffline ? 'Downloaded. Tap to remove from downloads' : 'Save for offline reading',
          onPress: savingOffline ? undefined : handleSaveOffline,
        }}
        synopsis={novel.summary}
        more={{ label: 'Read full summary', onPress: () => navigation.navigate('NovelSummary', { id }) }}
        section={{
          title: offline ? 'Saved chapters' : 'Chapters',
          count: chapters.length,
          newestFirst,
          onToggleSort: () => setNewestFirst((v) => !v),
        }}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        styles={styles}
        colors={colors}
        isDark={isDark}
      >
        {novel.saved_with_key === 'guest' ? (
          <View style={[styles.notice, { borderColor: `${colors.warning}66`, backgroundColor: `${colors.warning}14` }]}>
            <FontAwesome5 name="user-clock" size={12} color={colors.warning} />
            <Text style={[styles.noticeText, { color: colors.warning }]}>Saved in a guest session</Text>
          </View>
        ) : null}
      </DetailHero>
    </Animated.View>
  );

  const footer = (
    <View style={{ paddingBottom: BOTTOM_NAV_CLEARANCE + 24 }}>
      {!offline && novel.id && novel.title ? (
        <View style={[styles.pad, { marginTop: space.xl }]}>
          <NovelCommentSection novelId={novel.id} novelTitle={novel.title} isOnline={isOnline} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.page}>
      <FlatList
        data={chapters}
        keyExtractor={([chapterId]) => `chapter-${chapterId}`}
        renderItem={({ item: [chapterId, title] }) => {
          const index = parseInt(chapterId, 10);
          const advance = novel?.advance_chapters?.find((ch) => ch.index === index)?.is_advance === true;
          return (
            <View style={styles.rowWrap}>
              <ChapterRow
                number={(Number.isNaN(index) ? 0 : index) + 1}
                title={title}
                state={chapterState(chapterId)}
                resumePct={resumePct}
                badge={advance ? { label: 'Advance', icon: 'star' } : undefined}
                onPress={() => openChapter(chapterId)}
                styles={styles}
                colors={colors}
              />
            </View>
          );
        }}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <EmptyState
            icon={offline ? 'download' : 'feather-alt'}
            title={offline ? 'No saved chapters' : 'No chapters yet'}
            subtitle={offline ? 'Unlock chapters and tap “Save offline” while connected.' : 'The author hasn’t published any chapters yet.'}
          />
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={14}
        windowSize={11}
        refreshControl={
          offline ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          )
        }
      />

      <Sheet visible={showConnectPopup} onClose={() => setShowConnectPopup(false)} title="Unlock this chapter">
        <Text style={styles.sheetText}>
          The first {FREE_CHAPTERS} chapters are free. Connect your wallet to unlock the rest of {novel.title}.
        </Text>
        <View style={{ marginVertical: space.lg }}>
          <GoogleSignInButton />
        </View>
      </Sheet>
    </View>
  );
};

export default NovelDetailScreen;
