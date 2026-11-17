import React, { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Image,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, SUPABASE_URL } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { formatNumber } from '../utils/formatNumber';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  getAssociatedTokenAddressSync,
  unpackAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {
  RPC_URL,
  SMP_MINT_ADDRESS,
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
  TARGET_WALLET,
  MANGA_TREASURY_WALLET,
  SMP_DECIMALS,
  AMETHYST_MINT_ADDRESS,
  WEB_API_BASE_URL,
} from '../constants';
import bs58 from 'bs58';
import MangaCommentSection from '../components/MangaCommentSection';
import { useTheme } from '../context/ThemeContext';
import pioneerBadge from '../assets/Pioneer.png';
import {
  Screen, Tap, IconButton, GradientButton, GhostButton, Input, Field, Panel, Sheet, Toast,
  Skeleton, EmptyState, Divider, SectionHeader,
} from '../components/ui';
import { radius, space, glow, useMangaTheme } from '../theme/theme';
import { getStyles as getChapterStyles } from '../styles/MangaChapterStyles';
import { saveReadingProgress, getContentReadingProgress } from '../services/readingProgress';
import ScreenSkeleton from '../components/ScreenSkeleton';

const { width: SCREEN_W } = Dimensions.get('window');

/* ───────────── Reader page: full-width, auto aspect ratio, tap toggles controls ───────────── */
const ReaderPage = React.memo(({ uri, onPress }) => {
  const { colors } = useMangaTheme();
  const [ratio, setRatio] = useState(0.7);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w && h) setRatio(w / h);
      },
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  return (
    <Tap onPress={onPress} scaleTo={1} accessibilityLabel="Toggle reader controls">
      <View style={{ width: SCREEN_W, aspectRatio: ratio, backgroundColor: colors.surface }}>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" onLoad={() => setReady(true)} />
        {!ready ? (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </View>
    </Tap>
  );
});

/* ───────────── Paywall building blocks ───────────── */
const PayTile = ({ icon, color, title, amount, sub, onPress, disabled }) => {
  const mangaTheme = useMangaTheme();
  const { type } = mangaTheme;
  const styles = useMemo(() => getChapterStyles(mangaTheme), [mangaTheme]);
  return (
  <Tap onPress={onPress} disabled={disabled} style={[styles.payTile, disabled && { opacity: 0.45 }]} accessibilityLabel={`Unlock with ${title}`}>
    <View style={[styles.payIcon, { backgroundColor: color + '26' }]}>
      <Icon name={icon} size={14} color={color} solid />
    </View>
    <Text style={styles.payTitle}>{title}</Text>
    <Text style={styles.payAmount} numberOfLines={1} adjustsFontSizeToFit>{amount}</Text>
    <Text style={type.caption}>{sub}</Text>
  </Tap>
  );
};

const BundleCard = ({ icon, title, desc, usd, smp, ribbon, tone, onPress }) => {
  const mangaTheme = useMangaTheme();
  const styles = useMemo(() => getChapterStyles(mangaTheme), [mangaTheme]);
  return (
  <Tap onPress={onPress} scaleTo={0.985} style={{ marginBottom: space.md }} accessibilityLabel={`Unlock ${title}`}>
    <LinearGradient colors={tone} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bundle, glow(tone[1], 0.3)]}>
      <View style={styles.bundleIcon}>
        <Icon name={icon} size={18} color="#fff" solid />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bundleTitle}>{title}</Text>
        <Text style={styles.bundleDesc}>{desc}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.bundleUsd}>${usd.toFixed(2)}</Text>
        <Text style={styles.bundleSmp}>{smp} SMP</Text>
      </View>
      {ribbon ? (
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>{ribbon}</Text>
        </View>
      ) : null}
    </LinearGradient>
  </Tap>
  );
};

const PlanCard = ({ icon, title, desc, usd, days, best, solLabel, busy, onSol, onUsdc }) => {
  const mangaTheme = useMangaTheme();
  const { colors, gradients } = mangaTheme;
  const styles = useMemo(() => getChapterStyles(mangaTheme), [mangaTheme]);
  return (
  <View style={{ marginBottom: space.md }}>
    <LinearGradient
      colors={best ? gradients.sakura : gradients.electric}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.bundle, glow(best ? '#ff5c8a' : '#4cc9f0', 0.3)]}
    >
      <View style={styles.bundleIcon}>
        <Icon name={icon} size={18} color="#fff" solid />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bundleTitle}>{title}</Text>
        <Text style={styles.bundleDesc}>{desc}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.bundleUsd}>${usd.toFixed(2)}</Text>
        <Text style={styles.bundleSmp}>{days} days</Text>
      </View>
      {best ? (
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>BEST VALUE</Text>
        </View>
      ) : null}
    </LinearGradient>
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: -space.sm, paddingHorizontal: 4 }}>
      <Tap
        onPress={onSol}
        disabled={!!busy}
        style={[styles.planPayBtn, { flex: 1, opacity: busy ? 0.5 : 1 }]}
        accessibilityLabel={`Subscribe with SOL`}
      >
        {busy === 'SOL' ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="sun" size={13} color="#fff" solid />}
        <Text style={styles.planPayText}>SOL {solLabel}</Text>
      </Tap>
      <Tap
        onPress={onUsdc}
        disabled={!!busy}
        style={[styles.planPayBtn, { flex: 1, backgroundColor: colors.info + '33', borderColor: colors.info + '66', opacity: busy ? 0.5 : 1 }]}
        accessibilityLabel={`Subscribe with USDC`}
      >
        {busy === 'USDC' ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="dollar-sign" size={13} color={colors.info} solid />}
        <Text style={[styles.planPayText, { color: colors.info }]}>USDC ${usd.toFixed(2)}</Text>
      </Tap>
    </View>
  </View>
  );
};

const connection = new Connection(RPC_URL, 'confirmed');
const MERCHANT_WALLET = TARGET_WALLET;
const SMP_READ_COST = 1000; // Fixed cost for single chapter (server: record-manga-payment "smp_read")
const shortSigOf = (sig) => (sig ? `${String(sig).slice(0, 4)}…${String(sig).slice(-4)}` : '');
const threeChaptersSmp = 6480139; // Fixed $3 equivalent for 3 chapters
const fullChaptersSmp = 32400693; // Fixed $15 equivalent for all chapters

// Check if writer has SMP ATA
const checkWriterAta = async (writerWalletAddress) => {
  try {
    const smpMint = new PublicKey(SMP_MINT_ADDRESS);
    const writerATA = getAssociatedTokenAddressSync(smpMint, new PublicKey(writerWalletAddress));
    const ataInfo = await connection.getAccountInfo(writerATA);
    return ataInfo !== null;
  } catch (error) {
    return false; // ATA doesn't exist
  }
};

const fetchSolPrice = async () => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const text = await response.text();
    console.log('CoinGecko SOL Response:', text);
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
    const data = JSON.parse(text);
    return data.solana.usd || 150;
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    return 150;
  }
};

// Fetch fallback SMP price from web API (when Jupiter fails)
const fetchSmpFallbackPrice = async () => {
  try {
    const res = await fetch(`${WEB_API_BASE_URL}/api/smp-fallback-price`);
    if (!res.ok) {
      console.warn('[fetchSmpFallbackPrice] Web API unavailable');
      return null;
    }
    const data = await res.json();
    if (data?.fallbackPrice) {
      // Convert from SMP per USDC to USDC per SMP
      return 1 / data.fallbackPrice;
    }
    return null;
  } catch (err) {
    console.error('[fetchSmpFallbackPrice] Error:', err.message);
    return null;
  }
};

const MangaChapterScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { mangaId, chapterId } = route.params || {};
  const { isDark, colors: themeColors } = useTheme();
  const mangaTheme = useMangaTheme();
  const { colors, gradients, type } = mangaTheme;
  const styles = useMemo(() => getChapterStyles(mangaTheme), [mangaTheme]);
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const contextSignAndSend = walletContext?.signAndSendTransaction;

  const [manga, setManga] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [mangaOwner, setMangaOwner] = useState(null);
  const [pages, setPages] = useState([]);
  const [chapterPrice, setChapterPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [inputMangaId, setInputMangaId] = useState('');
  const [inputChapterId, setInputChapterId] = useState('');
  const [useInput, setUseInput] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [userId, setUserId] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [smpBalance, setSmpBalance] = useState(null);
  const [weeklyPoints, setWeeklyPoints] = useState(null);
  const [showTransactionPopup, setShowTransactionPopup] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [solPrice, setSolPrice] = useState(100);
  const [showPioneerModal, setShowPioneerModal] = useState(false);
  const [pioneerPayload, setPioneerPayload] = useState(null);
  const [currentCreatorId, setCurrentCreatorId] = useState(null);
  const [showAtaFundingModal, setShowAtaFundingModal] = useState(false);
  const [writerHasAta, setWriterHasAta] = useState(true);
  const [ataFundingCost, setAtaFundingCost] = useState(0);
  const [writerAtaAddress, setWriterAtaAddress] = useState(null);
  const [hasReadChapter, setHasReadChapter] = useState(false);
  const [amethystBalance, setAmethystBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [chapterList, setChapterList] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [subscribing, setSubscribing] = useState(null); // 'monthly-SOL' | 'days21-USDC' | ...
  const usdcPrice = 1;

  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = useMemo(() => {
    try {
      if (!wallet?.publicKey) return null;
      let publicKeyStr = wallet.publicKey;
      if (typeof publicKeyStr === 'string') {
        return new PublicKey(publicKeyStr);
      } else if (publicKeyStr instanceof Uint8Array || Array.isArray(publicKeyStr)) {
        return new PublicKey(bs58.encode(Buffer.from(publicKeyStr)));
      } else if (publicKeyStr instanceof PublicKey) {
        return publicKeyStr;
      }
      throw new Error('Invalid wallet.publicKey format');
    } catch (err) {
      console.error('Error creating activePublicKey:', err);
      setError('Invalid wallet public key format.');
      return null;
    }
  }, [wallet?.publicKey]);

  const activeWalletAddress = activePublicKey?.toString();

  // Sign via the embedded wallet context (same as SwapScreen/ChapterScreen).
  // Called with no password — the context shows its own auth modal or uses
  // biometrics, verifies the password, decrypts via wallet-encryption,
  // signs, broadcasts, and confirms. Returns the signature.
  const signAndSendTransaction = async (transaction) => {
    if (!contextSignAndSend) throw new Error('Wallet signing is not available. Please reconnect your wallet.');
    return contextSignAndSend(transaction);
  };

  const fetchAmethystBalance = useCallback(async () => {
    if (!activeWalletAddress) {
      setAmethystBalance(0);
      return;
    }

    try {
      const mintAddress = new PublicKey(AMETHYST_MINT_ADDRESS);
      const ataAddress = getAssociatedTokenAddressSync(mintAddress, new PublicKey(activeWalletAddress));
      const ataInfo = await connection.getAccountInfo(ataAddress);
      let balance = 0;
      if (ataInfo) {
        const ata = unpackAccount(ataAddress, ataInfo);
        balance = Number(ata.amount) / 10 ** SMP_DECIMALS;
      }
      setAmethystBalance(balance);
    } catch (error) {
      console.error('Error fetching Amethyst balance:', error);
      setError('Failed to fetch Amethyst balance.');
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress]);

  const fetchPrices = useCallback(async (retryCount = 3, retryDelay = 1000) => {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const solResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solData = await solResponse.json();
        setSolPrice(solData.solana?.usd || 100);
        return;
      } catch (error) {
        console.error(`Attempt ${attempt} - Error fetching prices:`, error);
        if (attempt === retryCount) {
          setError('Failed to fetch price data. Using default values.');
          setSolPrice(100);
          setTimeout(() => setError(null), 5000);
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }, []);

  const fetchUserBalances = useCallback(async () => {
    if (!activeWalletAddress) return;
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, weekly_points')
        .eq('wallet_address', activeWalletAddress)
        .single();
      if (userError || !userData) throw new Error(`Failed to fetch user data: ${userError?.message || 'User not found'}`);
      setUserId(userData.id);
      setWeeklyPoints(userData.weekly_points || 0);

      const { data: balanceData, error: balanceError } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('wallet_address', activeWalletAddress)
        .eq('currency', 'SMP')
        .maybeSingle();
      if (balanceError && balanceError.code !== 'PGRST116') throw new Error(`Failed to fetch SMP balance: ${balanceError.message}`);
      setSmpBalance(balanceData?.amount || 0);

      await fetchAmethystBalance();
    } catch (error) {
      console.error('Error fetching user balances:', error);
      setError('Unable to load wallet balances. Please ensure your wallet is registered.');
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress, fetchAmethystBalance]);

  const fetchManga = useCallback(async (mangaId, chapterId) => {
    try {
      const { data: mangaData, error: mangaError } = await supabase
        .from('manga')
        .select('id, title, user_id, cover_image')
        .eq('id', mangaId)
        .eq('is_visible', true)
        .single();

      if (mangaError) throw new Error(`Failed to fetch manga: ${mangaError.message}`);

      const { data: chapterData, error: chapterError } = await supabase
        .from('manga_chapters')
        .select('id, chapter_number, title, is_premium, price')
        .eq('manga_id', mangaId)
        .eq('id', chapterId)
        .single();
      if (chapterError) throw new Error(`Failed to fetch chapter: ${chapterError.message}`);

      const { data: ownerData } = await supabase
        .from('users')
        .select('id, name, wallet_address, balance')
        .eq('id', mangaData.user_id)
        .maybeSingle();

      setManga(mangaData);
      setChapter(chapterData);
      setMangaOwner(ownerData || null);
      setIsPremium(chapterData.is_premium);
      setChapterPrice(chapterData.price !== null ? chapterData.price : 2.9);
      console.log('fetchManga set chapterPrice:', chapterData.price !== null ? chapterData.price : 2.9);
    } catch (error) {
      console.error('Error fetching manga:', error);
      setError(`Unable to load manga: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChapterList = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('manga_chapters')
        .select('id, chapter_number')
        .eq('manga_id', mangaId)
        .order('chapter_number', { ascending: true });
      if (error) throw new Error(`Failed to fetch chapter list: ${error.message}`);
      setChapterList(data || []);
    } catch (error) {
      console.error('Error fetching chapter list:', error);
      setError(`Unable to load chapter list: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  }, [mangaId]);

  const checkHasReadChapter = useCallback(async () => {
    if (!activeWalletAddress || !manga || !chapterId) return;
    try {
      const eventDetails = `${activeWalletAddress}${manga.title || 'Untitled'}${chapterId}`
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 255);
      const { data: existingEvents, error } = await supabase
        .from('wallet_events')
        .select('id')
        .eq('event_details', eventDetails)
        .eq('wallet_address', activeWalletAddress)
        .limit(1);
      if (error) throw new Error(`Error checking read status: ${error.message}`);
      setHasReadChapter(existingEvents?.length > 0);
    } catch (error) {
      console.error('Error checking read status:', error);
      setError('Failed to verify read status.');
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress, manga, chapterId]);

  const checkAccess = useCallback(async (userId, mangaData, chapterData) => {
    console.log('checkAccess called with:', { userId, mangaId: mangaData?.id, chapterId: chapterData?.id });
    if (!mangaData || !chapterData || !isWalletConnected) {
      console.log('checkAccess: Missing data or wallet not connected');
      setIsLocked(true);
      return;
    }
    try {
      // All manga is premium — every chapter needs a subscription, unlock,
      // or recorded payment. The first chapter still shows a page preview.
      if (userId) {
        // Active series subscription covers every chapter + artist chat
        const { data: subs, error: subError } = await supabase
          .from('manga_subscriptions')
          .select('expires_at')
          .eq('user_id', userId)
          .eq('manga_id', mangaData.id)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(1);
        if (subError) console.warn('checkAccess: subscription check failed:', subError.message);
        if (subs?.length) {
          setSubscription(subs[0]);
          setIsLocked(false);
          return;
        }
        setSubscription(null);

        const { data: payments, error: paymentError } = await supabase
          .from('user_payments')
          .select('id')
          .eq('user_wallet', activeWalletAddress)
          .eq('manga_id', mangaData.id)
          .eq('chapter_id', chapterData.id)
          .limit(1);
        if (paymentError) {
          console.error('checkAccess: Payment check error:', paymentError);
          throw new Error(`Payment check failed: ${paymentError.message}`);
        }
        if (payments?.length) {
          console.log('checkAccess: Payment found, unlocking');
          setIsLocked(false);
          return;
        }

        // chapter_id NULL means a whole-series ("All Chapters") unlock
        const { data: unlocks, error: unlockError } = await supabase
          .from('unlocked_manga_chapters')
          .select('chapter_id, expires_at')
          .eq('user_id', userId)
          .eq('manga_id', mangaData.id)
          .or(`chapter_id.eq.${chapterData.id},chapter_id.is.null`)
          .limit(1);
        if (unlockError) {
          console.error('checkAccess: Unlock check error:', unlockError);
          throw new Error(`Unlock check failed: ${unlockError.message}`);
        }
        const unlock = unlocks?.[0];
        if (unlock && (!unlock.expires_at || new Date(unlock.expires_at) > new Date())) {
          console.log('checkAccess: Unlock record found, unlocking');
          setIsLocked(false);
          return;
        }
      }

      console.log('checkAccess: No payment or unlock record found, locking');
      setIsLocked(true);
    } catch (error) {
      console.error('Error checking access:', error);
      setError('Failed to verify chapter access.');
      setIsLocked(true);
      setTimeout(() => setError(null), 5000);
    }
  }, [isWalletConnected, activeWalletAddress]);

  // Pages are served as short-lived signed URLs by the edge function,
  // which verifies subscription/unlock/payment server-side.
  const loadPages = useCallback(async () => {
    if (!chapterId) return;
    try {
      const { data, error } = await supabase.functions.invoke('manga-chapter-pages', {
        body: { chapterId, walletAddress: activeWalletAddress },
      });
      if (error) {
        // 402 = locked chapter — expected, the paywall handles it. Don't toast.
        if (error.context?.status === 402) return;
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      setPages(data?.pages || []);
    } catch (e) {
      console.error('[MangaChapter] loadPages failed:', e?.message || e);
      setError('Could not load pages. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  }, [chapterId, activeWalletAddress]);

  // Subscription: client builds + signs the payment tx (70% artist / 30%
  // treasury), broadcasts it, then the edge function re-verifies on-chain and
  // writes the manga_subscriptions row.
  const handleSubscribe = async (plan, currency) => {
    if (!mangaId) return;
    if (!activeWalletAddress || !activePublicKey) {
      setError('Please connect your wallet to subscribe.');
      return;
    }
    if (!userId) {
      setError('User profile not found. Please ensure your wallet is registered.');
      return;
    }
    if (!mangaOwner?.wallet_address) {
      setError('Artist info not loaded yet. Please try again.');
      return;
    }
    const planCfg = { monthly: { usd: 5 }, days21: { usd: 3 } }[plan];
    if (!planCfg) return;
    const usdAmount = planCfg.usd;
    const key = `${plan}-${currency}`;
    setSubscribing(key);
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      let transaction;
      const authorPubkey = new PublicKey(mangaOwner.wallet_address);
      const treasuryPubkey = new PublicKey(MANGA_TREASURY_WALLET);

      if (currency === 'SOL') {
        if (!solPrice) throw new Error('SOL price not available');
        const totalLamports = Math.round((usdAmount / solPrice) * LAMPORTS_PER_SOL);
        const authorLamports = Math.floor(totalLamports * 0.7);
        transaction = new Transaction({ recentBlockhash: blockhash, feePayer: activePublicKey }).add(
          SystemProgram.transfer({ fromPubkey: activePublicKey, toPubkey: authorPubkey, lamports: authorLamports }),
          SystemProgram.transfer({ fromPubkey: activePublicKey, toPubkey: treasuryPubkey, lamports: totalLamports - authorLamports }),
        );
      } else {
        const amount = Math.round(usdAmount * 1e6); // USDC base units
        const mint = new PublicKey(USDC_MINT_ADDRESS);
        const [sourceATA, authorATA, treasuryATA] = await Promise.all([
          getOrCreateAssociatedTokenAccount(connection, activePublicKey, mint, activePublicKey),
          getOrCreateAssociatedTokenAccount(connection, activePublicKey, mint, authorPubkey, true),
          getOrCreateAssociatedTokenAccount(connection, activePublicKey, mint, treasuryPubkey, true),
        ]);
        const authorAmount = Math.floor(amount * 0.7);
        transaction = new Transaction({ recentBlockhash: blockhash, feePayer: activePublicKey }).add(
          createTransferInstruction(sourceATA.address, authorATA.address, activePublicKey, authorAmount),
          createTransferInstruction(sourceATA.address, treasuryATA.address, activePublicKey, amount - authorAmount),
        );
      }

      console.log(`[Subscribe] ${plan}/${currency}: ${activeWalletAddress} pays ${usdAmount} USD-equiv`);
      console.log(`[Subscribe]   -> artist ${mangaOwner.wallet_address}: ~70%`);
      console.log(`[Subscribe]   -> treasury ${MANGA_TREASURY_WALLET}: ~30%`);

      const signature = await signAndSendTransaction(transaction);
      await confirmTransactionWithRetry(signature, blockhash, lastValidBlockHeight);

      const { data, error } = await supabase.functions.invoke('subscribe-manga', {
        body: { signature, mangaId, plan, currency, walletAddress: activeWalletAddress },
      });
      if (error) {
        // FunctionsHttpError hides the real message — pull it from the response body
        let detail = error.message;
        try {
          const bodyJson = await error.context?.json?.();
          if (bodyJson?.error) detail = bodyJson.error;
        } catch (_) { /* keep generic message */ }
        throw new Error(detail || 'Subscription failed.');
      }
      if (data?.error) throw new Error(data.error);

      setSubscription({ expires_at: data?.expires_at });
      setIsLocked(false);
      setSuccessMessage('Subscription active — happy reading!');
      setTimeout(() => setSuccessMessage(''), 5000);
      await loadPages();
    } catch (e) {
      console.error('[MangaChapter] subscribe failed:', e?.message || e);
      setError(e?.message || 'Subscription failed. Please try again.');
      setTimeout(() => setError(null), 6000);
    } finally {
      setSubscribing(null);
    }
  };

  const confirmTransactionWithRetry = async (signature, blockhash, lastValidBlockHeight, retries = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
        return;
      } catch (err) {
        console.error(`Attempt ${attempt} - Transaction confirmation failed:`, err);
        if (attempt === retries) {
          throw new Error('Failed to confirm transaction after retries.');
        }
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  };

  // Ask the edge function whether this unlock earned the Pioneer badge.
  // The badge itself is granted server-side (user_badges is service-role only).
  const claimPioneerBadge = useCallback(async (signature) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken || !mangaId) return false;

      const supabaseUrl = SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/claim-pioneer-badge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ mangaId, signature }),
      });
      const data = await response.json();
      return !!(response.ok && data?.isPioneer);
    } catch (err) {
      console.warn('[claimPioneerBadge] Failed:', err.message);
      return false;
    }
  }, [mangaId]);

  const showPioneerIfEarned = useCallback((creatorId, creatorWallet) => {
    try {
      const smpMint = new PublicKey(SMP_MINT_ADDRESS);
      const writerATA = getAssociatedTokenAddressSync(smpMint, new PublicKey(creatorWallet));
      setPioneerPayload({
        type: 'create_ata',
        mint: SMP_MINT_ADDRESS.toString(),
        owner: creatorWallet,
        ata: writerATA.toBase58(),
        instructions: 'Use this payload to create an Associated Token Account for the writer'
      });
    } catch (err) {
      console.warn('[showPioneerIfEarned] Failed to build payload:', err.message);
      setPioneerPayload(null);
    }
    setCurrentCreatorId(creatorId);
    setShowPioneerModal(true);
  }, []);

  const updateTokenBalance = useCallback(async () => {
    if (!activeWalletAddress || !manga || !chapterId || !isPremium) return;
    try {
      if (!activePublicKey) throw new Error('No valid public key available.');
      if (!TARGET_WALLET) throw new Error('TARGET_WALLET is not defined.');

      let targetPublicKey;
      try {
        targetPublicKey = new PublicKey(TARGET_WALLET);
      } catch (err) {
        throw new Error(`Invalid TARGET_WALLET: ${err.message}`);
      }

      const smpMint = new PublicKey(SMP_MINT_ADDRESS);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, weekly_points')
        .eq('wallet_address', activeWalletAddress)
        .single();
      if (userError || !userData) throw new Error(`User not found: ${userError?.message}`);

      // (The reader pays on-chain below — their in-app balance is not touched.)
      let sourceATA;
      try {
        sourceATA = await getOrCreateAssociatedTokenAccount(
          connection,
          activePublicKey,
          smpMint,
          activePublicKey,
          true
        );
      } catch (err) {
        console.error('Error creating source ATA:', err);
        throw new Error('Failed to create or fetch source SMP token account');
      }

      let smpBalanceOnChain = 0;
      try {
        const accountInfo = await getAccount(connection, sourceATA.address);
        smpBalanceOnChain = Number(accountInfo.amount) / 10 ** SMP_DECIMALS;
      } catch (err) {
        if (err.name === 'TokenAccountNotFoundError') {
          console.warn('SMP token account not found for user, assuming zero balance');
        } else {
          throw err;
        }
      }
      if (smpBalanceOnChain < SMP_READ_COST) throw new Error(`Insufficient SMP balance on-chain: ${smpBalanceOnChain.toLocaleString()} SMP`);

      const { data: mangaOwnerData, error: mangaOwnerError } = await supabase
        .from('manga')
        .select('user_id')
        .eq('id', manga.id)
        .single();
      if (mangaOwnerError || !mangaOwnerData) throw new Error(`Manga owner not found: ${mangaOwnerError?.message}`);

      const { data: mangaOwner, error: mangaOwnerBalanceError } = await supabase
        .from('users')
        .select('id, wallet_address, balance')
        .eq('id', mangaOwnerData.user_id)
        .single();
      if (mangaOwnerBalanceError || !mangaOwner) throw new Error(`Manga owner balance not found: ${mangaOwnerBalanceError?.message}`);

      const eventDetails = `${activeWalletAddress}${manga.title || 'Untitled'}${chapterId}`
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 255);
      const { data: existingEvents, error: eventError } = await supabase
        .from('wallet_events')
        .select('id')
        .eq('event_details', eventDetails)
        .eq('wallet_address', activeWalletAddress)
        .limit(1);
      if (eventError) throw new Error(`Error checking wallet events: ${eventError.message}`);
      if (existingEvents?.length > 0) {
        setHasReadChapter(true);
        return;
      }

      let destATA;
      try {
        destATA = await getOrCreateAssociatedTokenAccount(
          connection,
          activePublicKey,
          smpMint,
          targetPublicKey,
          true
        );
      } catch (err) {
        console.error('Error creating destination ATA:', err);
        throw new Error('Failed to create or fetch destination SMP token account');
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: activePublicKey,
      }).add(
        createTransferInstruction(
          sourceATA.address,
          destATA.address,
          activePublicKey,
          SMP_READ_COST * 10 ** SMP_DECIMALS,
          []
        )
      );

      const signature = await signAndSendTransaction(transaction);

      await confirmTransactionWithRetry(signature, blockhash, lastValidBlockHeight);

      // The server verifies the transfer on-chain, unlocks the chapter and
      // gives the rewards (reader points, artist's 500 SMP) exactly once.
      const { data: recData, error: recError } = await supabase.functions.invoke('record-manga-payment', {
        body: {
          signature,
          chapterId,
          mangaId,
          currency: 'SMP',
          paymentType: 'smp_read',
          walletAddress: activeWalletAddress,
        },
      });
      if (recError) {
        console.warn('[updateTokenBalance] Failed to record payment:', recError.message);
        throw new Error(`PAID_NOT_SAVED: ${shortSigOf(signature)}`);
      }
      const readerReward = Number(recData?.readerReward) || 0;

      // Pioneer badge is granted server-side; show the modal if earned
      if (await claimPioneerBadge(signature)) {
        showPioneerIfEarned(mangaOwner.id, mangaOwner.wallet_address);
      }

      setSuccessMessage(`Payment successful! ${SMP_READ_COST.toLocaleString()} SMP sent.` +
        (readerReward ? ` You earned ${readerReward} points.` : ''));
      setSmpBalance((b) => Math.max(0, (Number(b) || 0) - SMP_READ_COST));
      if (readerReward) setWeeklyPoints((p) => (Number(p) || 0) + readerReward);
      setHasReadChapter(true);
      setIsLocked(false);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error in updateTokenBalance:', error);
      const msg = String(error?.message || '');
      setError(
        msg.startsWith('PAID_NOT_SAVED')
          ? `Your ${SMP_READ_COST.toLocaleString()} SMP was sent, but we couldn't save the unlock yet. Please DON'T pay again — reopen the chapter in a minute, or contact support with code ${msg.split(': ')[1] || ''}.`
          : msg.includes('Insufficient SMP balance')
            ? `Not enough SMP in your wallet — reading with SMP costs ${SMP_READ_COST.toLocaleString()} SMP. You were not charged.`
            : /user rejected|cancel/i.test(msg)
              ? 'Payment cancelled. You were not charged.'
              : `Couldn't complete the payment: ${msg}`
      );
      setTimeout(() => setError(null), msg.startsWith('PAID_NOT_SAVED') ? 20000 : 8000);
    }
  }, [activeWalletAddress, manga, chapterId, isPremium, activePublicKey, amethystBalance, claimPioneerBadge, showPioneerIfEarned]);

  const initiatePayment = async (currency, paymentType = 'single') => {
    if (!activeWalletAddress || !activePublicKey) {
      setError('Please connect your wallet to proceed.');
      return;
    }
    if (!userId) {
      setError('User profile not found. Please ensure your wallet is registered.');
      return;
    }
    try {
      await fetchPrices();
      const usdAmount = paymentType === 'threeChapters' ? 3 : paymentType === 'fullChapters' ? 15 : chapterPrice;
      let amount, decimals, mint, displayAmount, solPriceUsed;

      if (currency === 'SOL') {
        if (!solPrice) throw new Error('SOL price not available');
        solPriceUsed = solPrice;
        amount = Math.round((usdAmount / solPrice) * 1_000_000_000);
        decimals = 9;
        displayAmount = (amount / 1_000_000_000).toFixed(4);
      } else if (currency === 'USDC') {
        amount = Math.round(usdAmount * 10 ** 6);
        decimals = 6;
        mint = USDC_MINT_ADDRESS;
        displayAmount = (amount / 10 ** 6).toFixed(2);
      } else if (currency === 'SKR') {
        if (paymentType === 'threeChapters') {
          amount = threeChaptersSmp * 10 ** 6; // Using same decimals as SMP
          displayAmount = threeChaptersSmp.toLocaleString();
          usdAmount = 3;
        } else if (paymentType === 'fullChapters') {
          amount = fullChaptersSmp * 10 ** 6; // Using same decimals as SMP
          displayAmount = fullChaptersSmp.toLocaleString();
          usdAmount = 15;
        } else {
          amount = SMP_READ_COST * 10 ** 6; // Using same decimals as SMP
          displayAmount = SMP_READ_COST.toLocaleString();
          usdAmount = chapterPrice;
        }
        decimals = 6;
        mint = SKR_MINT_ADDRESS;
      } else if (currency === 'SMP') {
        if (paymentType === 'threeChapters') {
          amount = threeChaptersSmp * 10 ** SMP_DECIMALS;
          displayAmount = threeChaptersSmp.toLocaleString();
          usdAmount = 3;
        } else if (paymentType === 'fullChapters') {
          amount = fullChaptersSmp * 10 ** SMP_DECIMALS;
          displayAmount = fullChaptersSmp.toLocaleString();
          usdAmount = 15;
        } else {
          amount = SMP_READ_COST * 10 ** SMP_DECIMALS;
          displayAmount = SMP_READ_COST.toLocaleString();
          usdAmount = chapterPrice;
        }
        decimals = SMP_DECIMALS;
        mint = SMP_MINT_ADDRESS;

        // Check if writer has SMP ATA - only for SMP payments
        if (!mangaOwner?.wallet_address) {
          throw new Error('Writer info not loaded yet. Please try again.');
        }
        const hasAta = await checkWriterAta(mangaOwner.wallet_address);
        setWriterHasAta(hasAta);

        if (!hasAta) {
          // Calculate ATA funding cost
          const smpMint = new PublicKey(SMP_MINT_ADDRESS);
          const writerATA = getAssociatedTokenAddressSync(smpMint, new PublicKey(mangaOwner.wallet_address));
          const rentExempt = await connection.getMinimumBalanceForRentExemption(165);
          const fundingCost = 0.00203928; // ~0.002 SOL for ATA creation
          setAtaFundingCost(fundingCost);
          setWriterAtaAddress(writerATA.toBase58());
          setShowAtaFundingModal(true);
          setTransactionDetails({ currency, amount, displayAmount, decimals, mint, solPrice: solPriceUsed, chapterPrice: usdAmount, paymentType });
          setPaymentMethod(currency);
          return;
        }
      }

      setTransactionDetails({ currency, amount, displayAmount, decimals, mint, solPrice: solPriceUsed, chapterPrice: usdAmount, paymentType });
      setPaymentMethod(currency);
      setShowTransactionPopup(true);
    } catch (error) {
      console.error('Error initiating payment:', error);
      setError(`Failed to initiate payment: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const confirmPayment = async () => {
    if (!transactionDetails) return;
    console.log('Starting confirmPayment with details:', transactionDetails);
    const { currency, amount, decimals, mint, solPrice, chapterPrice, paymentType } = transactionDetails;
    try {
      let targetPublicKey;
      try {
        targetPublicKey = new PublicKey(MERCHANT_WALLET);
      } catch (err) {
        throw new Error(`Invalid MERCHANT_WALLET: ${err.message}`);
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      const balance = await connection.getBalance(activePublicKey);
      const minBalanceRequired = currency === 'SOL' ? amount + 5000 : 5000;
      if (balance < minBalanceRequired) {
        throw new Error(`Insufficient SOL balance: ${(balance / 1_000_000_000).toFixed(4)} SOL`);
      }

      if (currency === 'SOL') {
        const transaction = new Transaction({
          recentBlockhash: blockhash,
          feePayer: activePublicKey,
        }).add(
          SystemProgram.transfer({
            fromPubkey: activePublicKey,
            toPubkey: targetPublicKey,
            lamports: amount,
          })
        );

        const signature = await signAndSendTransaction(transaction);

        await confirmTransactionWithRetry(signature, blockhash, lastValidBlockHeight);
        await processUnlock(signature, amount / 1_000_000_000, currency, solPrice, chapterPrice, paymentType);
      } else {
        const sourceATA = await getOrCreateAssociatedTokenAccount(
          connection,
          activePublicKey,
          new PublicKey(mint),
          activePublicKey
        );
        const destATA = await getOrCreateAssociatedTokenAccount(
          connection,
          activePublicKey,
          new PublicKey(mint),
          targetPublicKey
        );
        const transaction = new Transaction({
          recentBlockhash: blockhash,
          feePayer: activePublicKey,
        }).add(createTransferInstruction(sourceATA.address, destATA.address, activePublicKey, amount));

        const signature = await signAndSendTransaction(transaction);

        await confirmTransactionWithRetry(signature, blockhash, lastValidBlockHeight);
        await processUnlock(signature, amount / 10 ** decimals, currency, undefined, chapterPrice, paymentType);
      }
    } catch (error) {
      console.error('Confirm Payment error:', error);
      setError(`Payment failed: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setShowTransactionPopup(false);
      setTransactionDetails(null);
      setPaymentMethod(null);
    }
  };

  const processUnlock = async (signature, amount, currency, solPrice, chapterPrice, paymentType) => {
    try {
      if (!activeWalletAddress || !mangaId || !chapterId || !signature || !amount || !currency) {
        throw new Error('Missing required fields.');
      }
      if (!['SOL', 'USDC', 'SMP'].includes(currency)) {
        throw new Error('Unsupported currency.');
      }
      if (!chapterPrice) {
        throw new Error('Chapter price not provided.');
      }

      let senderPubkey, receiverPubkey;
      try {
        senderPubkey = new PublicKey(activeWalletAddress);
        receiverPubkey = new PublicKey(MERCHANT_WALLET);
      } catch (e) {
        throw new Error('Invalid wallet address format.');
      }

      let expectedAmount, decimals, mint;
      if (currency === 'SOL') {
        if (!solPrice) throw new Error('SOL price not provided.');
        expectedAmount = chapterPrice / solPrice;
        decimals = 9;
      } else if (currency === 'USDC') {
        expectedAmount = chapterPrice;
        decimals = 6;
        mint = USDC_MINT_ADDRESS;
      } else if (currency === 'SKR') {
        if (paymentType === 'threeChapters') {
          expectedAmount = threeChaptersSmp;
          chapterPrice = 3;
        } else if (paymentType === 'fullChapters') {
          expectedAmount = fullChaptersSmp;
          chapterPrice = 15;
        } else {
          expectedAmount = SMP_READ_COST;
        }
        decimals = 6;
        mint = SKR_MINT_ADDRESS;
      } else if (currency === 'SMP') {
        if (paymentType === 'threeChapters') {
          expectedAmount = threeChaptersSmp;
          chapterPrice = 3;
        } else if (paymentType === 'fullChapters') {
          expectedAmount = fullChaptersSmp;
          chapterPrice = 15;
        } else {
          expectedAmount = SMP_READ_COST;
        }
        decimals = SMP_DECIMALS;
        mint = SMP_MINT_ADDRESS;
      }

      const tolerance = 0.02;
      const minAmount = expectedAmount * (1 - tolerance);
      const maxAmount = expectedAmount * (1 + tolerance);

      let tx = null;
      for (let i = 0; i < 3; i++) {
        tx = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
        if (tx) break;
        console.log(`Attempt ${i + 1}: Transaction not found, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!tx) {
        console.log('Transaction not found after retries:', signature);
        throw new Error('Invalid transaction: not found.');
      }

      if (!tx.meta || tx.meta.err) {
        console.log('Transaction meta error:', tx.meta?.err);
        throw new Error('Invalid transaction: failed on chain.');
      }

      console.log('Transaction accountKeys:', tx.transaction.message.accountKeys.map(key => key.toBase58()));

      const senderIndex = tx.transaction.message.accountKeys.findIndex(
        key => key.toBase58() === senderPubkey.toBase58()
      );
      const receiverIndex = tx.transaction.message.accountKeys.findIndex(
        key => key.toBase58() === receiverPubkey.toBase58()
      );

      if (senderIndex === -1 || receiverIndex === -1) {
        console.log('Sender or receiver not found:', { senderIndex, receiverIndex });
        const missing = senderIndex === -1 ? 'sender' : 'receiver';
        throw new Error(`Invalid transaction: ${missing} missing.`);
      }

      let amountTransferred;
      if (currency === 'SOL') {
        amountTransferred = (tx.meta.postBalances[receiverIndex] - tx.meta.preBalances[receiverIndex]) / LAMPORTS_PER_SOL;
        console.log('SOL Transfer Details:', { amountTransferred });
      } else {
        const mintStr = mint?.toString();
        const receiverATA = await getAssociatedTokenAddressSync(
          new PublicKey(mint),
          receiverPubkey
        );

        const receiverATAIndex = tx.transaction.message.accountKeys.findIndex(
          key => key.toBase58() === receiverATA.toBase58()
        );

        if (receiverATAIndex === -1) {
          console.log('Receiver ATA not found:', { receiverATAIndex });
          throw new Error(`Invalid ${currency} transaction: receiver ATA missing.`);
        }

        // Amount received = receiver's post balance minus pre balance.
        // uiAmount is already decimal-adjusted, so no further scaling.
        const receiverPre = tx.meta.preTokenBalances?.find(
          b => b.accountIndex === receiverATAIndex && b.mint === mintStr
        );
        const receiverPost = tx.meta.postTokenBalances?.find(
          b => b.accountIndex === receiverATAIndex && b.mint === mintStr
        );

        if (!receiverPost) {
          console.log('Token balances not found:', { receiverPre, receiverPost });
          throw new Error(`Invalid ${currency} transfer: token balances missing.`);
        }

        const preAmount = receiverPre ? Number(receiverPre.uiTokenAmount.uiAmount) || 0 : 0;
        amountTransferred = (Number(receiverPost.uiTokenAmount.uiAmount) || 0) - preAmount;
        console.log(`${currency} Transfer Details:`, { amountTransferred });
      }

      console.log('Amount transferred:', amountTransferred, 'Expected range:', minAmount, '-', maxAmount);

      if (amountTransferred < minAmount || amountTransferred > maxAmount) {
        console.log('Incorrect payment amount:', { expected: expectedAmount, actual: amountTransferred });
        throw new Error('Incorrect payment amount.');
      }

      if (tx.transaction.message.accountKeys[receiverIndex].toBase58() !== MERCHANT_WALLET) {
        console.log('Invalid recipient:', tx.transaction.message.accountKeys[receiverIndex].toBase58());
        throw new Error('Invalid recipient.');
      }

      const { data: chapterData, error: chapterError } = await supabase
        .from('manga_chapters')
        .select('id, is_premium')
        .eq('id', chapterId)
        .eq('manga_id', mangaId)
        .single();
      if (chapterError || !chapterData) {
        console.log('Chapter validation error:', chapterError);
        throw new Error('Manga chapter not found.');
      }
      if (!chapterData.is_premium) {
        console.log('Chapter is not premium.');
        throw new Error('Chapter is not premium.');
      }

      const { data: existingPayments, error: paymentError } = await supabase
        .from('user_payments')
        .select('id')
        .eq('user_wallet', activeWalletAddress)
        .eq('manga_id', mangaId)
        .eq('chapter_id', chapterId)
        .limit(1);
      if (paymentError) {
        console.error('Payment check error:', paymentError);
        throw new Error('Failed to check existing payment.');
      }

      if (existingPayments?.length) {
        console.log('Existing payment found, unlocking.');
        setIsLocked(false);
        setSuccessMessage('Chapter already unlocked.');
        setTimeout(() => setSuccessMessage(''), 5000);
        await checkAccess(userId, manga, chapter);
        return true;
      }

      // Record the payment server-side: the edge function re-verifies the
      // on-chain transfer to the merchant wallet, then writes the unlock rows.
      const { data: recData, error: recError } = await supabase.functions.invoke('record-manga-payment', {
        body: {
          signature,
          chapterId,
          mangaId,
          currency,
          paymentType: paymentType || 'single',
          walletAddress: activeWalletAddress,
          amountUsd: chapterPrice,
        },
      });
      if (recError) throw new Error(recError.message || 'Failed to record payment.');
      if (recData?.error) throw new Error(recData.error);

      // (Was `paymentData` — undefined, so a SUCCESSFUL payment threw here and
      // the reader was told the unlock failed.)
      console.log('Unlock successful:', recData);

      // Pioneer badge is granted server-side; show the modal if earned
      if (await claimPioneerBadge(signature)) {
        const creatorId = manga?.user_id || mangaOwner?.id;
        const creatorWallet = mangaOwner?.wallet_address;
        if (creatorId && creatorWallet) {
          showPioneerIfEarned(creatorId, creatorWallet);
        } else {
          setCurrentCreatorId(creatorId);
          setShowPioneerModal(true);
        }
      }

      setIsLocked(false);
      setSuccessMessage('Chapter unlocked successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
      await checkAccess(userId, manga, chapter);
      return true;
    } catch (error) {
      console.error('Error processing unlock:', error);
      setError(`Failed to unlock chapter: ${error.message}`);
      setTimeout(() => setError(null), 5000);
      return false;
    }
  };

  const handleReadWithSMP = async () => {
    if (!isWalletConnected) {
      setError('Please connect your wallet to read with SMP.');
      return;
    }
    if (!activePublicKey) {
      setError('Invalid wallet configuration.');
      return;
    }
    if (!userId) {
      setError('User profile not found. Please ensure your wallet is registered.');
      return;
    }
    if (hasReadChapter) {
      return;
    }
    setPaymentMethod('SMP');
    await updateTokenBalance();
  };

  useEffect(() => {
    if (!mangaId || !chapterId) {
      setError('Invalid manga or chapter ID.');
      setUseInput(true);
      setLoading(false);
      return;
    }

    if (!isWalletConnected) {
      setLoading(false);
      return;
    }

    const initialize = async () => {
      await Promise.all([
        fetchPrices(),
        fetchUserBalances(),
        fetchManga(mangaId, chapterId),
        fetchChapterList(),
      ]);
    };
    initialize();
  }, [mangaId, chapterId, fetchManga, fetchUserBalances, fetchPrices, isWalletConnected, fetchChapterList]);

  useEffect(() => {
    if (manga && chapter) {
      checkAccess(userId, manga, chapter);
      if (isWalletConnected) {
        checkHasReadChapter();
      }
    }
  }, [manga, chapter, userId, checkAccess, checkHasReadChapter, isWalletConnected]);

  // Load signed page URLs once access is confirmed — or as a preview for the
  // first chapter when locked (the edge function returns only preview pages).
  useEffect(() => {
    const isFirstChapter = chapterList.length > 0 && chapterList[0]?.id === chapterId;
    if (!loading && manga && chapter && (!isLocked || isFirstChapter) && pages.length === 0) {
      loadPages();
    }
  }, [loading, manga, chapter, isLocked, pages.length, loadPages, chapterList, chapterId]);

  useEffect(() => {
    if (
      !loading &&
      manga &&
      !isLocked &&
      isPremium &&
      isWalletConnected &&
      paymentMethod === 'SMP' &&
      transactionDetails?.paymentType === 'single'
    ) {
      updateTokenBalance();
    }
  }, [loading, manga, isLocked, isPremium, updateTokenBalance, isWalletConnected, paymentMethod, transactionDetails]);

  const handleManualFetch = () => {
    if (!inputMangaId || !inputChapterId) {
      setError('Please enter both Manga ID and Chapter ID.');
      return;
    }
    setLoading(true);
    setError(null);
    setUseInput(false);
    fetchManga(inputMangaId, inputChapterId);
  };

  /* ───────────── reader UI state (hooks stay above every early return) ───────────── */
  const [chromeVisible, setChromeVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [paying, setPaying] = useState(false);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length) {
      const idx = viewableItems[0].index;
      if (typeof idx === 'number') setCurrentPage(idx + 1);
    }
  }).current;
  const toggleChrome = useCallback(() => setChromeVisible((v) => !v), []);

  // Reading progress ("continue reading"): remember the last chapter + page
  // position per manga so the user can resume where they left off.
  const flatListRef = useRef(null);
  const [resumePct, setResumePct] = useState(null);
  const resumeAppliedRef = useRef(false);
  const progressSaveRef = useRef({ lastSentAt: 0, pending: null, latest: null });

  // Save progress (throttled to one write per 2s; latest position kept in a ref
  // so the unmount cleanup can flush whatever the user last saw).
  useEffect(() => {
    if (!userId || !mangaId || !chapter?.id || pages.length === 0) return;
    const pct = Math.min(100, Math.round(((currentPage - 1) / Math.max(1, pages.length - 1)) * 1000) / 10);
    const payload = {
      userId,
      contentType: 'manga',
      contentId: mangaId,
      chapterKey: chapter.id,
      chapterNumber: chapter.chapter_number,
      scrollPct: pct,
    };
    progressSaveRef.current.latest = payload;
    progressSaveRef.current.pending = payload;
    const now = Date.now();
    if (now - progressSaveRef.current.lastSentAt < 2000) return;
    progressSaveRef.current.lastSentAt = now;
    progressSaveRef.current.pending = null;
    saveReadingProgress(payload);
  }, [currentPage, pages.length, chapter, userId, mangaId]);

  // Flush the final position on unmount / chapter change.
  useEffect(() => () => {
    const pending = progressSaveRef.current.pending || progressSaveRef.current.latest;
    if (pending) saveReadingProgress(pending);
  }, []);

  // Load the saved position once the chapter is known. Only runs when pages
  // actually loaded — i.e. the chapter is readable (unlocked/subscribed/free
  // preview). A locked chapter showing the paywall must NOT create or resume
  // progress, otherwise "Continue Reading" would point at a paywalled chapter.
  const pagesLoaded = pages.length > 0;
  useEffect(() => {
    setResumePct(null);
    resumeAppliedRef.current = false;
    if (!userId || !mangaId || !chapter?.id || !pagesLoaded) return;
    let alive = true;
    getContentReadingProgress(userId, 'manga', mangaId).then((row) => {
      if (!alive) return;
      if (row && String(row.chapter_key) === String(chapter.id)) {
        const pct = Number(row.scroll_pct) || 0;
        if (pct > 0 && pct < 100) setResumePct(pct);
      } else {
        // Different chapter (or first read ever): mark this one as current.
        saveReadingProgress({
          userId,
          contentType: 'manga',
          contentId: mangaId,
          chapterKey: chapter.id,
          chapterNumber: chapter.chapter_number,
          scrollPct: 0,
        });
      }
    });
    return () => { alive = false; };
  }, [userId, mangaId, chapter?.id, pagesLoaded]);

  // Apply the resume jump once the page list has rendered.
  useEffect(() => {
    if (resumePct == null || resumeAppliedRef.current || pages.length === 0) return;
    resumeAppliedRef.current = true;
    const idx = Math.min(pages.length - 1, Math.max(0, Math.round((resumePct / 100) * (pages.length - 1))));
    flatListRef.current?.scrollToIndex({ index: idx, animated: false });
  }, [pages.length, resumePct]);

  const handleScrollToIndexFailed = useCallback((info) => {
    const offset = (info.averageItemLength || SCREEN_W) * info.index;
    flatListRef.current?.scrollToOffset({ offset, animated: false });
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
    }, 400);
  }, []);

  const renderPage = useCallback(
    ({ item }) => <ReaderPage uri={item.image_url} onPress={toggleChrome} />,
    [toggleChrome]
  );

  const closeTx = () => {
    setShowTransactionPopup(false);
    setTransactionDetails(null);
    setPaymentMethod(null);
    setPaying(false);
  };
  const handleConfirmPayment = async () => {
    if (paying) return;
    setPaying(true);
    try {
      await confirmPayment();
    } finally {
      setPaying(false);
    }
  };

  const goBackToSeries = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MangaDetail', { id: mangaId });

  /* ───────────── early states ───────────── */
  if (!isWalletConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
        <Screen>
          <View style={styles.center}>
            <EmptyState
              icon="lock"
              title="Connect your wallet"
              subtitle="Link a wallet to read chapters, earn points and unlock premium content."
              action="Connect Wallet"
              onAction={() => navigation.navigate('WalletImport')}
            />
            <View style={{ width: 220 }}>
              <GhostButton label="Back to Home" icon="home" onPress={() => navigation.navigate('Home')} />
            </View>
          </View>
        </Screen>
      </SafeAreaView>
    );
  }

  if (loading) {
    return <ScreenSkeleton variant="manga" label="Loading chapter" />;
  }

  // Only take over the screen for a fatal error. Transient errors show as a toast instead.
  if (useInput || (error && (!manga || !chapter))) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
        <Screen>
          <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
            <Panel style={{ width: '100%', maxWidth: 420 }}>
              <Text style={{ ...type.h1, color: colors.danger, textAlign: 'center', marginBottom: space.lg }}>
                {error || 'Missing parameters'}
              </Text>
              <Field label="Manga ID">
                <Input value={inputMangaId} onChangeText={setInputMangaId} placeholder="UUID" autoCapitalize="none" accessibilityLabel="Manga ID input" />
              </Field>
              <Field label="Chapter ID">
                <Input value={inputChapterId} onChangeText={setInputChapterId} placeholder="UUID" autoCapitalize="none" accessibilityLabel="Chapter ID input" />
              </Field>
              <GradientButton label="Fetch Chapter" icon="download" onPress={handleManualFetch} />
              <View style={{ height: space.sm }} />
              <GhostButton label="Back to Home" icon="home" onPress={() => navigation.navigate('Home')} />
            </Panel>
          </ScrollView>
        </Screen>
      </SafeAreaView>
    );
  }

  if (!manga || !chapter || (pages.length === 0 && !isLocked)) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
        <Screen>
          <View style={styles.center}>
            <EmptyState
              icon="book-open"
              title="Chapter not found"
              subtitle="This chapter may have no pages yet, or it isn't available."
              action="Try another chapter"
              onAction={() => {
                setUseInput(true);
                setError('Enter new values to try again.');
              }}
            />
            <View style={{ width: 220 }}>
              <GhostButton label="Back to Home" icon="home" onPress={() => navigation.navigate('Home')} />
            </View>
          </View>
        </Screen>
      </SafeAreaView>
    );
  }

  /* ───────────── derived values ───────────── */
  const chapterTitle = chapter.title || `Chapter ${chapter.chapter_number}`;
  const chapterNum = parseInt(chapter.chapter_number, 10);
  const currentIndex = chapterList.findIndex((ch) => ch.id === chapter.id);
  const prevChapter = currentIndex > 0 ? chapterList[currentIndex - 1]?.id : null;
  const nextChapterId = currentIndex < chapterList.length - 1 ? chapterList[currentIndex + 1]?.id : null;
  const isFirstChapter = chapterList.length > 0 && chapterList[0]?.id === chapterId;
  const singleChapterSol = solPrice ? (chapterPrice / solPrice).toFixed(4) : 'N/A';
  const singleChapterUsdc = (chapterPrice / usdcPrice).toFixed(2);
  const usd = Number(chapterPrice || 0);
  const progress = pages.length ? Math.min(1, currentPage / pages.length) : 0;

  const goChapter = (id) => navigation.navigate('MangaChapter', { mangaId, chapterId: id });

  const balanceStrip = (
    <View style={styles.balanceStrip}>
      <View style={styles.balanceItem}>
        <Icon name="coins" size={12} color={colors.primaryHi} solid />
        <Text style={styles.balanceText}>{smpBalance !== null ? formatNumber(smpBalance) : '…'}</Text>
        <Text style={styles.balanceLabel}>SMP</Text>
      </View>
      <View style={styles.balanceDivider} />
      <View style={styles.balanceItem}>
        <Icon name="star" size={12} color={colors.gold} solid />
        <Text style={styles.balanceText}>{weeklyPoints !== null ? formatNumber(weeklyPoints) : '…'}</Text>
        <Text style={styles.balanceLabel}>PTS</Text>
      </View>
      <View style={styles.balanceDivider} />
      <View style={styles.balanceItem}>
        <Icon name="gem" size={12} color={colors.electric} solid />
        <Text style={styles.balanceText}>{formatNumber(amethystBalance)}</Text>
        <Text style={styles.balanceLabel}>AMETHYST</Text>
      </View>
    </View>
  );

  const toast = successMessage || error ? (
    <View style={styles.toastWrap} pointerEvents="none">
      <Toast message={successMessage || error} type={error ? 'error' : 'success'} />
    </View>
  ) : null;

  /* ───────────── paywall ───────────── */
  const paywall = (
    <View style={{ flex: 1 }}>
      {manga?.cover_image ? (
        <Image source={{ uri: manga.cover_image }} style={styles.paywallBackdrop} blurRadius={40} />
      ) : null}
      <LinearGradient colors={['rgba(10,10,20,0.55)', colors.bg]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.paywallScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.paywallTop}>
          <IconButton icon="chevron-left" label="Go back" onPress={goBackToSeries} size={38} />
          <Text numberOfLines={1} style={styles.paywallManga}>{manga.title}</Text>
          <View style={{ width: 38 }} />
        </View>

        <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', marginTop: space.lg }}>
          <LinearGradient colors={gradients.gold} style={[styles.lockBadge, glow(colors.gold, 0.5)]}>
            <Icon name="lock" size={26} color="#3b2600" solid />
          </LinearGradient>
          <Text style={styles.paywallTitle}>{chapterTitle}</Text>
          <Text style={{ ...type.body, textAlign: 'center', marginTop: 4 }}>
            This is a premium chapter. Unlock it to keep reading.
          </Text>
        </Animated.View>

        <View style={{ marginTop: space.xl }}>{balanceStrip}</View>

        <Text style={[type.label, { marginTop: space.xl, marginBottom: space.xs }]}>Subscribe to {manga?.title || 'this series'}</Text>
        <Text style={{ ...type.caption, marginBottom: space.md }}>
          Every chapter, ad-free, plus direct chat with the artist.
        </Text>

        <PlanCard
          icon="crown"
          title="Monthly"
          desc="Full access to every chapter + artist chat"
          usd={5}
          days={30}
          best
          solLabel={solPrice ? (5 / solPrice).toFixed(4) : '…'}
          busy={subscribing?.startsWith('monthly') ? subscribing.split('-')[1] : null}
          onSol={() => handleSubscribe('monthly', 'SOL')}
          onUsdc={() => handleSubscribe('monthly', 'USDC')}
        />
        <PlanCard
          icon="bookmark"
          title="21 Days"
          desc="Full access to every chapter + artist chat"
          usd={3}
          days={21}
          solLabel={solPrice ? (3 / solPrice).toFixed(4) : '…'}
          busy={subscribing?.startsWith('days21') ? subscribing.split('-')[1] : null}
          onSol={() => handleSubscribe('days21', 'SOL')}
          onUsdc={() => handleSubscribe('days21', 'USDC')}
        />
        <Text style={[type.caption, { textAlign: 'center', marginTop: space.sm }]}>
          Secure Solana payment. Access starts instantly and renews only if you subscribe again.
        </Text>
      </ScrollView>
    </View>
  );

  /* ───────────── reader ───────────── */
  const readerHeader = (
    <View style={{ paddingTop: 64 }}>
      {isPremium ? (
        <View style={styles.earnWrap}>
          {hasReadChapter ? (
            <View style={styles.earnDone}>
              <Icon name="check-circle" size={16} color={colors.mint} solid />
              <Text style={styles.earnDoneText}>You've earned points from this chapter</Text>
            </View>
          ) : (
            <Panel accent={colors.primary} style={{ padding: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.earnIcon}>
                  <Icon name="gem" size={16} color="#fff" solid />
                </View>
                <View style={{ flex: 1, marginRight: space.md }}>
                  <Text style={type.bodyStrong}>Read to earn</Text>
                  <Text style={type.caption}>Spend 1,000 SMP, get points + support the artist.</Text>
                </View>
                <GradientButton full={false} size="sm" label="Earn" icon="bolt" onPress={handleReadWithSMP} />
              </View>
            </Panel>
          )}
        </View>
      ) : null}
    </View>
  );

  const readerFooter = (
    <View>
      {isLocked ? (
        <View style={[styles.endCard, { alignItems: 'stretch' }]}>
          <Text style={styles.endKicker}>PREVIEW ENDED</Text>
          <Text style={styles.endTitle}>Keep reading {manga.title}</Text>
          <Text style={{ ...type.body, textAlign: 'center', marginTop: 4 }}>
            Subscribe to unlock every chapter and chat with the artist.
          </Text>
          <View style={{ marginTop: space.lg }}>
            <PlanCard
              icon="crown"
              title="Monthly"
              desc="Every chapter + artist chat"
              usd={5}
              days={30}
              best
              solLabel={solPrice ? (5 / solPrice).toFixed(4) : '…'}
              busy={subscribing?.startsWith('monthly') ? subscribing.split('-')[1] : null}
              onSol={() => handleSubscribe('monthly', 'SOL')}
              onUsdc={() => handleSubscribe('monthly', 'USDC')}
            />
            <PlanCard
              icon="bookmark"
              title="21 Days"
              desc="Every chapter + artist chat"
              usd={3}
              days={21}
              solLabel={solPrice ? (3 / solPrice).toFixed(4) : '…'}
              busy={subscribing?.startsWith('days21') ? subscribing.split('-')[1] : null}
              onSol={() => handleSubscribe('days21', 'SOL')}
              onUsdc={() => handleSubscribe('days21', 'USDC')}
            />
          </View>
        </View>
      ) : (
      <View style={styles.endCard}>
        <Text style={styles.endKicker}>END OF CHAPTER</Text>
        <Text style={styles.endTitle}>{chapterTitle}</Text>
        {nextChapterId ? (
          <GradientButton size="lg" label="Next Chapter" icon="chevron-right" onPress={() => goChapter(nextChapterId)} style={{ marginTop: space.lg }} />
        ) : (
          <Text style={{ ...type.body, marginTop: 6 }}>You're all caught up. 🎉</Text>
        )}
        <View style={{ flexDirection: 'row', marginTop: space.md, gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <GhostButton label="Previous" icon="chevron-left" disabled={!prevChapter} onPress={() => prevChapter && goChapter(prevChapter)} />
          </View>
          <View style={{ flex: 1 }}>
            <GhostButton label="Series" icon="book-open" onPress={() => navigation.navigate('MangaDetail', { id: mangaId })} />
          </View>
        </View>
      </View>
      )}
      {subscription && mangaOwner?.wallet_address && mangaOwner.wallet_address !== activeWalletAddress ? (
        <Panel accent={colors.primary} style={{ marginHorizontal: space.lg, marginBottom: space.md, padding: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.earnIcon, { backgroundColor: colors.primary }]}>
              <Icon name="comments" size={16} color="#fff" solid />
            </View>
            <View style={{ flex: 1, marginRight: space.md }}>
              <Text style={type.bodyStrong}>You're subscribed</Text>
              <Text style={type.caption} numberOfLines={1}>
                Chat with {mangaOwner?.name || 'the artist'} — they can reply right here.
              </Text>
            </View>
            <GradientButton
              full={false}
              size="sm"
              label="Message"
              icon="comment-dots"
              onPress={() => navigation.navigate('Chat', { chatId: mangaOwner.wallet_address })}
            />
          </View>
        </Panel>
      ) : null}
      <MangaCommentSection
        mangaId={mangaId}
        chapterId={chapterId}
        isWalletConnected={isWalletConnected}
        activePublicKey={activePublicKey}
      />
      <View style={{ height: 90 }} />
    </View>
  );

  const reader = (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={renderPage}
        keyExtractor={(item) => item.page_number.toString()}
        ListHeaderComponent={readerHeader}
        ListFooterComponent={readerFooter}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        showsVerticalScrollIndicator={false}
      />

      {chromeVisible ? (
        <>
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.topBar}>
            <IconButton icon="chevron-left" label="Go back" onPress={goBackToSeries} size={38} />
            <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: space.sm }}>
              <Text numberOfLines={1} style={styles.barTitle}>{manga.title}</Text>
              <Text numberOfLines={1} style={type.caption}>{chapterTitle}</Text>
            </View>
            <View style={styles.miniStat}>
              <Icon name="star" size={10} color={colors.gold} solid />
              <Text style={styles.miniStatText}>{weeklyPoints !== null ? formatNumber(weeklyPoints) : '…'}</Text>
            </View>
          </Animated.View>
          <View style={styles.progressTrack} pointerEvents="none">
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 3, width: `${progress * 100}%` }} />
          </View>

          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.bottomBar}>
            <IconButton icon="step-backward" label="Previous chapter" size={42} onPress={() => prevChapter && goChapter(prevChapter)} style={{ opacity: prevChapter ? 1 : 0.35 }} />
            <View style={styles.pageIndicator}>
              <Text style={styles.pageText}>{currentPage}</Text>
              <Text style={styles.pageTotal}> / {pages.length}</Text>
            </View>
            <IconButton icon="step-forward" label="Next chapter" size={42} tone="primary" onPress={() => nextChapterId && goChapter(nextChapterId)} style={{ opacity: nextChapterId ? 1 : 0.35 }} />
          </Animated.View>
        </>
      ) : null}
    </View>
  );

  const unlockLabel =
    transactionDetails?.paymentType === 'threeChapters'
      ? '3 chapters'
      : transactionDetails?.paymentType === 'fullChapters'
      ? 'all chapters'
      : `Chapter ${chapterNum}`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <Screen>
        {isLocked && !isFirstChapter ? paywall : reader}
        {toast}
      </Screen>

      {/* Confirm transaction — the wallet context shows its own auth modal
          (password or biometrics) when signing, same as SwapScreen */}
      <Sheet
        visible={showTransactionPopup}
        onClose={closeTx}
        title="Confirm payment"
        footer={
          <View>
            <GradientButton label={paying ? 'Processing…' : 'Confirm & pay'} icon="shield-alt" onPress={handleConfirmPayment} loading={paying} disabled={paying} />
            <View style={{ height: space.sm }} />
            <GhostButton label="Cancel" onPress={closeTx} disabled={paying} />
            <Text style={styles.modalNote}>You'll be asked to confirm with your wallet.</Text>
          </View>
        }
      >
        <View style={styles.txHero}>
          <Text style={type.label}>Unlock {unlockLabel}</Text>
          <Text style={styles.txAmount}>
            {transactionDetails?.displayAmount} <Text style={styles.txCurrency}>{transactionDetails?.currency}</Text>
          </Text>
          <Text style={type.body}>≈ ${Number(transactionDetails?.chapterPrice || 0).toFixed(2)} USD</Text>
        </View>
        <View style={styles.txRows}>
          <View style={styles.txRow}>
            <Text style={type.caption}>From</Text>
            <Text style={styles.txValue}>{activeWalletAddress?.slice(0, 6)}…{activeWalletAddress?.slice(-4)}</Text>
          </View>
          <Divider style={{ marginVertical: 0 }} />
          <View style={styles.txRow}>
            <Text style={type.caption}>To</Text>
            <Text style={styles.txValue}>{MERCHANT_WALLET?.slice(0, 6)}…{MERCHANT_WALLET?.slice(-4)}</Text>
          </View>
        </View>
      </Sheet>

      {/* Pioneer Badge Modal */}
      <Sheet
        visible={showPioneerModal}
        onClose={() => setShowPioneerModal(false)}
        title="🏆 Pioneer Badge"
        tall
      >
        <View style={{ alignItems: 'center', marginBottom: space.lg }}>
          <Image source={pioneerBadge} style={{ width: 120, height: 48, resizeMode: 'contain' }} />
          <Text style={[type.h2, { marginTop: space.md, color: colors.gold }]}>You're a Pioneer!</Text>
          <Text style={[type.body, { marginTop: space.sm, textAlign: 'center' }]}>
            You're the first reader to support this writer. As a thank you, you can claim a special Pioneer badge for your profile.
          </Text>
        </View>

        <Panel style={{ marginBottom: space.lg }}>
          <SectionHeader title="Writer ATA Payload" icon="code" />
          <View style={{ backgroundColor: colors.bgCard, padding: space.md, borderRadius: radius.md, marginTop: space.sm }}>
            <Text style={[type.caption, { color: colors.textMute, marginBottom: space.xs }]}>Mint:</Text>
            <Text style={[type.body, { fontFamily: 'monospace', marginBottom: space.sm }]}>{pioneerPayload?.mint}</Text>
            <Text style={[type.caption, { color: colors.textMute, marginBottom: space.xs }]}>Owner:</Text>
            <Text style={[type.body, { fontFamily: 'monospace', marginBottom: space.sm }]}>{pioneerPayload?.owner}</Text>
            <Text style={[type.caption, { color: colors.textMute, marginBottom: space.xs }]}>ATA:</Text>
            <Text style={[type.body, { fontFamily: 'monospace' }]}>{pioneerPayload?.ata}</Text>
          </View>
        </Panel>

        <View style={{ marginTop: space.lg }}>
          <GradientButton
            label="Claim Pioneer Badge"
            icon="award"
            onPress={() => {
              // Badge was already granted server-side by claim-pioneer-badge
              setSuccessMessage('🏆 Congratulations! You have earned the Pioneer badge!');
              setTimeout(() => setSuccessMessage(''), 5000);
              setShowPioneerModal(false);
            }}
          />
          <View style={{ height: space.sm }} />
          <GhostButton
            label="Decline"
            onPress={() => setShowPioneerModal(false)}
          />
        </View>
      </Sheet>

      {/* ATA Funding Modal */}
      <Sheet
        visible={showAtaFundingModal}
        onClose={() => setShowAtaFundingModal(false)}
        title="💰 Writer ATA Setup"
        tall
      >
        <View style={{ alignItems: 'center', marginBottom: space.lg }}>
          <Text style={[type.h2, { marginTop: space.md, color: colors.gold }]}>Writer Missing ATA</Text>
          <Text style={[type.body, { marginTop: space.sm, textAlign: 'center' }]}>
            This writer doesn't have an SMP Associated Token Account (ATA) yet. Without it, their payment share will be rerouted to the treasury.
          </Text>
          <Text style={[type.body, { marginTop: space.sm, textAlign: 'center' }]}>
            Would you like to fund the ATA creation (~0.002 SOL) so the writer can receive their payment directly?
          </Text>
        </View>

        <Panel style={{ marginBottom: space.lg }}>
          <SectionHeader title="ATA Details" icon="code" />
          <View style={{ backgroundColor: colors.bgCard, padding: space.md, borderRadius: radius.md, marginTop: space.sm }}>
            <Text style={[type.caption, { color: colors.textMute, marginBottom: space.xs }]}>Writer Wallet:</Text>
            <Text style={[type.body, { fontFamily: 'monospace', marginBottom: space.sm }]}>{mangaOwner?.wallet_address?.slice(0, 8)}...</Text>
            <Text style={[type.caption, { color: colors.textMute, marginBottom: space.xs }]}>ATA Address:</Text>
            <Text style={[type.body, { fontFamily: 'monospace', marginBottom: space.sm }]}>{writerAtaAddress?.slice(0, 8)}...</Text>
            <Text style={[type.caption, { color: colors.textMute, marginBottom: space.xs }]}>Funding Cost:</Text>
            <Text style={[type.body, { fontFamily: 'monospace' }]}>~0.002 SOL</Text>
          </View>
        </Panel>

        <View style={{ marginTop: space.lg }}>
          <GradientButton
            label="Fund ATA & Proceed"
            icon="send"
            onPress={async () => {
              setShowAtaFundingModal(false);
              // Show transaction popup with ATA funding included
              setShowTransactionPopup(true);
            }}
          />
          <View style={{ height: space.sm }} />
          <GhostButton
            label="Skip ATA Funding"
            onPress={() => {
              setShowAtaFundingModal(false);
              // Proceed without ATA funding
              setShowTransactionPopup(true);
            }}
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
};

export default MangaChapterScreen;
