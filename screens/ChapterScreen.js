import React, { useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  Image,
  TouchableOpacity,
  Modal,
  StatusBar,
  SafeAreaView,
  Linking,
  Alert,
  ActivityIndicator,
  Share,
  TextInput,
  Platform,
} from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import Tts from 'react-native-tts';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import { getNovelForOffline, isErrorNetworkError } from '../services/offlineCache';
import { safeFetch } from '../utils/urlValidation';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, createTransferInstruction, createBurnInstruction } from '@solana/spl-token';
import {
  RPC_URL,
  FALLBACK_RPC_URL,
  SMP_MINT_ADDRESS,
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
  SKR_DECIMALS,
  SMP_DECIMALS,
  AMETHYST_MINT_ADDRESS,
  AMETHYST_DECIMALS,
  WEB_API_BASE_URL,
} from '../constants';
import CommentSection from '../components/Comments/CommentSection';
import UBBadge from '../components/UBBadge';
import AutopaySettings from '../components/AutopaySettings';
import { CardStyleInterpolators } from '@react-navigation/stack';
import { formatNumber } from '../utils/formatNumber';
import { useTheme } from '../context/ThemeContext';
import { getChapterScreenStyles } from '../styles/ChapterScreenStyles';
import pioneerBadge from '../assets/Pioneer.png';
import { useReadingTimer, formatReadingTime } from '../hooks/useReadingTimer';
import { saveReadingProgress, getContentReadingProgress } from '../services/readingProgress';

const { height } = Dimensions.get('window');

// Create connection with fallback logic
const connection = new Connection(RPC_URL, 'confirmed', {
  confirmTransactionInitialTimeout: 60000,
});

const MIN_ATA_SOL = 0.00103928;
const MIN_USER_SOL = 0.001;

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

// Poll getSignatureStatuses instead of confirmTransaction — the websocket
// subscription used by confirmTransaction often never connects in React
// Native / on rate-limited RPC, which hangs payment flows indefinitely.
const waitForSignature = async (connection, signature, lastValidBlockHeight, timeoutMs = 45000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { value } = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
      const st = value?.[0];
      if (st?.err) throw new Error('Transaction failed on-chain.');
      if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return true;
      const height = await connection.getBlockHeight('confirmed');
      if (height > lastValidBlockHeight) return false;
    } catch (e) {
      if (e.message === 'Transaction failed on-chain.') throw e;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
};

// Create writer ATA
const createWriterAta = async (walletAddress, publicKey, signAndSendTransaction) => {
  try {
    const smpMint = new PublicKey(SMP_MINT_ADDRESS);
    const writerPublicKey = new PublicKey(walletAddress);
    const writerATA = getAssociatedTokenAddressSync(smpMint, writerPublicKey);

    // Check if ATA already exists
    const existingAta = await connection.getAccountInfo(writerATA);
    if (existingAta) {
      if (__DEV__) console.log('[createWriterAta] ATA already exists, skipping creation');
      return true;
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const ataTransaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: publicKey,
    }).add(
      createAssociatedTokenAccountInstruction(
        publicKey,
        writerATA,
        writerPublicKey,
        smpMint
      )
    );

    const ataSignature = await signAndSendTransaction(ataTransaction);
    if (__DEV__) console.log('[createWriterAta] ATA created:', ataSignature);

    const landed = await waitForSignature(connection, ataSignature, lastValidBlockHeight);
    if (!landed) {
      throw new Error('ATA creation transaction was not confirmed. Please check your wallet before retrying.');
    }

    return true;
  } catch (error) {
    console.error('[createWriterAta] Error:', error.message);
    throw error;
  }
};

const SQUADS_WALLET = new PublicKey("71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD");
const TREASURY_WALLET = new PublicKey("71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD");
const FOUNDER_FUND_WALLET = new PublicKey("71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD");
const SEMPAI_HQ_WALLET = new PublicKey("71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD");

// Ad video configuration - use local asset
const AD_VIDEO_URI = require('../assets/ad_video.mp4');

// USD cost of unlocking a single chapter. Centralized here so the displayed
// SMP cost (SMP_READ_COST) and the amount actually charged on-chain
// (processChapterPayment) can never drift apart.
const CHAPTER_READ_USD_COST = 0.0025; // Reduced for testing

// ---------------------------------------------------------------------------
// Live pricing (Jupiter)
// ---------------------------------------------------------------------------
const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const PRICE_CACHE_KEY = 'kaito_live_price_cache_v2';
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const priceV3Endpoint = (ids) => `https://lite-api.jup.ag/price/v3?ids=${ids.join(',')}`;
const quoteEndpoint = (inputMint, amountBaseUnits) =>
  `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${USDC_MINT_ADDRESS.toString()}&amount=${amountBaseUnits}&slippageBps=50`;

async function fetchQuoteDerivedUsdcPrice(mint, decimals) {
  try {
    const amount = Math.round(10 ** decimals); // 1 whole token, in base units
    const res = await fetch(quoteEndpoint(mint, amount));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.outAmount) return null;
    return Number(data.outAmount) / 10 ** 6; // USDC has 6 decimals
  } catch (err) {
    console.error('[fetchQuoteDerivedUsdcPrice] Error:', err.message);
    return null;
  }
}

async function fetchSmpFallbackPrice() {
  try {
    const res = await fetch(`${WEB_API_BASE_URL}/api/smp-fallback-price`);
    if (!res.ok) {
      console.warn('[fetchSmpFallbackPrice] Web API unavailable');
      return null;
    }
    const data = await res.json();
    if (data?.fallbackPrice) {
      return 1 / data.fallbackPrice;
    }
    return null;
  } catch (err) {
    console.error('[fetchSmpFallbackPrice] Error:', err.message);
    return null;
  }
}

function splitAmountWithResidual(amount, ratios) {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  const r = [];
  let runningTotal = 0;
  for (let i = 0; i < ratios.length - 1; i++) {
    r[i] = Math.floor((amount * ratios[i]) / totalRatio);
    runningTotal += r[i];
  }
  r[ratios.length - 1] = amount - runningTotal;
  return r;
}

async function createBenefactorPaymentTransaction({ paymentMint, paymentAmount, userPublicKey, authorPublicKey }) {
  const [authorAmount, treasuryAmount] = splitAmountWithResidual(paymentAmount, [80, 20]);
  const instructions = [];

  if (!paymentMint) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: authorPublicKey,
        lamports: authorAmount,
      }),
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: TREASURY_WALLET,
        lamports: treasuryAmount,
      })
    );
  } else {
    const userAta = await getAssociatedTokenAddressSync(paymentMint, userPublicKey);
    const authorAta = await getAssociatedTokenAddressSync(paymentMint, authorPublicKey);
    const treasuryAta = await getAssociatedTokenAddressSync(paymentMint, TREASURY_WALLET);

    instructions.push(
      createTransferInstruction(userAta, authorAta, userPublicKey, authorAmount),
      createTransferInstruction(userAta, treasuryAta, userPublicKey, treasuryAmount)
    );
  }

  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = userPublicKey;
  return tx;
}

async function createPaymentTransactionClient({ paymentMint, paymentAmount, userPublicKey, authorPublicKey, smpMintAddress }) {
  const [creatorAmount, sempaiHqAmount, founderFundAmount] = splitAmountWithResidual(paymentAmount, [50, 30, 20]);
  const instructions = [];

  if (!paymentMint) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: authorPublicKey,
        lamports: creatorAmount,
      }),
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: SEMPAI_HQ_WALLET,
        lamports: sempaiHqAmount,
      }),
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: FOUNDER_FUND_WALLET,
        lamports: founderFundAmount,
      })
    );
  } else {
    const userAta = getAssociatedTokenAddressSync(paymentMint, userPublicKey);
    const creatorAta = getAssociatedTokenAddressSync(paymentMint, authorPublicKey);
    const sempaiHqAta = getAssociatedTokenAddressSync(paymentMint, SEMPAI_HQ_WALLET, true);
    const founderFundAta = getAssociatedTokenAddressSync(paymentMint, FOUNDER_FUND_WALLET, true);

    // Check user ATA first - if it doesn't exist, we can't proceed
    const userAtaInfo = await connection.getAccountInfo(userAta);
    if (!userAtaInfo) {
      throw new Error('You do not have an SMP token account. Please get some SMP tokens first.');
    }

    const [creatorAtaInfo, sempaiHqAtaInfo, founderFundAtaInfo] = await connection.getMultipleAccountsInfo([
      creatorAta,
      sempaiHqAta,
      founderFundAta,
    ]);

    const userBalance = await connection.getBalance(userPublicKey);
    const ataRentExemption = Math.ceil(0.00203928 * 1e9); // lamports per ATA
    const TX_FEE_LAMPORTS = 5000;

    // Budget ALL missing ATAs up front. The founder fund ATA is the reroute
    // sink, so it gets creation priority when the wallet can't afford them all.
    const ataSpecs = [
      { key: 'ff', ata: founderFundAta, owner: FOUNDER_FUND_WALLET, exists: !!founderFundAtaInfo },
      { key: 'creator', ata: creatorAta, owner: authorPublicKey, exists: !!creatorAtaInfo },
      { key: 'hq', ata: sempaiHqAta, owner: SEMPAI_HQ_WALLET, exists: !!sempaiHqAtaInfo },
    ];
    const creatable = new Set();
    let ataBudget = userBalance - TX_FEE_LAMPORTS;
    for (const spec of ataSpecs) {
      if (spec.exists) continue;
      if (ataBudget >= ataRentExemption) {
        creatable.add(spec.key);
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPublicKey,
            spec.ata,
            spec.owner,
            paymentMint
          )
        );
        ataBudget -= ataRentExemption;
      }
    }

    const ffReady = ataSpecs[0].exists || creatable.has('ff');
    if (!ffReady) {
      throw new Error('Insufficient SOL to create required token accounts. Please add SOL to your wallet.');
    }
    const creatorReady = ataSpecs[1].exists || creatable.has('creator');
    const hqReady = ataSpecs[2].exists || creatable.has('hq');

    let reroutedToFounderFund = 0;
    if (creatorReady) {
      instructions.push(createTransferInstruction(userAta, creatorAta, userPublicKey, creatorAmount));
    } else {
      reroutedToFounderFund += creatorAmount;
    }
    if (hqReady) {
      instructions.push(createTransferInstruction(userAta, sempaiHqAta, userPublicKey, sempaiHqAmount));
    } else {
      reroutedToFounderFund += sempaiHqAmount;
    }

    const totalFounderFundAmount = founderFundAmount + reroutedToFounderFund;
    instructions.push(createTransferInstruction(userAta, founderFundAta, userPublicKey, totalFounderFundAmount));

    if (smpMintAddress && paymentMint.equals(smpMintAddress)) {
      instructions.push(createBurnInstruction(userAta, paymentMint, userPublicKey, founderFundAmount));
    }
  }

  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = userPublicKey;
  return tx;
}

const ChapterScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { novelId, chapterId } = route.params || {};
  const { wallet, isWalletConnected: contextWalletConnected, signAndSendTransaction } = useContext(EmbeddedWalletContext);
  const { isDark, colors } = useTheme();
  const styles = getChapterScreenStyles(isDark);

  const [novel, setNovel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [inputNovelId, setInputNovelId] = useState('');
  const [inputChapterId, setInputChapterId] = useState('');
  const [useInput, setUseInput] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [userId, setUserId] = useState(null);
  const [advanceInfo, setAdvanceInfo] = useState(null);

  // Restore user ID from AsyncStorage (works offline)
  useEffect(() => {
    (async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('offline_user_id');
        if (storedUserId) {
          if (__DEV__) console.log('[ChapterScreen] Restored user ID from storage:', storedUserId);
          setUserId(storedUserId);
        }
      } catch (e) {
        console.error('[ChapterScreen] Failed to restore user ID:', e);
      }
    })();
  }, []);
  const [canUnlockNextThree, setCanUnlockNextThree] = useState(false);
  const [readingMode, setReadingMode] = useState('free');
  const [smpBalance, setSmpBalance] = useState(0);
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [amethystBalance, setAmethystBalance] = useState(0);
  const [skrBalance, setSkrBalance] = useState(0);
  const [showTransactionPopup, setShowTransactionPopup] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [solPrice, setSolPrice] = useState(100); // Live SOL price in USD (fallback until first fetch resolves)
  const [smpPrice, setSmpPrice] = useState(0.01); // Live SMP price in USD (fallback until first fetch resolves)
  const [pricesAreLive, setPricesAreLive] = useState(false); // false = showing fallback, not confirmed live data
  const [recentlyUnlocked, setRecentlyUnlocked] = useState(false);
  const [hasReadChapter, setHasReadChapter] = useState(false);
  const [showPioneerModal, setShowPioneerModal] = useState(false);
  const [isClaimingPioneer, setIsClaimingPioneer] = useState(false);
  const [pioneerPayload, setPioneerPayload] = useState(null);
  const [currentCreatorId, setCurrentCreatorId] = useState(null);
  const [showAtaFundingModal, setShowAtaFundingModal] = useState(false);
  const [writerHasAta, setWriterHasAta] = useState(true);
  const [ataFundingCost, setAtaFundingCost] = useState(0);
  const [writerAtaAddress, setWriterAtaAddress] = useState(null);
  const [pendingPaymentDetails, setPendingPaymentDetails] = useState(null);
  const [pendingAuthorData, setPendingAuthorData] = useState(null);
  const usdcPrice = 1; // USDC is pegged to $1
  const [isAdvanceChapter, setIsAdvanceChapter] = useState(false);
  const [isUnlockedViaSubscription, setIsUnlockedViaSubscription] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const paymentInProgressRef = useRef(false);
  const [isOnline, setIsOnline] = useState(null);
  const emberAnims = useRef([]);

  // Reading time tracking
  // Only track reading time once the chapter is actually unlocked —
  // a locked/paywalled chapter must not accumulate reading sessions.
  const { isTracking, getCurrentDuration } = useReadingTimer(isLocked ? null : userId, novelId, chapterId);
  const embersData = useRef([]);
  const embersInitialized = useRef(false);

  // Calculate if user has insufficient SMP balance
  const hasInsufficientSmp = smpBalance < (SMP_READ_COST / 10 ** SMP_DECIMALS);

  // Ad unlock system
  const [hasUsedAdUnlockToday, setHasUsedAdUnlockToday] = useState(false);
  const [showAdOption, setShowAdOption] = useState(false);
  const [showVideoAd, setShowVideoAd] = useState(false);
  const videoRef = useRef(null);
  const [status, setStatus] = useState({});
  const [watchDuration, setWatchDuration] = useState(0);
  const [adWatched, setAdWatched] = useState(false);

  // Benefactor subscription system
  const [benefactorAccess, setBenefactorAccess] = useState(null);
  const [showBenefactorOption, setShowBenefactorOption] = useState(false);
  const [showBenefactorModal, setShowBenefactorModal] = useState(false);
  const [selectedBenefactorToken, setSelectedBenefactorToken] = useState('USDC');
  const [hasWriterBadge, setHasWriterBadge] = useState(false);
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [autopayPreferenceLoaded, setAutopayPreferenceLoaded] = useState(false);
  const [solBalance, setSolBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState(null);
  
  // Payment animation
  const [showPaymentAnimation, setShowPaymentAnimation] = useState(false);
  const paymentAnimationProgress = useRef(new Animated.Value(0)).current;
  const paymentPulseAnimation = useRef(new Animated.Value(1)).current;

  // Animate payment processing
  useEffect(() => {
    if (showPaymentAnimation) {
      // Reset animations
      paymentAnimationProgress.setValue(0);
      paymentPulseAnimation.setValue(1);
      
      // Create pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(paymentPulseAnimation, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(paymentPulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      
      // Create progress animation
      const progressAnimation = Animated.timing(paymentAnimationProgress, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      });
      
      pulseAnimation.start();
      progressAnimation.start();
      
      return () => {
        pulseAnimation.stop();
        progressAnimation.stop();
      };
    }
  }, [showPaymentAnimation]);
  const planAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const planDetailsAnimation = useRef(new Animated.Value(0)).current;

  // Rating system
  const [userRating, setUserRating] = useState(null);
  const [averageRating, setAverageRating] = useState(null);

  // Text-to-speech
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Chapter selector
  const [showChapterSelector, setShowChapterSelector] = useState(false);

  // Author's note system
  const [authorNote, setAuthorNote] = useState('');
  const [isEditingAuthorNote, setIsEditingAuthorNote] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);

  // Fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize ember particles
  useEffect(() => {
    if (embersInitialized.current) return;

    try {
      const embers = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 6 + Math.random() * 4,
      }));
      embersData.current = embers;

      // Only initialize Animated.Value if Animated is available
      if (Animated && Animated.Value) {
        emberAnims.current = embers.map(() => new Animated.Value(0));

        emberAnims.current.forEach((anim, index) => {
          if (Animated.loop && Animated.sequence && Animated.delay && Animated.timing) {
            Animated.loop(
              Animated.sequence([
                Animated.delay(embers[index].delay * 1000),
                Animated.timing(anim, {
                  toValue: 1,
                  duration: embers[index].duration * 1000,
                  useNativeDriver: true,
                }),
              ])
            ).start();
          }
        });
      }

      embersInitialized.current = true;
    } catch (error) {
      console.error('Error initializing ember particles:', error);
    }
  }, []);

  // Check network status
  useEffect(() => {
    let lastOnline = null;
    const checkNetworkStatus = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const online = networkState.isConnected && networkState.type !== 'none';
        setIsOnline(online);
        if (online !== lastOnline) {
          lastOnline = online;
          if (__DEV__) console.log('[ChapterScreen] Network status:', online ? 'online' : 'offline');
        }
      } catch (error) {
        console.error('[ChapterScreen] Error checking network status:', error);
        setIsOnline(true);
      }
    };

    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = useMemo(() => {
    try {
      return wallet?.publicKey ? new PublicKey(wallet.publicKey) : null;
    } catch (err) {
      console.error('[activePublicKey] Error:', err);
      setError('Invalid wallet public key.');
      return null;
    }
  }, [wallet?.publicKey]);

  const activeWalletAddress = activePublicKey?.toString();

  // Dynamic SMP cost for CHAPTER_READ_USD_COST, using the live SMP price
  const SMP_READ_COST = useMemo(() => {
    if (!smpPrice || smpPrice <= 0) {
      console.warn('[SMP_READ_COST] Invalid SMP price, using default value');
      return 250000000; // Fallback: 0.0025 USD / 0.00000001 USD per SMP = 250,000,000 (6 decimals)
    }
    const costInSmp = Math.ceil((CHAPTER_READ_USD_COST / smpPrice) * 10 ** SMP_DECIMALS);
    if (__DEV__) console.log('[SMP_READ_COST] Calculated SMP cost for $' + CHAPTER_READ_USD_COST + ':', costInSmp, 'SMP price:', smpPrice);
    return costInSmp;
  }, [smpPrice]);

  // Fetch live SOL + SMP prices from Jupiter, with a short-lived cache and a
  // /quote-based fallback for any mint Jupiter's price index omits.
  const fetchPrices = useCallback(async () => {
    try {
      const cachedRaw = await SecureStore.getItemAsync(PRICE_CACHE_KEY);
      if (cachedRaw) {
        try {
          const { timestamp, solPrice: cachedSol, smpPrice: cachedSmp } = JSON.parse(cachedRaw);
          if (Date.now() - timestamp < PRICE_CACHE_TTL_MS && cachedSol > 0 && cachedSmp > 0) {
            if (__DEV__) console.log('[fetchPrices] Using cached prices:', { solPrice: cachedSol, smpPrice: cachedSmp });
            setSolPrice(cachedSol);
            setSmpPrice(cachedSmp);
            setPricesAreLive(true);
            return;
          }
          if (__DEV__) console.warn('[fetchPrices] Cache expired or invalid, fetching new prices');
        } catch (err) {
          console.error('[fetchPrices] Cache parse error:', err.message);
          await SecureStore.deleteItemAsync(PRICE_CACHE_KEY);
        }
      }

      let liveSolPrice = null;
      let liveSmpPrice = null;

      try {
        const ids = [SOL_MINT_ADDRESS, SMP_MINT_ADDRESS.toString(), USDC_MINT_ADDRESS.toString()];
        const res = await fetch(priceV3Endpoint(ids));
        if (!res.ok) throw new Error(`Price API error: ${res.status}`);
        const json = await res.json();

        liveSolPrice = json?.[SOL_MINT_ADDRESS]?.usdPrice || null;
        liveSmpPrice = json?.[SMP_MINT_ADDRESS.toString()]?.usdPrice || null;

        // v3 silently drops low-liquidity / single-pool tokens (SMP's lone
        // Meteora pool is exactly that profile) — fall back to a live quote.
        if (!liveSmpPrice) {
          liveSmpPrice = await fetchQuoteDerivedUsdcPrice(SMP_MINT_ADDRESS.toString(), SMP_DECIMALS);
          // If Jupiter quote also fails, try web API fallback
          if (!liveSmpPrice) {
            liveSmpPrice = await fetchSmpFallbackPrice();
            if (liveSmpPrice) {
              if (__DEV__) console.log('[fetchPrices] Using web API fallback for SMP price');
            }
          }
        }
        if (!liveSolPrice) {
          liveSolPrice = await fetchQuoteDerivedUsdcPrice(SOL_MINT_ADDRESS, 9);
        }
      } catch (err) {
        console.error('[fetchPrices] Live price fetch failed:', err.message);
      }

      if (liveSolPrice && liveSmpPrice) {
        setSolPrice(liveSolPrice);
        setSmpPrice(liveSmpPrice);
        setPricesAreLive(true);
        await SecureStore.setItemAsync(
          PRICE_CACHE_KEY,
          JSON.stringify({ timestamp: Date.now(), solPrice: liveSolPrice, smpPrice: liveSmpPrice })
        );
        if (__DEV__) console.log('[fetchPrices] Live prices cached:', { solPrice: liveSolPrice, smpPrice: liveSmpPrice });
      } else {
        // Total failure (no network, both API paths down): keep whatever
        // was already in state (last good value) rather than silently
        // resetting to a made-up number, and flag prices as non-live so the
        // UI can warn the user costs shown may be stale.
        console.warn('[fetchPrices] Live pricing unavailable — keeping last known values.');
        setPricesAreLive(false);
      }
    } catch (err) {
      console.error('[fetchPrices] Error:', err.message);
      setPricesAreLive(false);
    }
  }, []);

  const fetchSmpBalanceOnChain = useCallback(async (retryCount = 3, retryDelay = 1000) => {
    if (!activeWalletAddress || !activePublicKey) return 0;

    // Skip if offline or status unknown
    if (isOnline === false || isOnline === null) {
      if (__DEV__) console.log('[fetchSmpBalanceOnChain] Offline - skipping RPC call');
      return 0;
    }

    const rpcUrls = [RPC_URL, FALLBACK_RPC_URL];
    let lastError = null;

    for (const rpcUrl of rpcUrls) {
      for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
          const fallbackConnection = new Connection(rpcUrl, 'confirmed');
          const smpMint = new PublicKey(SMP_MINT_ADDRESS);
          const ataAddress = await getAssociatedTokenAddress(smpMint, activePublicKey);
          const ataInfo = await fallbackConnection.getAccountInfo(ataAddress);
          if (!ataInfo) {
            if (__DEV__) console.log(`[fetchSmpBalanceOnChain] No ATA found for SMP, returning 0`);
            setSmpBalance(0);
            return 0;
          }
          const balance = Number(ataInfo.data.readBigUInt64LE(64)) / 10 ** SMP_DECIMALS;
          if (__DEV__) console.log(`[fetchSmpBalanceOnChain] SMP balance:`, balance);
          setSmpBalance(balance);
          return balance;
        } catch (error) {
          lastError = error;
          console.error(`[fetchSmpBalanceOnChain] Attempt ${attempt} error:`, error.message);

          // Handle RPC authorization issues gracefully
          if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            console.warn('[fetchSmpBalanceOnChain] RPC authorization issue, trying next RPC');
            break; // Try next RPC
          }

          if (attempt === retryCount) {
            console.warn(`[fetchSmpBalanceOnChain] All attempts failed, trying next RPC`);
            break; // Try next RPC
          }
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    // All RPCs failed
    setError('Unable to fetch SMP balance.');
    setTimeout(() => setError(null), 5000);
    return 0;
  }, [activeWalletAddress, activePublicKey, isOnline]);

  const fetchTokenBalances = useCallback(async () => {
    // Skip if offline
    if (isOnline === false || isOnline === null) {
      return;
    }

    if (!activeWalletAddress || !activePublicKey) {
      setSolBalance(0);
      setUsdcBalance(0);
      setSkrBalance(0);
      return;
    }

    try {
      // Fetch SOL balance
      const solBal = await connection.getBalance(activePublicKey);
      setSolBalance(solBal / 1e9);

      // Fetch USDC balance
      const usdcMint = new PublicKey(USDC_MINT_ADDRESS);
      const usdcAta = await getAssociatedTokenAddress(usdcMint, activePublicKey);
      const usdcAtaInfo = await connection.getAccountInfo(usdcAta);
      if (usdcAtaInfo) {
        const usdcBal = Number(usdcAtaInfo.data.readBigUInt64LE(64)) / 1e6;
        setUsdcBalance(usdcBal);
      } else {
        setUsdcBalance(0);
      }

      // Fetch SKR balance
      const skrMint = new PublicKey(SKR_MINT_ADDRESS);
      const skrAta = await getAssociatedTokenAddress(skrMint, activePublicKey);
      const skrAtaInfo = await connection.getAccountInfo(skrAta);
      if (skrAtaInfo) {
        const skrBal = Number(skrAtaInfo.data.readBigUInt64LE(64)) / 1e6;
        setSkrBalance(skrBal);
      } else {
        setSkrBalance(0);
      }
    } catch (error) {
      console.error('[fetchTokenBalances] Error:', error.message);
      setSolBalance(0);
      setUsdcBalance(0);
      setSkrBalance(0);
    }
  }, [activeWalletAddress, activePublicKey]);

  const fetchAmethystBalance = useCallback(async () => {
    if (!activeWalletAddress || !activePublicKey) return 0;

    // Skip if offline or status unknown
    if (isOnline === false || isOnline === null) {
      if (__DEV__) console.log('[fetchAmethystBalance] Offline - skipping RPC call');
      return 0;
    }

    const rpcUrls = [RPC_URL, FALLBACK_RPC_URL];
    let lastError = null;

    for (const rpcUrl of rpcUrls) {
      try {
        const fallbackConnection = new Connection(rpcUrl, 'confirmed');
        const amethystMint = new PublicKey(AMETHYST_MINT_ADDRESS);
        const ataAddress = await getAssociatedTokenAddress(amethystMint, activePublicKey);
        const ataInfo = await fallbackConnection.getAccountInfo(ataAddress);
        const balance = ataInfo ? Number(ataInfo.data.readBigUInt64LE(64)) / 10 ** AMETHYST_DECIMALS : 0;
        if (__DEV__) console.log(`[fetchAmethystBalance] Balance:`, balance);
        setAmethystBalance(balance);
        return balance;
      } catch (error) {
        lastError = error;
        console.error(`[fetchAmethystBalance] Error:`, error.message);

        // Don't show error to user for RPC issues, just log it and try next RPC
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.warn('[fetchAmethystBalance] RPC authorization issue, trying next RPC');
          continue;
        }
        console.warn(`[fetchAmethystBalance] Failed, trying next RPC`);
      }
    }

    // All RPCs failed
    console.error('[fetchAmethystBalance] All RPCs failed:', lastError);
    setAmethystBalance(0);
    return 0;
  }, [activeWalletAddress, activePublicKey, isOnline]);

  const fetchSkrBalance = useCallback(async () => {
    if (!activeWalletAddress || !activePublicKey) return 0;

    // Skip if offline or status unknown
    if (isOnline === false || isOnline === null) {
      if (__DEV__) console.log('[fetchSkrBalance] Offline - skipping RPC call');
      return 0;
    }

    const rpcUrls = [RPC_URL, FALLBACK_RPC_URL];
    let lastError = null;

    for (const rpcUrl of rpcUrls) {
      try {
        const fallbackConnection = new Connection(rpcUrl, 'confirmed');
        const skrMint = new PublicKey(SKR_MINT_ADDRESS);
        const ataAddress = await getAssociatedTokenAddress(skrMint, activePublicKey);
        const ataInfo = await fallbackConnection.getAccountInfo(ataAddress);
        const balance = ataInfo ? Number(ataInfo.data.readBigUInt64LE(64)) / 10 ** SKR_DECIMALS : 0;
        if (__DEV__) console.log(`[fetchSkrBalance] Balance:`, balance);
        setSkrBalance(balance);
        return balance;
      } catch (error) {
        lastError = error;
        console.error(`[fetchSkrBalance] Error:`, error.message);

        // Don't show error to user for RPC issues, just log it and try next RPC
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.warn('[fetchSkrBalance] RPC authorization issue, trying next RPC');
          continue;
        }
        console.warn(`[fetchSkrBalance] Failed, trying next RPC`);
      }
    }

    // All RPCs failed
    console.error('[fetchSkrBalance] All RPCs failed:', lastError);
    setSkrBalance(0);
    return 0;
  }, [activeWalletAddress, activePublicKey, isOnline]);

  const fetchUserData = useCallback(async () => {
    // Skip if offline
    if (isOnline === false || isOnline === null) {
      if (__DEV__) console.log('[ChapterScreen] Offline - skipping user data fetch');
      return;
    }

    if (!activeWalletAddress) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, weekly_points')
        .eq('wallet_address', activeWalletAddress)
        .single();
      if (error) throw new Error(error.message);
      setUserId(data.id);
      setWeeklyPoints(data.weekly_points || 0);
      await Promise.all([fetchSmpBalanceOnChain(), fetchAmethystBalance(), fetchSkrBalance()]);

      // Check ad unlock eligibility
      const chapterNum = parseInt(chapterId, 10);
      const today = new Date().toISOString().split('T')[0];
      const { data: todayUnlock, error: todayError } = await supabase
        .from('ad_based_unlocks')
        .select('id')
        .eq('user_id', data.id)
        .gte('ad_watched_at', today)
        .limit(1);

      const hasUsedToday = todayUnlock && todayUnlock.length > 0;
      setHasUsedAdUnlockToday(hasUsedToday);

      const { data: chapterUnlock, error: chapterError } = await supabase
        .from('ad_based_unlocks')
        .select('id')
        .eq('user_id', data.id)
        .eq('novel_id', novelId)
        .eq('chapter_number', chapterNum)
        .maybeSingle();

      const isAdEligible = !hasUsedToday && !chapterUnlock;
      setShowAdOption(isAdEligible);

      // Check benefactor access — track locally so fetchUserData doesn't
      // depend on benefactorAccess state (a new object every fetch would
      // retrigger this callback in an infinite loop).
      let activeSubscription = null;
      let badgeHolder = false;
      const { data: novelData } = await supabase
        .from('novels')
        .select('user_id')
        .eq('id', novelId)
        .single();

      if (novelData) {
        const writerId = novelData.user_id;
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('writer_subscriptions')
          .select('*')
          .eq('benefactor_wallet', activeWalletAddress)
          .eq('writer_id', writerId)
          .eq('is_active', true)
          .maybeSingle();

        if (subscriptionData && !subscriptionError) {
          if (new Date(subscriptionData.expires_at) <= new Date()) {
            await supabase
              .from('writer_subscriptions')
              .update({ is_active: false })
              .eq('id', subscriptionData.id);
            setBenefactorAccess(null);
          } else if (subscriptionData.chapters_remaining <= 0 && subscriptionData.plan_type !== 'gold') {
            setBenefactorAccess(null);
          } else {
            activeSubscription = subscriptionData;
            setBenefactorAccess(subscriptionData);
          }
        } else {
          setBenefactorAccess(null);
        }
      }

      // Check for writer badge access
      if (novel?.user_id) {
        const { data: userBadges, error: badgeError } = await supabase
          .from('user_badges')
          .select('badge_id')
          .eq('user_id', data.id)
          .maybeSingle();

        if (!badgeError && userBadges) {
          const { data: badge, error: badgeDetailError } = await supabase
            .from('badges')
            .select('writer_id')
            .eq('id', userBadges.badge_id)
            .single();

          if (!badgeDetailError && badge && badge.writer_id === novel.user_id) {
            badgeHolder = true;
            setHasWriterBadge(true);
          } else {
            setHasWriterBadge(false);
          }
        } else {
          setHasWriterBadge(false);
        }
      }

      setShowBenefactorOption(!activeSubscription && !badgeHolder);

      // Fetch autopay preference
      if (data.id) {
        const { data: autopayData } = await supabase
          .from('users')
          .select('autopay_enabled')
          .eq('id', data.id)
          .single();
        setAutopayEnabled(autopayData?.autopay_enabled || false);
      }
      setAutopayPreferenceLoaded(true);
    } catch (error) {
      console.error('[fetchUserData] Error:', error.message);
      setError('Failed to load user data.');
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress, fetchSmpBalanceOnChain, fetchAmethystBalance, novelId, chapterId, isOnline]);

  const fetchNovel = useCallback(async (id, chapter) => {
    if (!id) {
      setError('Invalid novel ID.');
      setLoading(false);
      return;
    }
    try {
      // If offline or status unknown, try cache first
      if (isOnline === false || isOnline === null) {
        if (__DEV__) console.log('[ChapterScreen] Offline/status unknown - loading novel from cache');
        const cachedData = await getNovelForOffline(id, userId || 'guest');
        if (cachedData) {
          if (__DEV__) console.log('[ChapterScreen] Novel loaded from cache:', cachedData.novel.title);
          setNovel(cachedData.novel);
          // Chapters are now in cachedData.chapters
          if (cachedData.chapters && cachedData.chapters.length > 0) {
            if (__DEV__) console.log('[ChapterScreen] Loaded', cachedData.chapters.length, 'chapters from cache');
          }
          setLoading(false);
          return;
        } else {
          if (__DEV__) console.log('[ChapterScreen] Novel not in cache');
          setError('Novel not available offline. Please save it for offline reading first.');
          setLoading(false);
          return;
        }
      }

      // Online - fetch from network
      // For chapters beyond 2 without wallet, don't fetch content - show connect wallet instead
      const chapterNum = parseInt(chapter, 10);
      if (__DEV__) console.log('[ChapterScreen] Fetching chapter:', chapter, 'parsed:', chapterNum, 'isWalletConnected:', isWalletConnected);
      
      if (chapterNum > 2 && !isWalletConnected) {
        if (__DEV__) console.log('[ChapterScreen] Chapter beyond 2 without wallet, skipping fetch');
        // Let the UI show the connect wallet message
        setLoading(false);
        return;
      }

      let { data, error } = await supabase
        .from('novels')
        .select('id, title, chaptertitles, chaptercontents, advance_chapters, user_id')
        .eq('id', id)
        .single();

      const isNetworkError = isErrorNetworkError(error);
      // failed to fetch from network, try cache
      if(isNetworkError){
        if (__DEV__) console.log(`[ChapterScreen] could not load novel ${id} from network, trying from cache`);
        const cachedData = await getNovelForOffline(id, userId || 'guest');
        if (cachedData) {
          data = cachedData.novel;
          if (__DEV__) console.log(`[ChapterScreen] novel ${id} loaded successfully from cache`);
        }
      }
      else if (error) throw new Error(error.message);

      if (!data || !data.chaptercontents?.[chapter]) {
        // If offline, check if chapter is in cached .smp file
        if (isOnline === false) {
          const cachedData = await getNovelForOffline(id, userId || 'guest');
          if (cachedData) {
            const chapter = cachedData.chapters.find(c => c.chapter_number === chapter);
            if (chapter && chapter.content) {
              if (__DEV__) console.log('[ChapterScreen] Chapter found in offline cache');
              data = cachedData.novel;
              data.chaptercontents = {};
              data.chaptercontents[chapter] = chapter.content;
            } else {
              throw new Error('Chapter not available offline');
            }
          } else {
            throw new Error('Chapter not found');
          }
        } else {
          throw new Error('Chapter not found');
        }
      }
      setNovel(data);
      setAdvanceInfo(
        data.advance_chapters?.find((c) => c.index === parseInt(chapter)) || {
          is_advance: false,
          free_release_date: null,
        }
      );

      // Check if current user is the author
      if (userId && data.user_id === userId) {
        setIsAuthor(true);
      }

      // Fetch author's note for this chapter (skip if offline)
      if (isOnline === true) {
        const chapterNum = parseInt(chapter, 10);
        const { data: chapterData, error: chapterError } = await supabase
          .from('novel_chapters')
          .select('author_note')
          .eq('novel_id', id)
          .eq('chapter_number', chapterNum)
          .maybeSingle();

        if (!chapterError && chapterData) {
          setAuthorNote(chapterData.author_note || '');
        } else {
          setAuthorNote('');
        }
      }
    } catch (error) {
      console.error('[fetchNovel] Error:', error.message);
      setError(error.message || 'Unable to load chapter.');
      setNovel(null);
    } finally {
      setLoading(false);
    }
  }, [userId, isOnline]);

  const handleSaveAuthorNote = async () => {
    try {
      const chapterNum = parseInt(chapterId, 10);
      const { error } = await supabase
        .from('novel_chapters')
        .upsert({
          novel_id: novelId,
          chapter_number: chapterNum,
          author_note: authorNote,
        }, {
          onConflict: ['novel_id', 'chapter_number'],
        });

      if (error) throw error;
      setSuccessMessage("Author's note saved successfully!");
      setTimeout(() => setSuccessMessage(''), 3000);
      setIsEditingAuthorNote(false);
    } catch (error) {
      setError("Failed to save author's note: " + error.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  // Ad unlock eligibility check
  const checkAdUnlockEligibility = useCallback(async (currentUserId = null) => {
    const targetUserId = currentUserId || userId;
    if (!targetUserId || !novelId || !chapterId) return false;
    try {
      const chapterNum = parseInt(chapterId, 10);

      // Check if user has already used ad unlock today
      const today = new Date().toISOString().split('T')[0];
      const { data: todayUnlock, error: todayError } = await supabase
        .from('ad_based_unlocks')
        .select('id')
        .eq('user_id', targetUserId)
        .gte('ad_watched_at', today)
        .limit(1);

      if (todayError && todayError.code !== 'PGRST116') throw new Error(todayError.message);

      const hasUsedToday = todayUnlock && todayUnlock.length > 0;
      setHasUsedAdUnlockToday(hasUsedToday);

      // Check if this specific chapter was already unlocked via ad
      const { data: chapterUnlock, error: chapterError } = await supabase
        .from('ad_based_unlocks')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('novel_id', novelId)
        .eq('chapter_number', chapterNum)
        .maybeSingle();

      if (chapterError && chapterError.code !== 'PGRST116') throw new Error(chapterError.message);

      return !hasUsedToday && !chapterUnlock;
    } catch (error) {
      console.error('[checkAdUnlockEligibility] Error:', error.message);
      return false;
    }
  }, [userId, novelId, chapterId]);

  // Handle ad-based unlock
  const handleAdBasedUnlock = useCallback(async () => {
    if (!userId || !novelId || !chapterId || isProcessing) {
      setError('Unable to process ad unlock. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Check eligibility again
      const isEligible = await checkAdUnlockEligibility();
      if (!isEligible) {
        setError(hasUsedAdUnlockToday
          ? 'You have already used your free ad unlock for today. Come back tomorrow!'
          : 'This chapter was already unlocked via ad.');
        setIsProcessing(false);
        return;
      }

      // Show video ad
      setShowVideoAd(true);
    } catch (error) {
      console.error('[handleAdBasedUnlock] Error:', error.message);
      setError(`Ad unlock failed: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  }, [userId, novelId, chapterId, isProcessing, checkAdUnlockEligibility, hasUsedAdUnlockToday]);

  // Handle video ad completion
  const handleVideoAdEnd = useCallback(async () => {
    try {
      const chapterNum = parseInt(chapterId, 10);

      // Record ad unlock
      const { error: adUnlockError } = await supabase
        .from('ad_based_unlocks')
        .insert({
          user_id: userId,
          novel_id: novelId,
          chapter_number: chapterNum,
          unlocked_at: new Date().toISOString(),
          ad_watched_at: new Date().toISOString(),
        });

      if (adUnlockError) throw new Error(`Failed to record ad unlock: ${adUnlockError.message}`);

      // Record in chapter_payments
      const { error: paymentError } = await supabase
        .from('chapter_payments')
        .insert({
          wallet_address: activeWalletAddress,
          novel_id: novelId,
          chapter_number: chapterNum,
          payment_type: 'AD_BASED',
          currency: 'FREE',
          amount: 0,
          transaction_id: `AD_UNLOCK_${Date.now()}`,
          created_at: new Date().toISOString(),
        });

      if (paymentError) {
        console.warn('[handleVideoAdEnd] Failed to record payment entry:', paymentError.message);
      }

      // Unlock the chapter
      setIsLocked(false);
      setRecentlyUnlocked(true);
      setShowVideoAd(false);

      setSuccessMessage('Chapter unlocked successfully! You can read it now.');
      setTimeout(() => setSuccessMessage(''), 5000);

      await checkAdUnlockEligibility();
      setTimeout(() => setRecentlyUnlocked(false), 10000);
    } catch (error) {
      console.error('[handleVideoAdEnd] Error:', error.message);
      setError(`Failed to complete ad unlock: ${error.message}`);
      setShowVideoAd(false);
      setTimeout(() => setError(null), 5000);
    }
  }, [userId, novelId, chapterId, activeWalletAddress, checkAdUnlockEligibility]);

  // Auto-play video when modal opens
  useEffect(() => {
    if (showVideoAd && videoRef.current) {
      if (__DEV__) console.log('[Video Ad] Modal opened, starting playback');
      setWatchDuration(0);
      setAdWatched(false);
      // Add a small delay to ensure the modal is fully rendered
      setTimeout(() => {
        videoRef.current?.playAsync().catch(err => {
          console.error('[Video Ad] Failed to play:', err);
        });
      }, 500);
    }
  }, [showVideoAd]);

  // Benefactor access check
  const checkBenefactorAccess = useCallback(async () => {
    if (!activeWalletAddress || !novelId) return null;

    try {
      // First get the novel to find the writer (author)
      const { data: novelData, error: novelError } = await supabase
        .from('novels')
        .select('user_id')
        .eq('id', novelId)
        .single();

      if (novelError || !novelData) {
        console.error('[checkBenefactorAccess] Error fetching novel:', novelError?.message);
        return null;
      }

      const writerId = novelData.user_id;

      // Check for active subscription to this writer
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('writer_subscriptions')
        .select('*')
        .eq('benefactor_wallet', activeWalletAddress)
        .eq('writer_id', writerId)
        .eq('is_active', true)
        .single();

      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        console.error('[checkBenefactorAccess] Error:', subscriptionError.message);
        return null;
      }

      if (subscriptionData) {
        // Check if subscription has expired
        if (new Date(subscriptionData.expires_at) <= new Date()) {
          // Expire the subscription
          await supabase
            .from('writer_subscriptions')
            .update({ is_active: false })
            .eq('id', subscriptionData.id);

          return null;
        }

        // Check remaining chapters (only applies to non-gold plans)
        if (subscriptionData.chapters_remaining <= 0 && subscriptionData.plan_type !== 'gold') {
          return null;
        }

        return subscriptionData;
      }

      return null;
    } catch (error) {
      console.error('[checkBenefactorAccess] Error:', error.message);
      return null;
    }
  }, [activeWalletAddress, novelId]);

  // Process benefactor payment
  const processBenefactorPayment = useCallback(async (paymentAmount, novelIdParam, paymentMint) => {
    try {
      if (!activeWalletAddress || !novelIdParam || !activePublicKey || !signAndSendTransaction) {
        return { success: false, error: 'Please connect your wallet and try again.' };
      }

      // Get novel author wallet
      const { data: novelData, error: novelError } = await supabase
        .from('novels')
        .select('user_id')
        .eq('id', novelIdParam)
        .single();

      if (novelError || !novelData) {
        return { success: false, error: 'Could not fetch novel data' };
      }

      const { data: authorData, error: authorError } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', novelData.user_id)
        .single();

      if (authorError || !authorData?.wallet_address) {
        return { success: false, error: 'Could not fetch author wallet' };
      }

      const authorPublicKey = new PublicKey(authorData.wallet_address);

      // Build transaction using benefactor payment function (80/20 split)
      const transaction = await createBenefactorPaymentTransaction({
        paymentMint,
        paymentAmount,
        userPublicKey: activePublicKey,
        authorPublicKey,
      });

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = activePublicKey;

      // Sign and send
      const signature = await signAndSendTransaction(transaction);

      // Wait for confirmation
      const start = Date.now();
      let landed = false;

      while (Date.now() - start < 10000) {
        const statusResp = await connection.getSignatureStatus(signature);
        const status = statusResp?.value;

        if (status?.err) throw new Error('Transaction failed on-chain.');
        if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
          landed = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!landed) {
        const finalStatus = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
        if (finalStatus?.value?.confirmationStatus === 'confirmed' || finalStatus?.value?.confirmationStatus === 'finalized') {
          landed = true;
        } else if (finalStatus?.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(finalStatus?.value?.err)}`);
        }
      }

      if (!landed) throw new Error('Transaction not confirmed yet. Please try again.');

      return { success: true, signature };

    } catch (error) {
      console.error('[processBenefactorPayment] Error:', error);
      return { success: false, error: error.message };
    }
  }, [activeWalletAddress, activePublicKey, signAndSendTransaction]);

  // Handle benefactor unlock
  const handleBenefactorUnlock = useCallback(async (plan) => {
    if (!activeWalletAddress || !novelId || !chapterId || isProcessing) {
      setError('Unable to process benefactor unlock. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMessage('');

    try {
      const pricingTiers = {
        blue:  { price: 1,   chapters: 3,   name: 'Blue' },
        iron:  { price: 2,   chapters: 6,   name: 'Iron' },
        silver: { price: 3,   chapters: 10,  name: 'Silver' },
        gold:  { price: 5,   chapters: 999, name: 'Gold' },
      };

      const tier = pricingTiers[plan.id];
      if (!tier) throw new Error('Invalid plan selected');

      const existingAccess = await checkBenefactorAccess();
      if (existingAccess) {
        setError('You already have an active subscription to this writer.');
        return;
      }

      setSuccessMessage(`Processing ${tier.name} writer subscription...`);

      // Get selected token from plan (USDC or SOL)
      const currency = plan.selectedToken || selectedBenefactorToken;

      // Check balance before attempting transaction
      if (currency === 'USDC') {
        if (usdcBalance < tier.price) {
          throw new Error(`Insufficient USDC balance. You need ${tier.price} USDC but have ${usdcBalance.toFixed(2)} USDC.`);
        }
      } else if (currency === 'SOL') {
        const solNeeded = tier.price * (solPrice || 100);
        if (solBalance < solNeeded) {
          throw new Error(`Insufficient SOL balance. You need ${solNeeded.toFixed(4)} SOL (~$${tier.price}) but have ${solBalance.toFixed(4)} SOL.`);
        }
      } else if (currency === 'SKR') {
        if (skrBalance < tier.price) {
          throw new Error(`Insufficient SKR balance. You need ${tier.price} SKR but have ${skrBalance.toFixed(2)} SKR.`);
        }
      }

      let paymentAmount = 0;
      let paymentMint = null;

      if (currency === 'USDC') {
        paymentMint = new PublicKey(USDC_MINT_ADDRESS);
        paymentAmount = Math.floor(tier.price * 1_000_000);
      } else if (currency === 'SOL') {
        paymentAmount = Math.floor(tier.price * (solPrice || 100) * 1_000_000_000);
      } else if (currency === 'SKR') {
        paymentMint = new PublicKey(SKR_MINT_ADDRESS);
        paymentAmount = Math.floor(tier.price * 1_000_000); // Using same decimals as SMP
      } else {
        throw new Error('Invalid token selected. Only USDC, SOL, or SKR are allowed for benefactor plans.');
      }

      const paymentResult = await processBenefactorPayment(paymentAmount, novelId, paymentMint);

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed');
      }

      // Create subscription record
      const { data: novelData } = await supabase
        .from('novels')
        .select('user_id')
        .eq('id', novelId)
        .single();

      const writerId = novelData.user_id;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (tier.chapters === 999 ? 30 : 14));

      const { error: subError } = await supabase
        .from('writer_subscriptions')
        .insert({
          benefactor_wallet: activeWalletAddress,
          writer_id: writerId,
          plan_type: plan.id,
          chapters_unlocked: tier.chapters,
          chapters_remaining: tier.chapters,
          expires_at: expiresAt.toISOString(),
          is_active: true,
        });

      if (subError) throw new Error(subError.message);

      // Update user's benefactor status
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({
          is_benefactor: true,
          benefactor_level: plan.id,
        })
        .eq('wallet_address', activeWalletAddress);

      if (userUpdateError) {
        console.warn('[handleBenefactorUnlock] Failed to update user benefactor status:', userUpdateError.message);
      }

      // Success
      const benefactorData = await checkBenefactorAccess();
      setBenefactorAccess(benefactorData);
      setShowBenefactorOption(false);
      setShowBenefactorModal(false);

      setIsLocked(false);
      setRecentlyUnlocked(true);

      const accessMessage = tier.chapters === 999
        ? `${tier.name} writer subscription activated! Unlimited access for 30 days.`
        : `${tier.name} writer subscription activated! Early access to ${tier.chapters} chapters for 14 days.`;

      setSuccessMessage(accessMessage);
      setTimeout(() => setSuccessMessage(''), 6000);
      setTimeout(() => setRecentlyUnlocked(false), 10000);

    } catch (error) {
      console.error('[handleBenefactorUnlock] Error:', error);
      setError(`Benefactor unlock failed: ${error.message}`);
      setTimeout(() => setError(null), 6000);
    } finally {
      setIsProcessing(false);
    }
  }, [activeWalletAddress, novelId, chapterId, isProcessing, checkBenefactorAccess, processBenefactorPayment, solPrice]);

  // Autopay functionality - temporarily disabled for testing
  const handleAutopayUnlock = useCallback(async () => {
    setError('Autopay is temporarily disabled for maintenance. Please unlock chapters manually.');
    setTimeout(() => setError(null), 5000);
  }, []);

  useEffect(() => {
    // Autopay disabled - no automatic payments
  }, [loading, novel, pricesAreLive, autopayPreferenceLoaded, isLocked, autopayEnabled, smpBalance, isProcessing, userId, isAdvanceChapter]);

  // Share functionality
  const handleShare = useCallback(async () => {
    const shareUrl = `https://sempaihq.com/novel/${novelId}/chapter/${chapterId}`;
    const shareText = `Read ${novel?.title} - ${novel?.chaptertitles?.[chapterId]} on Sempai HQ!`;

    try {
      await Share.share({
        message: `${shareText}\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error('[Share] Error sharing:', error);
      setError('Failed to share chapter');
      setTimeout(() => setError(null), 3000);
    }
  }, [novelId, chapterId, novel]);

  // Rating functions
  const fetchRatings = useCallback(async () => {
    // Skip if offline
    if (isOnline === false || isOnline === null) {
      return;
    }

    if (!userId) return;
    const chapterNum = parseInt(chapterId, 10);

    if (userRating === null) {
      const { data: userRatingData, error: userError } = await supabase
        .from('chapter_ratings')
        .select('rating')
        .eq('user_id', userId)
        .eq('content_type', 'novel')
        .eq('content_id', novelId)
        .eq('chapter_number', chapterNum)
        .single();
      if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching user rating:', userError);
      } else {
        setUserRating(userRatingData?.rating || null);
      }
    }

    const { data: ratingsData, error: avgError } = await supabase
      .from('chapter_ratings')
      .select('rating')
      .eq('content_type', 'novel')
      .eq('content_id', novelId)
      .eq('chapter_number', chapterNum);
    if (avgError) {
      console.error('Error fetching average rating:', avgError);
    } else {
      const avg = ratingsData?.length
        ? ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length
        : null;
      setAverageRating(avg);
    }
  }, [userId, novelId, chapterId, userRating]);

  const handleRating = useCallback(async (rating) => {
    if (!userId || !isWalletConnected) return;
    setUserRating(rating);
    const chapterNum = parseInt(chapterId, 10);

    const { data, error } = await supabase
      .from('chapter_ratings')
      .upsert(
        {
          user_id: userId,
          content_type: 'novel',
          content_id: novelId,
          chapter_number: chapterNum,
          rating,
        },
        {
          onConflict: ['user_id', 'content_type', 'content_id', 'chapter_number'],
        }
      );

    if (error) {
      console.error('Error saving rating:', error);
      setError('Failed to save rating. Please try again.');
      setUserRating(null);
      return;
    }
    await fetchRatings();
  }, [userId, isWalletConnected, novelId, chapterId, fetchRatings]);

  // Text-to-speech functions
  const readText = useCallback(async () => {
    try {
      const text = novel?.chaptercontents?.[chapterId] || '';
      if (!text) return;

      await Tts.speak(text);
      setIsSpeaking(true);
      setIsPaused(false);
    } catch (error) {
      console.error('[readText] Error:', error);
      setError('Text-to-speech not available.');
      setTimeout(() => setError(null), 5000);
    }
  }, [novel, chapterId]);

  const pauseText = useCallback(async () => {
    try {
      await Tts.pause();
      setIsPaused(true);
    } catch (error) {
      console.error('[pauseText] Error:', error);
    }
  }, []);

  const resumeText = useCallback(async () => {
    try {
      await Tts.resume();
      setIsPaused(false);
    } catch (error) {
      console.error('[resumeText] Error:', error);
    }
  }, []);

  const stopText = useCallback(async () => {
    try {
      await Tts.stop();
      setIsSpeaking(false);
      setIsPaused(false);
    } catch (error) {
      console.error('[stopText] Error:', error);
    }
  }, []);

  // Check has read chapter
  const checkHasReadChapter = useCallback(async (targetChapterId) => {
    // Skip if offline
    if (isOnline === false || isOnline === null) {
      return false;
    }

    if (!activeWalletAddress || !novel || !targetChapterId) return false;
    try {
      const eventDetails = `${activeWalletAddress}${novel.title || 'Untitled'}${targetChapterId}`
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 255);
      const { data, error } = await supabase
        .from('wallet_events')
        .select('id')
        .eq('event_details', eventDetails)
        .eq('wallet_address', activeWalletAddress)
        .limit(1);
      if (error) throw new Error(error.message);
      const hasRead = !!data.length;
      if (targetChapterId === chapterId) setHasReadChapter(hasRead);
      return hasRead;
    } catch (error) {
      console.error('[checkHasReadChapter] Error:', error.message);
      setError('Failed to verify read status.');
      setTimeout(() => setError(null), 5000);
      return false;
    }
  }, [activeWalletAddress, novel, chapterId]);

  const checkChapterPayment = useCallback(async (chapterNum) => {
    if (!activeWalletAddress || !novelId) return false;
    if (chapterNum === undefined || chapterNum === null || isNaN(chapterNum)) {
      console.error('[checkChapterPayment] Invalid chapter number:', chapterNum);
      return false;
    }
    try {
      const { data, error } = await supabase
        .from('chapter_payments')
        .select('id')
        .eq('wallet_address', activeWalletAddress)
        .eq('novel_id', novelId)
        .eq('chapter_number', chapterNum)
        .single();
      if(isErrorNetworkError(error)){
        const cachedData = await getNovelForOffline(novelId, userId || 'guest');
        if (cachedData && cachedData.chapters) {
          data = cachedData.chapters.find(({ chapter_number }) => chapter_number == chapterNum);
        }
      }
      else if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return !!data;
    } catch (error) {
      console.error('[checkChapterPayment] Error:', error.message);
      return false;
    }
  }, [activeWalletAddress, novelId]);

  const checkAccess = useCallback(async (walletAddress, novelData, chapterNum) => {
    // Skip if offline
    if (isOnline === false || isOnline === null) {
      return;
    }

    // Reset to locked state while checking access
    setIsLocked(true);

    // First 3 chapters (indices 0, 1, 2) are free for all users - no wallet required
    if (chapterNum >= 0 && chapterNum <= 2) {
      if (__DEV__) console.log('[checkAccess] First 3 chapters are free, unlocking:', chapterNum);
      setIsLocked(false);
      setCanUnlockNextThree(true);
      setIsAdvanceChapter(false);
      setIsUnlockedViaSubscription(false);
      return;
    }

    if (!walletAddress || !novelData?.id || chapterNum === undefined) {
      setIsLocked(true);
      setCanUnlockNextThree(true);
      return;
    }

    // Guard against invalid novel_id (string "null" or invalid UUID)
    if (!novelData.id || novelData.id === 'null' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(novelData.id)) {
      console.error('[checkAccess] Invalid novel ID:', novelData.id);
      setIsLocked(true);
      setCanUnlockNextThree(true);
      return;
    }

    try {
      // First 3 chapters (indices 0, 1, 2) are free for all users - no wallet required
      if (chapterNum >= 0 && chapterNum <= 2) {
        if (__DEV__) console.log('[checkAccess] First 3 chapters are free, unlocking:', chapterNum);
        setIsLocked(false);
        setCanUnlockNextThree(true);
        setIsAdvanceChapter(false);
        setIsUnlockedViaSubscription(false);
        return;
      }

      const advanceInfo = novelData.advance_chapters?.find((c) => c.index === chapterNum) || {
        is_advance: false,
        free_release_date: null,
      };
      setIsAdvanceChapter(advanceInfo.is_advance);
      setIsUnlockedViaSubscription(false);

      const isPaid = await checkChapterPayment(chapterNum);
      if (isPaid) {
        setIsLocked(false);
        setCanUnlockNextThree(true);
        return;
      }

      // Check for ad-based unlock
      if (userId) {
        const { data: adUnlock, error: adError } = await supabase
          .from('ad_based_unlocks')
          .select('id')
          .eq('user_id', userId)
          .eq('novel_id', novelData.id)
          .eq('chapter_number', chapterNum)
          .maybeSingle();

        if (!adError && adUnlock) {
          setIsLocked(false);
          return;
        }
      }

      // Check for writer badge access (benefactor)
      if (userId && novelData.user_id) {
        const { data: userBadges, error: badgeError } = await supabase
          .from('user_badges')
          .select('badge_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!badgeError && userBadges) {
          // Get the badge details to check if it's for this writer
          const { data: badge, error: badgeDetailError } = await supabase
            .from('badges')
            .select('writer_id')
            .eq('id', userBadges.badge_id)
            .single();

          if (!badgeDetailError && badge && badge.writer_id === novelData.user_id) {
            // User has the writer's badge, grant access
            setIsLocked(false);
            setCanUnlockNextThree(true);
            setIsUnlockedViaSubscription(true);
            return;
          }
        }
      }

      // Check for writer subscription access (legacy benefactor system)
      const subscriptionData = await checkBenefactorAccess();
      if (subscriptionData) {
        // Check if this chapter has already been accessed under this subscription
        const { data: accessLog, error: logError } = await supabase
          .from('writer_access_log')
          .select('id')
          .eq('subscription_id', subscriptionData.id)
          .eq('novel_id', novelData.id)
          .eq('chapter_number', chapterNum)
          .maybeSingle();

        if (!logError && accessLog) {
          setIsLocked(false);
          return;
        }

        // For unlimited access (gold plan) or remaining chapters > 0, grant access
        if (subscriptionData.plan_type === 'gold' || subscriptionData.chapters_remaining > 0) {
          setIsLocked(false);

          // Log the chapter access
          await supabase
            .from('writer_access_log')
            .insert({
              subscription_id: subscriptionData.id,
              novel_id: novelData.id,
              chapter_number: chapterNum,
              accessed_at: new Date().toISOString(),
            });

          // Only decrement if not gold (unlimited)
          if (subscriptionData.plan_type !== 'gold') {
            const newRemaining = subscriptionData.chapters_remaining - 1;
            await supabase
              .from('writer_subscriptions')
              .update({ chapters_remaining: newRemaining })
              .eq('id', subscriptionData.id);

            setBenefactorAccess({ ...subscriptionData, chapters_remaining: newRemaining });
          }

          return;
        }
      }

      // Check unlocked_story_chapters for all chapters (not just advance)
      if (userId) {
        const { data, error } = await supabase
          .from('unlocked_story_chapters')
          .select('chapter_unlocked_till, expires_at')
          .eq('user_id', userId)
          .eq('story_id', novelData.id)
          .single();
        if (error && error.code !== 'PGRST116') throw new Error(error.message);
        if (data && (!data.expires_at || new Date(data.expires_at) > new Date())) {
          const totalChapters = Object.keys(novelData.chaptercontents || {}).length;
          if (data.chapter_unlocked_till === -1 || (data.chapter_unlocked_till >= chapterNum && chapterNum <= totalChapters)) {
            setIsLocked(false);
            setCanUnlockNextThree(true);
            setIsUnlockedViaSubscription(true);
            return;
          }
        }
      }

      if (advanceInfo.is_advance) {
        const { data, error } = await supabase
          .from('unlocked_story_chapters')
          .select('chapter_unlocked_till, expires_at')
          .eq('user_id', userId)
          .eq('story_id', novelData.id)
          .single();
        if (error && error.code !== 'PGRST116') throw new Error(error.message);
        if (data && (!data.expires_at || new Date(data.expires_at) > new Date())) {
          const totalChapters = Object.keys(novelData.chaptercontents || {}).length;
          if (data.chapter_unlocked_till === -1 || (data.chapter_unlocked_till >= chapterNum && chapterNum <= totalChapters)) {
            setIsLocked(false);
            setCanUnlockNextThree(true);
            setIsUnlockedViaSubscription(true);
            return;
          }
        }
      }
      setIsLocked(true);
      setCanUnlockNextThree(true);
    } catch (error) {
      console.error('[checkAccess] Error:', error.message);
      setError('Failed to verify chapter access.');
      setTimeout(() => setError(null), 5000);
      setIsLocked(true);
      setCanUnlockNextThree(false);
    }
  }, [userId, checkChapterPayment, checkBenefactorAccess]);

  const shouldShowContent = useMemo(() => {
    const chapterNum = parseInt(chapterId, 10);
    // First 3 chapters are free for all users
    if (chapterNum >= 0 && chapterNum <= 2) return true;
    if (!isWalletConnected) return false;
    if (isUnlockedViaSubscription) return true;
    // Don't show content if still loading or locked
    if (loading) return false;
    return !isLocked;
  }, [isWalletConnected, isUnlockedViaSubscription, isLocked, chapterId, loading]);

  // Reading progress ("continue reading"): remember the last chapter + scroll
  // position per novel so the user can resume where they left off.
  const contentScrollRef = useRef(null);
  const progressLayoutRef = useRef({ viewH: 0, contentH: 0 });
  const pendingProgressRef = useRef(null);
  const lastProgressSaveRef = useRef(0);
  const resumePctRef = useRef(null);
  const resumeAppliedRef = useRef(false);

  const flushReadingProgress = useCallback((force = false) => {
    const pending = pendingProgressRef.current;
    if (!pending || !userId || !novelId) return;
    const now = Date.now();
    if (!force && now - lastProgressSaveRef.current < 2000) return;
    lastProgressSaveRef.current = now;
    pendingProgressRef.current = null;
    saveReadingProgress({
      userId,
      contentType: 'novel',
      contentId: novelId,
      chapterKey: pending.chapterKey,
      chapterNumber: parseInt(pending.chapterKey, 10),
      scrollPct: pending.pct,
    });
  }, [userId, novelId]);

  const handleContentScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent || {};
    if (!contentSize || !layoutMeasurement) return;
    const scrollable = contentSize.height - layoutMeasurement.height;
    const pct = scrollable > 0 ? (contentOffset.y / scrollable) * 100 : 0;
    pendingProgressRef.current = { pct, chapterKey: chapterId };
    flushReadingProgress();
  }, [chapterId, flushReadingProgress]);

  const tryApplyResume = useCallback(() => {
    const { viewH, contentH } = progressLayoutRef.current;
    if (resumeAppliedRef.current || resumePctRef.current == null || !viewH || !contentH) return;
    const max = contentH - viewH;
    if (max <= 0) return;
    resumeAppliedRef.current = true;
    contentScrollRef.current?.scrollTo({ y: (resumePctRef.current / 100) * max, animated: false });
  }, []);

  const handleContentViewLayout = useCallback((e) => {
    progressLayoutRef.current.viewH = e?.nativeEvent?.layout?.height || 0;
    tryApplyResume();
  }, [tryApplyResume]);

  const handleContentSizeChange = useCallback((w, h) => {
    progressLayoutRef.current.contentH = h || 0;
    tryApplyResume();
  }, [tryApplyResume]);

  // Load the saved position once the chapter content is actually readable.
  useEffect(() => {
    resumeAppliedRef.current = false;
    resumePctRef.current = null;
    progressLayoutRef.current = { viewH: 0, contentH: 0 };
    if (!shouldShowContent || !userId || !novelId || !chapterId || !novel?.chaptercontents?.[chapterId]) return;
    let alive = true;
    getContentReadingProgress(userId, 'novel', novelId).then((row) => {
      if (!alive) return;
      const pct = row ? Number(row.scroll_pct) || 0 : 0;
      if (row && String(row.chapter_key) === String(chapterId)) {
        if (pct > 0 && pct < 100) resumePctRef.current = pct;
      } else {
        // Different chapter (or first read ever): mark this one as current so
        // "continue reading" points here even if the user never scrolls.
        saveReadingProgress({
          userId,
          contentType: 'novel',
          contentId: novelId,
          chapterKey: chapterId,
          chapterNumber: parseInt(chapterId, 10),
          scrollPct: 0,
        });
      }
      tryApplyResume();
    });
    return () => { alive = false; };
  }, [shouldShowContent, userId, novelId, chapterId, novel, tryApplyResume]);

  // Flush the final scroll position when leaving the chapter or switching chapters.
  useEffect(() => () => flushReadingProgress(true), [flushReadingProgress, chapterId]);

  const processChapterPayment = useCallback(
    async (targetChapterId, paymentType = 'SINGLE', currency = 'SMP') => {
      // Prevent multiple simultaneous payments
      if (paymentInProgressRef.current) {
        if (__DEV__) console.log('[processChapterPayment] Payment already in progress, ignoring duplicate call');
        return false;
      }
      paymentInProgressRef.current = true;

      if (__DEV__) console.log('[processChapterPayment] Active Wallet Address:', activeWalletAddress);
      if (__DEV__) console.log('[processChapterPayment] Target Chapter ID:', targetChapterId);

      if (!activeWalletAddress || !novelId || !targetChapterId || !activePublicKey || !wallet || !signAndSendTransaction) {
        setError('Please connect your wallet and try again.');
        paymentInProgressRef.current = false;
        return false;
      }

      // Validate chapterId is a valid number
      const parsedChapterId = parseInt(targetChapterId, 10);
      if (isNaN(parsedChapterId)) {
        console.error('[processChapterPayment] Invalid chapter ID:', targetChapterId);
        setError('Invalid chapter ID.');
        paymentInProgressRef.current = false;
        return false;
      }

      setIsProcessing(true);
      setShowPaymentAnimation(true);
      setError(null);
      setSuccessMessage('');
      setWarningMessage('');

      try {
        // Check if already paid
        const isPaid = await checkChapterPayment(parsedChapterId);
        if (isPaid && paymentType === 'SINGLE') {
          if (__DEV__) console.log('[processChapterPayment] Chapter already paid');
          setIsLocked(false);
          return true;
        }

        // Fetch author data for payment
        const { data: novelData, error: novelError } = await supabase
          .from('novels')
          .select('user_id')
          .eq('id', novelId)
          .single();

        if (novelError || !novelData) {
          throw new Error('Could not fetch novel data');
        }

        const { data: authorData, error: authorError } = await supabase
          .from('users')
          .select('wallet_address')
          .eq('id', novelData.user_id)
          .single();

        if (authorError || !authorData?.wallet_address) {
          throw new Error('Could not fetch author wallet');
        }

        const authorPublicKey = new PublicKey(authorData.wallet_address);

        // Check if writer has SMP ATA - only for SMP payments
        if (currency === 'SMP') {
          const hasAta = await checkWriterAta(authorData.wallet_address);
          setWriterHasAta(hasAta);

          if (!hasAta) {
            // Calculate ATA funding cost
            const smpMint = new PublicKey(SMP_MINT_ADDRESS);
            const writerATA = getAssociatedTokenAddressSync(smpMint, authorPublicKey);
            const rentExempt = await connection.getMinimumBalanceForRentExemption(165);
            const fundingCost = 0.00203928; // ~0.002 SOL for ATA creation
            setAtaFundingCost(fundingCost);
            setWriterAtaAddress(writerATA.toBase58());
            // Store pending payment details
            setPendingPaymentDetails({ targetChapterId, paymentType, currency });
            setPendingAuthorData(authorData);
            setShowAtaFundingModal(true);
            // Return early - user will need to confirm ATA funding before proceeding
            setIsProcessing(false);
            setShowPaymentAnimation(false);
            paymentInProgressRef.current = false;
            return false;
          }
        }

        // Calculate payment amount
        const usdAmount = CHAPTER_READ_USD_COST;
        let paymentAmount = 0;
        let paymentMint = null;

        if (currency === 'USDC') {
          paymentMint = new PublicKey(USDC_MINT_ADDRESS);
          paymentAmount = Math.floor(usdAmount * 1e6);
        } else if (currency === 'SOL') {
          paymentAmount = Math.floor(usdAmount * solPrice * 1e9);
        } else if (currency === 'SMP') {
          paymentMint = new PublicKey(SMP_MINT_ADDRESS);
          // Calculate SMP amount: USD amount / SMP price in USD, then adjust for decimals
          paymentAmount = Math.ceil((usdAmount / smpPrice) * 10 ** SMP_DECIMALS);
        } else {
          throw new Error(`Invalid currency: ${currency}`);
        }

        if (__DEV__) console.log('[processChapterPayment] Payment amount:', paymentAmount, currency);

        // Build transaction client-side
        if (__DEV__) console.log('[processChapterPayment] Building transaction...');
        const transaction = await createPaymentTransactionClient({
          paymentMint,
          paymentAmount,
          userPublicKey: activePublicKey,
          authorPublicKey,
          smpMintAddress: paymentMint
        });

        // Get fresh blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = activePublicKey;

        // Sign and send transaction
        if (__DEV__) console.log('[processChapterPayment] Signing and sending transaction...');
        const signature = await signAndSendTransaction(transaction);
        console.log('[processChapterPayment] Transaction sent, signature:', signature);

        // Poll for confirmation — confirmTransaction's websocket subscription
        // can hang indefinitely in React Native.
        console.log('[processChapterPayment] Waiting for on-chain confirmation...');
        const landed = await waitForSignature(connection, signature, lastValidBlockHeight);
        console.log('[processChapterPayment] Confirmation result:', landed);
        if (!landed) {
          throw new Error('Transaction not confirmed yet. Check your wallet before trying again — do NOT pay twice.');
        }

        // Record payment in database via edge function
        const requestBody = {
          walletAddress: activeWalletAddress,
          novelId,
          chapterId: parsedChapterId,
          paymentType,
          currency,
          signature,
        };

        console.log('[processChapterPayment] Calling unlock-chapter edge function...');
        try {
          // Use fetch directly for better control
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;

          if (!accessToken) {
            console.warn('[processChapterPayment] No access token available');
          } else {
            const supabaseUrl = 'https://xqeimsncmnqsiowftdmz.supabase.co';
            const functionUrl = `${supabaseUrl}/functions/v1/unlock-chapter`;

            if (__DEV__) console.log('[processChapterPayment] Calling edge function at:', functionUrl);

            const response = await safeFetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify(requestBody),
            });

            if (__DEV__) console.log('[processChapterPayment] Edge function response status:', response.status);

            const data = await response.json();
            if (__DEV__) console.log('[processChapterPayment] Edge function response:', JSON.stringify(data, null, 2));
            if (__DEV__) console.log('[processChapterPayment] isPioneer flag:', data?.isPioneer);

            if (response.ok && data?.isPioneer) {
              if (__DEV__) console.log('[processChapterPayment] Pioneer badge detected! Showing modal...');
              // First payment to this writer - show Pioneer badge modal
              // (badge is granted server-side by the edge function)
              const smpMint = new PublicKey(SMP_MINT_ADDRESS);
              const writerATA = getAssociatedTokenAddressSync(smpMint, authorPublicKey);
              setPioneerPayload({
                type: 'create_ata',
                mint: SMP_MINT_ADDRESS.toString(),
                owner: authorData.wallet_address,
                ata: writerATA.toBase58(),
                instructions: 'Use this payload to create an Associated Token Account for the writer'
              });
              setCurrentCreatorId(novelData.user_id);
              setShowPioneerModal(true);
            } else {
              if (__DEV__) console.log('[processChapterPayment] Not a pioneer payment or response not OK');
              // Fallback: Check if user should have Pioneer badge but doesn't
              // This handles cases where edge function might not be deployed
              try {
                const { data: pioneerBadge } = await supabase
                  .from('badges')
                  .select('id')
                  .eq('type', 'pioneer')
                  .limit(1)
                  .maybeSingle();

                if (pioneerBadge) {
                  const { data: userBadge } = await supabase
                    .from('user_badges')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('badge_id', pioneerBadge.id)
                    .maybeSingle();

                  if (!userBadge) {
                    if (__DEV__) console.log('[processChapterPayment] User missing Pioneer badge, checking if first payment...');
                    // Check if this is actually the first payment to this writer
                    const { data: authorNovels } = await supabase
                      .from('novels')
                      .select('id')
                      .eq('user_id', novelData.user_id);

                    const authorNovelIds = (authorNovels || []).map(n => n.id);
                    const { data: priorPayments } = await supabase
                      .from('chapter_payments')
                      .select('id')
                      .eq('wallet_address', activeWalletAddress)
                      .in('novel_id', authorNovelIds)
                      .neq('transaction_id', signature)
                      .limit(1);

                    if (!priorPayments || priorPayments.length === 0) {
                      if (__DEV__) console.log('[processChapterPayment] This IS the first payment! Showing Pioneer modal...');
                      const smpMint = new PublicKey(SMP_MINT_ADDRESS);
                      const writerATA = getAssociatedTokenAddressSync(smpMint, authorPublicKey);
                      setPioneerPayload({
                        type: 'create_ata',
                        mint: SMP_MINT_ADDRESS.toString(),
                        owner: authorData.wallet_address,
                        ata: writerATA.toBase58(),
                        instructions: 'Use this payload to create an Associated Token Account for the writer'
                      });
                      setCurrentCreatorId(novelData.user_id);
                      setShowPioneerModal(true);
                    }
                  }
                }
              } catch (fallbackError) {
                console.error('[processChapterPayment] Fallback Pioneer check failed:', fallbackError);
              }
            }

            if (!response.ok) {
              console.error('[processChapterPayment] Edge function error:', data.error || 'Unknown error');
              console.warn('[processChapterPayment] Payment succeeded but database recording failed');
            } else if (data?.error) {
              console.error('[processChapterPayment] Edge function returned error:', data.error);
            }
          }
        } catch (dbError) {
          console.error('[processChapterPayment] Database recording error:', dbError.message);
          console.warn('[processChapterPayment] Payment succeeded but database recording failed');
        }

        setSuccessMessage('Payment successful! Chapter unlocked.');
        await fetchSmpBalanceOnChain();
        setIsLocked(false);
        setCanUnlockNextThree(true);
        setRecentlyUnlocked(true);

        // Keep chapter unlocked for 30 seconds to prevent re-locking during DB replication
        setTimeout(() => setRecentlyUnlocked(false), 30000);

        setTimeout(() => setSuccessMessage(''), 5000);
        return true;

      } catch (err) {
        console.error('[processChapterPayment] Error:', err.message);
        if (err.message.includes('Insufficient')) {
          setWarningMessage(`Insufficient ${currency} balance. Get more tokens to continue.`);
          setTimeout(() => {
            navigation.navigate('Swap', {
              returnScreen: 'Chapter',
              returnParams: { novelId, chapterId: targetChapterId },
            });
          }, 2000);
        } else {
          setError(err.message || 'Transaction failed. Please try again.');
          setTimeout(() => setError(null), 5000);
        }
        return false;
      } finally {
        setIsProcessing(false);
        setShowPaymentAnimation(false);
        paymentInProgressRef.current = false;
      }
    },
    [activeWalletAddress, activePublicKey, novelId, smpBalance, smpPrice, solPrice, navigation, signAndSendTransaction, checkChapterPayment, wallet, fetchSmpBalanceOnChain]
  );

  const handleNextChapter = useCallback(
    async (nextChapterId) => {
      if (!nextChapterId) return;
      setIsProcessing(true);
      try {
        const success = await processChapterPayment(nextChapterId);
        if (success) {
          navigation.navigate('Chapter', { novelId, chapterId: nextChapterId });
        } else {
          setError('Failed to unlock next chapter.');
          setTimeout(() => setError(null), 5000);
        }
      } catch (err) {
        console.error('[handleNextChapter] Error:', err.message);
        setError('Failed to process next chapter.');
        setTimeout(() => setError(null), 5000);
      } finally {
        setIsProcessing(false);
      }
    },
    [processChapterPayment, navigation, novelId]
  );

  useEffect(() => {
    if (!novelId || !chapterId) {
      setError('Invalid novel or chapter ID.');
      setUseInput(true);
      setLoading(false);
      return;
    }

    // Wait for user ID to be loaded before proceeding offline
    if ((isOnline === false || isOnline === null) && !userId) {
      if (__DEV__) console.log('[ChapterScreen] Waiting for user ID to load before checking cache');
      return;
    }

    const initialize = async () => {
      // Reset loading state when chapter changes
      setLoading(true);
      setIsLocked(true);

      const chapterNum = parseInt(chapterId, 10);
      if (__DEV__) console.log('[ChapterScreen] initialize - chapterId:', chapterId, 'chapterNum:', chapterNum, 'isWalletConnected:', isWalletConnected, 'isOnline:', isOnline);

      // If offline or status unknown, only allow chapters that are saved
      if (isOnline === false || isOnline === null) {
        if (__DEV__) console.log('[ChapterScreen] Offline/status unknown mode, checking cache');
        const cachedData = await getNovelForOffline(novelId, userId || 'guest');
        if (cachedData) {
          if (__DEV__) console.log('[ChapterScreen] Cached novel found:', cachedData.novel.title);
          // Check if chapter is in the saved chapters
          const chapter = cachedData.chapters.find(c => c.chapter_number === chapterId);
          if (chapter && chapter.content) {
            if (__DEV__) console.log('[ChapterScreen] Chapter available in offline cache, unlocking:', chapterNum);
            setIsLocked(false);
            setCanUnlockNextThree(true);
            setIsAdvanceChapter(false);
            setIsUnlockedViaSubscription(false);
            setReadingMode('free');
            // Set novel with chapter content
            const novelWithChapter = { ...cachedData.novel };
            novelWithChapter.chaptercontents = {};
            novelWithChapter.chaptercontents[chapterId] = chapter.content;
            setNovel(novelWithChapter);
            setLoading(false);
            return;
          } else {
            if (__DEV__) console.log('[ChapterScreen] Chapter not in saved chapters');
            setError('This chapter is not available offline. Please save the novel while online to access this chapter.');
            setLoading(false);
            return;
          }
        } else {
          if (__DEV__) console.log('[ChapterScreen] Novel not in cache');
          setError('Novel not available offline. Please save it for offline reading first.');
          setLoading(false);
          return;
        }
      }
      
      // Online - fetch from network
      await Promise.all([
        fetchPrices(),
        isWalletConnected ? fetchUserData() : Promise.resolve(),
        fetchNovel(novelId, chapterId),
      ]);
    };
    initialize();
  }, [novelId, chapterId, fetchNovel, fetchUserData, fetchPrices, isWalletConnected, isOnline]);

  useEffect(() => {
    if (novel && chapterId && !recentlyUnlocked) {
      const chapterNum = parseInt(chapterId, 10);
      if (isNaN(chapterNum)) {
        setError('Invalid chapter number');
        return;
      }

      // If offline and chapter is in saved chapters, unlock immediately
      if ((isOnline === false || isOnline === null) && novel) {
        // Load from cache to check chapter availability
        (async () => {
          const cachedData = await getNovelForOffline(novelId, userId || 'guest');
          if (cachedData) {
            const chapter = cachedData.chapters.find(c => c.chapter_number === chapterId);
            if (chapter && chapter.content) {
              if (__DEV__) console.log('[ChapterScreen] Chapter in offline cache, unlocking:', chapterNum);
              setIsLocked(false);
              setCanUnlockNextThree(true);
              setIsAdvanceChapter(false);
              setIsUnlockedViaSubscription(false);
              setReadingMode('free');
              // Set chapter content in novel object
              const novelWithChapter = { ...novel };
              novelWithChapter.chaptercontents = {};
              novelWithChapter.chaptercontents[chapterId] = chapter.content;
              setNovel(novelWithChapter);
              // Skip checkHasReadChapter when offline
              return;
            }
          }
        })();
      }

      // First 3 chapters (indices 0, 1, 2) are free - unlock immediately even without wallet
      if (chapterNum >= 0 && chapterNum <= 2) {
        if (__DEV__) console.log('[ChapterScreen] First 3 chapters are free, unlocking:', chapterNum);
        setIsLocked(false);
        setCanUnlockNextThree(true);
        setIsAdvanceChapter(false);
        setIsUnlockedViaSubscription(false);
        setReadingMode('free');
        // Skip checkHasReadChapter when offline
        if (isOnline === true) {
          checkHasReadChapter(chapterId);
        }
        return;
      }

      // Only check access for chapters beyond 2 if wallet is connected
      if (isWalletConnected && activeWalletAddress && isOnline === true) {
        checkAccess(activeWalletAddress, novel, chapterNum);
        checkHasReadChapter(chapterId);
      }
    }
  }, [novel, activeWalletAddress, chapterId, checkAccess, checkHasReadChapter, isWalletConnected, recentlyUnlocked, isOnline]);

  useEffect(() => {
    if (!loading && novel && !isLocked && readingMode === 'paid' && isWalletConnected && !hasReadChapter) {
      const chapterNum = parseInt(chapterId, 10);
      // Don't process payment for first 3 chapters (indices 0, 1, 2)
      if (chapterNum >= 0 && chapterNum <= 2) {
        if (__DEV__) console.log('[ChapterScreen] First 3 chapters are free, skipping payment');
        return;
      }
      // Don't process payment for offline chapters
      if (isOnline === false) {
        (async () => {
          try {
            const cachedData = await getNovelForOffline(novelId, userId || 'guest');
            if (cachedData && cachedData.chapters) {
              const offlineChapter = cachedData.chapters.find(c => c.chapter_number === chapterId);
              if (offlineChapter && offlineChapter.content) {
                if (__DEV__) console.log('[ChapterScreen] Chapter in offline cache, skipping payment');
                return;
              }
            }
          } catch (e) {
            if (__DEV__) console.log('[ChapterScreen] Error checking offline cache:', e);
          }
        })();
      }
      processChapterPayment(chapterId);
    }
  }, [loading, novel, isLocked, readingMode, processChapterPayment, isWalletConnected, chapterId, hasReadChapter, isOnline, userId]);

  // Fetch ratings when chapter is unlocked
  useEffect(() => {
    if (!isLocked && isWalletConnected && userId) {
      fetchRatings();
    }
  }, [isLocked, isWalletConnected, userId, fetchRatings]);

  // Cleanup text-to-speech on unmount
  useEffect(() => {
    return () => {
      Tts.stop();
    };
  }, []);

  // Optimize Amethyst balance fetching
  useEffect(() => {
    if (!isWalletConnected || !activeWalletAddress) return;
    if (isOnline === false || isOnline === null) return; // Skip offline
    let intervalId;
    const fetchAndSchedule = async () => {
      await fetchAmethystBalance();
      intervalId = setInterval(fetchAmethystBalance, 300000); // Fetch every 5 minutes
    };
    fetchAndSchedule();
    return () => clearInterval(intervalId);
  }, [isWalletConnected, activeWalletAddress, fetchAmethystBalance, isOnline]);

  // Fetch token balances for benefactor payments
  useEffect(() => {
    if (isWalletConnected && activeWalletAddress && isOnline === true) {
      fetchTokenBalances();
    }
  }, [isWalletConnected, activeWalletAddress, fetchTokenBalances, isOnline]);

  // Refresh live prices periodically so long reading sessions don't drift
  // too far from the market (cache TTL above already avoids redundant calls)
  useEffect(() => {
    const intervalId = setInterval(fetchPrices, PRICE_CACHE_TTL_MS);
    return () => clearInterval(intervalId);
  }, [fetchPrices]);

  // Animate benefactor plans when modal opens
  useEffect(() => {
    if (showBenefactorModal) {
      planAnimations.forEach((anim, index) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: index * 100,
          useNativeDriver: true,
        }).start();
      });
    } else {
      planAnimations.forEach(anim => anim.setValue(0));
    }
  }, [showBenefactorModal, planAnimations]);

  // Animate plan details modal
  useEffect(() => {
    if (showPlanDetailsModal) {
      Animated.timing(planDetailsAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      planDetailsAnimation.setValue(0);
    }
  }, [showPlanDetailsModal, planDetailsAnimation]);

  const handleManualFetch = useCallback(() => {
    if (!inputNovelId || !inputChapterId) {
      setError('Please enter both Novel ID and Chapter ID.');
      return;
    }
    setLoading(true);
    setError(null);
    setUseInput(false);
    fetchNovel(inputNovelId, inputChapterId);
  }, [inputNovelId, inputChapterId, fetchNovel]);

  const chapterContent = novel?.chaptercontents?.[chapterId] || '';
  const paragraphs = useMemo(() => {
    if (!chapterContent) return [];
    return chapterContent
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.trim());
  }, [chapterContent]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading Chapter...</Text>
      </SafeAreaView>
    );
  }

  if (useInput || (error && (!isWalletConnected && parseInt(chapterId, 10) < 2))) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{error || 'Missing Parameters'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Novel ID (UUID)"
            placeholderTextColor="#888"
            value={inputNovelId}
            onChangeText={setInputNovelId}
            accessibilityLabel="Novel ID input"
          />
          <TextInput
            style={styles.input}
            placeholder="Chapter ID (e.g., 1)"
            placeholderTextColor="#888"
            value={inputChapterId}
            onChangeText={setInputChapterId}
            keyboardType="numeric"
            accessibilityLabel="Chapter ID input"
          />
          <TouchableOpacity style={styles.actionButton} onPress={handleManualFetch}>
            <Text style={styles.actionButtonText}>Fetch Chapter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Home')}>
            <FontAwesome5 name="home" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!novel || !novel.chaptercontents?.[chapterId]) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View>
          <Text style={styles.errorTitle}>Chapter Not Found</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setUseInput(true);
              setError('Enter new values to try again.');
            }}
          >
            <Text style={styles.actionButtonText}>Try Another Chapter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Home')}>
            <FontAwesome5 name="home" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const chapterTitle = novel.chaptertitles?.[chapterId] || `Chapter ${parseInt(chapterId) + 1}`;
  const chapterKeys = Object.keys(novel.chaptercontents || {});
  const chapterIdStr = String(chapterId);
  const currentIndex = chapterKeys.findIndex(key => String(key) === chapterIdStr);
  const prevChapter = currentIndex > 0 ? chapterKeys[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapterKeys.length - 1 ? chapterKeys[currentIndex + 1] : null;
  const releaseDateMessage =
    advanceInfo?.is_advance && advanceInfo?.free_release_date
      ? `Locked until ${new Date(advanceInfo.free_release_date).toLocaleString()}`
      : 'This chapter is locked.';
  const threeChaptersSol = solPrice ? (3 / solPrice).toFixed(4) : 'N/A';
  const fullChaptersSol = solPrice ? (15 / solPrice).toFixed(4) : 'N/A';
  const threeChaptersUsdc = 3;
  const fullChaptersUsdc = 15;
  const threeChaptersSmp = smpPrice ? Math.ceil(3 / smpPrice) : 'N/A';
  const fullChaptersSmp = smpPrice ? Math.ceil(15 / smpPrice) : 'N/A';

  // OFFLINE MODE - Minimal reading UI
  if (isOnline === false || isOnline === null) {
    const chapterContent = novel?.chaptercontents?.[chapterId] || '';
    const chapterTitle = novel?.chaptertitles?.[parseInt(chapterId, 10)] || `Chapter ${parseInt(chapterId, 10) + 1}`;

    if (isFullscreen) {
      return (
        <View style={[styles.fullscreenContainer, { backgroundColor: colors.bg }]}>
          <StatusBar hidden={true} />

          {/* Fullscreen close button */}
          <TouchableOpacity
            style={styles.fullscreenCloseButton}
            onPress={() => setIsFullscreen(false)}
          >
            <FontAwesome5 name="times" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Chapter Content - Full Screen */}
          <ScrollView style={styles.fullscreenScrollView} contentContainerStyle={styles.fullscreenContent}>
            <Text style={[styles.offlineChapterTitle, { color: colors.textPrimary }]}>
              {chapterTitle}
            </Text>
            <Text style={[styles.offlineChapterContent, { color: colors.textPrimary }]}>
              {chapterContent}
            </Text>
          </ScrollView>
        </View>
      );
    }

    return (
      <SafeAreaView style={[styles.offlineContainer, { backgroundColor: colors.bg }]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.bg}
        />

        {/* Offline Header */}
        <View style={[styles.offlineHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.offlineBackButton}
          >
            <FontAwesome5 name="arrow-left" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <FontAwesome5 name="wifi" size={20} color={colors.warning} />
          <Text style={[styles.offlineHeaderText, { color: colors.textPrimary }]}>Offline Mode</Text>
          <TouchableOpacity
            onPress={() => setIsFullscreen(true)}
            style={styles.offlineFullscreenButton}
          >
            <FontAwesome5 name="expand" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Chapter Content */}
        <ScrollView style={styles.offlineScrollView}>
          <View style={styles.offlineChapterContainer}>
            <Text style={[styles.offlineChapterTitle, { color: colors.textPrimary }]}>
              {chapterTitle}
            </Text>
            <Text style={[styles.offlineChapterContent, { color: colors.textPrimary }]}>
              {chapterContent}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ONLINE MODE - Full UI
  // If fullscreen, render only chapter content
  if (isFullscreen) {
    const chapterContent = novel?.chaptercontents?.[chapterId] || '';

    // Never reveal chapter content in fullscreen when the chapter is locked
    if (!shouldShowContent) {
      return (
        <View style={[styles.fullscreenContainer, { backgroundColor: colors.bg }]}>
          <StatusBar hidden={true} />
          <TouchableOpacity
            style={styles.fullscreenCloseButton}
            onPress={() => setIsFullscreen(false)}
          >
            <FontAwesome5 name="times" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.lockedContainer}>
            <FontAwesome5 name="lock" size={48} color={colors.accent} style={styles.lockIcon} />
            <Text style={styles.lockedMessage}>This chapter is locked</Text>
            <Text style={styles.lockedSubMessage}>Unlock it to read in fullscreen.</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.fullscreenContainer, { backgroundColor: colors.bg }]}>
        <StatusBar hidden={true} />

        {/* Fullscreen close button */}
        <TouchableOpacity
          style={styles.fullscreenCloseButton}
          onPress={() => setIsFullscreen(false)}
        >
          <FontAwesome5 name="times" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        {/* Chapter Content - Full Screen */}
        <ScrollView
          style={styles.fullscreenScrollView}
          contentContainerStyle={styles.fullscreenContent}
          scrollEventThrottle={200}
          onScroll={handleContentScroll}
        >
          <Text style={[styles.offlineChapterTitle, { color: colors.textPrimary }]}>
            {chapterTitle}
          </Text>
          <Text style={[styles.offlineChapterContent, { color: colors.textPrimary }]}>
            {chapterContent}
          </Text>
        </ScrollView>
      </View>
    );
  }

  // Normal online mode
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <View style={styles.backgroundGradient} />
      <View style={styles.emberContainer} pointerEvents="none">
        {embersInitialized.current && emberAnims.current && emberAnims.current.length > 0 && embersData.current && embersData.current.map((ember, index) => {
          const anim = emberAnims.current[index];
          if (!anim) return null;
          return (
            <Animated.View
              key={ember.id}
              style={[
                styles.ember,
                {
                  left: `${ember.left}%`,
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [height, -50],
                      }),
                    },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
      {isWalletConnected && (
        <View style={styles.balanceContainer}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceCard}>
              <FontAwesome5 name="wallet" size={12} color={colors.gold} />
              <Text style={styles.balanceLabel}>SMP</Text>
              <Text style={styles.balanceValue}>{formatNumber(smpBalance)}</Text>
            </View>
            <View style={styles.balanceCard}>
              <FontAwesome5 name="gem" size={12} color={colors.gold} />
              <Text style={styles.balanceLabel}>Amethyst</Text>
              <Text style={styles.balanceValue}>{formatNumber(amethystBalance)}</Text>
            </View>
            <View style={styles.balanceCard}>
              <FontAwesome5 name="gem" size={12} color={colors.gold} />
              <Text style={styles.balanceLabel}>SKR</Text>
              <Text style={styles.balanceValue}>{formatNumber(skrBalance)}</Text>
            </View>
          </View>
          <View style={styles.pointsCard}>
            <FontAwesome5 name="star" size={12} color={colors.gold} />
            <Text style={styles.pointsLabel}>Points</Text>
            <Text style={styles.pointsValue}>{formatNumber(weeklyPoints)}</Text>
          </View>
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Home')}>
          <FontAwesome5 name="home" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{chapterTitle}</Text>
          {isTracking && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <FontAwesome5 name="clock" size={10} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 10, marginLeft: 4, fontFamily: 'monospace' }}>
                {formatReadingTime(getCurrentDuration())}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('NovelsPage', { novelId })}
        >
          <FontAwesome5 name="book" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setIsFullscreen(true)}
        >
          <FontAwesome5 name="expand" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      {(successMessage || error || warningMessage) && (
        <View
          style={[
            styles.messageContainer,
            error ? styles.errorMessage : warningMessage ? styles.warningMessage : styles.successMessage,
          ]}
        >
          <FontAwesome5
            name={error ? 'exclamation-circle' : warningMessage ? 'exclamation-triangle' : 'check-circle'}
            size={14}
            color={error ? colors.error : warningMessage ? colors.warning : colors.success}
          />
          <Text style={styles.messageText}>{successMessage || error || warningMessage}</Text>
        </View>
      )}
      {!isWalletConnected && parseInt(chapterId, 10) > 2 ? (
        <View style={styles.lockedContainer}>
          <FontAwesome5 name="wallet" size={48} color={colors.accent} style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Connect Wallet to Continue Reading</Text>
          <Text style={styles.lockedSubMessage}>Please connect your wallet to read chapters.</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <FontAwesome5 name="wallet" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
            <Text style={styles.actionButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.lockedContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.lockedMessage}>Loading chapter...</Text>
        </View>
      ) : isLocked ? (
        <View style={styles.lockedContainer}>
          <UBBadge type="writer" size="large" showLabel={false} />
          <Text style={styles.lockedMessage}>Read this Chapter</Text>

          {/* For advance chapters, show benefactor options */}
          {isAdvanceChapter ? (
            <>
              {showBenefactorOption && !hasWriterBadge && !benefactorAccess && (
                <View style={styles.benefactorContainer}>
                  <Text style={styles.lockedSubMessage}>This is an advance chapter</Text>
                  <Text style={styles.lockedSubMessage}>Buy the writer's badge to access advance chapters</Text>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.badgesButton]}
                    onPress={() => navigation.navigate('Badges', { writerId: novel?.user_id })}
                    disabled={isProcessing}
                  >
                    <FontAwesome5 name="crown" size={16} color={colors.gold} style={styles.buttonIcon} />
                    <Text style={styles.badgesButtonText}>Buy Writer's Badge</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Benefactor badge status */}
              {hasWriterBadge && (
                <View style={styles.benefactorStatus}>
                  <FontAwesome5 name="crown" size={16} color={colors.gold} style={styles.buttonIcon} />
                  <Text style={styles.benefactorStatusText}>
                    Writer's Badge Holder
                  </Text>
                </View>
              )}

              {/* Benefactor subscription status (legacy) */}
              {benefactorAccess && (
                <View style={styles.benefactorStatus}>
                  <FontAwesome5 name="star" size={16} color={colors.gold} style={styles.buttonIcon} />
                  <Text style={styles.benefactorStatusText}>
                    Writer Subscription: {benefactorAccess.plan_type?.toUpperCase()} Plan
                  </Text>
                  {benefactorAccess.plan_type !== 'gold' && (
                    <Text style={styles.benefactorStatusText}>
                      {benefactorAccess.chapters_remaining}/{benefactorAccess.chapters_unlocked} chapters remaining
                    </Text>
                  )}
                  <Text style={styles.benefactorStatusText}>
                    Expires: {new Date(benefactorAccess.expires_at).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* For regular chapters, show payment options */}
              {/* Ad unlock option */}
              {showAdOption && (
                <View style={styles.adUnlockContainer}>
                  <Text style={styles.lockedSubMessage}>You don't have enough SMP. Watch an ad to unlock for free!</Text>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.adUnlockButton]}
                    onPress={handleAdBasedUnlock}
                    disabled={isProcessing || hasUsedAdUnlockToday}
                  >
                    <FontAwesome5 name="video" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
                    <Text style={styles.actionButtonText}>
                      {hasUsedAdUnlockToday ? 'Ad Unlock Used Today' : 'Watch Ad - Free Unlock'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.lockedSubMessage}>One chapter per day</Text>
                </View>
              )}

              {/* Small balance check and autopay options */}
              {hasInsufficientSmp && !showAdOption && (
                <View style={styles.smallBalanceContainer}>
                  <Text style={styles.lockedSubMessage}>Low SMP balance detected</Text>
                  <Text style={styles.lockedSubMessage}>Enable autopay to automatically unlock chapters</Text>
                  <AutopaySettings onAutopayToggle={(enabled) => setAutopayEnabled(enabled)} />
                </View>
              )}

              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={styles.smpButton}
                  onPress={() => processChapterPayment(chapterId, 'SINGLE', 'SMP')}
                  disabled={isProcessing}
                >
                  <FontAwesome5 name="gem" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
                  <Text style={styles.smpButtonText}>
                    Read with {(SMP_READ_COST / 10 ** SMP_DECIMALS).toLocaleString()} SMP (Earn Points)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.getSmpButton}
                  onPress={() => {
                    const rampUrl = `https://buy.ramp.network/?hostApiKey=${WEB_API_BASE_URL}&defaultAsset=SOL`;
                    Linking.openURL(rampUrl).catch(err => console.error('Failed to open URL:', err));
                  }}
                >
                  <FontAwesome5 name="shopping-cart" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
                  <Text style={styles.getSmpButtonText}>Get Tokens</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <ScrollView
            ref={contentScrollRef}
            contentContainerStyle={styles.scrollContent}
            scrollEventThrottle={200}
            onScroll={handleContentScroll}
            onLayout={handleContentViewLayout}
            onContentSizeChange={handleContentSizeChange}
          >
            {/* Audio controls and share */}
            <View style={styles.audioControls}>
              <TouchableOpacity style={styles.audioButton} onPress={readText} disabled={isSpeaking}>
                <FontAwesome5 name="volume-up" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
                <Text style={styles.audioButtonText}>Read Aloud</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.audioButton} onPress={pauseText} disabled={!isSpeaking || isPaused}>
                <FontAwesome5 name="pause" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
                <Text style={styles.audioButtonText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.audioButton} onPress={resumeText} disabled={!isSpeaking || !isPaused}>
                <FontAwesome5 name="play" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
                <Text style={styles.audioButtonText}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.audioButton} onPress={stopText} disabled={!isSpeaking}>
                <FontAwesome5 name="stop" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
                <Text style={styles.audioButtonText}>Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.audioButton} onPress={handleShare}>
                <FontAwesome5 name="share-alt" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
                <Text style={styles.audioButtonText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Story content */}
            {hasReadChapter && (
              <View style={styles.readingOptions}>
                <Text style={styles.readingModeText}>You've earned points from this chapter</Text>
              </View>
            )}
            {paragraphs.map((paragraph, index) => (
              <Text key={`paragraph-${index}`} style={styles.paragraph}>{paragraph}</Text>
            ))}

            {/* Chapter selector */}
            <View style={styles.chapterSelector}>
              <TouchableOpacity style={styles.chapterSelectorButton} onPress={() => setShowChapterSelector(true)}>
                <FontAwesome5 name="book-open" size={16} color={colors.textPrimary} style={styles.buttonIcon} />
                <Text style={styles.chapterSelectorText}>Jump to Chapter</Text>
              </TouchableOpacity>
            </View>

            {/* Rating section */}
            {isWalletConnected && (
              <View style={styles.ratingSection}>
                <View style={styles.userRating}>
                  <Text style={styles.ratingLabel}>Your Rating:</Text>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => handleRating(star)}>
                        <FontAwesome5
                          name="star"
                          size={20}
                          color={star <= (userRating || 0) ? colors.goldBright : colors.textMuted}
                          style={styles.star}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.averageRating}>
                  <Text style={styles.ratingLabel}>Average Rating:</Text>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FontAwesome5
                        key={star}
                        name="star"
                        size={20}
                        color={star <= Math.round(averageRating || 0) ? colors.goldBright : colors.textMuted}
                        style={styles.star}
                      />
                    ))}
                  </View>
                  <Text style={styles.ratingValue}>
                    {averageRating ? ` (${averageRating.toFixed(1)} / 5)` : ' (No ratings yet)'}
                  </Text>
                </View>
              </View>
            )}

            {/* Author's Note Section */}
            {isWalletConnected && (
              <View style={styles.authorNoteSection}>
                <Text style={styles.authorNoteTitle}>Author's Note</Text>
                {isAuthor ? (
                  <>
                    {isEditingAuthorNote ? (
                      <View style={styles.authorNoteEdit}>
                        <TextInput
                          value={authorNote}
                          onChangeText={setAuthorNote}
                          placeholder="Add a note for your readers..."
                          placeholderTextColor="#888"
                          multiline
                          numberOfLines={4}
                          style={styles.authorNoteTextarea}
                        />
                        <View style={styles.authorNoteActions}>
                          <TouchableOpacity style={styles.saveButton} onPress={handleSaveAuthorNote}>
                            <Text style={styles.saveButtonText}>Save Note</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setIsEditingAuthorNote(false)}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.authorNoteDisplay}>
                        {authorNote ? (
                          <Text style={styles.authorNoteText}>{authorNote}</Text>
                        ) : (
                          <Text style={styles.authorNoteEmpty}>No author's note yet.</Text>
                        )}
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => setIsEditingAuthorNote(true)}
                        >
                          <Text style={styles.editButtonText}>Edit Note</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.authorNoteDisplay}>
                    {authorNote ? (
                      <Text style={styles.authorNoteText}>{authorNote}</Text>
                    ) : (
                      <Text style={styles.authorNoteEmpty}>No author's note for this chapter.</Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Chapter Navigation Buttons */}
            <View style={styles.chapterNavigation}>
              {prevChapter !== null && (
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={() => navigation.navigate('Chapter', { novelId, chapterId: prevChapter })}
                >
                  <FontAwesome5 name="chevron-left" size={16} color={colors.gold} />
                  <Text style={styles.navButtonText}>Previous</Text>
                </TouchableOpacity>
              )}
              <View style={styles.navSpacer} />
              {nextChapter !== null && (
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={() => navigation.navigate('Chapter', { novelId, chapterId: nextChapter })}
                >
                  <Text style={styles.navButtonText}>Next</Text>
                  <FontAwesome5 name="chevron-right" size={16} color={colors.gold} />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 80 }} />

            {/* Comment Section */}
            <CommentSection novelId={novelId} chapter={parseInt(chapterId, 10) + 1} />
          </ScrollView>
        </View>
      )}
      <Modal
        visible={showTransactionPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTransactionPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTransactionPopup(false)}
            >
              <FontAwesome5 name="times" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Confirm Transaction</Text>
            <Text style={styles.modalSubtitle}>
              Unlock {transactionDetails?.subscriptionType === '3CHAPTERS' ? '3 chapters' : 'all chapters'} for:
            </Text>
            <View style={styles.transactionDetails}>
              <Text style={styles.detailText}>
                Amount: {transactionDetails?.displayAmount} {transactionDetails?.currency}
              </Text>
              <Text style={styles.detailText}>USD Value: ${transactionDetails?.usd}</Text>
              <Text style={styles.detailText}>
                Wallet: {activeWalletAddress ? `${activeWalletAddress.slice(0, 6)}...${activeWalletAddress.slice(-4)}` : 'N/A'}
              </Text>
            </View>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  setShowTransactionPopup(false);
                  processChapterPayment(
                    chapterId,
                    transactionDetails.subscriptionType,
                    transactionDetails.currency
                  );
                }}
              >
                <Text style={styles.modalButtonText}>Confirm Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowTransactionPopup(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalNote}>This transaction will be processed securely.</Text>
          </View>
        </View>
      </Modal>

      {/* Payment Processing Animation Modal */}
      <Modal
        visible={showPaymentAnimation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentAnimation(false)}
      >
        <View style={styles.paymentAnimationOverlay}>
          <Animated.View style={[
            styles.paymentAnimationContainer,
            {
              transform: [{ scale: paymentPulseAnimation }]
            }
          ]}>
            <Animated.View style={[
              styles.paymentAnimationRing,
              {
                transform: [{ scale: paymentPulseAnimation }],
                opacity: paymentPulseAnimation.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.8, 0]
                })
              }
            ]} />
            <Animated.View style={[
              styles.paymentAnimationRing,
              styles.paymentAnimationRing2,
              {
                transform: [{ scale: paymentPulseAnimation }],
                opacity: paymentPulseAnimation.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.6, 0]
                })
              }
            ]} />
            <FontAwesome5 name="gem" size={40} color={colors.accent} style={styles.paymentIcon} />
            <Text style={styles.paymentAnimationText}>Processing Payment</Text>
            <Animated.View style={styles.paymentProgressBar}>
              <Animated.View 
                style={[
                  styles.paymentProgressFill,
                  {
                    width: paymentAnimationProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}
              />
            </Animated.View>
            <Text style={styles.paymentAnimationSubtext}>Unlocking chapter with SMP...</Text>
          </Animated.View>
        </View>
      </Modal>

      {/* Video Ad Modal */}
      <Modal
        visible={showVideoAd}
        animationType="fade"
        onRequestClose={() => setShowVideoAd(false)}
      >
        <View style={styles.fullScreenVideoContainer}>
          <TouchableOpacity
            style={styles.fullScreenCloseButton}
            onPress={() => setShowVideoAd(false)}
          >
            <FontAwesome5 name="times" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.videoProgressContainer}>
            <Text style={styles.videoProgressText}>
              {Math.min(Math.floor(watchDuration), 30)} / 30s
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min((watchDuration / 30) * 100, 100)}%` }]} />
            </View>
          </View>
          <Video
            ref={videoRef}
            source={AD_VIDEO_URI}
            style={styles.fullScreenVideo}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
            onPlaybackStatusUpdate={status => {
              setStatus(() => status);
              // Track watch duration
              if (status.isPlaying && !adWatched) {
                const currentDuration = status.positionMillis / 1000; // Convert to seconds
                setWatchDuration(currentDuration);

                // Check if 30 seconds reached
                if (currentDuration >= 30 && !adWatched) {
                  setAdWatched(true);
                  if (__DEV__) console.log('[Video Ad] 30 seconds watched, unlocking chapter');
                  handleVideoAdEnd();
                }
              }
            }}
            onEnd={handleVideoAdEnd}
            onError={(error) => {
              console.error('[Video Ad] Error:', error);
              setError('Failed to load video ad');
              setShowVideoAd(false);
            }}
          />
        </View>
      </Modal>

      {/* Benefactor Subscription Modal */}
      <Modal
        visible={showBenefactorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBenefactorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.benefactorModalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowBenefactorModal(false)}
            >
              <FontAwesome5 name="times" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Subscribe to Writer</Text>
            <Text style={styles.modalSubtitle}>Choose a subscription plan</Text>

            {/* Scrollable body: keeps everything on-screen on short devices
                instead of overflowing/clipping the plan grid below it. */}
            <ScrollView
              style={{ width: '100%' }}
              contentContainerStyle={styles.benefactorScrollBody}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {/* Token Selector - 3 equal flex columns, can never wrap to
                  a 2nd row regardless of screen width */}
              <View style={styles.tokenSelectorRow}>
                <TouchableOpacity
                  style={[styles.tokenOptionFlex, selectedBenefactorToken === 'USDC' && styles.tokenOptionSelected]}
                  onPress={() => setSelectedBenefactorToken('USDC')}
                >
                  <FontAwesome5 name="dollar-sign" size={16} color={selectedBenefactorToken === 'USDC' ? colors.gold : colors.textSecondary} />
                  <Text style={[styles.tokenOptionText, selectedBenefactorToken === 'USDC' && styles.tokenOptionTextSelected]} numberOfLines={1}>USDC</Text>
                  <Text style={styles.tokenBalance} numberOfLines={1}>{usdcBalance.toFixed(2)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tokenOptionFlex, selectedBenefactorToken === 'SOL' && styles.tokenOptionSelected]}
                  onPress={() => setSelectedBenefactorToken('SOL')}
                >
                  <FontAwesome5 name="coins" size={16} color={selectedBenefactorToken === 'SOL' ? colors.gold : colors.textSecondary} />
                  <Text style={[styles.tokenOptionText, selectedBenefactorToken === 'SOL' && styles.tokenOptionTextSelected]} numberOfLines={1}>SOL</Text>
                  <Text style={styles.tokenBalance} numberOfLines={1}>{solBalance.toFixed(4)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tokenOptionFlex, selectedBenefactorToken === 'SKR' && styles.tokenOptionSelected]}
                  onPress={() => setSelectedBenefactorToken('SKR')}
                >
                  <FontAwesome5 name="gem" size={16} color={selectedBenefactorToken === 'SKR' ? colors.gold : colors.textSecondary} />
                  <Text style={[styles.tokenOptionText, selectedBenefactorToken === 'SKR' && styles.tokenOptionTextSelected]} numberOfLines={1}>SKR</Text>
                  <Text style={styles.tokenBalance} numberOfLines={1}>{skrBalance.toFixed(2)}</Text>
                </TouchableOpacity>
              </View>

              {/* Plan grid - fixed 2-column pairing on every device.
                  Each slot is 48% of the grid width with space-between,
                  so exactly 2 cards sit per row every time (4 plans = 2 rows). */}
              <View style={styles.benefactorPlansGrid}>
                {[
                  {
                    id: 'blue',
                    price: 1,
                    chapters: 3,
                    name: 'Blue',
                    color: colors.textSecondary,
                    image: require('../assets/plan-image/Blue.png'),
                    features: [
                      'Early access to 3 advance chapters',
                      'Support your favorite creators',
                      'Exclusive benefactor badge',
                    ],
                    duration: '14 days',
                  },
                  {
                    id: 'iron',
                    price: 2,
                    chapters: 6,
                    name: 'Iron',
                    color: '#808080',
                    image: require('../assets/plan-image/Black.png'),
                    features: [
                      'Early access to 6 advance chapters',
                      'Support your favorite creators',
                      'Exclusive benefactor badge',
                      'Priority support',
                    ],
                    duration: '14 days',
                  },
                  {
                    id: 'silver',
                    price: 3,
                    chapters: 10,
                    name: 'Silver',
                    color: '#C0C0C0',
                    image: require('../assets/plan-image/Sliver.png'),
                    features: [
                      'Early access to 10 advance chapters',
                      'Support your favorite creators',
                      'Exclusive benefactor badge',
                      'Priority support',
                      'Creator recognition',
                    ],
                    duration: '14 days',
                  },
                  {
                    id: 'gold',
                    price: 5,
                    chapters: 999,
                    name: 'Gold',
                    color: colors.gold,
                    image: require('../assets/plan-image/Gold.png'),
                    featured: true,
                    features: [
                      'Unlimited access to all advance chapters',
                      'Support your favorite creators',
                      'Exclusive benefactor badge',
                      'Priority support',
                      'Creator recognition',
                      'Voting rights',
                    ],
                    duration: '30 days',
                  },
                ].map((plan, index) => {
                  const canAfford = selectedBenefactorToken === 'USDC'
                    ? usdcBalance >= plan.price
                    : solBalance >= plan.price * (solPrice || 100);

                  return (
                    <View key={plan.id} style={styles.benefactorPlanSlot}>
                      <Animated.View
                        style={{
                          opacity: planAnimations[index],
                          transform: [
                            {
                              translateY: planAnimations[index].interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                              }),
                            },
                          ],
                        }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.benefactorPlan,
                            { borderColor: plan.color },
                            !canAfford && styles.benefactorPlanDisabled,
                          ]}
                          onPress={() => {
                            setSelectedPlanDetails(plan);
                            setShowPlanDetailsModal(true);
                          }}
                          disabled={isProcessing}
                          activeOpacity={0.8}
                        >
                          {plan.featured && (
                            <View style={styles.featuredBadge}>
                              <Text style={styles.featuredBadgeText}>RECOMMENDED</Text>
                            </View>
                          )}
                          <Image source={plan.image} style={styles.benefactorPlanBadge} resizeMode="contain" />
                          <Text style={[styles.benefactorPlanName, { color: plan.color }]} numberOfLines={1}>
                            {plan.name}
                          </Text>
                          <Text style={styles.benefactorPlanPrice} numberOfLines={1}>${plan.price}</Text>
                          <Text style={styles.benefactorPlanChapters} numberOfLines={1}>
                            {plan.chapters === 999 ? 'Unlimited' : `${plan.chapters} chapters`}
                          </Text>
                          <Text style={styles.benefactorPlanDuration} numberOfLines={1}>{plan.duration}</Text>
                          {!canAfford && (
                            <Text style={styles.insufficientBalanceText} numberOfLines={1}>
                              Insufficient balance
                            </Text>
                          )}
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Plan Details Modal */}
      <Modal
        visible={showPlanDetailsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlanDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.planDetailsModal,
              {
                opacity: planDetailsAnimation,
                transform: [
                  {
                    scale: planDetailsAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowPlanDetailsModal(false)}
            >
              <FontAwesome5 name="times" size={20} color={colors.textPrimary} />
            </TouchableOpacity>

            {selectedPlanDetails && (
              <>
                <Image
                  source={selectedPlanDetails.image}
                  style={styles.planDetailsBadge}
                  resizeMode="contain"
                />
                <Text style={[styles.planDetailsName, { color: selectedPlanDetails.color }]}>
                  {selectedPlanDetails.name} Plan
                </Text>
                <Text style={styles.planDetailsPrice}>${selectedPlanDetails.price}</Text>
                <Text style={styles.planDetailsDuration}>{selectedPlanDetails.duration}</Text>

                <View style={styles.planFeaturesList}>
                  {selectedPlanDetails.features.map((feature, index) => (
                    <View key={index} style={styles.planFeatureItem}>
                      <FontAwesome5 name="check" size={14} color={colors.gold} style={styles.featureCheckIcon} />
                      <Text style={styles.planFeatureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.planDetailsSubscribeButton,
                    { backgroundColor: selectedPlanDetails.color },
                    isProcessing && styles.planDetailsSubscribeButtonDisabled
                  ]}
                  onPress={() => {
                    setShowPlanDetailsModal(false);
                    handleBenefactorUnlock({ ...selectedPlanDetails, selectedToken: selectedBenefactorToken });
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  ) : (
                    <Text style={styles.planDetailsSubscribeButtonText}>
                      Subscribe for ${selectedPlanDetails.price}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Chapter Selector Modal */}
      <Modal
        visible={showChapterSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChapterSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowChapterSelector(false)}
            >
              <FontAwesome5 name="times" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Jump to Chapter</Text>
            <ScrollView style={styles.chapterList}>
              {Object.keys(novel?.chaptercontents || {}).map((ch) => (
                <TouchableOpacity
                  key={ch}
                  style={styles.chapterListItem}
                  onPress={() => {
                    setShowChapterSelector(false);
                    navigation.navigate('Chapter', { novelId, chapterId: ch });
                  }}
                >
                  <Text style={styles.chapterListItemText}>
                    {novel?.chaptertitles?.[ch] || `Chapter ${parseInt(ch) + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Pioneer Badge Modal */}
      <Modal
        visible={showPioneerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isClaimingPioneer && setShowPioneerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pioneerCard}>
            {/* Hero */}
            <View style={styles.pioneerHero}>
              <View style={styles.pioneerBadgeRing}>
                <Image source={pioneerBadge} style={styles.pioneerBadgeImage} />
              </View>
              <Text style={styles.pioneerTitle}>You're a Pioneer</Text>
              <Text style={styles.pioneerSubtitle}>
                First reader to support this writer
              </Text>
            </View>

            {/* Perks */}
            <View style={styles.pioneerPerks}>
              <View style={styles.pioneerPerkRow}>
                <FontAwesome5 name="medal" size={13} color="#FFD700" style={styles.pioneerPerkIcon} />
                <Text style={styles.pioneerPerkText}>Exclusive Pioneer badge on your profile</Text>
              </View>
              <View style={styles.pioneerPerkRow}>
                <FontAwesome5 name="star" size={13} color="#FFD700" style={styles.pioneerPerkIcon} />
                <Text style={styles.pioneerPerkText}>Recognized as this writer's first supporter</Text>
              </View>
              <View style={styles.pioneerPerkRow}>
                <FontAwesome5 name="crown" size={13} color="#FFD700" style={styles.pioneerPerkIcon} />
                <Text style={styles.pioneerPerkText}>Rare badge — cannot be earned again</Text>
              </View>
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={[styles.pioneerClaimButton, isClaimingPioneer && { opacity: 0.6 }]}
              disabled={isClaimingPioneer}
              onPress={async () => {
                setIsClaimingPioneer(true);
                try {
                  // Try to grant Pioneer badge manually if edge function didn't
                  const { data: pioneerBadgeRow } = await supabase
                    .from('badges')
                    .select('id')
                    .eq('type', 'pioneer')
                    .limit(1)
                    .maybeSingle();

                  if (pioneerBadgeRow && userId) {
                    const { data: existingBadge } = await supabase
                      .from('user_badges')
                      .select('id')
                      .eq('user_id', userId)
                      .eq('badge_id', pioneerBadgeRow.id)
                      .maybeSingle();

                    if (!existingBadge) {
                      // Try to insert badge (might fail due to RLS)
                      const { error: badgeError } = await supabase
                        .from('user_badges')
                        .insert({
                          user_id: userId,
                          badge_id: pioneerBadgeRow.id,
                          acquired_at: new Date().toISOString(),
                        });

                      if (badgeError) {
                        console.error('[Pioneer Badge] Manual insert failed:', badgeError);
                        // Badge might already be granted by edge function
                      }
                    }
                  }

                  Alert.alert('Congratulations!', 'You have earned the Pioneer badge!');
                  setShowPioneerModal(false);
                } catch (error) {
                  console.error('[Pioneer Badge] Error:', error);
                  Alert.alert('Error', 'Failed to add Pioneer badge: ' + error.message);
                } finally {
                  setIsClaimingPioneer(false);
                }
              }}
            >
              {isClaimingPioneer ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <FontAwesome5 name="award" size={14} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.pioneerClaimButtonText}>Claim Pioneer Badge</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pioneerDeclineButton}
              disabled={isClaimingPioneer}
              onPress={() => setShowPioneerModal(false)}
            >
              <Text style={styles.pioneerDeclineText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ATA Funding Modal */}
      <Modal
        visible={showAtaFundingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAtaFundingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ataModalContent}>
            <View style={styles.ataModalHeader}>
              <View style={styles.ataModalIcon}>
                <FontAwesome5 name="exclamation-triangle" size={28} color={colors.warning || '#FFD700'} />
              </View>
              <Text style={styles.ataModalTitle}>Writer Missing ATA</Text>
              <Text style={styles.ataModalDescription}>
                This writer doesn't have an SMP Associated Token Account yet. Without it, their payment share will be rerouted to the treasury.
              </Text>
            </View>

            <View style={styles.ataInfoCard}>
              <View style={styles.ataInfoRow}>
                <Text style={styles.ataInfoLabel}>Writer Wallet:</Text>
                <Text style={styles.ataInfoValue}>{pendingAuthorData?.wallet_address?.slice(0, 8)}...</Text>
              </View>
              <View style={styles.ataInfoRow}>
                <Text style={styles.ataInfoLabel}>ATA Address:</Text>
                <Text style={styles.ataInfoValue}>{writerAtaAddress?.slice(0, 8)}...</Text>
              </View>
              <View style={styles.ataCostBadge}>
                <Text style={styles.ataCostText}>~0.002 SOL to create ATA</Text>
              </View>
            </View>

            <View style={styles.ataButtonContainer}>
              <TouchableOpacity
                style={styles.ataPrimaryButton}
                onPress={async () => {
                  try {
                    setShowAtaFundingModal(false);
                    // Create writer ATA first
                    await createWriterAta(
                      pendingAuthorData?.wallet_address,
                      activePublicKey,
                      signAndSendTransaction
                    );
                    // Then proceed with payment
                    if (pendingPaymentDetails) {
                      await processChapterPayment(
                        pendingPaymentDetails.targetChapterId,
                        pendingPaymentDetails.paymentType,
                        pendingPaymentDetails.currency
                      );
                    }
                  } catch (error) {
                    console.error('[ATA Funding] Error:', error);
                    setError(`Failed to create ATA: ${error.message}`);
                    setTimeout(() => setError(null), 5000);
                  }
                }}
              >
                <FontAwesome5 name="check-circle" size={18} color="#ffffff" style={styles.ataButtonIcon} />
                <Text style={styles.ataPrimaryButtonText}>Fund ATA & Proceed</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ataSecondaryButton}
                onPress={async () => {
                  setShowAtaFundingModal(false);
                  // Proceed with payment (writer share will be rerouted to treasury)
                  if (pendingPaymentDetails) {
                    await processChapterPayment(
                      pendingPaymentDetails.targetChapterId,
                      pendingPaymentDetails.paymentType,
                      pendingPaymentDetails.currency
                    );
                  }
                }}
              >
                <FontAwesome5 name="arrow-right" size={16} color={colors.warning || '#FFD700'} style={styles.ataButtonIcon} />
                <Text style={styles.ataSecondaryButtonText}>Skip - Send to Treasury</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ataCancelButton}
                onPress={() => setShowAtaFundingModal(false)}
              >
                <Text style={styles.ataCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Set navigation options to avoid overlay issues
ChapterScreen.navigationOptions = {
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  cardOverlayEnabled: false,
  gestureEnabled: true,
};

export default React.memo(ChapterScreen);