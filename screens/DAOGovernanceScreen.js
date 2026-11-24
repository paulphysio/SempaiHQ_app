// screens/DAOGovernanceScreen.js
// Live money-activity feed (DexScreener-style) backed by the public money_events table.
import { GelPageHeader } from '../components/gel/GelGate';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';

const PAGE_SIZE = 50;
const SOLSCAN = 'https://solscan.io/tx/';

const TYPE_META = {
  chapter_unlock:     { icon: 'book-open',       color: '#4da3ff', label: 'Chapter' },
  manga_unlock:       { icon: 'book-reader',     color: '#4da3ff', label: 'Manga' },
  manga_subscription: { icon: 'star',            color: '#b48cff', label: 'Manga Sub' },
  bazaar_purchase:    { icon: 'shopping-bag',    color: '#F36316', label: 'Bazaar' },
  bazaar_lend:        { icon: 'hand-holding',    color: '#F36316', label: 'Lend' },
  bazaar_refund:      { icon: 'undo',            color: '#ff4444', label: 'Refund' },
  badge_purchase:     { icon: 'award',           color: '#FFC857', label: 'Badge' },
  writer_subscription:{ icon: 'heart',           color: '#ff6b9d', label: 'Sub' },
  kaiji_deposit:      { icon: 'coins',           color: '#a78bfa', label: 'Kaiji' },
  kaiji_payout:       { icon: 'trophy',          color: '#44ff88', label: 'Kaiji' },
  kaiji_refund:       { icon: 'undo',            color: '#44ff88', label: 'Kaiji' },
  kaiji_deposit_refund:{ icon: 'undo',           color: '#a78bfa', label: 'Kaiji' },
  kaiji_sol_swap:     { icon: 'exchange-alt',    color: '#22d3ee', label: 'Swap' },
  withdrawal:         { icon: 'money-bill-wave', color: '#ff4444', label: 'Withdraw' },
  token_send:         { icon: 'paper-plane',     color: '#9ca3af', label: 'Send' },
  jupiter_swap:       { icon: 'exchange-alt',    color: '#22d3ee', label: 'Swap' },
  creator_tip:        { icon: 'gift',            color: '#ff6b9d', label: 'Tip' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'payments', label: 'Payments', types: ['chapter_unlock', 'manga_unlock', 'manga_subscription', 'bazaar_purchase', 'bazaar_lend', 'badge_purchase', 'writer_subscription', 'creator_tip'] },
  { key: 'kaiji', label: 'Kaiji', types: ['kaiji_deposit', 'kaiji_payout', 'kaiji_refund', 'kaiji_deposit_refund', 'kaiji_sol_swap'] },
  { key: 'swaps', label: 'Swaps', types: ['jupiter_swap', 'kaiji_sol_swap', 'token_send'] },
  { key: 'out', label: 'Payouts', types: ['withdrawal', 'kaiji_payout', 'kaiji_refund', 'kaiji_deposit_refund', 'bazaar_refund'] },
];

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function shortAddr(addr) {
  if (!addr || typeof addr !== 'string') return '';
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

function formatAmount(amount, asset) {
  if (amount == null) return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const decimals = ['SOL'].includes(asset) ? 4 : n >= 1000 ? 0 : n >= 1 ? 2 : 4;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${asset || ''}`.trim();
}

const DAOGovernanceScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getDAOStyles(colors), [isDark]);
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ count: 0, volumeUsd: 0 });
  const livePulse = useRef(new Animated.Value(0.4)).current;
  const channelRef = useRef(null);

  const fetchEvents = useCallback(async (reset = false) => {
    try {
      const { data, error } = await supabase
        .from('money_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      setEvents(data || []);
      const usd = (data || []).reduce((a, e) => a + (Number(e.usd_value) || 0), 0);
      setStats({ count: (data || []).length, volumeUsd: usd });
    } catch (e) {
      console.error('[DAO feed] fetch failed:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(true);

    // Live updates: any new money_events row appears instantly.
    // Unique topic per mount — reusing a name returns the already-subscribed
    // channel and .on() after subscribe() throws.
    const topic = `money_events_feed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    channelRef.current = supabase
      .channel(topic)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'money_events' }, (payload) => {
        const row = payload.new;
        setEvents((prev) => [row, ...prev].slice(0, PAGE_SIZE));
        setStats((s) => ({
          count: s.count + 1,
          volumeUsd: s.volumeUsd + (Number(row.usd_value) || 0),
        }));
      })
      .subscribe();

    // Pulse the LIVE dot.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchEvents, livePulse]);

  const activeTypes = FILTERS.find((f) => f.key === filter)?.types;
  const visible = activeTypes ? events.filter((e) => activeTypes.includes(e.event_type)) : events;

  const openTx = (sig) => {
    if (sig) Linking.openURL(SOLSCAN + sig).catch(() => {});
  };

  const renderEvent = ({ item }) => {
    const meta = TYPE_META[item.event_type] || { icon: 'money-bill', color: '#9ca3af', label: 'Tx' };
    const isOut = item.direction === 'out';
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={item.tx_sig ? 0.7 : 1}
        onPress={() => openTx(item.tx_sig)}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
          <Icon name={meta.icon} size={13} color={meta.color} />
        </View>
        <View style={styles.rowMain}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={[styles.rowAmount, { color: isOut ? '#ff6b6b' : '#44ff88' }]}>
              {isOut ? '−' : '+'}{formatAmount(item.amount, item.asset)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {meta.label}
              {item.counterparty ? ` · ${shortAddr(item.counterparty)}` : ''}
              {item.wallet ? ` · ${shortAddr(item.wallet)}` : ''}
            </Text>
            <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
          </View>
          {item.usd_value != null && Number(item.usd_value) > 0 && (
            <Text style={styles.rowUsd}>≈ ${Number(item.usd_value).toFixed(2)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <GelPageHeader
        title="DAO Governance"
        subtitle="Every payment, payout and swap — in the open"
        right={
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        }
      />

      {/* Stats strip */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.count}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>${stats.volumeUsd.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Tracked USD</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{visible.length}</Text>
          <Text style={styles.statLabel}>Shown</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading treasury feed…</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(e) => e.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchEvents(true); }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="satellite-dish" size={28} color="#444" />
              <Text style={styles.emptyText}>No money events yet.{"\n"}Payments, swaps and payouts will appear here live.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home')}>
        <Icon name="arrow-left" size={12} color="#fff" />
        <Text style={styles.backButtonText}>Home</Text>
      </TouchableOpacity>
    </View>
  );
};

export const getDAOStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: c.textPrimary, fontSize: 20, },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(68,255,136,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(68,255,136,0.35)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success || '#22C55E' },
  liveText: { color: c.success || '#22C55E', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { color: c.textPrimary, fontSize: 15, },
  statLabel: { color: c.textMuted, fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.bgElevated,
  },
  chipActive: { backgroundColor: 'rgba(243, 99, 22,0.15)', borderColor: c.accent },
  chipText: { color: c.textMuted, fontSize: 12 },
  chipTextActive: { color: c.accent },
  list: { paddingHorizontal: 16, paddingBottom: 110 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.bgCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { color: c.textPrimary, fontSize: 13, flex: 1, marginRight: 8 },
  rowAmount: { fontSize: 13, },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rowMeta: { color: c.textMuted, fontSize: 11, flex: 1, marginRight: 8 },
  rowTime: { color: c.textMuted, fontSize: 10 },
  rowUsd: { color: '#4da3ff', fontSize: 11, marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { color: c.textMuted, marginTop: 12, fontSize: 13 },
  emptyText: { color: c.textMuted, marginTop: 14, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  backButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(243, 99, 22,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  backButtonText: { color: '#fff', fontSize: 13, },
});

export default DAOGovernanceScreen;
