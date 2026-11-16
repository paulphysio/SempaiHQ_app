import React, { useState, useRef, useEffect, useContext, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { NotificationEmitter } from '../services/NotificationEmitter';
import { Sheet, Skeleton, EmptyState } from './ui';
import { radius, space } from '../theme/tokens';
import GelOrb from './nav/GelOrb';

/* ─────────────────────────── helpers ─────────────────────────── */

/** "now", "3m", "5h", "2d", or a short date. */
const timeAgo = (iso) => {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const dayBucket = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((start - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  return 'Earlier';
};

/**
 * What a message is about — drives the icon, colour, label and filter.
 * `kind` is the source (notification row vs platform announcement);
 * `type` is the notification row's own type (new_chapter, new_novel, …).
 */
const classify = (msg, colors) => {
  if (msg.kind === 'announcement') {
    return { group: 'announcements', icon: 'bullhorn', tint: colors.gold, label: 'SempaiHQ' };
  }
  switch (msg.type) {
    case 'new_chapter':
      return { group: 'chapters', icon: 'book-open', tint: colors.accent, label: 'New chapter' };
    case 'new_novel':
      return { group: 'titles', icon: 'magic', tint: colors.electric, label: 'New novel' };
    case 'new_manga':
      return { group: 'titles', icon: 'magic', tint: colors.electric, label: 'New manga' };
    case 'announcement':
      return { group: 'announcements', icon: 'bullhorn', tint: colors.gold, label: 'From the creator' };
    default:
      return { group: 'other', icon: 'bell', tint: colors.info, label: 'Update' };
  }
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'chapters', label: 'Chapters' },
  { key: 'titles', label: 'New titles' },
  { key: 'announcements', label: 'Announcements' },
];

/* ─────────────────────────── row ─────────────────────────── */

const MessageRow = React.memo(({ msg, onOpen, colors, isDark }) => {
  const c = classify(msg, colors);
  const unread = msg.kind === 'notification' && !msg.is_read;
  const contentTitle = msg.kind === 'announcement' ? msg.title : msg.novel_title;
  const canOpen = !!(msg.novel_id || msg.manga_id);
  return (
    <Pressable
      onPress={canOpen ? () => onOpen(msg) : undefined}
      style={({ pressed }) => [
        rowStyles.row,
        { backgroundColor: unread ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(30,41,59,0.04)') : 'transparent' },
        pressed && canOpen && { opacity: 0.7 },
      ]}
      accessibilityRole={canOpen ? 'button' : 'text'}
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${c.label}${contentTitle ? `, ${contentTitle}` : ''}. ${msg.message || ''}`}
    >
      {unread ? <View style={[rowStyles.unreadBar, { backgroundColor: c.tint, shadowColor: c.tint }]} /> : null}
      <View style={[rowStyles.icon, { backgroundColor: `${c.tint}1F`, borderColor: `${c.tint}55` }]}>
        <FontAwesome5 name={c.icon} size={14} color={c.tint} solid />
      </View>
      <View style={rowStyles.body}>
        <View style={rowStyles.topLine}>
          <Text style={[rowStyles.kind, { color: c.tint }]} numberOfLines={1}>{c.label}</Text>
          <Text style={[rowStyles.time, { color: colors.textMuted }]}>{timeAgo(msg.created_at)}</Text>
        </View>
        {contentTitle ? (
          <Text style={[rowStyles.title, { color: colors.textPrimary }, unread && { fontWeight: '800' }]} numberOfLines={1}>
            {contentTitle}
          </Text>
        ) : null}
        {msg.message ? (
          <Text style={[rowStyles.message, { color: colors.textSecondary }]} numberOfLines={3}>{msg.message}</Text>
        ) : null}
        {canOpen ? (
          <View style={rowStyles.openRow}>
            <Text style={[rowStyles.openText, { color: c.tint }]}>
              {msg.manga_id ? 'Open manga' : 'Open novel'}
            </Text>
            <FontAwesome5 name="arrow-right" size={9} color={c.tint} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});
MessageRow.displayName = 'MessageRow';

const MessagesSkeleton = () => (
  <View>
    {[0, 1, 2, 3, 4].map((i) => (
      <View key={i} style={rowStyles.row}>
        <Skeleton width={40} height={40} r={20} />
        <View style={[rowStyles.body, { gap: 8 }]}>
          <Skeleton width="30%" height={10} />
          <Skeleton width="65%" height={14} />
          <Skeleton width="90%" height={12} />
        </View>
      </View>
    ))}
  </View>
);

/* ─────────────────────────── data hook ─────────────────────────── */

/**
 * Notifications + platform announcements for the connected wallet: unread
 * count, list, and an `openSheet` that marks everything read.
 */
export const useMessagesInbox = () => {
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = walletContext?.isWalletConnected || !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // users row for the connected wallet, resolved once per wallet.
  const userRowRef = useRef(null);
  const getUserRow = useCallback(async () => {
    if (!activeWalletAddress) return null;
    if (userRowRef.current?.wallet === activeWalletAddress) return userRowRef.current.row;
    const { data, error } = await supabase
      .from('users')
      .select('id, isWriter, isArtist')
      .eq('wallet_address', activeWalletAddress)
      .single();
    if (error || !data) return null;
    userRowRef.current = { wallet: activeWalletAddress, row: data };
    return data;
  }, [activeWalletAddress]);

  const fetchMessages = useCallback(async () => {
    if (!isWalletConnected || !activeWalletAddress) return undefined;
    setLoading(true);
    try {
      const userData = await getUserRow();
      if (!userData) {
        setMessages([]);
        return undefined;
      }
      const [notifRes, annRes, unreadRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('announcements')
          .select('id, title, message, created_at, release_date, audience')
          .order('created_at', { ascending: false })
          .limit(10),
        // Unread counts notifications only: platform announcements have no
        // per-user read column and already fan out into notifications rows.
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userData.id)
          .or('is_read.is.null,is_read.eq.false'),
      ]);
      if (notifRes.error) console.error('[Messages] notifications:', notifRes.error);
      if (annRes.error) console.error('[Messages] announcements:', annRes.error);

      const notifData = notifRes.data || [];
      const announcements = (annRes.data || []).filter((a) =>
        a.audience === 'creators' ? userData.isWriter || userData.isArtist : true
      );
      setMessages(
        [
          // `kind` = source; the row keeps its own `type` (new_chapter, …).
          ...notifData.map((n) => ({ ...n, kind: 'notification' })),
          ...announcements.map((a) => ({ ...a, kind: 'announcement' })),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      );
      return unreadRes.count ?? notifData.filter((n) => !n.is_read).length;
    } catch (error) {
      console.error('[Messages] fetch failed:', error);
      return undefined;
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [isWalletConnected, activeWalletAddress, getUserRow]);

  const refresh = useCallback(async () => {
    const unread = await fetchMessages();
    if (typeof unread === 'number') setUnreadCount(unread);
  }, [fetchMessages]);

  useEffect(() => {
    if (isWalletConnected && activeWalletAddress) refresh();
    else {
      setUnreadCount(0);
      setMessages([]);
    }
  }, [isWalletConnected, activeWalletAddress, refresh]);

  // ── Keep the badge live ──────────────────────────────────────────────
  // Coalesce bursts (a push + a realtime insert for the same message).
  const refreshTimer = useRef(null);
  const refreshSoon = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, 250);
  }, [refresh]);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  // 1) A push arrived while the app is open (App.js emits this).
  useEffect(() => {
    const listener = NotificationEmitter.addListener('notificationReceived', refreshSoon);
    return () => listener.remove();
  }, [refreshSoon]);

  // 2) A notification row was written for this user — instant, even when the
  //    device has no push token or the push is delayed.
  useEffect(() => {
    if (!isWalletConnected || !activeWalletAddress) return undefined;
    let channel = null;
    let alive = true;
    getUserRow().then((row) => {
      if (!alive || !row?.id) return;
      channel = supabase
        .channel(`inbox:${row.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${row.id}` },
          () => {
            // Bump right away so the badge never waits on the network…
            setUnreadCount((n) => n + 1);
            // …then reconcile with the real count.
            refreshSoon();
          }
        )
        .subscribe();
    });
    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [isWalletConnected, activeWalletAddress, getUserRow, refreshSoon]);

  // 3) Back from the background (e.g. a push arrived while away).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isWalletConnected) refreshSoon();
    });
    return () => sub.remove();
  }, [isWalletConnected, refreshSoon]);

  const openSheet = useCallback(async () => {
    setOpen(true);
    // Opening reads everything: clear the badge now, not after the network.
    // (The list still highlights what was unread for this visit.)
    setUnreadCount(0);
    await fetchMessages();
    try {
      const userData = await getUserRow();
      if (userData) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userData.id)
          .or('is_read.is.null,is_read.eq.false');
        if (error) console.warn('[Messages] mark-read failed:', error.message);
      }
    } catch (error) {
      console.error('[Messages] mark-read error:', error);
    }
  }, [fetchMessages, getUserRow]);

  const closeSheet = useCallback(() => setOpen(false), []);

  return { open, openSheet, closeSheet, messages, loading, loaded, unreadCount, isWalletConnected };
};

/* ─────────────────────────── sheet ─────────────────────────── */

export const MessagesSheet = ({ open, onClose, messages, loading, loaded, isWalletConnected }) => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const [filter, setFilter] = useState('all');

  const classified = useMemo(
    () => messages.map((m) => ({ msg: m, group: classify(m, colors).group })),
    [messages, colors]
  );
  const counts = useMemo(() => {
    const c = { all: classified.length, chapters: 0, titles: 0, announcements: 0 };
    classified.forEach(({ group }) => { if (c[group] !== undefined) c[group] += 1; });
    return c;
  }, [classified]);
  const unread = useMemo(() => messages.filter((m) => m.kind === 'notification' && !m.is_read).length, [messages]);

  const sections = useMemo(() => {
    const list = filter === 'all' ? classified : classified.filter((x) => x.group === filter);
    const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
    const by = {};
    list.forEach(({ msg }) => {
      const b = dayBucket(msg.created_at);
      (by[b] = by[b] || []).push(msg);
    });
    return order.filter((k) => by[k]?.length).map((k) => ({ title: k, items: by[k] }));
  }, [classified, filter]);

  const openMessage = useCallback(
    (msg) => {
      onClose();
      // Let the sheet start closing before the screen changes.
      setTimeout(() => {
        if (msg.manga_id) navigation.navigate('MangaDetail', { id: msg.manga_id });
        else if (msg.novel_id) navigation.navigate('NovelDetail', { id: msg.novel_id });
      }, 120);
    },
    [navigation, onClose]
  );

  let body;
  if (!isWalletConnected) {
    body = <EmptyState icon="wallet" title="Connect your wallet" subtitle="New chapters, new titles and creator announcements will show up here." />;
  } else if (loading && !loaded && messages.length === 0) {
    body = <MessagesSkeleton />;
  } else if (messages.length === 0) {
    body = <EmptyState icon="bell" title="You're all caught up" subtitle="When a creator you read posts a chapter or an announcement, you'll see it here." />;
  } else if (sections.length === 0) {
    body = (
      <EmptyState
        icon={filter === 'chapters' ? 'book-open' : filter === 'titles' ? 'magic' : 'bullhorn'}
        title="Nothing here yet"
        subtitle="Try another filter."
      />
    );
  } else {
    body = sections.map((sec) => (
      <View key={sec.title}>
        <Text style={[sheetStyles.dayLabel, { color: colors.textMuted }]}>{sec.title.toUpperCase()}</Text>
        <View style={[sheetStyles.group, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {sec.items.map((msg, i) => (
            <View key={`${msg.kind}-${msg.id}`}>
              {i > 0 ? <View style={[sheetStyles.divider, { backgroundColor: colors.border }]} /> : null}
              <MessageRow msg={msg} onOpen={openMessage} colors={colors} isDark={isDark} />
            </View>
          ))}
        </View>
      </View>
    ));
  }

  return (
    <Sheet visible={open} onClose={onClose} title="Messages" tall>
      {isWalletConnected && messages.length ? (
        <>
          <Text style={[sheetStyles.summary, { color: colors.textSecondary }]}>
            {unread ? `${unread} new since your last visit` : 'You’re all caught up'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sheetStyles.filters} style={sheetStyles.filterBar}>
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[sheetStyles.chip, { borderColor: on ? colors.accent : colors.border, backgroundColor: colors.bgCard }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  {on ? (
                    <LinearGradient
                      colors={[colors.accentHi, colors.accent, colors.accentDeep]}
                      start={{ x: 0.1, y: 0 }}
                      end={{ x: 0.9, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  <Text style={[sheetStyles.chipText, { color: on ? '#FFFFFF' : colors.textSecondary }]}>{f.label}</Text>
                  <View style={[sheetStyles.count, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : colors.accentSoft }]}>
                    <Text style={[sheetStyles.countText, { color: on ? '#FFFFFF' : colors.accent }]}>{counts[f.key]}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
        {body}
      </ScrollView>
    </Sheet>
  );
};

/** Stand-alone gel bell + sheet (for headers / other surfaces). */
const MessagesButton = ({ size = 34, style }) => {
  const inbox = useMessagesInbox();
  return (
    <>
      <GelOrb
        icon="bell"
        size={size}
        lit={inbox.unreadCount > 0 || inbox.open}
        badge={inbox.unreadCount}
        onPress={inbox.openSheet}
        label={inbox.unreadCount > 0 ? `Messages, ${inbox.unreadCount} unread` : 'Messages'}
        style={style}
      />
      <MessagesSheet {...inbox} onClose={inbox.closeSheet} />
    </>
  );
};

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 14, paddingHorizontal: space.md },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  icon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  kind: { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  time: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '700', marginTop: 3 },
  message: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  openText: { fontSize: 12, fontWeight: '800' },
});

const sheetStyles = StyleSheet.create({
  summary: { fontSize: 13, fontWeight: '600', marginTop: -4 },
  filterBar: { flexGrow: 0, marginTop: space.md, marginHorizontal: -space.xl },
  filters: { gap: 8, paddingHorizontal: space.xl, paddingBottom: space.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 17,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '800' },
  dayLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: space.md, marginBottom: 8 },
  group: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
});

export default React.memo(MessagesButton);
