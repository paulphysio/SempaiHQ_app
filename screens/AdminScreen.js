import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { FontAwesome5 } from '@expo/vector-icons';
import { resolveRefund } from '../utils/bazaar';
import { toast } from '../components/Toast';

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'chart-line' },
  { key: 'applications', label: 'Applications', icon: 'user-plus' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'content', label: 'Content', icon: 'book-open' },
  { key: 'bazaar', label: 'Bazaar', icon: 'store' },
  { key: 'announcements', label: 'Alerts', icon: 'bullhorn' },
  { key: 'rewards', label: 'Rewards', icon: 'trophy' },
  { key: 'refunds', label: 'Refunds', icon: 'undo' },
];

const AdminScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  const { isDark, colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [actionBusy, setActionBusy] = useState(null);
  const [spotlightList, setSpotlightList] = useState([]);
  const [spotlightBusy, setSpotlightBusy] = useState(false);

  // management tabs
  const [contentKind, setContentKind] = useState('novel'); // 'novel' | 'manga'
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState([]);
  const [bazaarBooks, setBazaarBooks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [editTarget, setEditTarget] = useState(null); // {type, data}
  const [editSaving, setEditSaving] = useState(false);

  const pendingApplications = applications.filter((a) => !['approved', 'rejected'].includes(a.application_status)).length;
  const pendingRefunds = refunds.filter((r) => r.status === 'pending').length;

  // ---------------------------------------------------------------- admin gate
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isWalletConnected) {
        if (alive) { setIsAdmin(false); setAdminChecked(true); }
        return;
      }
      try {
        const { data } = await supabase
          .from('users')
          .select('"isSuperuser"')
          .eq('wallet_address', wallet?.publicKey?.toString())
          .maybeSingle();
        if (alive) { setIsAdmin(!!data?.isSuperuser); setAdminChecked(true); }
      } catch {
        if (alive) { setIsAdmin(false); setAdminChecked(true); }
      }
    })();
    return () => { alive = false; };
  }, [isWalletConnected, wallet?.publicKey]);

  // ------------------------------------------------------------------ loaders
  const loadOverview = useCallback(async () => {
    const count = (q) => q.then((r) => r.count || 0);
    const [users, novels, writers, artists, books, events, pendingApps, pendingRefs] = await Promise.all([
      count(supabase.from('users').select('id', { count: 'exact', head: true })),
      count(supabase.from('novels').select('id', { count: 'exact', head: true })),
      count(supabase.from('users').select('id', { count: 'exact', head: true }).eq('isWriter', true)),
      count(supabase.from('users').select('id', { count: 'exact', head: true }).eq('isArtist', true)),
      count(supabase.from('bazaar_books').select('id', { count: 'exact', head: true })),
      count(supabase.from('money_events').select('id', { count: 'exact', head: true })),
      count(supabase.from('creator_applications').select('id', { count: 'exact', head: true })
        .not('application_status', 'in', '("approved","rejected")')),
      count(supabase.from('bazaar_refund_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    ]);
    setStats({ users, novels, writers, artists, books, events, pendingApps, pendingRefs, creators: writers + artists });
  }, []);

  const loadApplications = useCallback(async () => {
    const { data, error } = await supabase
      .from('creator_applications')
      .select('*')
      .not('application_status', 'in', '("approved","rejected")')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    setApplications(data || []);
  }, []);

  const loadRewards = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, wallet_address, weekly_points')
      .order('weekly_points', { ascending: false })
      .limit(20);
    if (error) throw error;
    setRewards(data || []);
  }, []);

  const loadRefunds = useCallback(async () => {
    const { data: refundRows, error } = await supabase
      .from('bazaar_refund_requests')
      .select(`id, purchase_id, requested_by, requester_role, reason, status, resolution_note, created_at,
        bazaar_purchases(book_id, buyer_wallet, price_usd, currency, access_type,
          bazaar_books(title, author_name))`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const rows = refundRows || [];
    const purchaseIds = rows.map((r) => r.purchase_id).filter(Boolean);
    const statsByPurchase = {};
    if (purchaseIds.length > 0) {
      const { data: sessions } = await supabase
        .from('bazaar_read_sessions')
        .select('purchase_id, pages_read, max_page, total_pages, seconds_spent, file_type, created_at')
        .in('purchase_id', purchaseIds);
      (sessions || []).forEach((s) => {
        const agg = (statsByPurchase[s.purchase_id] ||= {
          sessions: 0, seconds: 0, pages: new Set(), maxPage: 0, totalPages: null,
        });
        agg.sessions += 1;
        agg.seconds += s.seconds_spent || 0;
        (s.pages_read || []).forEach((p) => agg.pages.add(p));
        if ((s.max_page || 0) > agg.maxPage) agg.maxPage = s.max_page;
        if (s.total_pages) agg.totalPages = s.total_pages;
      });
    }
    setRefunds(rows.map((r) => ({
      ...r,
      purchase: r.bazaar_purchases || null,
      book: r.bazaar_purchases?.bazaar_books || null,
      readStats: statsByPurchase[r.purchase_id] || null,
    })));
  }, []);

  const loadUsers = useCallback(async () => {
    // Emails are private: this server function only answers admins.
    const { data, error } = await supabase.rpc('admin_list_users', { p_limit: 200 });
    if (error) throw error;
    setUsers(data || []);
  }, []);

  const loadContent = useCallback(async (kind) => {
    const table = kind === 'novel' ? 'novels' : 'manga';
    const select = kind === 'novel'
      ? 'id, title, image, summary, user_id, is_visible, featured, spotlight_rank, viewers_count, status'
      : 'id, title, cover_image, summary, user_id, is_visible, featured, spotlight_rank, viewers_count, status';
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('title', { ascending: true })
      .limit(200);
    if (error) throw error;
    setContent((data || []).map((row) => ({ ...row, _kind: kind, _table: table })));
  }, []);

  const loadBazaarBooks = useCallback(async () => {
    const { data, error } = await supabase
      .from('bazaar_books')
      .select('id, title, author_name, author_id, file_type, status, sale_enabled, lending_enabled, price_usd, lend_price_smp, cover_url, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    setBazaarBooks(data || []);
  }, []);

  const loadAnnouncements = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, message, audience, is_superuser_announcement, release_date, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    setAnnouncements(data || []);
  }, []);

  const loadTab = useCallback(async (tab, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      await loadOverview();
      if (tab === 'applications') await loadApplications();
      else if (tab === 'rewards') await loadRewards();
      else if (tab === 'refunds') await loadRefunds();
      else if (tab === 'users') await loadUsers();
      else if (tab === 'content') await loadContent(contentKind);
      else if (tab === 'bazaar') await loadBazaarBooks();
      else if (tab === 'announcements') await loadAnnouncements();
    } catch (e) {
      console.error('[AdminScreen] load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadOverview, loadApplications, loadRewards, loadRefunds, loadUsers, loadContent, loadBazaarBooks, loadAnnouncements, contentKind]);

  useEffect(() => {
    if (isAdmin) loadTab(activeTab);
  }, [isAdmin, activeTab, loadTab]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTab(activeTab, { silent: true });
  };

  // switch novel/manga sub-tab
  const switchContentKind = (kind) => {
    if (kind === contentKind) return;
    setContentKind(kind);
    setSearch('');
    loadContent(kind).catch(() => {});
  };

  // ------------------------------------------------------------------ actions
  const handleApplication = async (app, approve) => {
    setActionBusy(app.id || app.user_id);
    try {
      const status = approve ? 'approved' : 'rejected';
      const { error: appError } = await supabase
        .from('creator_applications')
        .update({ application_status: status })
        .eq('user_id', app.user_id)
        .eq('role', app.role);
      if (appError) throw appError;

      if (approve) {
        const roleUpdate = app.role === 'writer' ? { isWriter: true } : app.role === 'artist' ? { isArtist: true } : {};
        if (Object.keys(roleUpdate).length) {
          const { error: roleError } = await supabase.from('users').update(roleUpdate).eq('id', app.user_id);
          if (roleError) console.warn('[AdminScreen] role grant failed:', roleError.message);
        }
      }

      toast.success(`Application ${approve ? 'approved' : 'rejected'}.`);
      await Promise.all([loadApplications(), loadOverview()]);
    } catch (e) {
      console.error('[AdminScreen] application action failed:', e?.message);
      toast.error(e?.message || 'Action failed');
    } finally {
      setActionBusy(null);
    }
  };

  const handleResolveRefund = async (refundId, action) => {
    setActionBusy(refundId);
    try {
      const result = await resolveRefund(refundId, action);
      if (!result.ok || result.data?.error) throw new Error(result.data?.error || 'Resolution failed');
      toast.success(`Refund request ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await Promise.all([loadRefunds(), loadOverview()]);
    } catch (e) {
      console.error('[AdminScreen] resolve refund failed:', e?.message);
      toast.error(e?.message || 'Failed to resolve refund');
    } finally {
      setActionBusy(null);
    }
  };

  // ---- content quick actions (no modal needed)
  const toggleContentVisibility = async (item) => {
    const next = !item.is_visible;
    setActionBusy(item.id);
    try {
      const { error } = await supabase.from(item._table).update({ is_visible: next }).eq('id', item.id);
      if (error) throw error;
      setContent((prev) => prev.map((c) => (c.id === item.id ? { ...c, is_visible: next } : c)));
    } catch (e) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setActionBusy(null);
    }
  };

  const toggleContentFeatured = async (item) => {
    const next = !item.featured;
    setActionBusy(item.id);
    try {
      const { error } = await supabase.from(item._kind === 'novel' ? 'novels' : 'manga').update({ featured: next }).eq('id', item.id);
      if (error) throw error;
      setContent((prev) => prev.map((c) => (c.id === item.id ? { ...c, featured: next } : c)));
    } catch (e) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setActionBusy(null);
    }
  };

  // ── Spotlight: admins pick up to 5 novels/manga for Home, in their order ──
  const SPOTLIGHT_MAX = 5;

  const loadSpotlight = useCallback(async () => {
    const [{ data: n, error: ne }, { data: m, error: me }] = await Promise.all([
      supabase.from('novels').select('id, title, is_visible, spotlight_rank').not('spotlight_rank', 'is', null),
      supabase.from('manga').select('id, title, is_visible, spotlight_rank').not('spotlight_rank', 'is', null),
    ]);
    if (ne || me) throw ne || me;
    const list = [
      ...(n || []).map((r) => ({ ...r, kind: 'novel' })),
      ...(m || []).map((r) => ({ ...r, kind: 'manga' })),
    ].sort((a, b) => a.spotlight_rank - b.spotlight_rank);
    setSpotlightList(list);
    return list;
  }, []);

  // Set one title's position (null = remove). Checks the change really stuck,
  // because the database quietly ignores spotlight changes from non-admins.
  const setSpotlightRank = async (kind, id, rank) => {
    const { data, error } = await supabase.from(kind === 'novel' ? 'novels' : 'manga')
      .update({ spotlight_rank: rank }).eq('id', id).select('spotlight_rank');
    if (error) throw error;
    if (!data?.length || (data[0].spotlight_rank ?? null) !== rank) {
      throw new Error('Only admins can change the spotlight');
    }
  };

  // Save positions 1..n for this list, then refresh what's on screen.
  const saveSpotlightOrder = async (list) => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].spotlight_rank !== i + 1) await setSpotlightRank(list[i].kind, list[i].id, i + 1);
    }
    const fresh = await loadSpotlight();
    const rankOf = new Map(fresh.map((p) => [`${p.kind}:${p.id}`, p.spotlight_rank]));
    setContent((prev) => prev.map((c) => ({ ...c, spotlight_rank: rankOf.get(`${c._kind}:${c.id}`) ?? null })));
  };

  const runSpotlight = async (fn, doneMessage) => {
    setSpotlightBusy(true);
    try {
      await fn();
      if (doneMessage) toast.success(doneMessage);
    } catch (e) {
      toast.error(e?.message || 'Couldn’t update the spotlight');
      loadSpotlight().catch(() => {});
    } finally {
      setSpotlightBusy(false);
    }
  };

  const moveSpotlight = (index, delta) => runSpotlight(async () => {
    const list = [...spotlightList];
    const j = index + delta;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    setSpotlightList(list); // feels instant; saved right after
    await saveSpotlightOrder(list);
  });

  const removeSpotlight = (p) => runSpotlight(async () => {
    await setSpotlightRank(p.kind, p.id, null);
    await saveSpotlightOrder(spotlightList.filter((x) => !(x.kind === p.kind && x.id === p.id)));
  }, 'Removed from the spotlight');

  const toggleSpotlight = (item) => {
    const inList = spotlightList.find((p) => p.kind === item._kind && p.id === item.id);
    if (inList || item.spotlight_rank != null) {
      return removeSpotlight(inList || { kind: item._kind, id: item.id });
    }
    if (spotlightList.length >= SPOTLIGHT_MAX) {
      toast.info(`The spotlight holds ${SPOTLIGHT_MAX} titles. Remove one first.`);
      return;
    }
    const position = spotlightList.length + 1;
    return runSpotlight(async () => {
      await setSpotlightRank(item._kind, item.id, position);
      await saveSpotlightOrder([...spotlightList, { kind: item._kind, id: item.id, spotlight_rank: position }]);
    }, `Added to the spotlight (#${position})`);
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'content') {
      loadSpotlight().catch((e) => console.error('[AdminScreen] spotlight load:', e?.message));
    }
  }, [isAdmin, activeTab, refreshing, loadSpotlight]);

  const setBazaarStatus = async (book, status) => {
    setActionBusy(book.id);
    try {
      const { error } = await supabase.from('bazaar_books').update({ status }).eq('id', book.id);
      if (error) throw error;
      setBazaarBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, status } : b)));
    } catch (e) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setActionBusy(null);
    }
  };

  const deleteAnnouncement = (ann) => {
    Alert.alert('Delete announcement?', `"${ann.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setActionBusy(ann.id);
          try {
            const { error } = await supabase.from('announcements').delete().eq('id', ann.id);
            if (error) throw error;
            setAnnouncements((prev) => prev.filter((a) => a.id !== ann.id));
          } catch (e) {
            toast.error(e?.message || 'Delete failed');
          } finally {
            setActionBusy(null);
          }
        },
      },
    ]);
  };

  // ------------------------------------------------------------------ edit modal
  const openEditor = (type, data) => setEditTarget({ type, data: { ...data } });

  const handleEditSave = async () => {
    if (!editTarget) return;
    const { type, data } = editTarget;
    setEditSaving(true);
    try {
      if (type === 'user') {
        const patch = {
          name: data.name?.trim() || null,
          weekly_points: Number(data.weekly_points) || 0,
          isWriter: !!data.isWriter,
          isArtist: !!data.isArtist,
          isSuperuser: !!data.isSuperuser,
        };
        const { error } = await supabase.from('users').update(patch).eq('id', data.id);
        if (error) throw error;
        setUsers((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...patch } : u)));
        loadOverview().catch(() => {});
      } else if (type === 'novel' || type === 'manga') {
        const patch = {
          title: data.title?.trim(),
          summary: data.description?.trim() || null,
          is_visible: !!data.is_visible,
          featured: !!data.featured,
        };
        const { error } = await supabase.from(type === 'novel' ? 'novels' : 'manga').update(patch).eq('id', data.id);
        if (error) throw error;
        setContent((prev) => prev.map((c) => (c.id === data.id ? { ...c, ...patch } : c)));
      } else if (type === 'bazaar') {
        const patch = {
          title: data.title?.trim(),
          author_name: data.author_name?.trim() || null,
          price_usd: Number(data.price_usd) || 1,
          lend_price_smp: Number(data.lend_price_smp) || 12500,
          sale_enabled: !!data.sale_enabled,
          lending_enabled: !!data.lending_enabled,
        };
        const { error } = await supabase.from('bazaar_books').update(patch).eq('id', data.id);
        if (error) throw error;
        setBazaarBooks((prev) => prev.map((b) => (b.id === data.id ? { ...b, ...patch } : b)));
      } else if (type === 'announcement') {
        const patch = {
          title: data.title?.trim(),
          message: data.message?.trim(),
          release_date: data.release_date || null,
        };
        const { error } = await supabase.from('announcements').update(patch).eq('id', data.id);
        if (error) throw error;
        setAnnouncements((prev) => prev.map((a) => (a.id === data.id ? { ...a, ...patch } : a)));
      }
      setEditTarget(null);
      toast.success('Changes applied.');
    } catch (e) {
      console.error('[AdminScreen] edit save failed:', e?.message);
      toast.error(e?.message || 'Save failed');
    } finally {
      setEditSaving(false);
    }
  };

  // ------------------------------------------------------------------ helpers
  const formatSeconds = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const shortWallet = (w) => (w ? `${String(w).slice(0, 6)}...${String(w).slice(-4)}` : '—');
  const displayName = (u) => u?.name || shortWallet(u?.wallet_address);

  const q = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) =>
    !q || [u.name, u.email, u.wallet_address].some((v) => String(v || '').toLowerCase().includes(q))
  );
  const filteredContent = content.filter((c) =>
    !q || String(c.title || '').toLowerCase().includes(q) || String(c.user_id || '').toLowerCase().includes(q)
  );
  const filteredBazaar = bazaarBooks.filter((b) =>
    !q || String(b.title || '').toLowerCase().includes(q) || String(b.author_name || '').toLowerCase().includes(q)
  );
  const filteredAnnouncements = announcements.filter((a) =>
    !q || String(a.title || '').toLowerCase().includes(q) || String(a.message || '').toLowerCase().includes(q)
  );

  const s = useCallback(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 12,
      backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.5 },
    headerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    iconBtn: {
      width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    },
    tabScroll: { flexGrow: 0 },
    tabBar: {
      flexDirection: 'row', marginHorizontal: 12, marginTop: 12, marginBottom: 4,
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.border,
    },
    tab: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, gap: 6,
    },
    tabActive: { backgroundColor: colors.accent },
    tabText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    tabTextActive: { color: colors.textPrimary },
    tabBadge: {
      minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
      backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
    },
    tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    searchWrap: { marginHorizontal: 16, marginTop: 8 },
    search: {
      backgroundColor: colors.bgCard, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontSize: 14,
    },
    subTabs: {
      flexDirection: 'row', marginHorizontal: 16, marginTop: 10,
      backgroundColor: colors.bgCard, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border,
    },
    subTab: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
    subTabActive: { backgroundColor: colors.accentSoft },
    subTabText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    subTabTextActive: { color: colors.accent },
    content: { flex: 1 },
    section: { padding: 16 },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: {
      width: '48%', backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    statTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statIconWrap: {
      width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
    statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    card: {
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    cardSub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
    cardMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 6 },
    roleChip: {
      alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 8, backgroundColor: colors.accentSoft,
    },
    roleChipText: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    miniChip: {
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
      backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
    },
    miniChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    miniChipText: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 },
    miniChipTextActive: { color: colors.textPrimary },
    actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    btn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, gap: 6,
      backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
    },
    btnApprove: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
    btnReject: { backgroundColor: colors.danger, borderColor: colors.danger },
    btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
    btnText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
    btnTextLight: { color: '#fff' },
    rankBadge: {
      width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
    },
    rankText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
    empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    emptyText: { fontSize: 14, color: colors.textMuted },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    centerText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
    // edit modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.bgElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 10, maxHeight: '85%',
      borderWidth: 1, borderColor: colors.border,
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 14 },
    fieldLabel: { fontSize: 11, fontWeight: '800', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginTop: 12, marginBottom: 5 },
    fieldInput: {
      backgroundColor: colors.bgCard, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontSize: 14,
    },
    fieldMultiline: { minHeight: 80, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  }), [colors, insets]);

  const st = s();

  // ------------------------------------------------------------------- gates
  if (!adminChecked) {
    return (
      <SafeAreaView style={[st.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!isWalletConnected) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.center}>
          <FontAwesome5 name="shield-alt" size={44} color={colors.danger} />
          <Text style={st.centerText}>Connect your wallet to access admin</Text>
          <TouchableOpacity style={[st.btn, st.btnPrimary, { paddingHorizontal: 24 }]} onPress={() => navigation.navigate('WalletImport')}>
            <FontAwesome5 name="wallet" size={13} color="#fff" />
            <Text style={[st.btnText, st.btnTextLight]}>CONNECT WALLET</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.center}>
          <FontAwesome5 name="lock" size={44} color={colors.danger} />
          <Text style={st.centerText}>Admin access required</Text>
          <Text style={[st.centerText, { fontSize: 13 }]}>This account doesn't have admin privileges.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------- UI
  const statCards = stats ? [
    { icon: 'users', label: 'Users', value: stats.users, color: colors.accent },
    { icon: 'book', label: 'Novels', value: stats.novels, color: '#4da3ff' },
    { icon: 'user-tag', label: 'Creators', value: stats.creators, color: colors.gold },
    { icon: 'store', label: 'Bazaar Books', value: stats.books, color: colors.accent },
    { icon: 'coins', label: 'Money Events', value: stats.events, color: '#22c55e' },
    { icon: 'user-plus', label: 'Pending Apps', value: stats.pendingApps, color: '#b48cff' },
    { icon: 'undo', label: 'Pending Refunds', value: stats.pendingRefs, color: colors.danger },
  ] : [];

  const needsSearch = ['users', 'content', 'bazaar', 'announcements'].includes(activeTab);

  const renderEditField = (label, value, onChange, opts = {}) => (
    <View key={label}>
      <Text style={st.fieldLabel}>{label}</Text>
      <TextInput
        style={[st.fieldInput, opts.multiline && st.fieldMultiline]}
        value={value ?? ''}
        onChangeText={onChange}
        multiline={opts.multiline}
        keyboardType={opts.keyboardType || 'default'}
        placeholderTextColor={colors.textMuted}
        placeholder={opts.placeholder}
      />
    </View>
  );

  const renderToggleChips = (options, values, onToggle) => (
    <View style={st.chipRow}>
      {options.map((o) => {
        const active = values[o.key];
        return (
          <TouchableOpacity
            key={o.key}
            style={[st.miniChip, active && st.miniChipActive]}
            onPress={() => onToggle(o.key, !active)}
          >
            <Text style={[st.miniChipText, active && st.miniChipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={st.container} edges={[]}>
      <View style={st.header}>
        <View>
          <Text style={st.headerTitle}>Admin</Text>
          <Text style={st.headerSub}>Sempai HQ control panel</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={st.iconBtn} onPress={onRefresh} accessibilityLabel="Refresh">
            <FontAwesome5 name="sync-alt" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={st.iconBtn} onPress={() => navigation.navigate('Home')} accessibilityLabel="Home">
            <FontAwesome5 name="home" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabScroll} contentContainerStyle={{ paddingHorizontal: 12 }}>
        <View style={st.tabBar}>
          {TABS.map((t) => {
            const badge = t.key === 'applications' ? pendingApplications : t.key === 'refunds' ? pendingRefunds : 0;
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[st.tab, active && st.tabActive]}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.8}
              >
                <FontAwesome5 name={t.icon} size={12} color={active ? colors.textPrimary : colors.textMuted} />
                <Text style={[st.tabText, active && st.tabTextActive]}>{t.label}</Text>
                {badge > 0 && (
                  <View style={st.tabBadge}>
                    <Text style={st.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {needsSearch && (
        <View style={st.searchWrap}>
          <TextInput
            style={st.search}
            placeholder={activeTab === 'users' ? 'Search name, email or wallet…' : activeTab === 'content' ? 'Search title…' : activeTab === 'bazaar' ? 'Search title or author…' : 'Search announcements…'}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}

      {activeTab === 'content' && (
        <View style={st.subTabs}>
          {[{ key: 'novel', label: 'Novels' }, { key: 'manga', label: 'Manga' }].map((k) => (
            <TouchableOpacity key={k.key} style={[st.subTab, contentKind === k.key && st.subTabActive]} onPress={() => switchContentKind(k.key)}>
              <Text style={[st.subTabText, contentKind === k.key && st.subTabTextActive]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        style={st.content}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 8) + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {loading && !stats ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 13 }}>Loading…</Text>
          </View>
        ) : (
          <View style={st.section}>
            {activeTab === 'overview' && (
              <>
                <Text style={st.sectionTitle}>Platform Stats</Text>
                <View style={st.statGrid}>
                  {statCards.map((c) => (
                    <View key={c.label} style={st.statCard}>
                      <View style={st.statTop}>
                        <View style={[st.statIconWrap, { backgroundColor: `${c.color}22` }]}>
                          <FontAwesome5 name={c.icon} size={14} color={c.color} />
                        </View>
                      </View>
                      <Text style={st.statValue}>{c.value.toLocaleString()}</Text>
                      <Text style={st.statLabel}>{c.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {activeTab === 'applications' && (
              <>
                <Text style={st.sectionTitle}>Creator Applications</Text>
                {applications.length === 0 ? (
                  <View style={st.empty}>
                    <FontAwesome5 name="check-circle" size={36} color={colors.textMuted} />
                    <Text style={st.emptyText}>No pending applications</Text>
                  </View>
                ) : (
                  applications.map((app) => {
                    const busy = actionBusy === (app.id || app.user_id);
                    return (
                      <View key={app.id || `${app.user_id}-${app.role}`} style={st.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={st.cardTitle}>{app.name || 'Anonymous'}</Text>
                          <View style={st.roleChip}>
                            <Text style={st.roleChipText}>{(app.role || 'creator').toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={st.cardSub}>{app.email || 'No email'}</Text>
                        {app.reason ? <Text style={st.cardSub}>“{app.reason}”</Text> : null}
                        {app.submission_link ? (
                          <Text style={st.cardMeta} numberOfLines={1}>Link: {app.submission_link}</Text>
                        ) : null}
                        <Text style={st.cardMeta}>
                          Applied {app.created_at ? new Date(app.created_at).toLocaleDateString() : ''}
                          {app.application_status && app.application_status !== 'pending' ? ` · ${app.application_status}` : ''}
                        </Text>
                        {!['approved', 'rejected'].includes(app.application_status) && (
                          <View style={st.actions}>
                            <TouchableOpacity
                              style={[st.btn, st.btnApprove, busy && { opacity: 0.5 }]}
                              disabled={busy}
                              onPress={() => handleApplication(app, true)}
                            >
                              {busy ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="check" size={12} color="#fff" />}
                              <Text style={[st.btnText, st.btnTextLight]}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[st.btn, st.btnReject, busy && { opacity: 0.5 }]}
                              disabled={busy}
                              onPress={() => handleApplication(app, false)}
                            >
                              <FontAwesome5 name="times" size={12} color="#fff" />
                              <Text style={[st.btnText, st.btnTextLight]}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'users' && (
              <>
                <Text style={st.sectionTitle}>Users ({filteredUsers.length})</Text>
                {filteredUsers.length === 0 ? (
                  <View style={st.empty}>
                    <FontAwesome5 name="users" size={36} color={colors.textMuted} />
                    <Text style={st.emptyText}>No users found</Text>
                  </View>
                ) : (
                  filteredUsers.map((u) => (
                    <View key={u.id} style={st.card}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={st.cardTitle} numberOfLines={1}>{displayName(u)}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.gold }}>{Number(u.weekly_points || 0).toLocaleString()} pts</Text>
                      </View>
                      <Text style={st.cardSub} numberOfLines={1}>{u.email || 'No email'}</Text>
                      <Text style={st.cardMeta}>{shortWallet(u.wallet_address)}</Text>
                      <View style={st.chipRow}>
                        {!!u.isWriter && <View style={st.roleChip}><Text style={st.roleChipText}>WRITER</Text></View>}
                        {!!u.isArtist && <View style={st.roleChip}><Text style={st.roleChipText}>ARTIST</Text></View>}
                        {!!u.isSuperuser && <View style={[st.roleChip, { backgroundColor: `${colors.danger}22` }]}><Text style={[st.roleChipText, { color: colors.danger }]}>ADMIN</Text></View>}
                      </View>
                      <View style={st.actions}>
                        <TouchableOpacity style={[st.btn, st.btnPrimary]} onPress={() => openEditor('user', u)}>
                          <FontAwesome5 name="edit" size={11} color="#fff" />
                          <Text style={[st.btnText, st.btnTextLight]}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {activeTab === 'content' && (
              <>
                <Text style={st.sectionTitle}>Spotlight order ({spotlightList.length}/5)</Text>
                <View style={st.card}>
                  {spotlightList.length === 0 ? (
                    <Text style={st.cardSub}>
                      Nothing picked — Home chooses automatically. Tap “Spotlight” on any novel or manga below to add it.
                    </Text>
                  ) : (
                    spotlightList.map((p, i) => (
                      <View
                        key={`${p.kind}-${p.id}`}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10,
                          borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border }}
                      >
                        <Text style={{ width: 26, fontSize: 16, fontWeight: '900', color: colors.accent }}>#{i + 1}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={st.cardTitle} numberOfLines={1}>{p.title || 'Untitled'}</Text>
                          <Text style={st.cardMeta}>{p.kind === 'novel' ? 'NOVEL' : 'MANGA'}{p.is_visible === false ? ' · HIDDEN (won’t show)' : ''}</Text>
                        </View>
                        {[
                          { icon: 'arrow-up', label: `Move ${p.title} up`, on: () => moveSpotlight(i, -1), off: i === 0 },
                          { icon: 'arrow-down', label: `Move ${p.title} down`, on: () => moveSpotlight(i, 1), off: i === spotlightList.length - 1 },
                          { icon: 'times', label: `Remove ${p.title} from the spotlight`, on: () => removeSpotlight(p) },
                        ].map((b) => (
                          <TouchableOpacity
                            key={b.icon}
                            onPress={b.on}
                            disabled={!!b.off || spotlightBusy}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={b.label}
                            style={[st.btn, { paddingHorizontal: 10 }, (b.off || spotlightBusy) && { opacity: 0.35 }]}
                          >
                            <FontAwesome5 name={b.icon} size={12} color={b.icon === 'times' ? colors.danger : colors.textSecondary} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))
                  )}
                </View>

                <Text style={st.sectionTitle}>{contentKind === 'novel' ? 'Novels' : 'Manga'} ({filteredContent.length})</Text>
                {filteredContent.length === 0 ? (
                  <View style={st.empty}>
                    <FontAwesome5 name="book-open" size={36} color={colors.textMuted} />
                    <Text style={st.emptyText}>No {contentKind === 'novel' ? 'novels' : 'manga'} found</Text>
                  </View>
                ) : (
                  filteredContent.map((item) => {
                    const busy = actionBusy === item.id;
                    return (
                      <View key={item.id} style={st.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={st.cardTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                          <View style={[st.roleChip, { backgroundColor: item.is_visible ? `${colors.accent}22` : `${colors.danger}22` }]}>
                            <Text style={[st.roleChipText, { color: item.is_visible ? colors.accent : colors.danger }]}>
                              {item.is_visible ? 'LIVE' : 'HIDDEN'}
                            </Text>
                          </View>
                        </View>
                        <Text style={st.cardMeta}>
                          by {shortWallet(item.user_id)}
                          {item.viewers_count != null ? ` · ${Number(item.viewers_count).toLocaleString()} views` : ''}
                          {item.featured ? ' · FEATURED' : ''}
                          {item.spotlight_rank != null ? ` · SPOTLIGHT #${item.spotlight_rank}` : ''}
                        </Text>
                        <View style={st.actions}>
                          <TouchableOpacity
                            style={[st.btn, busy && { opacity: 0.5 }]}
                            disabled={busy}
                            onPress={() => toggleContentVisibility(item)}
                          >
                            <FontAwesome5 name={item.is_visible ? 'eye-slash' : 'eye'} size={11} color={colors.textSecondary} />
                            <Text style={st.btnText}>{item.is_visible ? 'Hide' : 'Show'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[st.btn, busy && { opacity: 0.5 }]}
                            disabled={busy}
                            onPress={() => toggleContentFeatured(item)}
                          >
                            <FontAwesome5 name="star" size={11} color={item.featured ? colors.gold : colors.textSecondary} />
                            <Text style={st.btnText}>{item.featured ? 'Unfeature' : 'Feature'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[st.btn, busy && { opacity: 0.5 }]}
                            disabled={busy || spotlightBusy}
                            onPress={() => toggleSpotlight(item)}
                          >
                            <FontAwesome5 name="fire" size={11} color={item.spotlight_rank != null ? colors.accent : colors.textSecondary} />
                            <Text style={st.btnText}>{item.spotlight_rank != null ? 'Unspotlight' : 'Spotlight'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={st.btn} onPress={() => openEditor(item._kind, { ...item, description: item.summary || '' })}>
                            <FontAwesome5 name="edit" size={11} color={colors.textSecondary} />
                            <Text style={st.btnText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'bazaar' && (
              <>
                <Text style={st.sectionTitle}>Bazaar Books ({filteredBazaar.length})</Text>
                {filteredBazaar.length === 0 ? (
                  <View style={st.empty}>
                    <FontAwesome5 name="store" size={36} color={colors.textMuted} />
                    <Text style={st.emptyText}>No bazaar books found</Text>
                  </View>
                ) : (
                  filteredBazaar.map((book) => {
                    const busy = actionBusy === book.id;
                    return (
                      <View key={book.id} style={st.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={st.cardTitle} numberOfLines={1}>{book.title || 'Untitled'}</Text>
                          <View style={[st.roleChip, {
                            backgroundColor: book.status === 'active' ? `${colors.accent}22` : `${colors.danger}22`,
                          }]}>
                            <Text style={[st.roleChipText, { color: book.status === 'active' ? colors.accent : colors.danger }]}>
                              {String(book.status || 'active').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={st.cardSub}>
                          by {book.author_name || shortWallet(book.author_id)} · {String(book.file_type || '').toUpperCase()}
                          {book.price_usd != null ? ` · $${Number(book.price_usd).toFixed(2)}` : ''}
                          {book.lend_price_smp ? ` · ${Number(book.lend_price_smp).toLocaleString()} SMP lend` : ''}
                        </Text>
                        <Text style={st.cardMeta}>
                          {book.sale_enabled ? 'Sale ✓' : 'Sale ✗'} · {book.lending_enabled ? 'Lend ✓' : 'Lend ✗'}
                        </Text>
                        <View style={st.actions}>
                          {book.status !== 'active' ? (
                            <TouchableOpacity style={[st.btn, st.btnApprove, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => setBazaarStatus(book, 'active')}>
                              <FontAwesome5 name="play" size={11} color="#fff" />
                              <Text style={[st.btnText, st.btnTextLight]}>Activate</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity style={[st.btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => setBazaarStatus(book, 'paused')}>
                              <FontAwesome5 name="pause" size={11} color={colors.textSecondary} />
                              <Text style={st.btnText}>Pause</Text>
                            </TouchableOpacity>
                          )}
                          {book.status !== 'removed' && (
                            <TouchableOpacity style={[st.btn, st.btnReject, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => setBazaarStatus(book, 'removed')}>
                              <FontAwesome5 name="trash" size={11} color="#fff" />
                              <Text style={[st.btnText, st.btnTextLight]}>Remove</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={st.btn} onPress={() => openEditor('bazaar', book)}>
                            <FontAwesome5 name="edit" size={11} color={colors.textSecondary} />
                            <Text style={st.btnText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'announcements' && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={[st.sectionTitle, { marginBottom: 0 }]}>Announcements ({filteredAnnouncements.length})</Text>
                  <TouchableOpacity style={[st.btn, st.btnPrimary]} onPress={() => navigation.navigate('Announcements')}>
                    <FontAwesome5 name="plus" size={11} color="#fff" />
                    <Text style={[st.btnText, st.btnTextLight]}>Compose</Text>
                  </TouchableOpacity>
                </View>
                {filteredAnnouncements.length === 0 ? (
                  <View style={st.empty}>
                    <FontAwesome5 name="bullhorn" size={36} color={colors.textMuted} />
                    <Text style={st.emptyText}>No announcements yet</Text>
                  </View>
                ) : (
                  filteredAnnouncements.map((ann) => (
                    <View key={ann.id} style={st.card}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={st.cardTitle} numberOfLines={1}>{ann.title || 'Untitled'}</Text>
                        <View style={st.roleChip}>
                          <Text style={st.roleChipText}>{(ann.audience || 'all').toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={st.cardSub} numberOfLines={3}>{ann.message}</Text>
                      <Text style={st.cardMeta}>
                        {ann.created_at ? new Date(ann.created_at).toLocaleString() : ''}
                        {ann.is_superuser_announcement ? ' · admin' : ''}
                      </Text>
                      <View style={st.actions}>
                        <TouchableOpacity style={st.btn} onPress={() => openEditor('announcement', ann)}>
                          <FontAwesome5 name="edit" size={11} color={colors.textSecondary} />
                          <Text style={st.btnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[st.btn, st.btnReject]} disabled={actionBusy === ann.id} onPress={() => deleteAnnouncement(ann)}>
                          <FontAwesome5 name="trash" size={11} color="#fff" />
                          <Text style={[st.btnText, st.btnTextLight]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {activeTab === 'rewards' && (
              <>
                <Text style={st.sectionTitle}>Weekly Points Leaderboard</Text>
                {rewards.length === 0 ? (
                  <View style={st.empty}>
                    <FontAwesome5 name="trophy" size={36} color={colors.textMuted} />
                    <Text style={st.emptyText}>No rewards data yet</Text>
                  </View>
                ) : (
                  rewards.map((u, i) => (
                    <View key={u.id} style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                      <View style={st.rankBadge}>
                        <Text style={st.rankText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.cardTitle} numberOfLines={1}>{displayName(u)}</Text>
                        <Text style={st.cardMeta}>{shortWallet(u.wallet_address)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.gold }}>{Number(u.weekly_points || 0).toLocaleString()}</Text>
                        <Text style={st.cardMeta}>pts</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {activeTab === 'refunds' && (
              <>
                <Text style={st.sectionTitle}>Bazaar Refund Requests</Text>
                {refunds.length === 0 ? (
                  <View style={st.empty}>
                    <FontAwesome5 name="undo" size={36} color={colors.textMuted} />
                    <Text style={st.emptyText}>No refund requests</Text>
                  </View>
                ) : (
                  refunds.map((refund) => {
                    const statsAgg = refund.readStats;
                    const pagesList = statsAgg ? Array.from(statsAgg.pages).sort((a, b) => a - b) : [];
                    const busy = actionBusy === refund.id;
                    return (
                      <View key={refund.id} style={st.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={st.cardTitle} numberOfLines={1}>
                            {refund.book?.title || 'Unknown book'}
                          </Text>
                          <View style={[st.roleChip, { backgroundColor: refund.status === 'pending' ? `${colors.danger}22` : colors.accentSoft }]}>
                            <Text style={[st.roleChipText, { color: refund.status === 'pending' ? colors.danger : colors.accent }]}>
                              {refund.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        {refund.book?.author_name ? (
                          <Text style={st.cardSub}>by {refund.book.author_name}</Text>
                        ) : null}
                        <Text style={st.cardSub}>
                          {refund.requester_role === 'buyer' ? 'Buyer' : refund.requester_role === 'author' ? 'Author' : 'Admin'} request
                          {refund.purchase?.price_usd != null ? ` · $${Number(refund.purchase.price_usd).toFixed(2)} ${refund.purchase.currency || ''}` : ''}
                          {refund.purchase?.buyer_wallet ? ` · ${shortWallet(refund.purchase.buyer_wallet)}` : ''}
                        </Text>
                        {refund.reason ? <Text style={st.cardSub}>“{refund.reason}”</Text> : null}
                        <Text style={st.cardMeta}>
                          Requested {refund.created_at ? new Date(refund.created_at).toLocaleString() : ''}
                        </Text>
                        <Text style={st.cardMeta}>
                          {statsAgg
                            ? `Read: ${statsAgg.sessions} session${statsAgg.sessions === 1 ? '' : 's'} · ${formatSeconds(statsAgg.seconds)} · reached ${statsAgg.maxPage || '—'}${statsAgg.totalPages ? `/${statsAgg.totalPages}` : ''} page${statsAgg.pages.size === 1 ? '' : 's'} (${pagesList.slice(0, 12).join(', ')}${pagesList.length > 12 ? '…' : ''})`
                            : 'Read: no sessions — buyer never opened the file'}
                        </Text>
                        {refund.resolution_note ? (
                          <Text style={st.cardMeta}>Note: {refund.resolution_note}</Text>
                        ) : null}
                        {refund.status === 'pending' && (
                          <View style={st.actions}>
                            <TouchableOpacity
                              style={[st.btn, st.btnApprove, busy && { opacity: 0.5 }]}
                              disabled={busy}
                              onPress={() => handleResolveRefund(refund.id, 'approve')}
                            >
                              {busy ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="check" size={12} color="#fff" />}
                              <Text style={[st.btnText, st.btnTextLight]}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[st.btn, st.btnReject, busy && { opacity: 0.5 }]}
                              disabled={busy}
                              onPress={() => handleResolveRefund(refund.id, 'reject')}
                            >
                              <FontAwesome5 name="times" size={12} color="#fff" />
                              <Text style={[st.btnText, st.btnTextLight]}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* ------------------------------ edit modal ------------------------------ */}
      <Modal visible={!!editTarget} transparent animationType="slide" onRequestClose={() => setEditTarget(null)}>
        <KeyboardAvoidingView style={st.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => !editSaving && setEditTarget(null)} />
          <View style={st.modalCard}>
            {editTarget && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={st.modalTitle}>
                  Edit {editTarget.type === 'user' ? 'User' : editTarget.type === 'novel' ? 'Novel' : editTarget.type === 'manga' ? 'Manga' : editTarget.type === 'bazaar' ? 'Bazaar Book' : 'Announcement'}
                </Text>

                {editTarget.type === 'user' && (
                  <>
                    {renderEditField('Display name', editTarget.data.name, (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, name: v } })))}
                    {renderEditField('Weekly points', String(editTarget.data.weekly_points ?? 0), (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, weekly_points: v } })), { keyboardType: 'numeric' })}
                    <Text style={st.fieldLabel}>Roles</Text>
                    {renderToggleChips(
                      [{ key: 'isWriter', label: 'WRITER' }, { key: 'isArtist', label: 'ARTIST' }, { key: 'isSuperuser', label: 'ADMIN' }],
                      editTarget.data,
                      (key, val) => setEditTarget((t) => ({ ...t, data: { ...t.data, [key]: val } }))
                    )}
                    <Text style={[st.cardMeta, { marginTop: 8 }]}>{editTarget.data.email || ''} · {shortWallet(editTarget.data.wallet_address)}</Text>
                  </>
                )}

                {(editTarget.type === 'novel' || editTarget.type === 'manga') && (
                  <>
                    {renderEditField('Title', editTarget.data.title, (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, title: v } })))}
                    {renderEditField('Summary', editTarget.data.description, (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, description: v } })), { multiline: true })}
                    <Text style={st.fieldLabel}>Visibility</Text>
                    {renderToggleChips(
                      [{ key: 'is_visible', label: 'VISIBLE' }, { key: 'featured', label: 'FEATURED' }],
                      editTarget.data,
                      (key, val) => setEditTarget((t) => ({ ...t, data: { ...t.data, [key]: val } }))
                    )}
                  </>
                )}

                {editTarget.type === 'bazaar' && (
                  <>
                    {renderEditField('Title', editTarget.data.title, (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, title: v } })))}
                    {renderEditField('Author name', editTarget.data.author_name, (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, author_name: v } })))}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>{renderEditField('Price (USD)', String(editTarget.data.price_usd ?? 1), (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, price_usd: v } })), { keyboardType: 'decimal-pad' })}</View>
                      <View style={{ flex: 1 }}>{renderEditField('Lend (SMP)', String(editTarget.data.lend_price_smp ?? 12500), (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, lend_price_smp: v } })), { keyboardType: 'numeric' })}</View>
                    </View>
                    <Text style={st.fieldLabel}>Availability</Text>
                    {renderToggleChips(
                      [{ key: 'sale_enabled', label: 'SALE' }, { key: 'lending_enabled', label: 'LENDING' }],
                      editTarget.data,
                      (key, val) => setEditTarget((t) => ({ ...t, data: { ...t.data, [key]: val } }))
                    )}
                  </>
                )}

                {editTarget.type === 'announcement' && (
                  <>
                    {renderEditField('Title', editTarget.data.title, (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, title: v } })))}
                    {renderEditField('Message', editTarget.data.message, (v) => setEditTarget((t) => ({ ...t, data: { ...t.data, message: v } })), { multiline: true })}
                  </>
                )}

                <View style={st.modalActions}>
                  <TouchableOpacity style={[st.btn, { flex: 1 }]} disabled={editSaving} onPress={() => setEditTarget(null)}>
                    <Text style={st.btnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.btn, st.btnPrimary, { flex: 1 }, editSaving && { opacity: 0.5 }]} disabled={editSaving} onPress={handleEditSave}>
                    {editSaving ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="save" size={12} color="#fff" />}
                    <Text style={[st.btnText, st.btnTextLight]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default AdminScreen;
