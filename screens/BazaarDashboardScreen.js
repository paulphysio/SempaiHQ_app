import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useBazaarTheme } from '../styles/BazaarStyles';
import { resolveRefund } from '../utils/bazaar';
import { toast } from '../components/Toast';
import ScreenSkeleton from '../components/ScreenSkeleton';

const TABS = ['Overview', 'My Books', 'Refunds', 'All Sales'];

const BazaarDashboardScreen = () => {
  const { colors: BAZAAR_COLORS, styles } = useBazaarTheme();
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const activePublicKey = wallet?.publicKey;
  const insets = useSafeAreaInsets();
  // Clear the floating GlobalBottomNav (68px) so tab content stays visible.
  const bottomNavClearance = Math.max(insets.bottom, 8) + 12 + 68 + 8;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [isAdmin, setIsAdmin] = useState(false);

  const [books, setBooks] = useState([]);
  const [salesByBook, setSalesByBook] = useState({});
  const [refunds, setRefunds] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);

  const load = useCallback(async () => {
    if (!activePublicKey) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, wallet_address, isSuperuser')
        .eq('wallet_address', activePublicKey.toString())
        .maybeSingle();
      setUser(userData || null);
      setIsAdmin(!!userData?.isSuperuser);
      if (!userData) return;

      // My books
      const { data: myBooks } = await supabase
        .from('bazaar_books')
        .select('id, title, cover_url, file_type, status, created_at')
        .eq('author_id', userData.id)
        .order('created_at', { ascending: false });
      const bookList = myBooks || [];
      setBooks(bookList);
      const bookIds = bookList.map((b) => b.id);

      // Sales per my book
      if (bookIds.length > 0) {
        const { data: purchases } = await supabase
          .from('bazaar_purchases')
          .select('id, book_id, price_usd, author_share_pct, currency, access_type, status, created_at')
          .in('book_id', bookIds);
        const map = {};
        (purchases || []).forEach((p) => {
          if (p.status === 'refunded') return;
          const cur = map[p.book_id] || { sales: 0, lends: 0, gross: 0, authorEarned: 0 };
          if (p.access_type === 'lend') {
            cur.lends += 1; // lends pay the platform, not the author
          } else {
            cur.sales += 1;
            cur.gross += Number(p.price_usd || 0);
            cur.authorEarned += Number(p.price_usd || 0) * (Number(p.author_share_pct || 70) / 100);
          }
          map[p.book_id] = cur;
        });
        setSalesByBook(map);
      } else {
        setSalesByBook({});
      }

      // Refund requests: scoped to my books + my own purchases (admins see all)
      const myPurchaseIds = new Set();
      if (bookIds.length > 0) {
        const { data: bookPurchases } = await supabase.from('bazaar_purchases').select('id').in('book_id', bookIds);
        (bookPurchases || []).forEach((p) => myPurchaseIds.add(p.id));
      }
      const { data: myBuys } = await supabase
        .from('bazaar_purchases')
        .select('id')
        .or(`buyer_id.eq.${userData.id},buyer_wallet.eq.${userData.wallet_address}`);
      (myBuys || []).forEach((p) => myPurchaseIds.add(p.id));

      let refundQuery = supabase
        .from('bazaar_refund_requests')
        .select('id, purchase_id, requester_role, reason, status, created_at, purchase:bazaar_purchases(book_id, book:bazaar_books(title))')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!userData.isSuperuser) {
        refundQuery = refundQuery.in(
          'purchase_id',
          myPurchaseIds.size ? [...myPurchaseIds] : ['00000000-0000-0000-0000-000000000000']
        );
      }
      const { data: refundRows } = await refundQuery;
      setRefunds(
        (refundRows || []).map((r) => {
          const p = Array.isArray(r.purchase) ? r.purchase[0] : r.purchase;
          const b = Array.isArray(p?.book) ? p.book[0] : p?.book;
          return { ...r, bookTitle: b?.title || 'A book' };
        })
      );

      // Admin: all recent purchases
      if (userData.isSuperuser) {
        const { data: all } = await supabase
          .from('bazaar_purchases')
          .select('id, book_id, buyer_wallet, currency, access_type, price_usd, author_amount, platform_amount, status, created_at')
          .order('created_at', { ascending: false })
          .limit(50);
        setAllPurchases(all || []);
      }
    } catch (err) {
      console.error('[BazaarDashboard] Load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activePublicKey]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const totals = books.reduce(
    (acc, b) => {
      const s = salesByBook[b.id] || { sales: 0, lends: 0, gross: 0, authorEarned: 0 };
      acc.sales += s.sales;
      acc.lends += s.lends;
      acc.gross += s.gross;
      acc.earned += s.authorEarned;
      return acc;
    },
    { sales: 0, lends: 0, gross: 0, earned: 0 }
  );

  const statusColor = (s) =>
    s === 'completed'
      ? BAZAAR_COLORS.success
      : s === 'refunded'
      ? BAZAAR_COLORS.danger
      : s === 'refund_pending'
      ? BAZAAR_COLORS.gold
      : BAZAAR_COLORS.textMuted;

  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => t !== 'All Sales');

  const renderOverview = () => (
    <>
      <View style={styles.statRow}>
        <View style={[styles.statCard, styles.statCardHalf]}>
          <Text style={styles.statValue}>{totals.sales}</Text>
          <Text style={styles.statLabel}>Sales ({totals.lends} borrows)</Text>
        </View>
        <View style={[styles.statCard, styles.statCardHalf]}>
          <Text style={styles.statValue}>${totals.gross.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Gross revenue</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>${totals.earned.toFixed(2)}</Text>
        <Text style={styles.statLabel}>Your estimated earnings (70% share)</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.listItemSub}>
          Sales are paid on-chain at purchase time — the split already happened.{"\n\n"}
          Refund requests appear under the Refunds tab and are reviewed manually.
        </Text>
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('UploadBook')}>
        <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Upload Another Book</Text>
      </TouchableOpacity>
    </>
  );

  const renderMyBooks = () =>
    books.length === 0 ? (
      <View style={styles.centerContainer}>
        <Ionicons name="book-outline" size={48} color={BAZAAR_COLORS.textMuted} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>You haven't published any books yet.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('UploadBook')}>
          <Text style={styles.primaryButtonText}>Upload a Book</Text>
        </TouchableOpacity>
      </View>
    ) : (
      books.map((b) => {
        const s = salesByBook[b.id] || { sales: 0, lends: 0, gross: 0, authorEarned: 0 };
        return (
          <TouchableOpacity
            key={b.id}
            style={styles.listItem}
            onPress={() => navigation.navigate('BazaarBook', { bookId: b.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.listItemTitle} numberOfLines={1}>{b.title}</Text>
              <Text style={styles.listItemSub}>
                {s.sales} sale{s.sales === 1 ? '' : 's'}{s.lends > 0 ? ` · ${s.lends} borrow${s.lends === 1 ? '' : 's'}` : ''} · ${s.gross.toFixed(2)} gross · ${s.authorEarned.toFixed(2)} to you
              </Text>
              <View style={[styles.statusPill, { backgroundColor: b.status === 'active' ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.08)' }]}>
                <Text style={[styles.statusPillText, { color: b.status === 'active' ? BAZAAR_COLORS.success : BAZAAR_COLORS.textMuted }]}>
                  {b.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={BAZAAR_COLORS.textMuted} />
          </TouchableOpacity>
        );
      })
    );

  const handleResolve = (refundId, action) => {
    const approve = action === 'approve';
    Alert.alert(
      approve ? 'Approve refund?' : 'Reject refund?',
      approve ? 'Access is revoked. You must send the on-chain refund manually.' : 'The buyer keeps access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approve ? 'Approve' : 'Reject',
          style: approve ? 'destructive' : 'default',
          onPress: async () => {
            const res = await resolveRefund(refundId, action);
            toast.error([res.ok ? 'Done' : 'Error', res.data?.message || res.data?.error || ''].filter(Boolean).join(' — '));
            load();
          },
        },
      ]
    );
  };

  const renderRefunds = () =>
    refunds.length === 0 ? (
      <View style={styles.centerContainer}>
        <Ionicons name="checkmark-circle-outline" size={48} color={BAZAAR_COLORS.success} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>No refund requests.</Text>
      </View>
    ) : (
      refunds.map((r) => (
        <View key={r.id} style={styles.listItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.listItemTitle} numberOfLines={1}>{r.bookTitle}</Text>
            <Text style={styles.listItemSub}>
              {r.requester_role === 'buyer' ? 'Buyer' : 'Author'} request · {new Date(r.created_at).toLocaleDateString()}
            </Text>
            {!!r.reason && <Text style={styles.listItemSub} numberOfLines={2}>"{r.reason}"</Text>}
            <View style={[styles.statusPill, { backgroundColor: 'rgba(255, 200, 87,0.12)' }]}>
              <Text style={[styles.statusPillText, { color: statusColor(r.status) }]}>
                {r.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            {isAdmin && r.status === 'pending' && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.tab, { borderColor: BAZAAR_COLORS.success }]} onPress={() => handleResolve(r.id, 'approve')}>
                  <Text style={[styles.tabText, { color: BAZAAR_COLORS.success }]}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, { borderColor: BAZAAR_COLORS.danger }]} onPress={() => handleResolve(r.id, 'reject')}>
                  <Text style={[styles.tabText, { color: BAZAAR_COLORS.danger }]}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))
    );

  const renderAllSales = () =>
    allPurchases.length === 0 ? (
      <View style={styles.centerContainer}>
        <Ionicons name="receipt-outline" size={48} color={BAZAAR_COLORS.textMuted} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>No sales yet.</Text>
      </View>
    ) : (
      allPurchases.map((p) => (
        <View key={p.id} style={styles.listItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.listItemTitle} numberOfLines={1}>
              {p.access_type === 'lend' ? 'LEND' : 'SALE'} · {p.currency === 'SMP' ? `${Number(p.platform_amount || 0).toLocaleString()} SMP` : `$${(Number(p.price_usd) || 0).toFixed(2)}`}
            </Text>
            <Text style={styles.listItemSub} numberOfLines={1}>
              {(p.buyer_wallet || '').slice(0, 8)}… · {new Date(p.created_at).toLocaleDateString()}
            </Text>
            <Text style={styles.listItemSub}>
              author {p.author_amount ?? '—'} / platform {p.platform_amount ?? '—'}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[styles.statusPillText, { color: statusColor(p.status) }]}>
              {p.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
      ))
    );

  if (loading) {
    return <ScreenSkeleton variant="dashboard" label="Loading your sales" />;
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bazaar Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="wallet-outline" size={48} color={BAZAAR_COLORS.textMuted} />
          <Text style={styles.mutedText}>Connect your wallet to view your bazaar dashboard.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bazaar Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {visibleTabs.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomNavClearance }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={BAZAAR_COLORS.accent}
          />
        }
      >
        {tab === 'Overview' && renderOverview()}
        {tab === 'My Books' && renderMyBooks()}
        {tab === 'Refunds' && renderRefunds()}
        {tab === 'All Sales' && isAdmin && renderAllSales()}
      </ScrollView>
    </View>
  );
};

export default BazaarDashboardScreen;
