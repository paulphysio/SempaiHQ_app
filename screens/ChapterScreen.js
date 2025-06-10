import React, { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient'; // Adjust path
import { EmbeddedWalletContext } from '../components/ConnectButton'; // Adjust path
import { Connection, PublicKey } from '@solana/web3.js';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import * as SecureStore from 'expo-secure-store';
import { styles } from '../styles/ChapterScreenStyles'; // Adjust path
import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
  RPC_URL,
  SMP_MINT_ADDRESS,
  SMP_DECIMALS,
} from '../constants'; // Adjust path
import CommentSection from '../components/Comments/CommentSection'; // Adjust path

const connection = new Connection(RPC_URL, 'confirmed');
const poolAddress = "3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33";
const meteoraApiUrl = `https://amm-v2.meteora.ag/pools?address=${poolAddress}`;

const ChapterScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { novelId, chapterId } = route.params || {};
  const { wallet } = useContext(EmbeddedWalletContext);

  const [novel, setNovel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warningMessage, setWarningMessage] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [smpBalance, setSmpBalance] = useState(0);
  const [solPrice, setSolPrice] = useState(165.2); // Default until fetched
  const [smpPrice, setSmpPrice] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const hasFetchedPrices = useRef(false); // Track price fetch per page visit
  const prevWalletAddress = useRef(null); // Track wallet address changes

  // Wallet public key
  const activePublicKey = useMemo(() => {
    try {
      return wallet?.publicKey ? new PublicKey(wallet.publicKey) : null;
    } catch (err) {
      console.error('[activePublicKey] Error:', err.message);
      setError('Invalid wallet public key.');
      return null;
    }
  }, [wallet?.publicKey]);

  const activeWalletAddress = activePublicKey?.toString();

  // SMP cost for $0.025
  const SMP_READ_COST = useMemo(() => {
    if (!smpPrice || smpPrice <= 0) {
      console.warn('[SMP_READ_COST] Invalid SMP price, using default');
      return 50000; // Fallback: 50,000 SMP
    }
    const costInSmp = Math.ceil((0.025 / smpPrice) * 10 ** SMP_DECIMALS);
    console.log('[SMP_READ_COST] Calculated SMP cost:', costInSmp, 'SMP price:', smpPrice);
    return costInSmp;
  }, [smpPrice]);

  // Fetch pool data (from provided script)
  const fetchPoolData = useCallback(async () => {
    try {
      const response = await fetch(meteoraApiUrl).then((r) => r.json());
      const poolData = response[0];
      if (!poolData || !poolData.pool_token_amounts) {
        throw new Error('Invalid pool data structure');
      }
      console.log('[fetchPoolData] Raw pool data:', poolData);
      return poolData;
    } catch (error) {
      console.error('[fetchPoolData] Error:', error.message);
      throw new Error(`Failed to fetch pool data: ${error.message}`);
    }
  }, []);

  // Calculate SMP price in SOL (corrected with decimals)
  const calculateSmpPriceInSol = useCallback((pool, smpDecimals = 6, solDecimals = 9) => {
    const smpAmount = parseFloat(pool.pool_token_amounts[0]) / Math.pow(10, smpDecimals);
    const solAmount = parseFloat(pool.pool_token_amounts[1]) / Math.pow(10, solDecimals);

    if (smpAmount <= 0 || solAmount <= 0) {
      throw new Error("Invalid pool amounts: SMP and SOL amounts must be positive");
    }

    if (solAmount < 0.01) {
      console.warn("Warning: Low SOL liquidity in pool. Price may be unreliable.");
    }

    const smpPerSol = smpAmount / solAmount;
    const priceInSol = 1 / smpPerSol;

    console.log("From Pool Data:", { priceInSol, smpPerSol });
    return {
      priceInSol,
      smpPerSol,
      source: "pool data"
    };
  }, []);

  // Fetch prices ($0.025 -> SOL -> SMP)
  const fetchPrices = useCallback(async () => {
    if (hasFetchedPrices.current) {
      console.log('[fetchPrices] Prices already fetched, skipping...');
      setPricesLoading(false);
      return;
    }
    setPricesLoading(true);
    try {
      // Check cache
      const cacheKey = 'priceCache';
      const cachedData = await SecureStore.getItemAsync(cacheKey);
      if (cachedData) {
        try {
          const { solPrice, smpPrice, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < 5 * 60 * 1000 && solPrice > 0 && smpPrice > 0) {
            console.log('[fetchPrices] Using cached prices:', { solPrice, smpPrice });
            setSolPrice(solPrice);
            setSmpPrice(smpPrice);
            hasFetchedPrices.current = true;
            setPricesLoading(false);
            return;
          }
        } catch (error) {
          console.warn('[fetchPrices] Cache parse error:', error.message);
        }
      }

      // Fetch SOL price from CoinGecko
      let solPrice = 165.2;
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        if (response.ok) {
          const data = await response.json();
          solPrice = data.solana.usd;
          console.log('[fetchPrices] SOL price:', solPrice);
        }
      } catch (error) {
        console.warn('[fetchPrices] SOL price fetch error:', error.message);
      }
      setSolPrice(solPrice);

      // Fetch SMP price
      const poolData = await fetchPoolData();
      const { priceInSol, smpPerSol } = calculateSmpPriceInSol(poolData, SMP_DECIMALS, 9);
      const smpPrice = priceInSol * solPrice;
      console.log('[fetchPrices] SMP Price:', priceInSol.toExponential(6), 'SOL per SMP');
      console.log('[fetchPrices] SMP per SOL:', smpPerSol.toFixed(2), 'SMP per SOL');
      console.log('[fetchPrices] SMP price in USD:', smpPrice);

      if (!isNaN(smpPrice) && smpPrice > 0) {
        setSmpPrice(smpPrice);
        await SecureStore.setItemAsync(cacheKey, JSON.stringify({ solPrice, smpPrice, timestamp: Date.now() }));
        console.log('[fetchPrices] Prices saved to cache:', { solPrice, smpPrice });
      } else {
        console.warn('[fetchPrices] Invalid SMP price:', smpPrice);
        setSmpPrice(null);
      }
      hasFetchedPrices.current = true;
    } catch (error) {
      console.error('[fetchPrices] Error:', error.message);
      setSmpPrice(null);
    } finally {
      setPricesLoading(false);
    }
  }, [fetchPoolData, calculateSmpPriceInSol]);

  // Fetch SMP balance
  const fetchSmpBalanceOnChain = useCallback(async () => {
    if (!activeWalletAddress || !activePublicKey) return 0;
    try {
      const smpMint = new PublicKey(SMP_MINT_ADDRESS);
      const ataAddress = await getAssociatedTokenAddress(smpMint, activePublicKey);
      const ataInfo = await connection.getAccountInfo(ataAddress);
      const balance = ataInfo ? Number(ataInfo.data.readBigUInt64LE(64)) / 10 ** SMP_DECIMALS : 0;
      console.log('[fetchSmpBalanceOnChain] SMP balance:', balance);
      setSmpBalance(balance);
      return balance;
    } catch (error) {
      console.error('[fetchSmpBalanceOnChain] Error:', error.message);
      setError('Failed to fetch SMP balance.');
      setTimeout(() => setError(null), 5000);
      return 0;
    }
  }, [activeWalletAddress, activePublicKey]);

  // Fetch novel data
  const fetchNovel = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('novels')
        .select('id, title, chaptertitles, chaptercontents')
        .eq('id', novelId)
        .single();
      if (error) throw error;
      if (!data.chaptercontents?.[chapterId]) throw new Error('Chapter not found');
      setNovel(data);
    } catch (error) {
      console.error('[fetchNovel] Error:', error.message);
      setError('Unable to load chapter.');
      setNovel(null);
    } finally {
      setLoading(false);
    }
  }, [novelId, chapterId]);

  // Check chapter access
  const checkAccess = useCallback(async () => {
    if (!activeWalletAddress || !novel || parseInt(chapterId) !== 0) {
      setIsLocked(true);
      return;
    }
    setIsLocked(false);
  }, [activeWalletAddress, novel, chapterId]);

  // Process chapter payment
  const processChapterPayment = useCallback(async () => {
    if (!activeWalletAddress || !novelId || !chapterId) {
      setError('Please connect your wallet.');
      return false;
    }
    try {
      if (smpBalance * 10 ** SMP_DECIMALS < SMP_READ_COST) {
        throw new Error('Insufficient SMP balance');
      }
      setWarningMessage('Payment processing not fully implemented.');
      setTimeout(() => setWarningMessage(''), 5000);
      return false;
    } catch (error) {
      console.error('[processChapterPayment] Error:', error.message);
      setWarningMessage(error.message);
      setTimeout(() => {
        try {
          navigation.navigate('TokenSwap', { returnScreen: 'Chapter', returnParams: { novelId, chapterId } });
        } catch (navError) {
          console.error('[processChapterPayment] Navigation error:', navError.message);
          setError('TokenSwap screen not available.');
          setTimeout(() => setError(null), 5000);
        }
      }, 2000);
      return false;
    }
  }, [activeWalletAddress, novelId, chapterId, smpBalance, SMP_READ_COST, navigation]);

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      const isConnected = !!activeWalletAddress;
      if (isConnected !== isWalletConnected) {
        setIsWalletConnected(isConnected);
      }
      if (!novelId || !chapterId) {
        setError('Invalid novel or chapter ID.');
        setLoading(false);
        setPricesLoading(false);
        return;
      }
      if (activeWalletAddress !== prevWalletAddress.current) {
        prevWalletAddress.current = activeWalletAddress;
        await Promise.all([
          fetchPrices(),
          activeWalletAddress ? fetchSmpBalanceOnChain() : Promise.resolve(),
          fetchNovel(),
        ]);
        if (activeWalletAddress) checkAccess();
      }
    };
    initialize();
    return () => {
      hasFetchedPrices.current = false; // Reset on unmount
    };
  }, [novelId, chapterId, activeWalletAddress, fetchPrices, fetchSmpBalanceOnChain, fetchNovel, checkAccess, isWalletConnected]);

  // Navigation buttons
  const chapterKeys = novel ? Object.keys(novel.chaptercontents || {}) : [];
  const currentIndex = chapterKeys.indexOf(chapterId);
  const prevChapter = currentIndex > 0 ? chapterKeys[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapterKeys.length - 1 ? chapterKeys[currentIndex + 1] : null;

  const ListFooter = useCallback(() => (
    <View>
      <View style={styles.navigation}>
        <View style={styles.navRow}>
          {prevChapter && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('Chapter', { novelId, chapterId: prevChapter })}
            >
              <Icon name="chevron-left" size={16} color="#ffffff" />
              <Text style={styles.navButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.navigate('Novel', { novelId })}
          >
            <Icon name="book-open" size={16} color="#ffffff" />
            <Text style={styles.navButtonText}>Back to Novel</Text>
          </TouchableOpacity>
          {nextChapter && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('Chapter', { novelId, chapterId: nextChapter })}
            >
              <Text style={styles.navButtonText}>Next</Text>
              <Icon name="chevron-right" size={16} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <CommentSection novelId={novelId} chapter={parseInt(chapterId) + 1} />
    </View>
  ), [prevChapter, nextChapter, novelId, chapterId, navigation]);

  // Render
  console.log('[Render] SMP_READ_COST:', SMP_READ_COST, 'smpPrice:', smpPrice);

  if (loading || pricesLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (error || !novel || !novel.chaptercontents?.[chapterId]) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Animated.View entering={SlideInDown}>
          <Text style={styles.errorTitle}>{error || 'Chapter Not Found'}</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Icon name="home" size={16} color="#ffffff" />
            <Text style={styles.actionButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const chapterContent = novel.chaptercontents[chapterId];
  const paragraphs = chapterContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.trim());

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      {isWalletConnected && (
        <Animated.View entering={FadeIn} style={styles.balanceContainer}>
          <Text style={styles.balanceText}>SMP: {smpBalance.toLocaleString()}</Text>
        </Animated.View>
      )}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {novel.chaptertitles?.[chapterId] || `Chapter ${parseInt(chapterId) + 1}`}
        </Text>
      </View>
      {warningMessage && (
        <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.warningMessage}>
          <Text style={styles.messageText}>{warningMessage}</Text>
        </Animated.View>
      )}
      {!isWalletConnected ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Text style={styles.lockedMessage}>Connect Wallet</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <Text style={styles.actionButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : isLocked ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Text style={styles.lockedMessage}>Unlock Chapter</Text>
          <TouchableOpacity
            style={styles.smpButton}
            onPress={processChapterPayment}
          >
            <Text style={styles.smpButtonText}>
              Read with {(SMP_READ_COST / 10 ** SMP_DECIMALS).toLocaleString()} SMP
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.getSmpButton}
            onPress={() => {
              try {
                navigation.navigate('TokenSwap', { returnScreen: 'Chapter', returnParams: { novelId, chapterId } });
              } catch (err) {
                setError('TokenSwap screen not available.');
                setTimeout(() => setError(null), 5000);
              }
            }}
          >
            <Text style={styles.getSmpButtonText}>Get SMP</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <FlatList
          data={paragraphs}
          renderItem={({ item }) => <Text style={styles.paragraph}>{item}</Text>}
          keyExtractor={(_, index) => `para-${index}`}
          style={styles.contentContainer}
          ListFooterComponent={ListFooter}
        />
      )}
    </SafeAreaView>
  );
};

export default React.memo(ChapterScreen);