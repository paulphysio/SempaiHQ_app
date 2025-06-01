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
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import * as SecureStore from 'expo-secure-store';
import { styles } from '../styles/ChapterScreenStyles';
import { RPC_URL, SMP_MINT_ADDRESS, USDC_MINT_ADDRESS, TARGET_WALLET, SMP_DECIMALS, AMETHYST_MINT_ADDRESS, AMETHYST_DECIMALS } from '../constants';
import bs58 from 'bs58';
import CommentSection from '../components/Comments/CommentSection';

const connection = new Connection(RPC_URL, 'confirmed');
const MIN_ATA_SOL = 0.00203928;
const SMP_READ_COST = 1000;
const MAX_PASSWORD_ATTEMPTS = 3;
const PASSWORD_ERROR_TIMEOUT = 5000;
const MIN_REWARD_WALLET_SOL = 0.05;
const MIN_USER_SOL = 0;

const ChapterScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { novelId, chapterId } = route.params || {};
  const {
    wallet,
    signAndSendTransaction,
    isWalletConnected: contextWalletConnected,
    useBiometrics,
  } = useContext(EmbeddedWalletContext);

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
  const [solPrice, setSolPrice] = useState(100);
  const [smpPrice, setSmpPrice] = useState(0.01);
  const [hasReadChapter, setHasReadChapter] = useState(false);
  const usdcPrice = 1;
  const [isAdvanceChapter, setIsAdvanceChapter] = useState(false);
  const [isUnlockedViaSubscription, setIsUnlockedViaSubscription] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const ITEMS_PER_PAGE = 20;
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [pendingChapterId, setPendingChapterId] = useState(null);

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

  const fetchSmpBalanceOnChain = useCallback(async (retryCount = 3, retryDelay = 1000) => {
    if (!activeWalletAddress || !activePublicKey) return 0;

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const ataAddress = getAssociatedTokenAddressSync(
          new PublicKey(SMP_MINT_ADDRESS),
          activePublicKey
        );
        console.log('Fetching SMP balance for ATA:', ataAddress.toString());

        const ataInfo = await connection.getAccountInfo(ataAddress);
        if (!ataInfo) {
          console.log('No ATA found for SMP, returning 0 balance');
          setSmpBalance(0);
          return 0;
        }

        const account = await getAccount(connection, ataAddress);
        const balance = Number(account.amount) / 10 ** SMP_DECIMALS;
        console.log('On-chain SMP balance:', balance);
        setSmpBalance(balance);
        return balance;
      } catch (error) {
        console.error(`Attempt ${attempt} - Error fetching on-chain SMP balance:`, error);
        if (attempt === retryCount) {
          setError('Unable to fetch SMP balance.');
          setSmpBalance(0);
          setTimeout(() => setError(null), 5000);
          return 0;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
    return 0;
  }, [activeWalletAddress, activePublicKey]);

  const fetchAmethystBalance = useCallback(async () => {
    if (!activeWalletAddress) return 0;
    try {
      const ataAddress = getAssociatedTokenAddressSync(new PublicKey(AMETHYST_MINT_ADDRESS), new PublicKey(activeWalletAddress));
      const ataInfo = await connection.getAccountInfo(ataAddress, 'confirmed');
      const balance = ataInfo ? Number(ataInfo.data.readBigUint64LE(64)) / 10 ** AMETHYST_DECIMALS : 0;
      setAmethystBalance(balance);
      return balance;
    } catch (error) {
      console.error('[fetchAmethystBalance] Error:', error);
      setError('Failed to fetch Amethyst balance.');
      setTimeout(() => setError(null), 5000);
      return 0;
    }
  }, [activeWalletAddress]);

  const fetchPrices = useCallback(async () => {
    try {
      const cacheKey = 'priceCache';
      const cacheExpiry = 5 * 60 * 1000;

      const cachedData = await SecureStore.getItemAsync(cacheKey);
      if (cachedData) {
        const { timestamp, solPrice, smpPrice } = JSON.parse(cachedData);
        if (Date.now() - timestamp < cacheExpiry) {
          setSolPrice(solPrice || 100);
          setSmpPrice(smpPrice || 0.01);
          return;
        }
      }

      let smpSolPrice = 0.0001;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch('https://dlmm-api.meteora.ag/pair/6uTXoUh8yVkgSWwPayqcvFTeWyj38KgxQ7ErUfcCmKVv', {
            headers: { 'Accept': 'application/json' },
            timeout: 5000,
          });

          if (response.ok) {
            const data = await response.json();
            if (data?.current_price) {
              smpSolPrice = data.current_price;
              console.log('[fetchPrices] SMP-SOL price from Meteora:', smpSolPrice);
              break;
            }
          }
          console.warn(`[fetchPrices] Meteora API attempt ${attempt + 1} failed:`, response.status);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        } catch (error) {
          console.warn(`[fetchPrices] Meteora API attempt ${attempt + 1} error:`, error.message);
          if (attempt === 2) console.warn('[fetchPrices] Using default SMP-SOL price.');
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      let solPrice = 100;
      try {
        const response = await fetch('https://dlmm-api.meteora.ag/pair/6uTXoUh8yVkgSWwPayqcvFTeWyj38KgxQ7ErUfcCmKVv', {
          headers: { 'Accept': 'application/json' },
          timeout: 5000,
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.current_price) {
            solPrice = data.current_price;
            console.log('[fetchPrices] SOL-USDC price:', solPrice);
          }
        }
      } catch (error) {
        console.warn('[fetchPrices] Failed to fetch SOL price:', error.message);
      }

      const smpPrice = smpSolPrice * solPrice;
      console.log('[fetchPrices] Calculated SMP-USD price:', smpPrice);

      setSolPrice(solPrice);
      setSmpPrice(smpPrice || 0.01);

      await SecureStore.setItemAsync(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        solPrice,
        smpPrice,
      }));
    } catch (error) {
      console.error('[fetchPrices] Error:', error);
      setSolPrice(100);
      setSmpPrice(0.01);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!activeWalletAddress) return;
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, weekly_points')
        .eq('wallet_address', activeWalletAddress)
        .single();
      if (userError) throw new Error(userError.message);

      setUserId(userData.id);
      setWeeklyPoints(userData.weekly_points || 0);
      await fetchSmpBalanceOnChain();
    } catch (error) {
      console.error('[fetchUserData] Error:', error);
      setError('Failed to load user data.');
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress, fetchSmpBalanceOnChain]);

  const fetchNovel = useCallback(async (id, chapter) => {
    try {
      const { data, error } = await supabase
        .from('novels')
        .select('id, title, chaptertitles, chaptercontents, advance_chapters, user_id')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      if (!data || !data.chaptercontents?.[chapter]) throw new Error('Chapter not found');
      setNovel(data);
      setAdvanceInfo(data.advance_chapters?.find((c) => c.index === parseInt(chapter)) || {
        is_advance: false,
        free_release_date: null,
      });
    } catch (error) {
      console.error('[fetchNovel] Error:', error);
      setError('Unable to load chapter.');
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
      const hasRead = data?.length > 0;
      if (targetChapterId === chapterId) setHasReadChapter(hasRead);
      return hasRead;
    } catch (error) {
      console.error('[checkHasReadChapter] Error:', error);
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

      if (error && error.code !== 'PGRST116') {
        console.error('[checkChapterPayment] Error:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('[checkChapterPayment] Error:', err);
      return false;
    }
  }, [activeWalletAddress, novelId]);

  const checkAccess = useCallback(async (walletAddress, novelData, chapterNum) => {
    if (!novelData || chapterNum === undefined) return;
    try {
      const advanceInfo = novelData.advance_chapters?.find((c) => c.index === chapterNum) || {
        is_advance: false,
        free_release_date: null,
      };

      setIsAdvanceChapter(advanceInfo.is_advance);
      setIsUnlockedViaSubscription(false);

      const { data: payment, error: paymentError } = await supabase
        .from('chapter_payments')
        .select('id')
        .eq('wallet_address', walletAddress)
        .eq('novel_id', novelData.id)
        .eq('chapter_number', chapterNum)
        .single();

      if (paymentError && paymentError.code !== 'PGRST116') {
        throw paymentError;
      }

      if (payment) {
        setIsLocked(false);
        setCanUnlockNextThree(true);
        return;
      }

      if (advanceInfo.is_advance) {
        const { data: unlock, error: unlockError } = await supabase
          .from('unlocked_story_chapters')
          .select('chapter_unlocked_till, expires_at')
          .eq('user_id', userId)
          .eq('story_id', novelData.id)
          .single();

        if (unlockError && unlockError.code !== 'PGRST116') {
          throw unlockError;
        }

        if (unlock && (!unlock.expires_at || new Date(unlock.expires_at) > new Date())) {
          const totalChapters = Object.keys(novelData.chaptercontents || {}).length;
          if (unlock.chapter_unlocked_till === -1 || (unlock.chapter_unlocked_till >= chapterNum && chapterNum <= totalChapters)) {
            setIsLocked(false);
            setCanUnlockNextThree(true);
            setIsUnlockedViaSubscription(true);
            return;
          }
        }

        setIsLocked(true);
        setCanUnlockNextThree(true);
      } else {
        setIsLocked(true);
        setCanUnlockNextThree(true);
      }
    } catch (error) {
      console.error('[checkAccess] Error:', error);
      setError('Failed to verify chapter access.');
      setTimeout(() => setError(null), 5000);
    }
  }, []);

  const shouldShowContent = useCallback(() => {
    if (!isWalletConnected) return false;
    if (isUnlockedViaSubscription) return true;
    if (parseInt(chapterId, 10) === 0) return true; // First chapter is always free
    return !isLocked || checkChapterPayment(parseInt(chapterId, 10));
  }, [isWalletConnected, isUnlockedViaSubscription, isLocked, chapterId, checkChapterPayment]);

  const handlePasswordSubmit = async () => {
    if (!password || !pendingTransaction || !pendingChapterId) {
      setPasswordError('Please enter your password');
      return;
    }

    try {
      const signature = await signAndSendTransaction(pendingTransaction, password);
      if (!signature) {
        throw new Error('Failed to get transaction signature');
      }

      console.log('[handlePasswordSubmit] Transaction sent with signature:', signature);
      
      // Wait for transaction confirmation with retries
      let confirmed = false;
      for (let i = 0; i < 3; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const confirmation = await connection.confirmTransaction(signature, 'confirmed');
          if (!confirmation?.value?.err) {
            confirmed = true;
            break;
          }
          console.log(`[handlePasswordSubmit] Confirmation attempt ${i + 1} failed, retrying...`);
        } catch (err) {
          console.log(`[handlePasswordSubmit] Confirmation attempt ${i + 1} error:`, err);
          if (i === 2) throw err;
        }
      }

      if (!confirmed) {
        throw new Error('Transaction failed to confirm after multiple attempts');
      }

      console.log('[handlePasswordSubmit] Transaction confirmed successfully');

      const { error: paymentError } = await supabase
        .from('chapter_payments')
        .insert({
          wallet_address: activeWalletAddress,
          novel_id: novelId,
          chapter_number: parseInt(pendingChapterId, 10),
          amount: SMP_READ_COST,
        });

      if (paymentError) throw paymentError;

      setShowPasswordModal(false);
      setPassword('');
      setPasswordError(null);
      setPasswordAttempts(0);
      setPendingTransaction(null);
      setPendingChapterId(null);

      setSuccessMessage(`Payment successful! ${SMP_READ_COST.toLocaleString()} SMP sent for Chapter ${parseInt(pendingChapterId, 10) + 1}.`);
      setSmpBalance(prev => prev - SMP_READ_COST);
      setIsLocked(false);
      setCanUnlockNextThree(true);
      setTimeout(() => setSuccessMessage(''), 5000);

      // Navigate to the next chapter after successful payment
      navigation.navigate('Chapter', { novelId, chapterId: pendingChapterId });
    } catch (err) {
      console.error('[handlePasswordSubmit] Error:', err);
      
      if (err.message.includes('Transaction failed') || err.message.includes('failed to confirm')) {
        setPasswordError('Transaction failed. Please try again.');
      } else if (err.code === '23505') {
        // Handle duplicate payment gracefully
        setShowPasswordModal(false);
        setPassword('');
        setPasswordError(null);
        setPasswordAttempts(0);
        setPendingTransaction(null);
        setPendingChapterId(null);
        // Navigate anyway since payment exists
        navigation.navigate('Chapter', { novelId, chapterId: pendingChapterId });
      } else {
        setPasswordAttempts(prev => prev + 1);
        if (passwordAttempts + 1 >= MAX_PASSWORD_ATTEMPTS) {
          setPasswordError('Maximum password attempts reached. Please try again later.');
          setTimeout(() => {
            setShowPasswordModal(false);
            setPassword('');
            setPasswordAttempts(0);
            setPendingTransaction(null);
            setPendingChapterId(null);
          }, PASSWORD_ERROR_TIMEOUT);
        } else {
          setPasswordError(`Invalid password. ${MAX_PASSWORD_ATTEMPTS - passwordAttempts - 1} attempts remaining.`);
        }
      }
    }
  };

  const processChapterPayment = useCallback(async (targetChapterId) => {
    if (!activeWalletAddress || !novel || !targetChapterId || !activePublicKey) {
      setError('Please ensure your wallet is connected and try again.');
      return false;
    }
  
    setError(null);
    setSuccessMessage('');
    setWarningMessage('');
    setIsProcessing(true);
  
    try {
      const isPaid = await checkChapterPayment(parseInt(targetChapterId, 10));
      if (isPaid) {
        console.log('[processChapterPayment] Chapter already paid for');
        return true;
      }
  
      if (!TARGET_WALLET) {
        throw new Error('Configuration error: Missing reward wallet address');
      }
  
      const targetPublicKey = new PublicKey(TARGET_WALLET);
      console.log('[processChapterPayment] Checking balances...');
  
      const [merchantSolBalance, userSolBalance, smpBalance] = await Promise.all([
        connection.getBalance(targetPublicKey),
        connection.getBalance(activePublicKey),
        fetchSmpBalanceOnChain(),
      ]);
  
      console.log('[processChapterPayment] Balances:', {
        merchantSol: merchantSolBalance / LAMPORTS_PER_SOL,
        userSol: userSolBalance / LAMPORTS_PER_SOL,
        userSMP: smpBalance,
      });
  
      if (merchantSolBalance < MIN_REWARD_WALLET_SOL * LAMPORTS_PER_SOL) {
        throw new Error(
          'The service is temporarily unavailable. Please contact support. (Insufficient merchant balance)'
        );
      }
  
      if (userSolBalance < MIN_ATA_SOL * LAMPORTS_PER_SOL) {
        throw new Error(
          `You need at least ${MIN_ATA_SOL} SOL in your wallet for token account creation.`
        );
      }
  
      if (smpBalance < SMP_READ_COST) {
        throw new Error(
          `Insufficient SMP tokens for reading.\n\n` +
          `Required: ${SMP_READ_COST} SMP\n` +
          `Current: ${smpBalance} SMP\n\n` +
          `To get SMP tokens:\n` +
          `1. Visit the SMP token page\n` +
          `2. Use USDC (${(userSolBalance / LAMPORTS_PER_SOL).toFixed(4)} available) or SOL (${(userSolBalance / LAMPORTS_PER_SOL).toFixed(4)} available) to purchase SMP\n` +
          `3. Return here to unlock the chapter`
        );
      }
  
      console.log('[processChapterPayment] Creating/getting ATAs...');
      const [sourceATA, destATA] = await Promise.all([
        getOrCreateAssociatedTokenAccount(
          connection,
          targetPublicKey,
          new PublicKey(SMP_MINT_ADDRESS),
          activePublicKey
        ),
        getOrCreateAssociatedTokenAccount(
          connection,
          targetPublicKey,
          new PublicKey(SMP_MINT_ADDRESS),
          targetPublicKey
        ),
      ]);
  
      console.log('[processChapterPayment] ATAs created/found:', {
        sourceATA: sourceATA.address.toString(),
        destATA: destATA.address.toString(),
      });
  
      const sourceATAInfo = await getAccount(connection, sourceATA.address);
      const sourceATABalance = Number(sourceATAInfo.amount) / 10 ** SMP_DECIMALS;
  
      if (sourceATABalance < SMP_READ_COST) {
        throw new Error(
          `Insufficient SMP tokens in your wallet. ` +
          `Required: ${SMP_READ_COST} SMP, Current: ${sourceATABalance} SMP`
        );
      }
  
      console.log('[processChapterPayment] Getting latest blockhash...');
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
  
      const transferAmount = BigInt(SMP_READ_COST * (10 ** SMP_DECIMALS));
  
      const transferInstruction = createTransferInstruction(
        sourceATA.address,
        destATA.address,
        activePublicKey,
        transferAmount
      );
  
      const transaction = new Transaction();
      transaction.add(transferInstruction);
      transaction.feePayer = activePublicKey;
      transaction.recentBlockhash = blockhash;
  
      console.log('[processChapterPayment] Prompting for transaction password...');
      let signature;
      if (useBiometrics) {
        try {
          signature = await signAndSendTransaction(transaction);
        } catch (err) {
          throw new Error('Biometric authentication failed: ' + err.message);
        }
      } else {
        setPendingTransaction(transaction);
        setPendingChapterId(targetChapterId);
        setShowPasswordModal(true);
        return false;
      }
  
      if (!signature) {
        throw new Error('Failed to get transaction signature');
      }
  
      console.log('[processChapterPayment] Waiting for confirmation...');
      const confirmation = await connection.confirmTransaction(signature);
      if (confirmation.value.err) {
        throw new Error('Transaction failed on chain');
      }
  
      const { error: paymentError } = await supabase
        .from('chapter_payments')
        .insert({
          wallet_address: activeWalletAddress,
          novel_id: novelId,
          chapter_number: parseInt(targetChapterId, 10),
          amount: SMP_READ_COST,
        });
  
      if (paymentError) throw paymentError;
  
      setSuccessMessage(`Payment successful! ${SMP_READ_COST.toLocaleString()} SMP sent for Chapter ${parseInt(targetChapterId, 10) + 1}.`);
      setSmpBalance(prev => prev - SMP_READ_COST);
      setIsLocked(false);
      setCanUnlockNextThree(true);
      setTimeout(() => setSuccessMessage(''), 5000);
      return true;
    } catch (err) {
      console.error('[processChapterPayment] Error:', err);
      const errorMessage = err.message.includes('Insufficient') ? err.message :
                          err.message.includes('service is temporarily unavailable') ? err.message :
                          err.message.includes('Invalid transaction password') ? 'Invalid password. Please try again.' :
                          err.message.includes('Biometric') ? err.message :
                          'Transaction failed. Please try again later.';
  
      setError(errorMessage);
  
      if (err.message.includes('Insufficient SMP tokens')) {
        setWarningMessage('Need SMP tokens to continue reading');
        setTimeout(() => {
          navigation.navigate('TokenSwap', {
            returnScreen: 'Chapter',
            returnParams: { novelId, chapterId },
          });
        }, 2000);
      }
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [activeWalletAddress, novel, novelId, activePublicKey, checkChapterPayment, signAndSendTransaction, navigation, chapterId, useBiometrics]);

  const handleNextChapter = async (nextChapterId) => {
    if (!nextChapterId) return;

    try {
      setIsProcessing(true);
      const isPaid = await checkChapterPayment(parseInt(nextChapterId, 10));
      
      if (isPaid) {
        navigation.navigate('Chapter', { novelId, chapterId: nextChapterId });
        return;
      }

      const paymentSuccess = await processChapterPayment(nextChapterId);
      if (paymentSuccess) {
        setIsProcessing(false);
        navigation.navigate('Chapter', { novelId, chapterId: nextChapterId });
      }
    } catch (err) {
      console.error('[handleNextChapter] Error:', err);
      setError('Failed to process payment for next chapter.');
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (chapterId && userId) {
      checkChapterPayment(parseInt(chapterId, 10)).then(isPaid => {
        setIsLocked(!isPaid);
      });
    }
  }, [chapterId, userId, checkChapterPayment]);

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
    if (novel && chapterId && isWalletConnected) {
      checkAccess(activeWalletAddress, novel, parseInt(chapterId, 10));
      checkHasReadChapter(chapterId);
    }
  }, [novel, activeWalletAddress, chapterId, checkAccess, checkHasReadChapter, isWalletConnected]);

  useEffect(() => {
    if (!loading && novel && !isLocked && readingMode === 'paid' && isWalletConnected) {
      processChapterPayment(chapterId);
    }
  }, [loading, novel, isLocked, readingMode, processChapterPayment, isWalletConnected, chapterId]);

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
      .filter(line => line.trim() !== '')
      .map(line => line.trim());
  }, [chapterContent]);

  const renderParagraph = useCallback(({ item, index }) => (
    <Text style={styles.paragraph}>{item}</Text>
  ), []);

  useEffect(() => {
    if (!isWalletConnected) return;

    fetchSmpBalanceOnChain();

    const intervalId = setInterval(() => {
      fetchSmpBalanceOnChain();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [isWalletConnected, fetchSmpBalanceOnChain]);

  const ListFooter = useCallback(() => (
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
  ), [prevChapter, nextChapter, novelId, chapterId, handleNextChapter, navigation]);

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

  const chapterTitle = novel.chaptertitles?.[chapterId] || `Chapter ${chapterId}`;
  const chapterKeys = Object.keys(novel.chaptercontents || {});
  const currentIndex = chapterKeys.indexOf(chapterId);
  const prevChapter = currentIndex > 0 ? chapterKeys[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapterKeys.length - 1 ? chapterKeys[currentIndex + 1] : null;
  const releaseDateMessage = advanceInfo?.is_advance && advanceInfo?.free_release_date
    ? `Locked until ${new Date(advanceInfo.free_release_date).toLocaleString()}`
    : 'This chapter is locked.';
  const threeChaptersSol = solPrice ? (3 / solPrice).toFixed(4) : 'N/A';
  const fullChaptersSol = solPrice ? (15 / solPrice).toFixed(4) : 'N/A';
  const threeChaptersUsdc = (3 / usdcPrice).toFixed(2);
  const fullChaptersUsdc = (15 / usdcPrice).toFixed(2);
  const threeChaptersSmp = smpPrice ? (3 / smpPrice).toFixed(2) : 'N/A';
  const fullChaptersSmp = smpPrice ? (15 / smpPrice).toFixed(2) : 'N/A';

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
          <Text style={styles.lockedSubMessage}>
            Please connect your wallet to read chapters.
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <Icon name="wallet" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.actionButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : isLocked && isAdvanceChapter ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
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
                onPress={() => processChapterPayment(chapterId)}
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
      ) : isLocked && parseInt(chapterId, 10) > 0 ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Icon name="wallet" size={48} color="#E67E22" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Connect Wallet to Continue Reading</Text>
          <Text style={styles.lockedSubMessage}>
            Please connect your wallet to read chapters.
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <Icon name="wallet" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.actionButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : !shouldShowContent() ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Icon name="gem" size={48} color="#E67E22" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Read this Chapter</Text>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.smpButton}
              onPress={() => processChapterPayment(chapterId)}
              disabled={isProcessing}
            >
              <Icon name="gem" size={16} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.smpButtonText}>
                Read with {SMP_READ_COST.toLocaleString()} SMP (Earn Points)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.getSmpButton}
              onPress={() => navigation.navigate('TokenSwap', {
                returnScreen: 'Chapter',
                returnParams: { novelId, chapterId },
              })}
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
          keyExtractor={(item, index) => `para-${index}`}
          style={styles.contentContainer}
          initialNumToRender={50}
          maxToRenderPerBatch={50}
          windowSize={5}
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          ListHeaderComponent={
            hasReadChapter ? (
              <View style={styles.readingOptions}>
                <Text style={styles.readingModeText}>
                  You've earned points from this chapter
                </Text>
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
              <Text style={styles.detailText}>
                USD Value: ${transactionDetails?.subscriptionType === '3CHAPTERS' ? '3' : '15'}
              </Text>
              <Text style={styles.detailText}>
                Wallet: {activeWalletAddress?.slice(0, 6)}...{activeWalletAddress?.slice(-4)}
              </Text>
              <Text style={styles.detailText}>
                To: {TARGET_WALLET.slice(0, 6)}...{TARGET_WALLET.slice(-4)}
              </Text>
            </View>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  setShowTransactionPopup(false);
                  processChapterPayment(chapterId);
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
            <Text style={styles.modalNote}>You will be prompted for your wallet password.</Text>
          </Animated.View>
        </View>
      </Modal>
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setPassword('');
          setPasswordError(null);
          setPasswordAttempts(0);
          setPendingTransaction(null);
        }}
      >
        <View style={styles.passwordModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.passwordModalContent}>
              <View style={styles.passwordModalHeader}>
                <Text style={styles.passwordModalTitle}>Enter Wallet Password</Text>
                <TouchableOpacity
                  style={styles.passwordModalCloseButton}
                  onPress={() => {
                    setShowPasswordModal(false);
                    setPassword('');
                    setPasswordError(null);
                    setPasswordAttempts(0);
                    setPendingTransaction(null);
                  }}
                >
                  <Icon name="times" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <View style={[
                styles.passwordInputContainer,
                passwordError ? styles.inputError : null,
                password ? styles.inputActive : null,
              ]}>
                <Icon name="lock" size={20} color="#E67E22" style={styles.passwordIcon} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your wallet password"
                  placeholderTextColor="#666"
                  secureTextEntry
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setPasswordError(null);
                  }}
                  autoFocus
                />
              </View>

              {passwordError && (
                <View style={styles.passwordErrorContainer}>
                  <Icon name="exclamation-circle" size={16} color="#FF5252" style={styles.errorIcon} />
                  <Text style={styles.passwordErrorText}>{passwordError}</Text>
                </View>
              )}

              <View style={styles.passwordModalButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.passwordModalConfirmButton,
                    !password ? styles.disabledButton : null,
                  ]}
                  onPress={handlePasswordSubmit}
                  disabled={!password}
                >
                  <Text style={styles.passwordModalButtonText}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.passwordModalCancelButton}
                  onPress={() => {
                    setShowPasswordModal(false);
                    setPassword('');
                    setPasswordError(null);
                    setPasswordAttempts(0);
                    setPendingTransaction(null);
                  }}
                >
                  <Text style={styles.passwordModalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {passwordAttempts >= MAX_PASSWORD_ATTEMPTS - 1 && (
                <View style={styles.lockoutMessage}>
                  <Icon name="clock" size={16} color="#FF5252" style={styles.lockoutIcon} />
                  <Text style={styles.lockoutText}>
                    Warning: One more failed attempt will lock the modal for {PASSWORD_ERROR_TIMEOUT / 1000} seconds
                  </Text>
                </View>
              )}

              <Text style={styles.passwordModalNote}>
                Enter your wallet password to sign this transaction
              </Text>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ChapterScreen;