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
} from 'react-native';
import { Video } from 'expo-av';
import Tts from 'react-native-tts';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, createTransferInstruction, createBurnInstruction } from '@solana/spl-token';
import {
  RPC_URL,
  SMP_MINT_ADDRESS,
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
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

const { height } = Dimensions.get('window');

const connection = new Connection(RPC_URL, 'confirmed');
const MIN_ATA_SOL = 0.00103928;
const MIN_USER_SOL = 0.001;

const SQUADS_WALLET = new PublicKey("62PPSRhAk6hdn85MUoYAnUDisswZRfos68Zqf7N1QLkr");
const TREASURY_WALLET = new PublicKey("62PPSRhAk6hdn85MUoYAnUDisswZRfos68Zqf7N1QLkr");
const FOUNDER_FUND_WALLET = new PublicKey("62PPSRhAk6hdn85MUoYAnUDisswZRfos68Zqf7N1QLkr");
const SEMPAI_HQ_WALLET = new PublicKey("4ZFvgNZygfiCSAS4aKBbQEgwJgBq5fRT9oLAH56GrF6H");

// Ad video configuration - use local asset
const AD_VIDEO_URI = require('../assets/ad_video.mp4');

// USD cost of unlocking a single chapter. Centralized here so the displayed
// SMP cost (SMP_READ_COST) and the amount actually charged on-chain
// (processChapterPayment) can never drift apart.
const CHAPTER_READ_USD_COST = 0.025;

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

    let reroutedToFounderFund = 0;

    const [creatorAtaInfo, sempaiHqAtaInfo, founderFundAtaInfo] = await connection.getMultipleAccountsInfo([
      creatorAta,
      sempaiHqAta,
      founderFundAta,
    ]);

    const userBalance = await connection.getBalance(userPublicKey);
    const ataRentExemption = 0.00203928 * 1000000000;
    const requiredSolForAtas = (!creatorAtaInfo ? ataRentExemption : 0) + (!sempaiHqAtaInfo ? ataRentExemption : 0);

    let creatorDestAta = creatorAta;
    let creatorDestAmount = creatorAmount;
    if (!creatorAtaInfo) {
      if (userBalance >= requiredSolForAtas) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPublicKey,
            creatorAta,
            authorPublicKey,
            paymentMint
          )
        );
      } else {
        reroutedToFounderFund += creatorAmount;
        creatorDestAta = null;
        creatorDestAmount = 0;
      }
    }

    let sempaiHqDestAta = sempaiHqAta;
    let sempaiHqDestAmount = sempaiHqAmount;
    if (!sempaiHqAtaInfo) {
      if (userBalance >= requiredSolForAtas) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPublicKey,
            sempaiHqAta,
            SEMPAI_HQ_WALLET,
            paymentMint
          )
        );
      } else {
        reroutedToFounderFund += sempaiHqAmount;
        sempaiHqDestAta = null;
        sempaiHqDestAmount = 0;
      }
    }

    let founderFundDestAta = founderFundAta;
    let founderFundDestAmount = founderFundAmount;
    if (!founderFundAtaInfo) {
      if (userBalance >= ataRentExemption) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPublicKey,
            founderFundAta,
            FOUNDER_FUND_WALLET,
            paymentMint
          )
        );
      } else {
        founderFundDestAta = null;
        founderFundDestAmount = 0;
      }
    }

    if (creatorDestAta && creatorDestAmount > 0) {
      instructions.push(createTransferInstruction(userAta, creatorDestAta, userPublicKey, creatorDestAmount));
    }
    if (sempaiHqDestAta && sempaiHqDestAmount > 0) {
      instructions.push(createTransferInstruction(userAta, sempaiHqDestAta, userPublicKey, sempaiHqDestAmount));
    }

    const totalFounderFundAmount = founderFundDestAmount + reroutedToFounderFund;
    if (totalFounderFundAmount > 0 && founderFundDestAta) {
      instructions.push(createTransferInstruction(userAta, founderFundDestAta, userPublicKey, totalFounderFundAmount));
    }

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
  const usdcPrice = 1; // USDC is pegged to $1
  const [isAdvanceChapter, setIsAdvanceChapter] = useState(false);
  const [isUnlockedViaSubscription, setIsUnlockedViaSubscription] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const emberAnims = useRef([]);
  const embersData = useRef([]);
  const embersInitialized = useRef(false);

  // Ad unlock system
  const [hasUsedAdUnlockToday, setHasUsedAdUnlockToday] = useState(false);
  const [showAdOption, setShowAdOption] = useState(false);
  const [showVideoAd, setShowVideoAd] = useState(false);
  const videoRef = useRef(null);

  // Benefactor subscription system
  const [benefactorAccess, setBenefactorAccess] = useState(null);
  const [showBenefactorOption, setShowBenefactorOption] = useState(false);
  const [showBenefactorModal, setShowBenefactorModal] = useState(false);
  const [selectedBenefactorToken, setSelectedBenefactorToken] = useState('USDC');
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [solBalance, setSolBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState(null);
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
    console.log('[SMP_READ_COST] Calculated SMP cost for $' + CHAPTER_READ_USD_COST + ':', costInSmp, 'SMP price:', smpPrice);
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
            console.log('[fetchPrices] Using cached prices:', { solPrice: cachedSol, smpPrice: cachedSmp });
            setSolPrice(cachedSol);
            setSmpPrice(cachedSmp);
            setPricesAreLive(true);
            return;
          }
          console.warn('[fetchPrices] Cache expired or invalid, fetching new prices');
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
              console.log('[fetchPrices] Using web API fallback for SMP price');
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
        console.log('[fetchPrices] Live prices cached:', { solPrice: liveSolPrice, smpPrice: liveSmpPrice });
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
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const smpMint = new PublicKey(SMP_MINT_ADDRESS);
        const ataAddress = await getAssociatedTokenAddress(smpMint, activePublicKey);
        const ataInfo = await connection.getAccountInfo(ataAddress);
        if (!ataInfo) {
          console.log('[fetchSmpBalanceOnChain] No ATA found for SMP, returning 0');
          setSmpBalance(0);
          return 0;
        }
        const balance = Number(ataInfo.data.readBigUInt64LE(64)) / 10 ** SMP_DECIMALS;
        console.log('[fetchSmpBalanceOnChain] SMP balance:', balance);
        setSmpBalance(balance);
        return balance;
      } catch (error) {
        console.error(`[fetchSmpBalanceOnChain] Attempt ${attempt} error:`, error.message);

        // Handle RPC authorization issues gracefully
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.warn('[fetchSmpBalanceOnChain] RPC authorization issue, using fallback balance 0');
          setSmpBalance(0);
          return 0;
        }

        if (attempt === retryCount) {
          setError('Unable to fetch SMP balance.');
          setTimeout(() => setError(null), 5000);
          return 0;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }
    return 0;
  }, [activeWalletAddress, activePublicKey]);

  const fetchTokenBalances = useCallback(async () => {
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
    try {
      const amethystMint = new PublicKey(AMETHYST_MINT_ADDRESS);
      const ataAddress = await getAssociatedTokenAddress(amethystMint, activePublicKey);
      const ataInfo = await connection.getAccountInfo(ataAddress);
      const balance = ataInfo ? Number(ataInfo.data.readBigUInt64LE(64)) / 10 ** AMETHYST_DECIMALS : 0;
      console.log('[fetchAmethystBalance] Balance:', balance);
      setAmethystBalance(balance);
      return balance;
    } catch (error) {
      console.error('[fetchAmethystBalance] Error:', error.message);

      // Don't show error to user for RPC issues, just log it
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.warn('[fetchAmethystBalance] RPC authorization issue, using fallback balance 0');
        setAmethystBalance(0);
      } else {
        setError('Failed to fetch Amethyst balance.');
        setTimeout(() => setError(null), 5000);
      }
      return 0;
    }
  }, [activeWalletAddress, activePublicKey]);

  const fetchSkrBalance = useCallback(async () => {
    if (!activeWalletAddress || !activePublicKey) return 0;
    try {
      const skrMint = new PublicKey(SKR_MINT_ADDRESS);
      const ataAddress = await getAssociatedTokenAddress(skrMint, activePublicKey);
      const ataInfo = await connection.getAccountInfo(ataAddress);
      const balance = ataInfo ? Number(ataInfo.data.readBigUInt64LE(64)) / 10 ** SKR_DECIMALS : 0;
      console.log('[fetchSkrBalance] Balance:', balance);
      setSkrBalance(balance);
      return balance;
    } catch (error) {
      console.error('[fetchSkrBalance] Error:', error.message);

      // Don't show error to user for RPC issues, just log it
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.warn('[fetchSkrBalance] RPC authorization issue, using fallback balance 0');
        setSkrBalance(0);
      } else {
        setError('Failed to fetch SKR balance.');
        setTimeout(() => setError(null), 5000);
      }
      return 0;
    }
  }, [activeWalletAddress, activePublicKey]);

  const fetchUserData = useCallback(async () => {
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

      // Check benefactor access
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
            setBenefactorAccess(subscriptionData);
          }
        } else {
          setBenefactorAccess(null);
        }
      }

      setShowBenefactorOption(!benefactorAccess);

      // Fetch autopay preference
      if (data.id) {
        const { data: autopayData } = await supabase
          .from('users')
          .select('autopay_enabled')
          .eq('id', data.id)
          .single();
        setAutopayEnabled(autopayData?.autopay_enabled || false);
      }
    } catch (error) {
      console.error('[fetchUserData] Error:', error.message);
      setError('Failed to load user data.');
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress, fetchSmpBalanceOnChain, fetchAmethystBalance, novelId, chapterId, benefactorAccess]);

  const fetchNovel = useCallback(async (id, chapter) => {
    if (!id) {
      setError('Invalid novel ID.');
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('novels')
        .select('id, title, chaptertitles, chaptercontents, advance_chapters, user_id')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      if (!data || !data.chaptercontents?.[chapter]) throw new Error('Chapter not found');
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

      // Fetch author's note for this chapter
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
    } catch (error) {
      console.error('[fetchNovel] Error:', error.message);
      setError(error.message || 'Unable to load chapter.');
      setNovel(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

  // Autopay functionality
  const handleAutopayUnlock = useCallback(async () => {
    if (!activeWalletAddress || !autopayEnabled || smpBalance < (SMP_READ_COST / 10 ** SMP_DECIMALS)) return;

    try {
      setIsProcessing(true);
      // Trigger SMP payment for chapter unlock
      console.log('[Autopay] Automatically unlocking chapter with SMP');
      await processChapterPayment('SINGLE', 'SMP');
    } catch (error) {
      console.error('[Autopay] Error:', error);
      setError(`Autopay failed: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  }, [activeWalletAddress, autopayEnabled, smpBalance, processChapterPayment]);

  useEffect(() => {
    if (isLocked && autopayEnabled && smpBalance >= (SMP_READ_COST / 10 ** SMP_DECIMALS) && !isProcessing && userId) {
      handleAutopayUnlock();
    }
  }, [isLocked, autopayEnabled, smpBalance, isProcessing, userId, handleAutopayUnlock]);

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
    try {
      const { data, error } = await supabase
        .from('chapter_payments')
        .select('id')
        .eq('wallet_address', activeWalletAddress)
        .eq('novel_id', novelId)
        .eq('chapter_number', chapterNum)
        .single();
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return !!data;
    } catch (error) {
      console.error('[checkChapterPayment] Error:', error.message);
      return false;
    }
  }, [activeWalletAddress, novelId]);

  const checkAccess = useCallback(async (walletAddress, novelData, chapterNum) => {
    // Reset to locked state while checking access
    setIsLocked(true);

    if (!walletAddress || !novelData?.id || chapterNum === undefined) {
      setIsLocked(true);
      setCanUnlockNextThree(true);
      return;
    }
    try {
      // First 3 chapters (0, 1, 2) are free for all users
      if (chapterNum >= 0 && chapterNum <= 2) {
        setIsLocked(false);
        setCanUnlockNextThree(true);
        setIsAdvanceChapter(false);
        setIsUnlockedViaSubscription(false);
        return;
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(novelData.id)) {
        throw new Error('Invalid novel ID format');
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

      // Check for writer subscription access
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

  const processChapterPayment = useCallback(
    async (targetChapterId, paymentType = 'SINGLE', currency = 'SMP') => {
      console.log('[processChapterPayment] Active Wallet Address:', activeWalletAddress);
      if (!activeWalletAddress || !novelId || !targetChapterId || !activePublicKey || !wallet || !signAndSendTransaction) {
        setError('Please connect your wallet and try again.');
        return false;
      }

      setIsProcessing(true);
      setError(null);
      setSuccessMessage('');
      setWarningMessage('');

      try {
        // Check if already paid
        const isPaid = await checkChapterPayment(parseInt(targetChapterId, 10));
        if (isPaid && paymentType === 'SINGLE') {
          console.log('[processChapterPayment] Chapter already paid');
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

        console.log('[processChapterPayment] Payment amount:', paymentAmount, currency);

        // Build transaction client-side
        console.log('[processChapterPayment] Building transaction...');
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
        console.log('[processChapterPayment] Signing and sending transaction...');
        const signature = await signAndSendTransaction(transaction);
        console.log('[processChapterPayment] Transaction sent, signature:', signature);

        // Confirm transaction with retry logic
        let confirmation;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            confirmation = await connection.confirmTransaction(
              {
                signature,
                blockhash,
                lastValidBlockHeight,
              },
              'confirmed'
            );
            break; // Success, exit loop
          } catch (confirmError) {
            retryCount++;
            console.warn(`[processChapterPayment] Confirmation attempt ${retryCount} failed:`, confirmError.message);

            if (retryCount >= maxRetries) {
              throw new Error('Transaction confirmation failed after multiple attempts. Please check your wallet for the transaction status.');
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }

        if (confirmation.value.err) {
          console.error('[processChapterPayment] On-chain transaction failed:', confirmation.value.err);
          throw new Error('Transaction failed on the blockchain.');
        }

        // Record payment in database via edge function
        const requestBody = {
          walletAddress: activeWalletAddress,
          novelId,
          chapterId: targetChapterId,
          paymentType,
          currency,
          signature,
        };

        try {
          // Use fetch directly for better control
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;

          if (!accessToken) {
            console.warn('[processChapterPayment] No access token available');
          } else {
            const supabaseUrl = 'https://xqeimsncmnqsiowftdmz.supabase.co';
            const functionUrl = `${supabaseUrl}/functions/v1/unlock-chapter`;

            console.log('[processChapterPayment] Calling edge function at:', functionUrl);

            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify(requestBody),
            });

            console.log('[processChapterPayment] Edge function response status:', response.status);

            const data = await response.json();
            console.log('[processChapterPayment] Edge function response:', data);

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
            navigation.navigate('TokenSwap', {
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
    const initialize = async () => {
      // Reset loading state when chapter changes
      setLoading(true);
      setIsLocked(true);

      const chapterNum = parseInt(chapterId, 10);
      if (!isWalletConnected && chapterNum > 0) {
        setError('Connect your wallet to read Chapter 2 and beyond.');
        setLoading(false);
        return;
      }
      await Promise.all([
        fetchPrices(),
        isWalletConnected ? fetchUserData() : Promise.resolve(),
        fetchNovel(novelId, chapterId),
      ]);
    };
    initialize();
  }, [novelId, chapterId, fetchNovel, fetchUserData, fetchPrices, isWalletConnected]);

  useEffect(() => {
    if (novel && chapterId && isWalletConnected && activeWalletAddress && !recentlyUnlocked) {
      const chapterNum = parseInt(chapterId, 10);
      if (isNaN(chapterNum)) {
        setError('Invalid chapter number');
        return;
      }
      checkAccess(activeWalletAddress, novel, chapterNum);
      checkHasReadChapter(chapterId);
    }
  }, [novel, activeWalletAddress, chapterId, checkAccess, checkHasReadChapter, isWalletConnected, recentlyUnlocked]);

  useEffect(() => {
    if (!loading && novel && !isLocked && readingMode === 'paid' && isWalletConnected && !hasReadChapter) {
      processChapterPayment(chapterId);
    }
  }, [loading, novel, isLocked, readingMode, processChapterPayment, isWalletConnected, chapterId, hasReadChapter]);

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
    let intervalId;
    const fetchAndSchedule = async () => {
      await fetchAmethystBalance();
      intervalId = setInterval(fetchAmethystBalance, 300000); // Fetch every 5 minutes
    };
    fetchAndSchedule();
    return () => clearInterval(intervalId);
  }, [isWalletConnected, activeWalletAddress, fetchAmethystBalance]);

  // Fetch token balances for benefactor payments
  useEffect(() => {
    if (isWalletConnected && activeWalletAddress) {
      fetchTokenBalances();
    }
  }, [isWalletConnected, activeWalletAddress, fetchTokenBalances]);

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
        <ActivityIndicator size="large" color="#E67E22" />
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
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
        <Text style={styles.headerTitle} numberOfLines={1}>{chapterTitle}</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('NovelsPage', { novelId })}
        >
          <FontAwesome5 name="book" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      {(successMessage || (error && isWalletConnected) || warningMessage) && (
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
      {!isWalletConnected && parseInt(chapterId, 10) > 0 ? (
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
      ) : isLocked && isAdvanceChapter ? (
        <View>
          <UBBadge type="writer" size="large" showLabel={false} />
          <Text style={styles.lockedMessage}>{releaseDateMessage}</Text>
          <Text style={styles.lockedSubMessage}>Unlock with a Subscription</Text>
          {!pricesAreLive && (
            <Text style={styles.priceStaleNote}>Live pricing unavailable — SOL/SMP prices shown may be stale</Text>
          )}
          <View style={styles.paymentGrid}>
            {[
              { type: '3CHAPTERS', currency: 'SOL', price: threeChaptersSol, usd: 3 },
              { type: 'FULL', currency: 'SOL', price: fullChaptersSol, usd: 15 },
              { type: '3CHAPTERS', currency: 'USDC', price: threeChaptersUsdc, usd: 3 },
              { type: 'FULL', currency: 'USDC', price: fullChaptersUsdc, usd: 15 },
              { type: '3CHAPTERS', currency: 'SMP', price: threeChaptersSmp, usd: 3 },
              { type: 'FULL', currency: 'SMP', price: fullChaptersSmp, usd: 15 },
            ].map(({ type, currency, price, usd }) => (
              <TouchableOpacity
                key={`${type}-${currency}`}
                style={[
                  styles.paymentButton,
                  type === 'FULL' ? styles.fullChaptersButton : styles.threeChaptersButton,
                  (type === '3CHAPTERS' && !canUnlockNextThree) || (currency !== 'USDC' && price === 'N/A')
                    ? styles.disabledButton
                    : null,
                ]}
                onPress={() => {
                  setTransactionDetails({ subscriptionType: type, currency, displayAmount: price, usd });
                  setShowTransactionPopup(true);
                }}
                disabled={(type === '3CHAPTERS' && !canUnlockNextThree) || (currency !== 'USDC' && price === 'N/A')}
              >
                <FontAwesome5
                  name={type === 'FULL' ? 'crown' : 'rocket'}
                  size={20}
                  color={colors.textPrimary}
                  style={styles.buttonIcon}
                />
                <Text style={styles.paymentButtonText}>
                  {type === 'FULL' ? 'All Chapters' : '3 Chapters'} ({currency})
                </Text>
                <Text style={styles.paymentPrice}>
                  ${usd} / {price} {currency}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : isLocked ? (
        <View style={styles.lockedContainer}>
          <UBBadge type="writer" size="large" showLabel={false} />
          <Text style={styles.lockedMessage}>Read this Chapter</Text>

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

          {/* Benefactor subscription option */}
          {showBenefactorOption && !benefactorAccess && (
            <View style={styles.benefactorContainer}>
              <AutopaySettings onAutopayToggle={(enabled) => setAutopayEnabled(enabled)} />
              <TouchableOpacity
                style={[styles.actionButton, styles.badgesButton]}
                onPress={() => navigation.navigate('Badges', { writerId: novel?.user_id })}
                disabled={isProcessing}
              >
                <FontAwesome5 name="crown" size={16} color={colors.gold} style={styles.buttonIcon} />
                <Text style={styles.actionButtonText}>Buy Badges</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.benefactorButton]}
                onPress={() => setShowBenefactorModal(true)}
                disabled={isProcessing}
              >
                <FontAwesome5 name="crown" size={16} color={colors.gold} style={styles.buttonIcon} />
                <Text style={styles.actionButtonText}>Subscribe to Writer</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Benefactor status */}
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
              <Text style={styles.benefactorExpiryText}>
                Expires: {new Date(benefactorAccess.expires_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
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

      {/* Video Ad Modal */}
      <Modal
        visible={showVideoAd}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVideoAd(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.videoAdContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowVideoAd(false)}
            >
              <FontAwesome5 name="times" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Watch Ad to Unlock</Text>
            <Text style={styles.modalSubtitle}>Please watch the ad to unlock this chapter for free</Text>
            <Video
              ref={videoRef}
              source={{ uri: AD_VIDEO_URI }}
              style={styles.video}
              useNativeControls
              resizeMode="contain"
              onEnd={handleVideoAdEnd}
              onError={(error) => {
                console.error('[Video Ad] Error:', error);
                setError('Failed to load video ad');
                setShowVideoAd(false);
              }}
            />
          </View>
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