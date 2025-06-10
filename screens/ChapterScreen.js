import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import * as SecureStore from 'expo-secure-store';
import { styles } from '../styles/ChapterScreenStyles';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
  RPC_URL,
  SMP_MINT_ADDRESS,
  USDC_MINT_ADDRESS,
  SMP_DECIMALS,
  AMETHYST_MINT_ADDRESS,
  AMETHYST_DECIMALS,
} from '../constants';
import { Buffer } from 'buffer';
import CommentSection from '../components/Comments/CommentSection';

const connection = new Connection(RPC_URL, 'confirmed');
const MIN_ATA_SOL = 0.00103928;
const MIN_USER_SOL = 0.001;
const poolAddress = "3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33";
const meteoraApiUrl = `https://amm-v2.meteora.ag/pools?address=${poolAddress}`;
const USDC_AMOUNT = 0.025; // Amount to convert (in USDC) for SMP_READ_COST

const ChapterScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { novelId, chapterId } = route.params || {};
  const { wallet, isWalletConnected: contextWalletConnected } = useContext(EmbeddedWalletContext);

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
  const [showTransactionPopup, setShowTransactionPopup] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [solPrice, setSolPrice] = useState(100); // Default SOL price
  const [smpPrice, setSmpPrice] = useState(0.01); // Default SMP price in USD
  const [hasReadChapter, setHasReadChapter] = useState(false);
  const usdcPrice = 1; // USDC is pegged to $1
  const [isAdvanceChapter, setIsAdvanceChapter] = useState(false);
  const [isUnlockedViaSubscription, setIsUnlockedViaSubscription] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Dynamic SMP cost for $0.025
  const SMP_READ_COST = useMemo(() => {
    if (!smpPrice || smpPrice <= 0) {
      console.warn('[SMP_READ_COST] Invalid SMP price, using default value');
      return 2500000; // Fallback: 0.025 USD / 0.01 USD per SMP = 2,500,000 lamports (6 decimals)
    }
    const costInSmp = Math.ceil((0.025 / smpPrice) * 10 ** SMP_DECIMALS);
    console.log('[SMP_READ_COST] Calculated SMP cost for $0.025:', costInSmp, 'SMP price:', smpPrice);
    return costInSmp;
  }, [smpPrice]);

  // Fetch pool data from Meteora API
  async function fetchPoolData() {
    try {
      const response = await fetch(meteoraApiUrl).then((r) => r.json());
      const poolData = response[0]; // Assuming the API returns an array with the pool object
      console.log('[fetchPoolData] Raw pool data:', JSON.stringify(poolData));
      return poolData;
    } catch (error) {
      console.error('[fetchPoolData] Error:', error.message);
      throw new Error(`Failed to fetch pool data: ${error.message}`);
    }
  }

  // Calculate SOL price in USD
  function calculateSolPriceInUsd(pool) {
    const solAmount = parseFloat(pool.pool_token_amounts[1]); // SOL amount in pool
    const solUsdValue = parseFloat(pool.pool_token_usd_amounts[1]); // USD value of SOL

    if (solAmount <= 0 || solUsdValue <= 0) {
      throw new Error("Invalid pool amounts: SOL amount or USD value must be positive");
    }

    const solPriceInUsd = solUsdValue / solAmount;
    console.log('[calculateSolPriceInUsd] SOL Price:', solPriceInUsd.toFixed(2), 'USD');
    return solPriceInUsd;
  }

  // Calculate SMP per SOL
  function calculateSmpPerSol(pool) {
    const smpAmount = parseFloat(pool.pool_token_amounts[0]); // SMP amount in pool
    const solAmount = parseFloat(pool.pool_token_amounts[1]); // SOL amount in pool

    if (smpAmount <= 0 || solAmount <= 0) {
      throw new Error("Invalid pool amounts: SMP and SOL amounts must be positive");
    }

    if (solAmount < 0.01) {
      console.warn('[calculateSmpPerSol] Warning: Low SOL liquidity in pool. Price may be unreliable.');
    }

    const smpPerSol = smpAmount / solAmount;
    console.log('[calculateSmpPerSol] SMP per SOL:', smpPerSol.toFixed(2));
    return smpPerSol;
  }

  // Convert USDC to SMP
  async function convertUsdcToSmp(usdcAmount) {
    try {
      const poolData = await fetchPoolData();
      const solPriceInUsd = calculateSolPriceInUsd(poolData);
      const solAmount = usdcAmount / solPriceInUsd;
      const smpPerSol = calculateSmpPerSol(poolData);
      const smpAmount = solAmount * smpPerSol;
      console.log(`[convertUsdcToSmp] ${usdcAmount} USDC = ${smpAmount.toFixed(2)} SMP`);
      return smpAmount;
    } catch (error) {
      console.error('[convertUsdcToSmp] Error:', error.message);
      return null;
    }
  }

  // Fetch prices (SOL and SMP)
  const fetchPrices = useCallback(async () => {
    try {
      const cacheKey = 'priceCache';
      const cacheExpiry = 5 * 60 * 1000; // 5 minutes
      const cachedData = await SecureStore.getItemAsync(cacheKey);
      if (cachedData) {
        try {
          const { timestamp, solPrice, smpPrice } = JSON.parse(cachedData);
          console.log('[fetchPrices] Raw cached data:', { timestamp, solPrice, smpPrice });
          if (Date.now() - timestamp < cacheExpiry && solPrice > 0 && smpPrice > 0) {
            console.log('[fetchPrices] Using cached prices:', { solPrice, smpPrice });
            setSolPrice(solPrice);
            setSmpPrice(smpPrice);
            return;
          } else {
            console.warn('[fetchPrices] Cache expired or invalid, fetching new prices');
          }
        } catch (error) {
          console.error('[fetchPrices] Cache parse error:', error.message);
          await SecureStore.deleteItemAsync(cacheKey);
        }
      }

      let solPrice = 100; // Default fallback
      let smpPrice = 0.01; // Default fallback

      const smpAmount = await convertUsdcToSmp(USDC_AMOUNT);
      if (smpAmount !== null && smpAmount > 0) {
        smpPrice = USDC_AMOUNT / smpAmount; // SMP price in USD
        const poolData = await fetchPoolData();
        solPrice = calculateSolPriceInUsd(poolData);
      } else {
        console.warn('[fetchPrices] Failed to fetch SMP amount, using fallback prices');
      }

      setSolPrice(solPrice);
      setSmpPrice(smpPrice);

      await SecureStore.setItemAsync(
        cacheKey,
        JSON.stringify({ timestamp: Date.now(), solPrice, smpPrice })
      );
      console.log('[fetchPrices] Prices saved to cache:', { solPrice, smpPrice });
    } catch (error) {
      console.error('[fetchPrices] Error:', error.message);
      setSolPrice(100);
      setSmpPrice(0.01);
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

  const fetchAmethystBalance = useCallback(async () => {
    if (!activeWalletAddress || !activePublicKey) return 0;
    try {
      const amethystMint = new PublicKey(AMETHYST_MINT_ADDRESS);
      const ataAddress = await getAssociatedTokenAddress(amethystMint, activePublicKey);
      const ataInfo = await connection.getAccountInfo(ataAddress);
      const balance = ataInfo ? Number(ataInfo.data.readBigUInt64LE(64)) / 10 ** AMETHYST_DECIMALS : 0;
      setAmethystBalance(balance);
      return balance;
    } catch (error) {
      console.error('[fetchAmethystBalance] Error:', error.message);
      setError('Failed to fetch Amethyst balance.');
      setTimeout(() => setError(null), 5000);
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
      await Promise.all([fetchSmpBalanceOnChain(), fetchAmethystBalance()]);
    } catch (error) {
      console.error('[fetchUserData] Error:', error.message);
      setError('Failed to load user data.');
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress, fetchSmpBalanceOnChain, fetchAmethystBalance]);

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
    } catch (error) {
      console.error('[fetchNovel] Error:', error.message);
      setError(error.message || 'Unable to load chapter.');
      setNovel(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (!walletAddress || !novelData?.id || chapterNum === undefined) {
      setIsLocked(true);
      setCanUnlockNextThree(true);
      return;
    }
    try {
      if (chapterNum === 0) {
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

      if (advanceInfo.is_advance && userId) {
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
  }, [userId, checkChapterPayment]);

  const shouldShowContent = useMemo(() => {
    if (!isWalletConnected) return false;
    if (isUnlockedViaSubscription) return true;
    if (parseInt(chapterId, 10) === 0) return true;
    return !isLocked;
  }, [isWalletConnected, isUnlockedViaSubscription, isLocked, chapterId]);

  const processChapterPayment = useCallback(
    async (targetChapterId, paymentType = 'SINGLE', currency = 'SMP') => {
      if (!activeWalletAddress || !novelId || !targetChapterId || !activePublicKey) {
        setError('Please connect your wallet and try again.');
        return false;
      }
      setIsProcessing(true);
      setError(null);
      setSuccessMessage('');
      setWarningMessage('');
      try {
        const isPaid = await checkChapterPayment(parseInt(targetChapterId, 10));
        if (isPaid && paymentType === 'SINGLE') {
          console.log('[processChapterPayment] Chapter already paid');
          setIsLocked(false);
          return true;
        }
        const userSolBalance = await connection.getBalance(activePublicKey);
        if (userSolBalance < MIN_ATA_SOL * 10 ** 9) {
          throw new Error(`Insufficient SOL for transaction fees (need ${MIN_ATA_SOL} SOL)`);
        }
        // Client-side balance check
        if (currency === 'SMP' && smpBalance * 10 ** SMP_DECIMALS < SMP_READ_COST && paymentType === 'SINGLE') {
          throw new Error('Insufficient SMP balance');
        }
        if (paymentType !== 'SINGLE') {
          const amount = currency === 'SMP' ? Math.ceil((paymentType === '3CHAPTERS' ? 3 : 15) / smpPrice) * 10 ** SMP_DECIMALS :
                        currency === 'USDC' ? (paymentType === '3CHAPTERS' ? 3 : 15) * 10 ** 6 :
                        Math.ceil((paymentType === '3CHAPTERS' ? 3 : 15) / solPrice) * 10 ** 9;
          if (currency === 'SMP' && smpBalance * 10 ** SMP_DECIMALS < amount) {
            throw new Error('Insufficient SMP balance');
          }
          // Add USDC and SOL balance checks if available
        }
        console.log('[processChapterPayment] Invoking unlock-chapter:', {
          userPublicKey: activeWalletAddress,
          novelId,
          chapterId: targetChapterId,
          paymentType,
          currency,
        });
        const { data, error: invokeError } = await supabase.functions.invoke('unlock-chapter', {
          body: {
            userPublicKey: activeWalletAddress,
            novelId,
            chapterId: targetChapterId,
            paymentType,
            currency,
          },
        });
        if (invokeError) {
          console.error('[processChapterPayment] Invoke error:', invokeError);
          throw new Error(`Edge function error: ${invokeError.message || 'Non-2xx status code'}`);
        }
        if (!data?.transaction) throw new Error('No transaction returned');

        const transaction = Transaction.from(Buffer.from(data.transaction, 'base64'));
        const signature = await connection.sendRawTransaction(transaction.serialize());
        let confirmation;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            confirmation = await connection.confirmTransaction(signature, 'confirmed');
            if (confirmation.value.err) throw new Error('Transaction failed on chain');
            break;
          } catch (err) {
            if (attempt === 3) throw err;
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }

        setSuccessMessage(
          `Payment successful! ${data.amount / (currency === 'SOL' ? 10 ** 9 : 10 ** 6)} ${currency} paid for ${
            paymentType === 'SINGLE' ? 'chapter' : paymentType === '3CHAPTERS' ? '3 chapters' : 'all chapters'
          }.`
        );
        setSmpBalance((prev) => (currency === 'SMP' ? prev - (data.amount / 10 ** SMP_DECIMALS) : prev));
        setIsLocked(false);
        setCanUnlockNextThree(true);
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
    [activeWalletAddress, activePublicKey, novelId, smpBalance, smpPrice, solPrice, navigation]
  );

  const handleNextChapter = useCallback(
    async (nextChapterId) => {
      if (!nextChapterId) return;
      setIsProcessing(true);
      try {
        const isPaid = await checkChapterPayment(parseInt(nextChapterId, 10));
        if (isPaid) {
          navigation.navigate('Chapter', { novelId, chapterId: nextChapterId });
          return;
        }
        const success = await processChapterPayment(nextChapterId);
        if (success) {
          navigation.navigate('Chapter', { novelId, chapterId: nextChapterId });
        }
      } catch (err) {
        console.error('[handleNextChapter] Error:', err.message);
        setError('Failed to process next chapter.');
        setTimeout(() => setError(null), 5000);
      } finally {
        setIsProcessing(false);
      }
    },
    [checkChapterPayment, processChapterPayment, navigation, novelId]
  );

  useEffect(() => {
    if (!novelId || !chapterId) {
      setError('Invalid novel or chapter ID.');
      setUseInput(true);
      setLoading(false);
      return;
    }
    const initialize = async () => {
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
    if (novel && chapterId && isWalletConnected && activeWalletAddress) {
      const chapterNum = parseInt(chapterId, 10);
      if (isNaN(chapterNum)) {
        setError('Invalid chapter number');
        return;
      }
      checkAccess(activeWalletAddress, novel, chapterNum);
      checkHasReadChapter(chapterId);
    }
  }, [novel, activeWalletAddress, chapterId, checkAccess, checkHasReadChapter, isWalletConnected]);

  useEffect(() => {
    if (!loading && novel && !isLocked && readingMode === 'paid' && isWalletConnected && !hasReadChapter) {
      processChapterPayment(chapterId);
    }
  }, [loading, novel, isLocked, readingMode, processChapterPayment, isWalletConnected, chapterId, hasReadChapter]);

  const handleManualFetch = () => {
    if (!inputNovelId || !inputChapterId) {
      setError('Please enter both Novel ID and Chapter ID.');
      return;
    }
    setLoading(true);
    setError(null);
    setUseInput(false);
    fetchNovel(inputNovelId, inputChapterId);
  };

  const chapterContent = novel?.chaptercontents?.[chapterId] || '';
  const paragraphs = useMemo(() => {
    if (!chapterContent) return [];
    return chapterContent
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.trim());
  }, [chapterContent]);

  const renderParagraph = useCallback(
    ({ item }) => <Text style={styles.paragraph}>{item}</Text>,
    []
  );

  useEffect(() => {
    if (!isWalletConnected) return;
    fetchSmpBalanceOnChain();
    const intervalId = setInterval(fetchSmpBalanceOnChain, 30000);
    return () => clearInterval(intervalId);
  }, [isWalletConnected, fetchSmpBalanceOnChain]);

  const ListFooter = useCallback(
    () => (
      <View>
        <View style={styles.navigation}>
          <View style={styles.navRow}>
            {prevChapter ? (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigation.navigate('Chapter', { novelId, chapterId: prevChapter })}
              >
                <Icon name="chevron-left" size={16} color="#ffffff" style={styles.buttonIcon} />
                <Text style={styles.navButtonText}>Previous</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.navPlaceholder} />
            )}
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('Novel', { novelId })}
            >
              <Icon name="book-open" size={16} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.navButtonText}>Back to Novel</Text>
            </TouchableOpacity>
            {nextChapter && (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleNextChapter(nextChapter)}
              >
                <Text style={styles.navButtonText}>Next</Text>
                <Icon name="chevron-right" size={16} color="#ffffff" style={styles.buttonIcon} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <CommentSection novelId={novelId} chapter={parseInt(chapterId, 10) + 1} />
      </View>
    ),
    [prevChapter, nextChapter, novelId, chapterId, handleNextChapter, navigation]
  );

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
        <Animated.View entering={SlideInDown} exiting={SlideOutDown}>
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
            <Icon name="home" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (!novel || !novel.chaptercontents?.[chapterId]) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Animated.View entering={SlideInDown} exiting={SlideOutDown}>
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
            <Icon name="home" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const chapterTitle = novel.chaptertitles?.[chapterId] || `Chapter ${parseInt(chapterId) + 1}`;
  const chapterKeys = Object.keys(novel.chaptercontents || {});
  const currentIndex = chapterKeys.indexOf(chapterId);
  const prevChapter = currentIndex > 0 ? chapterKeys[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapterKeys.length - 1 ? chapterKeys[currentIndex + 1] : null;
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
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      {isWalletConnected && (
        <Animated.View entering={FadeIn} style={styles.balanceContainer}>
          <View style={styles.balanceItem}>
            <Icon name="wallet" size={16} color="#E67E22" style={styles.balanceIcon} />
            <Text style={styles.balanceText}>SMP: {smpBalance.toLocaleString()}</Text>
          </View>
          <View style={styles.balanceItem}>
            <Icon name="star" size={16} color="#E67E22" style={styles.balanceIcon} />
            <Text style={styles.balanceText}>Points: {weeklyPoints.toLocaleString()}</Text>
          </View>
          <View style={styles.balanceItem}>
            <Icon name="gem" size={16} color="#E67E22" style={styles.balanceIcon} />
            <Text style={styles.balanceText}>Amethyst: {amethystBalance.toFixed(2)}</Text>
          </View>
        </Animated.View>
      )}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Home')}>
          <Icon name="home" size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{chapterTitle}</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Novel', { novelId })}
        >
          <Icon name="book" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
      {(successMessage || (error && isWalletConnected) || warningMessage) && (
        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={[
            styles.messageContainer,
            error ? styles.errorMessage : warningMessage ? styles.warningMessage : styles.successMessage,
          ]}
        >
          <Text style={styles.messageText}>{successMessage || error || warningMessage}</Text>
        </Animated.View>
      )}
      {!isWalletConnected && parseInt(chapterId, 10) > 0 ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Icon name="wallet" size={48} color="#E67E22" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Connect Wallet to Continue Reading</Text>
          <Text style={styles.lockedSubMessage}>Please connect your wallet to read chapters.</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <Icon name="wallet" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.actionButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : isLocked && isAdvanceChapter ? (
        <Animated.View style={styles.lockedContainer} entering={FadeIn}>
          <Icon name="lock" size={48} color="#FF5252" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>{releaseDateMessage}</Text>
          <Text style={styles.lockedSubMessage}>Unlock with a Subscription</Text>
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
                <Icon
                  name={type === 'FULL' ? 'crown' : 'rocket'}
                  size={20}
                  color="#ffffff"
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
        </Animated.View>
      ) : isLocked ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Icon name="gem" size={48} color="#E67E22" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Read this Chapter</Text>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.smpButton}
              onPress={() => processChapterPayment(chapterId, 'SINGLE', 'SMP')}
              disabled={isProcessing}
            >
              <Icon name="gem" size={16} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.smpButtonText}>
                Read with {(SMP_READ_COST / 10 ** SMP_DECIMALS).toLocaleString()} SMP (Earn Points)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.getSmpButton}
              onPress={() =>
                navigation.navigate('TokenSwap', {
                  returnScreen: 'Chapter',
                  returnParams: { novelId, chapterId },
                })
              }
            >
              <Icon name="shopping-cart" size={16} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.getSmpButtonText}>Get SMP Tokens</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : (
        <FlatList
          data={paragraphs}
          renderItem={renderParagraph}
          keyExtractor={(_, index) => `para-${index}`}
          style={styles.contentContainer}
          initialNumToRender={50}
          maxToRenderPerBatch={50}
          windowSize={5}
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          ListHeaderComponent={
            hasReadChapter ? (
              <View style={styles.readingOptions}>
                <Text style={styles.readingModeText}>You've earned points from this chapter</Text>
              </View>
            ) : null
          }
          ListFooterComponent={ListFooter}
        />
      )}
      <Modal
        visible={showTransactionPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTransactionPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTransactionPopup(false)}
            >
              <Icon name="times" size={20} color="#ffffff" />
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
                Wallet: {activeWalletAddress?.slice(0, 6)}...{activeWalletAddress?.slice(-4)}
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
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ChapterScreen;