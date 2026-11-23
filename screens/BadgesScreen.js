import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { View, Text, FlatList, ScrollView, Pressable, Image, ActivityIndicator, Modal, SafeAreaView, TextInput } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase, FUNCTIONS_URL } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getBadgesStyles, getBadgesPalette, TIER_COLORS } from '../styles/BadgesStyles';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token';
import {
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
  RPC_URL,
  USDC_DECIMALS,
  SKR_DECIMALS,
} from '../constants';
import { toast } from '../components/Toast';
import { GelModal } from '../components/gel/GelKit';

const connection = new Connection(RPC_URL, 'confirmed');
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const TREASURY_WALLET = new PublicKey('71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD');
const EDGE_FUNCTION_URL = `${FUNCTIONS_URL}/benefactor-payment`;

const CURRENCIES = [
  { key: 'USDC', icon: 'dollar-sign', decimals: 2 },
  { key: 'SOL', icon: 'coins', decimals: 4 },
  { key: 'SKR', icon: 'gem', decimals: 2 },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'complete', label: 'Complete' },
];

const getBadgeImage = (badge) => {
  if (badge?.image_url && badge.image_url !== 'local') return { uri: badge.image_url };
  switch (badge?.type?.toLowerCase()) {
    case 'gold':
      return require('../assets/plan-image/Gold.png');
    case 'silver':
      return require('../assets/plan-image/Sliver.png');
    case 'iron':
      return require('../assets/plan-image/Black.png');
    case 'pioneer':
      return require('../assets/badges/pioneer.webp');
    case 'seeker':
      return require('../assets/badges/seeker.webp');
    default:
      return require('../assets/plan-image/Blue.png');
  }
};

const buildDefaultBadges = (writerId) => [
  { id: `default-blue-${writerId}`, name: 'Blue Badge', description: 'Unlock 3 chapters', price: 1, type: 'blue' },
  { id: `default-iron-${writerId}`, name: 'Iron Badge', description: 'Unlock 6 chapters', price: 2, type: 'iron' },
  { id: `default-silver-${writerId}`, name: 'Silver Badge', description: 'Unlock 10 chapters', price: 3, type: 'silver' },
  { id: `default-gold-${writerId}`, name: 'Gold Badge', description: 'Unlock all chapters', price: 5, type: 'gold' },
].map((b) => ({ ...b, image_url: 'local', writer_id: writerId }));

const formatCount = (n = 0) => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};

const BadgesScreen = () => {
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const signAndSendTransaction = walletContext?.signAndSendTransaction;
  const activePublicKey = wallet?.publicKey;
  const activeWalletAddress = activePublicKey?.toString();
  const isWalletConnected = !!activePublicKey;

  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const routeWriterId = route.params?.writerId;
  const { isDark } = useTheme();
  const styles = useMemo(() => getBadgesStyles(isDark), [isDark]);
  const p = useMemo(() => getBadgesPalette(isDark), [isDark]);

  // list state
  const [tab, setTab] = useState('writers');
  const [writers, setWriters] = useState([]);
  const [writersLoading, setWritersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userBadges, setUserBadges] = useState([]);
  const [writerNameByIdState, setWriterNameByIdState] = useState({});

  // sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetView, setSheetView] = useState('writer'); // 'writer' | 'checkout'
  const [selectedWriter, setSelectedWriter] = useState(null);
  const [writerBadges, setWriterBadges] = useState([]);
  const [activeSub, setActiveSub] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // checkout state
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USDC');
  const [isProcessing, setIsProcessing] = useState(false);

  // balances
  const [solBalance, setSolBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [skrBalance, setSkrBalance] = useState(0);
  const [solPrice, setSolPrice] = useState(0);

  const detailRequest = useRef(0);
  const autoOpened = useRef(false);

  // ---------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------

  const fetchWriters = useCallback(async () => {
    try {
      const { data: writersData, error } = await supabase
        .from('users')
        .select('id, name, wallet_address, image')
        .eq('isWriter', true)
        .order('name', { ascending: true });
      if (error) throw error;

      const ids = (writersData || []).map((w) => w.id);
      let novels = [];
      if (ids.length) {
        const { data: novelsData, error: novelsError } = await supabase
          .from('novels')
          .select('id, user_id, title, status, image, viewers_count')
          .in('user_id', ids)
          .eq('is_visible', true);
        if (novelsError) throw novelsError;
        novels = novelsData || [];
      }

      setWriters(
        (writersData || []).map((writer) => {
          const own = novels
            .filter((n) => n.user_id === writer.id)
            .sort((a, b) => (b.viewers_count || 0) - (a.viewers_count || 0));
          return {
            ...writer,
            novels: own,
            novelCount: own.length,
            totalViewers: own.reduce((sum, n) => sum + (n.viewers_count || 0), 0),
            hasOngoing: own.some((n) => n.status === 'ongoing'),
            hasComplete: own.some((n) => n.status === 'complete'),
          };
        })
      );
    } catch (error) {
      console.error('[BadgesScreen] Error fetching writers:', error);
    } finally {
      setWritersLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchUserBadges = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select('*, badges(*)')
        .eq('user_id', user.id);
      if (error) throw error;
      
      // Fetch pioneer creators separately
      const { data: pioneerData, error: pioneerError } = await supabase
        .from('pioneer_creators')
        .select('*, creator:creator_id(id, name, wallet_address)')
        .eq('user_id', user.id);
      
      if (!pioneerError && pioneerData) {
        // Convert pioneer relationships to badge-like objects
        const pioneerBadges = pioneerData.map(p => ({
          id: `pioneer-${p.creator_id}`,
          user_id: user.id,
          badge_id: `pioneer-${p.creator_id}`,
          acquired_at: p.first_payment_at,
          badges: {
            name: `Pioneer of ${p.creator?.name || 'Unknown'}`,
            description: `First reader to support ${p.creator?.name || 'this writer'}`,
            type: 'pioneer',
            image_url: 'local',
            writer_id: p.creator_id, // Add writer_id so it can be looked up
          },
        }));
        
        // Add writer names to the writerNameById map
        pioneerData.forEach(p => {
          if (p.creator?.name) {
            setWriterNameByIdState(prev => ({ ...prev, [p.creator_id]: p.creator.name }));
          }
        });
        
        setUserBadges([...(data || []), ...pioneerBadges]);
      } else {
        setUserBadges(data || []);
      }
    } catch (error) {
      console.error('[BadgesScreen] Error fetching user badges:', error);
    }
  }, [user?.id]);

  const fetchSolPrice = useCallback(async () => {
    try {
      const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
      const data = await response.json();
      const price = data?.data?.[SOL_MINT]?.price ?? data?.[SOL_MINT]?.usdPrice;
      setSolPrice(price || 150);
    } catch (error) {
      console.error('[BadgesScreen] Error fetching SOL price:', error);
      setSolPrice(150);
    }
  }, []);

  const readTokenBalance = async (mintAddress, decimals) => {
    const ata = getAssociatedTokenAddressSync(new PublicKey(mintAddress), activePublicKey);
    const info = await connection.getAccountInfo(ata);
    return info ? Number(info.data.readBigUInt64LE(64)) / 10 ** decimals : 0;
  };

  const fetchBalances = useCallback(async () => {
    if (!activePublicKey) return;
    try {
      const [sol, usdc, skr] = await Promise.all([
        connection.getBalance(activePublicKey),
        readTokenBalance(USDC_MINT_ADDRESS, USDC_DECIMALS),
        readTokenBalance(SKR_MINT_ADDRESS, SKR_DECIMALS),
      ]);
      setSolBalance(sol / 1e9);
      setUsdcBalance(usdc);
      setSkrBalance(skr);
    } catch (error) {
      console.error('[BadgesScreen] Error fetching balances:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWalletAddress]);

  // Loads everything the writer sheet needs: badges + active subscription.
  // Guarded by a request id so a slow response can never overwrite a newer one.
  const loadWriterDetail = useCallback(
    async (writer) => {
      const requestId = ++detailRequest.current;
      setDetailLoading(true);
      try {
        const [badgesRes, subRes] = await Promise.all([
          supabase
            .from('badges')
            .select('*')
            .eq('writer_id', writer.id)
            .order('price', { ascending: true }),
          activeWalletAddress
            ? supabase
                .from('writer_subscriptions')
                .select('*')
                .eq('benefactor_wallet', activeWalletAddress)
                .eq('writer_id', writer.id)
                .eq('is_active', true)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (requestId !== detailRequest.current) return;
        if (badgesRes.error) throw badgesRes.error;

        const custom = badgesRes.data || [];
        setWriterBadges(custom.length ? custom : buildDefaultBadges(writer.id));
        setActiveSub(subRes?.data || null);
      } catch (error) {
        console.error('[BadgesScreen] Error loading writer detail:', error);
        if (requestId === detailRequest.current) setWriterBadges(buildDefaultBadges(writer.id));
      } finally {
        if (requestId === detailRequest.current) setDetailLoading(false);
      }
    },
    [activeWalletAddress]
  );

  useEffect(() => {
    fetchWriters();
    fetchSolPrice();
  }, [fetchWriters, fetchSolPrice]);

  useEffect(() => {
    fetchUserBadges();
  }, [fetchUserBadges]);

  useEffect(() => {
    if (activeWalletAddress) fetchBalances();
  }, [activeWalletAddress, fetchBalances]);

  // Shared pull-to-refresh for both tabs.
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetchWriters(),
      fetchUserBadges(),
      fetchSolPrice(),
      activeWalletAddress ? fetchBalances() : Promise.resolve(),
    ]).finally(() => setRefreshing(false));
  }, [fetchWriters, fetchUserBadges, fetchSolPrice, fetchBalances, activeWalletAddress]);

  const openWriter = useCallback(
    (writer) => {
      setSelectedWriter(writer);
      setWriterBadges([]);
      setActiveSub(null);
      setSelectedBadge(null);
      setSheetView('writer');
      setSheetVisible(true);
      loadWriterDetail(writer);
    },
    [loadWriterDetail]
  );

  // Open the writer straight away when arriving from a chapter screen.
  useEffect(() => {
    if (!routeWriterId || autoOpened.current || writers.length === 0) return;
    const writer = writers.find((w) => w.id === routeWriterId);
    if (writer) {
      autoOpened.current = true;
      openWriter(writer);
    }
  }, [routeWriterId, writers, openWriter]);

  const closeSheet = () => {
    if (isProcessing) return;
    setSheetVisible(false);
    setSheetView('writer');
  };

  const handleBack = () => {
    if (isProcessing) return;
    if (sheetView === 'checkout') setSheetView('writer');
    else closeSheet();
  };

  // ---------------------------------------------------------------------
  // Purchase
  // ---------------------------------------------------------------------

  const price = Number(selectedBadge?.price) || 0;
  const quotes = { USDC: price, SKR: price, SOL: solPrice ? price / solPrice : 0 };
  const balances = { USDC: usdcBalance, SOL: solBalance, SKR: skrBalance };
  const currencyMeta = CURRENCIES.find((c) => c.key === selectedCurrency);
  const canPay = isWalletConnected && !isProcessing && !!selectedBadge && !activeSub;

  const handlePurchaseBadge = async () => {
    if (!selectedBadge) return;
    if (!activePublicKey) {
      toast.error('Wallet needed — Connect your wallet first.');
      return;
    }
    if (!signAndSendTransaction) {
      toast.error('Wallet not ready — Wallet not ready for transactions. Please reconnect.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. No double subscriptions
      const { data: existing } = await supabase
        .from('writer_subscriptions')
        .select('id')
        .eq('benefactor_wallet', activeWalletAddress)
        .eq('writer_id', selectedBadge.writer_id)
        .eq('is_active', true)
        .maybeSingle();
      if (existing) {
        throw new Error('You already have an active subscription to this writer. Please wait for it to expire.');
      }

      // 2. Work out the amount
      const badgePrice = Number(selectedBadge.price) || 0;
      let paymentMint = null;
      let paymentAmount = 0;
      let decimals = 9;

      if (selectedCurrency === 'USDC') {
        paymentMint = new PublicKey(USDC_MINT_ADDRESS);
        decimals = USDC_DECIMALS;
        paymentAmount = Math.round(badgePrice * 10 ** decimals);
      } else if (selectedCurrency === 'SKR') {
        paymentMint = new PublicKey(SKR_MINT_ADDRESS);
        decimals = SKR_DECIMALS;
        paymentAmount = Math.round(badgePrice * 10 ** decimals);
      } else if (selectedCurrency === 'SOL') {
        paymentAmount = Math.round((badgePrice / (solPrice || 150)) * 1e9);
      } else {
        throw new Error('Invalid currency');
      }

      // 3. Check the balance before asking the wallet to sign
      const userAta = paymentMint ? getAssociatedTokenAddressSync(paymentMint, activePublicKey) : null;

      if (!paymentMint) {
        const lamports = await connection.getBalance(activePublicKey);
        const required = paymentAmount + 10000; // fee buffer
        if (lamports < required) {
          throw new Error(
            `Insufficient SOL balance. You have ${(lamports / 1e9).toFixed(4)} SOL but need ${(required / 1e9).toFixed(4)} SOL. Try USDC or SKR instead.`
          );
        }
      } else {
        let ataInfo;
        try {
          ataInfo = await connection.getAccountInfo(userAta);
        } catch (e) {
          throw new Error(`Failed to check ${selectedCurrency} balance. Please try again.`);
        }
        if (!ataInfo) {
          throw new Error(`No ${selectedCurrency} account found. Please use another currency.`);
        }
        const raw = Number(ataInfo.data.readBigUInt64LE(64));
        if (raw < paymentAmount) {
          throw new Error(
            `Insufficient ${selectedCurrency} balance. You have ${(raw / 10 ** decimals).toFixed(2)} but need ${(paymentAmount / 10 ** decimals).toFixed(2)}.`
          );
        }
      }

      // 4. Build the transaction
      const transaction = new Transaction();
      if (!paymentMint) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: activePublicKey,
            toPubkey: TREASURY_WALLET,
            lamports: paymentAmount,
          })
        );
      } else {
        const treasuryAta = getAssociatedTokenAddressSync(paymentMint, TREASURY_WALLET, true);
        const treasuryInfo = await connection.getAccountInfo(treasuryAta);
        if (!treasuryInfo) {
          throw new Error(`Treasury ${selectedCurrency} account not found. Please contact support.`);
        }
        transaction.add(createTransferInstruction(userAta, treasuryAta, activePublicKey, paymentAmount));
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = activePublicKey;

      // 5. Sign, send, confirm
      const signature = await signAndSendTransaction(transaction);

      let confirmation;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          confirmation = await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed'
          );
          break;
        } catch (e) {
          if (attempt === 3) throw new Error('Transaction confirmation failed');
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      if (confirmation?.value?.err) {
        const text = JSON.stringify(confirmation.value.err);
        if (text.includes('insufficient') || text.includes('lamports')) {
          throw new Error('Insufficient balance. Please check your wallet balance and try again.');
        }
        throw new Error('Transaction failed on the blockchain');
      }

      // 6. Record the purchase (with retries)
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No access token available');

      let recorded = false;
      for (let retry = 0; retry < 3 && !recorded; retry++) {
        try {
          const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              writerId: selectedBadge.writer_id,
              badgeId: selectedBadge.id,
              planType: selectedBadge.type || 'blue',
              signature,
              userPublicKey: activeWalletAddress,
              currency: selectedCurrency,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Failed to record purchase');
          recorded = true;
        } catch (e) {
          console.error(`[BadgesScreen] Edge function attempt ${retry + 1} failed:`, e.message);
          if (retry < 2) await new Promise((r) => setTimeout(r, 1000 * (retry + 1)));
        }
      }
      if (!recorded) {
        throw new Error(
          `Payment sent but failed to record. Transaction signature: ${signature}. Please contact support with this signature.`
        );
      }

      // 7. Refresh and go back to the writer
      await Promise.all([fetchUserBadges(), fetchBalances(), loadWriterDetail(selectedWriter)]);
      setSheetView('writer');
      setSelectedBadge(null);
      toast.info(`Badge unlocked — ${`${selectedBadge.name} is now yours.`}`);
    } catch (error) {
      console.error('[BadgesScreen] Purchase error:', error.message);
      toast.error(`Purchase failed — ${error.message || 'Please try again.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------

  const filteredWriters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return writers.filter((w) => {
      if (q && !w.name?.toLowerCase().includes(q)) return false;
      if (statusFilter === 'ongoing') return w.hasOngoing;
      if (statusFilter === 'complete') return w.hasComplete;
      return true;
    });
  }, [writers, searchQuery, statusFilter]);

  const writerNameById = useMemo(() => {
    const map = { ...writerNameByIdState };
    writers.forEach((w) => (map[w.id] = w.name));
    return map;
  }, [writers, writerNameByIdState]);

  const ownedBadgeIds = useMemo(() => new Set(userBadges.map((ub) => ub.badge_id)), [userBadges]);

  const shortAddress = activeWalletAddress
    ? `${activeWalletAddress.slice(0, 4)}…${activeWalletAddress.slice(-4)}`
    : 'Not connected';

  // ---------------------------------------------------------------------
  // Small render helpers
  // ---------------------------------------------------------------------

  const Avatar = ({ name, image, large }) => {
    // Resize image to reduce data usage
    const imageSize = large ? 84 : 52;
    const optimizedImage = image ? `${image}?width=${imageSize}&height=${imageSize}&quality=60&format=webp` : null;

    return optimizedImage ? (
      <Image
        source={{ uri: optimizedImage }}
        style={[styles.avatar, large && styles.avatarLg]}
        resizeMode="cover"
      />
    ) : (
      <View style={[styles.avatar, large && styles.avatarLg]}>
        <Text style={[styles.avatarText, large && styles.avatarTextLg]}>
          {(name?.trim()?.charAt(0) || '?').toUpperCase()}
        </Text>
      </View>
    );
  };

  const StatusTags = ({ writer }) =>
    writer.hasOngoing || writer.hasComplete ? (
      <View style={styles.tagRow}>
        {writer.hasOngoing && (
          <View style={[styles.tag, styles.tagOngoing]}>
            <Text style={[styles.tagText, styles.tagTextOngoing]}>Ongoing</Text>
          </View>
        )}
        {writer.hasComplete && (
          <View style={[styles.tag, styles.tagComplete]}>
            <Text style={[styles.tagText, styles.tagTextComplete]}>Complete</Text>
          </View>
        )}
      </View>
    ) : null;

  const renderWriter = ({ item }) => (
    <Pressable
      style={({ pressed }) => [styles.writerCard, pressed && { opacity: 0.8 }]}
      onPress={() => openWriter(item)}
    >
      <Avatar name={item.name} image={item.image} />
      <View style={styles.writerInfo}>
        <Text style={styles.writerName} numberOfLines={1}>
          {item.name || 'Unknown writer'}
        </Text>
        <Text style={styles.writerMetaText}>
          {item.novelCount} {item.novelCount === 1 ? 'novel' : 'novels'} · {formatCount(item.totalViewers)} readers
        </Text>
        <StatusTags writer={item} />
      </View>
      <FontAwesome5 name="chevron-right" size={14} color={p.textMuted} />
    </Pressable>
  );

  const renderMyBadge = ({ item }) => (
    <View style={styles.mineCard}>
      <Image source={getBadgeImage(item.badges)} style={styles.mineImage} resizeMode="contain" />
      <Text style={styles.mineName}>{item.badges?.name || 'Badge'}</Text>
      <Text style={styles.mineWriter} numberOfLines={1}>
        {writerNameById[item.badges?.writer_id] || 'Writer'}
      </Text>
      <Text style={styles.mineDesc}>{item.badges?.description}</Text>
    </View>
  );

  const Empty = ({ icon, title, text, cta, onPress }) => (
    <View style={styles.emptyWrap}>
      <FontAwesome5 name={icon} size={32} color={p.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {cta && (
        <Pressable style={styles.emptyButton} onPress={onPress}>
          <Text style={styles.emptyButtonText}>{cta}</Text>
        </Pressable>
      )}
    </View>
  );

  // ---------------------------------------------------------------------
  // Sheet: writer view
  // ---------------------------------------------------------------------

  const renderWriterSheet = () => (
    <>
      <View style={styles.sheetTopBar}>
        <View style={{ width: 38 }} />
        <View style={{ flex: 1 }} />
        <Pressable style={styles.iconButton} onPress={closeSheet} hitSlop={8}>
          <FontAwesome5 name="times" size={16} color={p.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Avatar name={selectedWriter?.name} image={selectedWriter?.image} large />
          <Text style={styles.heroName}>{selectedWriter?.name || 'Unknown writer'}</Text>
          {selectedWriter && <StatusTags writer={selectedWriter} />}
          <View style={styles.heroStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{selectedWriter?.novelCount || 0}</Text>
              <Text style={styles.statLabel}>Novels</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatCount(selectedWriter?.totalViewers || 0)}</Text>
              <Text style={styles.statLabel}>Readers</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Novels</Text>
          {selectedWriter?.novels?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.novelScroll}>
              {selectedWriter.novels.map((novel) => (
                <Pressable
                  key={novel.id}
                  style={styles.novelCard}
                  onPress={() => {
                    setSheetVisible(false);
                    navigation.navigate('NovelDetail', { id: novel.id });
                  }}
                >
                  {novel.image ? (
                    <Image source={{ uri: novel.image }} style={styles.novelCover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.novelCover, styles.novelCoverPlaceholder]}>
                      <FontAwesome5 name="book" size={26} color={p.textMuted} />
                    </View>
                  )}
                  <Text style={styles.novelTitle} numberOfLines={2}>
                    {novel.title}
                  </Text>
                  <Text style={styles.novelStatus}>
                    {novel.status ? novel.status.charAt(0).toUpperCase() + novel.status.slice(1) : 'Unknown'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noticeText}>This writer has no published novels yet.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>

          {activeSub && (
            <View style={styles.banner}>
              <FontAwesome5 name="check-circle" size={16} color={p.success} />
              <Text style={styles.bannerText}>You have an active subscription to this writer.</Text>
            </View>
          )}

          {detailLoading ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator color={p.accentBright} />
            </View>
          ) : (
            writerBadges.map((badge) => {
              const owned = ownedBadgeIds.has(badge.id);
              const blocked = !!activeSub;
              return (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeRow,
                    { borderLeftColor: TIER_COLORS[badge.type?.toLowerCase()] || TIER_COLORS.blue },
                    owned && styles.badgeRowOwned,
                  ]}
                >
                  <Image source={getBadgeImage(badge)} style={styles.badgeRowImage} resizeMode="contain" />
                  <View style={styles.badgeRowInfo}>
                    <Text style={styles.badgeRowName}>{badge.name}</Text>
                    <Text style={styles.badgeRowDesc}>{badge.description}</Text>
                  </View>
                  {owned ? (
                    <View style={styles.ownedPill}>
                      <FontAwesome5 name="check-circle" size={14} color={p.goldBright} />
                      <Text style={styles.ownedPillText}>Owned</Text>
                    </View>
                  ) : (
                    <Pressable
                      disabled={blocked}
                      style={[styles.buyButton, blocked && styles.buyButtonDisabled]}
                      onPress={() => {
                        setSelectedBadge(badge);
                        setSheetView('checkout');
                      }}
                    >
                      <Text style={[styles.buyButtonText, blocked && styles.buyButtonTextDisabled]}>
                        ${Number(badge.price) || 0}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </>
  );

  // ---------------------------------------------------------------------
  // Sheet: checkout view
  // ---------------------------------------------------------------------

  const renderCheckoutSheet = () => {
    const payLabel = `${quotes[selectedCurrency].toFixed(currencyMeta.decimals)} ${selectedCurrency}`;
    return (
      <>
        <View style={styles.sheetTopBar}>
          <Pressable style={styles.iconButton} onPress={handleBack} hitSlop={8} disabled={isProcessing}>
            <FontAwesome5 name="chevron-left" size={16} color={p.textPrimary} />
          </Pressable>
          <Text style={styles.sheetTopTitle}>Checkout</Text>
          <Pressable style={styles.iconButton} onPress={closeSheet} hitSlop={8} disabled={isProcessing}>
            <FontAwesome5 name="times" size={16} color={p.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetScrollContent, { paddingTop: 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Image source={getBadgeImage(selectedBadge)} style={styles.summaryImage} resizeMode="contain" />
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryName}>{selectedBadge?.name}</Text>
              <Text style={styles.summaryWriter}>
                {selectedBadge?.description} · {selectedWriter?.name}
              </Text>
            </View>
            <Text style={styles.summaryPrice}>${price}</Text>
          </View>

          <Text style={styles.label}>Pay with</Text>
          {CURRENCIES.map((c) => {
            const selected = selectedCurrency === c.key;
            const low = isWalletConnected && balances[c.key] < quotes[c.key];
            return (
              <Pressable
                key={c.key}
                style={[styles.currencyRow, selected && styles.currencyRowSelected]}
                onPress={() => setSelectedCurrency(c.key)}
                disabled={isProcessing}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <FontAwesome5 name={c.icon} size={16} color={selected ? p.accentBright : p.textSecondary} />
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencyName}>{c.key}</Text>
                  <Text style={styles.currencyBalance}>
                    {isWalletConnected ? `Balance ${balances[c.key].toFixed(c.decimals)}` : 'Wallet not connected'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.currencyAmount}>{quotes[c.key].toFixed(c.decimals)}</Text>
                  {low && (
                    <View style={styles.lowTag}>
                      <Text style={styles.lowTagText}>Low balance</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}

          {!isWalletConnected && (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>Connect your wallet to complete this purchase.</Text>
            </View>
          )}
          {activeSub && (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>You already have an active subscription to this writer.</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>You pay</Text>
            <Text style={styles.totalValue}>{payLabel}</Text>
          </View>
          <Pressable
            style={[styles.confirmButton, !canPay && styles.confirmButtonDisabled]}
            onPress={handlePurchaseBadge}
            disabled={!canPay}
          >
            {isProcessing ? (
              <ActivityIndicator color={p.textOnAccent} />
            ) : (
              <Text style={styles.confirmText}>Pay {payLabel}</Text>
            )}
          </Pressable>
        </View>
      </>
    );
  };

  // ---------------------------------------------------------------------
  // Screen
  // ---------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Badges</Text>
          <Text style={styles.subtitle}>Support writers and unlock chapters</Text>
        </View>
        <View style={styles.walletChip}>
          <View style={[styles.walletDot, isWalletConnected && styles.walletDotOn]} />
          <Text style={styles.walletChipText}>{shortAddress}</Text>
        </View>
      </View>

      <View style={styles.segment}>
        {[
          { key: 'writers', label: 'Writers' },
          { key: 'mine', label: userBadges.length ? `My badges (${userBadges.length})` : 'My badges' },
        ].map((t) => (
          <Pressable
            key={t.key}
            style={[styles.segmentItem, tab === t.key && styles.segmentItemActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.segmentText, tab === t.key && styles.segmentTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'writers' ? (
        <>
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <FontAwesome5 name="search" size={14} color={p.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search writers"
                placeholderTextColor={p.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
          </View>
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.chip, statusFilter === f.key && styles.chipActive]}
                onPress={() => setStatusFilter(f.key)}
              >
                <Text style={[styles.chipText, statusFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>

          {writersLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={p.accentBright} />
            </View>
          ) : (
            <FlatList
              data={filteredWriters}
              keyExtractor={(w) => String(w.id)}
              renderItem={renderWriter}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListEmptyComponent={
                <Empty
                  icon="user-slash"
                  title="No writers found"
                  text="Try a different name or clear the filter."
                />
              }
            />
          )}
        </>
      ) : (
        <FlatList
          key="mine-grid"
          data={userBadges}
          keyExtractor={(ub) => String(ub.id)}
          renderItem={renderMyBadge}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <Empty
              icon="medal"
              title="No badges yet"
              text="Pick a writer you enjoy and unlock chapters with a badge."
              cta="Browse writers"
              onPress={() => setTab('writers')}
            />
          }
        />
      )}

      {/* One sheet, two views. Keeping a single Modal avoids the iOS issue where a second
          Modal can't present while the first is still dismissing. The sheet has a fixed height
          so the ScrollView inside has room to render. */}
      <GelModal visible={sheetVisible} onClose={closeSheet} variant="sheet" maxWidth={560} contentStyle={{ paddingHorizontal: 0, paddingTop: 18, paddingBottom: 0 }}>
        <View style={{ height: 560, maxHeight: '100%' }}>
          {sheetView === 'checkout' && selectedBadge ? renderCheckoutSheet() : renderWriterSheet()}
        </View>
      </GelModal>
    </SafeAreaView>
  );
};

export default BadgesScreen;