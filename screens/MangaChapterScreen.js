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
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
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
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import * as SecureStore from 'expo-secure-store';
import { styles } from '../styles/MangaChapterStyles';
import {
  RPC_URL,
  SMP_MINT_ADDRESS,
  USDC_MINT_ADDRESS,
  TARGET_WALLET,
  SMP_DECIMALS,
  AMETHYST_MINT_ADDRESS,
} from '../constants';
import bs58 from 'bs58';
import MangaCommentSection from '../components/MangaCommentSection';

const connection = new Connection(RPC_URL, 'confirmed');
const MAX_PASSWORD_ATTEMPTS = 3;
const PASSWORD_ERROR_TIMEOUT = 5000;
const MERCHANT_WALLET = TARGET_WALLET;
const SMP_READ_COST = 1000; // Fixed cost for single chapter
const threeChaptersSmp = 6480139; // Fixed $3 equivalent for 3 chapters
const fullChaptersSmp = 32400693; // Fixed $15 equivalent for all chapters

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

const MangaChapterScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { mangaId, chapterId } = route.params || {};
  const { wallet } = useContext(EmbeddedWalletContext);

  const [manga, setManga] = useState(null);
  const [chapter, setChapter] = useState(null);
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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordCallback, setPasswordCallback] = useState(null);
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [hasReadChapter, setHasReadChapter] = useState(false);
  const [amethystBalance, setAmethystBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [chapterList, setChapterList] = useState([]);
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

  const retrieveSecretKey = async (password) => {
    try {
      if (!activeWalletAddress) throw new Error('No wallet address available');
      const key = `wallet-secret-${activeWalletAddress}-${password}`;
      const secretKeyBase58 = await SecureStore.getItemAsync(key);
      if (!secretKeyBase58) {
        throw new Error('Invalid password or secret key not found.');
      }
      const secretKey = bs58.decode(secretKeyBase58);
      if (secretKey.length !== 64) {
        throw new Error('Invalid secret key format.');
      }
      return secretKey;
    } catch (err) {
      console.error('Error retrieving secret key:', err);
      throw err;
    }
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
        .single();
      if (balanceError) throw new Error(`Failed to fetch SMP balance: ${balanceError.message}`);
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
        .select('id, title, user_id')
        .eq('id', mangaId)
        .single();
      if (mangaError) throw new Error(`Failed to fetch manga: ${mangaError.message}`);

      const { data: chapterData, error: chapterError } = await supabase
        .from('manga_chapters')
        .select('id, chapter_number, title, is_premium, price')
        .eq('manga_id', mangaId)
        .eq('id', chapterId)
        .single();
      if (chapterError) throw new Error(`Failed to fetch chapter: ${chapterError.message}`);

      const { data: pagesData, error: pagesError } = await supabase
        .from('manga_pages')
        .select('page_number, image_url')
        .eq('chapter_id', chapterId)
        .order('page_number', { ascending: true });
      if (pagesError) throw new Error(`Failed to fetch pages: ${pagesError.message}`);

      setManga(mangaData);
      setChapter(chapterData);
      setPages(pagesData || []);
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
      if (!chapterData.is_premium) {
        console.log('checkAccess: Chapter is not premium, unlocking');
        setIsLocked(false);
        return;
      }

      if (userId) {
        const { data: payment, error: paymentError } = await supabase
          .from('user_payments')
          .select('id')
          .eq('user_wallet', activeWalletAddress)
          .eq('manga_id', mangaData.id)
          .eq('chapter_id', chapterData.id)
          .single();
        if (paymentError && paymentError.code !== 'PGRST116') {
          console.error('checkAccess: Payment check error:', paymentError);
          throw new Error(`Payment check failed: ${paymentError.message}`);
        }
        if (payment) {
          console.log('checkAccess: Payment found, unlocking');
          setIsLocked(false);
          return;
        }

        const { data: unlock, error: unlockError } = await supabase
          .from('unlocked_manga_chapters')
          .select('chapter_id, expires_at')
          .eq('user_id', userId)
          .eq('manga_id', mangaData.id)
          .eq('chapter_id', chapterData.id)
          .single();
        if (unlockError && unlockError.code !== 'PGRST116') {
          console.error('checkAccess: Unlock check error:', unlockError);
          throw new Error(`Unlock check failed: ${unlockError.message}`);
        }
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

  const requestPassword = useCallback((callback) => {
    setPassword('');
    setPasswordError(null);
    setPasswordAttempts(0);
    setPasswordCallback(() => callback);
    setShowPasswordModal(true);
  }, []);

  const handlePasswordSubmit = useCallback(() => {
    if (!password) {
      setPasswordError('Please enter your password.');
      return;
    }
    if (passwordAttempts >= MAX_PASSWORD_ATTEMPTS) {
      setPasswordError('Maximum password attempts reached. Please try again later.');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPassword('');
        setPasswordAttempts(0);
        setPasswordCallback(null);
      }, PASSWORD_ERROR_TIMEOUT);
      return;
    }
    passwordCallback?.(password);
  }, [password, passwordCallback, passwordAttempts]);

  const signAndSendTransaction = async (transaction, pwd) => {
    try {
      const secretKey = await retrieveSecretKey(pwd);
      const keypair = Keypair.fromSecretKey(secretKey);
      transaction.sign(keypair);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      setShowPasswordModal(false);
      setPassword('');
      setPasswordError(null);
      setPasswordAttempts(0);
      setPasswordCallback(null);
      return signature;
    } catch (err) {
      setPasswordAttempts((prev) => prev + 1);
      if (passwordAttempts + 1 >= MAX_PASSWORD_ATTEMPTS) {
        setPasswordError('Maximum password attempts reached. Closing modal.');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPassword('');
          setPasswordAttempts(0);
          setPasswordCallback(null);
        }, PASSWORD_ERROR_TIMEOUT);
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
      throw err;
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

      const { data: walletBalance, error: balanceError } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('wallet_address', activeWalletAddress)
        .eq('currency', 'SMP')
        .single();
      if (balanceError || !walletBalance) throw new Error(`Wallet balance not found: ${balanceError?.message}`);
      if (walletBalance.amount < SMP_READ_COST) throw new Error(`Insufficient SMP balance: ${walletBalance.amount.toLocaleString()} SMP`);

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

      let signature;
      await new Promise((resolve, reject) => {
        requestPassword(async (pwd) => {
          try {
            signature = await signAndSendTransaction(transaction, pwd);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });

      await confirmTransactionWithRetry(signature, blockhash, lastValidBlockHeight);

      const newSmpBalance = walletBalance.amount - SMP_READ_COST;
      await supabase
        .from('wallet_balances')
        .update({ amount: newSmpBalance })
        .eq('wallet_address', activeWalletAddress)
        .eq('currency', 'SMP');

      let readerReward = 100;
      const authorReward = 500;
      const numericBalance = Number(amethystBalance) || 0;
      if (numericBalance >= 5000000) readerReward = 250;
      else if (numericBalance >= 1000000) readerReward = 200;
      else if (numericBalance >= 500000) readerReward = 170;
      else if (numericBalance >= 250000) readerReward = 150;
      else if (numericBalance >= 100000) readerReward = 120;

      const newReaderBalance = (userData.weekly_points || 0) + readerReward;
      const newAuthorBalance = mangaOwner.balance + authorReward;

      await Promise.all([
        supabase
          .from('users')
          .update({ weekly_points: newReaderBalance })
          .eq('id', userData.id),
        mangaOwner.id !== userData.id &&
          supabase
            .from('users')
            .update({ balance: newAuthorBalance })
            .eq('id', mangaOwner.id),
        supabase.from('wallet_balances').upsert([
          {
            user_id: mangaOwner.id,
            chain: 'SOL',
            currency: 'SMP',
            amount: newAuthorBalance,
            decimals: 0,
            wallet_address: mangaOwner.wallet_address,
          },
        ]),
        supabase.from('wallet_events').insert([
          {
            destination_user_id: userData.id,
            event_type: 'deposit',
            event_details: eventDetails,
            source_chain: 'SOL',
            source_currency: 'Token',
            amount_change: readerReward,
            wallet_address: activeWalletAddress,
            source_user_id: '6f859ff9-3557-473c-b8ca-f23fd9f7af27',
            destination_chain: 'SOL',
          },
          {
            destination_user_id: mangaOwner.id,
            event_type: 'deposit',
            event_details: eventDetails,
            source_chain: 'SOL',
            source_currency: 'SMP',
            amount_change: authorReward,
            wallet_address: mangaOwner.wallet_address,
            source_user_id: '6f859ff9-3557-473c-b8ca-f23fd9f7af27',
            destination_chain: 'SOL',
          },
          {
            destination_user_id: userData.id,
            event_type: 'withdrawal',
            event_details: eventDetails,
            source_chain: 'SOL',
            source_currency: 'SMP',
            amount_change: -SMP_READ_COST,
            wallet_address: activeWalletAddress,
            source_user_id: userData.id,
            destination_chain: 'SOL',
          },
        ]),
      ]);

      await supabase.from('user_payments').insert({
        user_wallet: activeWalletAddress,
        manga_id: mangaId,
        chapter_id: chapterId,
        transaction_id: signature,
        payment_amount: SMP_READ_COST,
        payment_currency: 'SMP',
        paid_at: new Date().toISOString(),
        payment_type: 'single',
        amount: SMP_READ_COST,
      });

      await supabase.from('unlocked_manga_chapters').insert({
        user_id: userData.id,
        manga_id: mangaId,
        chapter_id: chapterId,
        unlocked_at: new Date().toISOString(),
        expires_at: null,
      });

      setSuccessMessage(`Payment successful! ${SMP_READ_COST.toLocaleString()} SMP sent. You earned ${readerReward} points.`);
      setSmpBalance(newSmpBalance);
      setWeeklyPoints(newReaderBalance);
      setHasReadChapter(true);
      setIsLocked(false);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error in updateTokenBalance:', error);
      setError(
        error.message.includes('Insufficient SMP balance')
          ? 'Not enough SMP tokens to read this chapter.'
          : `SMP update failed: ${error.message}`
      );
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress, manga, chapterId, isPremium, activePublicKey, requestPassword, amethystBalance]);

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
      let signature;

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

        await new Promise((resolve, reject) => {
          requestPassword(async (pwd) => {
            try {
              signature = await signAndSendTransaction(transaction, pwd);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });

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

        await new Promise((resolve, reject) => {
          requestPassword(async (pwd) => {
            try {
              signature = await signAndSendTransaction(transaction, pwd);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });

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
      setShowPasswordModal(false);
      setPassword('');
      setPasswordError(null);
      setPasswordAttempts(0);
      setPasswordCallback(null);
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
        const senderATA = await getAssociatedTokenAddressSync(
          new PublicKey(mint),
          senderPubkey
        );
        const receiverATA = await getAssociatedTokenAddressSync(
          new PublicKey(mint),
          receiverPubkey
        );

        const senderATAIndex = tx.transaction.message.accountKeys.findIndex(
          key => key.toBase58() === senderATA.toBase58()
        );
        const receiverATAIndex = tx.transaction.message.accountKeys.findIndex(
          key => key.toBase58() === receiverATA.toBase58()
        );

        if (senderATAIndex === -1 || receiverATAIndex === -1) {
          console.log('ATA not found:', { senderATAIndex, receiverATAIndex });
          throw new Error(`Invalid ${currency} transaction: ATAs missing.`);
        }

        const preTokenBalances = tx.meta.preTokenBalances?.find(
          b => b.accountIndex === senderATAIndex && b.mint === mint
        );
        const postTokenBalances = tx.meta.postTokenBalances?.find(
          b => b.accountIndex === receiverATAIndex && b.mint === mint
        );

        if (!preTokenBalances || !postTokenBalances) {
          console.log('Token balances not found:', { preTokenBalances, postTokenBalances });
          throw new Error(`Invalid ${currency} transfer: token balances missing.`);
        }

        amountTransferred =
          (Number(preTokenBalances.uiTokenAmount.uiAmount) - (Number(postTokenBalances.uiTokenAmount.uiAmount) || 0)) /
          10 ** decimals;
        if (amountTransferred <= 0) {
          amountTransferred = Number(postTokenBalances.uiTokenAmount.uiAmount) / 10 ** decimals;
        }
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

      const { data: existingPayment, error: paymentError } = await supabase
        .from('user_payments')
        .select('id')
        .eq('user_wallet', activeWalletAddress)
        .eq('manga_id', mangaId)
        .eq('chapter_id', chapterId)
        .single();
      if (paymentError && paymentError.code !== 'PGRST116') {
        console.error('Payment check error:', paymentError);
        throw new Error('Failed to check existing payment.');
      }

      if (existingPayment) {
        console.log('Existing payment found, unlocking.');
        setIsLocked(false);
        setSuccessMessage('Chapter already unlocked.');
        setTimeout(() => setSuccessMessage(''), 5000);
        await checkAccess(userId, manga, chapter);
        return true;
      }

      const paymentData = {
        user_wallet: activeWalletAddress,
        manga_id: mangaId,
        chapter_id: chapterId,
        transaction_id: signature,
        payment_amount: amountTransferred,
        payment_currency: currency,
        payment_type: paymentType || 'single',
        amount: currency === 'SMP' ? expectedAmount : amount / 10 ** decimals,
        paid_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('user_payments').insert(paymentData);
      if (insertError) {
        console.error('Error inserting payment:', insertError);
        throw new Error('Failed to record payment.');
      }

      let unlockData = {
        user_id: userId,
        manga_id: mangaId,
        chapter_id: chapterId,
        unlocked_at: new Date().toISOString(),
        expires_at: null,
      };

      if (currency === 'SMP' && (paymentType === 'threeChapters' || paymentType === 'fullChapters')) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        unlockData.expires_at = expiresAt.toISOString();

        if (paymentType === 'threeChapters') {
          const currentIndex = chapterList.findIndex(ch => ch.id === chapterId);
          const chaptersToUnlock = chapterList.slice(currentIndex, currentIndex + 3);
          unlockData = chaptersToUnlock.map(ch => ({
            user_id: userId,
            manga_id: mangaId,
            chapter_id: ch.id,
            unlocked_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          }));
        } else if (paymentType === 'fullChapters') {
          unlockData = {
            user_id: userId,
            manga_id: mangaId,
            chapter_id: null,
            unlocked_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          };
        }
      }

      const { error: unlockError } = await supabase
        .from('unlocked_manga_chapters')
        .insert(Array.isArray(unlockData) ? unlockData : [unlockData]);
      if (unlockError) {
        console.error('Error inserting unlock record:', unlockError);
        throw new Error('Failed to record unlock.');
      }

      console.log('Unlock successful:', paymentData);
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

  const renderPage = useCallback(
    ({ item }) => (
      <Animated.View entering={FadeIn} style={styles.pageContainer}>
        <Image
          source={{ uri: item.image_url }}
          style={styles.pageImage}
          resizeMode="contain"
        />
      </Animated.View>
    ),
    []
  );

  if (!isWalletConnected) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Icon name="lock" size={48} color="#FF5252" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Connect Wallet to Access</Text>
          <Text style={styles.lockedSubMessage}>
            Please connect your wallet to read manga chapters.
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <Icon name="wallet" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.actionButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Icon name="home" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F36316" />
        <Text style={styles.loadingText}>Loading Chapter...</Text>
      </SafeAreaView>
    );
  }

  if (useInput || error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Text style={styles.errorTitle}>{error || 'Missing Parameters'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Manga ID (UUID)"
            placeholderTextColor="#888"
            value={inputMangaId}
            onChangeText={setInputMangaId}
            accessibilityLabel="Manga ID input"
          />
          <TextInput
            style={styles.input}
            placeholder="Chapter ID (UUID)"
            placeholderTextColor="#888"
            value={inputChapterId}
            onChangeText={setInputChapterId}
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

  if (!manga || !chapter || pages.length === 0) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
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
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
            <Icon name="home" size={16} color="#ffffff" style={styles.buttonIcon} />
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const chapterTitle = chapter.title || `Chapter ${chapter.chapter_number}`;
  const chapterNum = parseInt(chapter.chapter_number, 10);
  const currentIndex = chapterList.findIndex(ch => ch.id === chapter.id);
  const prevChapter = currentIndex > 0 ? chapterList[currentIndex - 1]?.id : null;
  const nextChapterId = currentIndex < chapterList.length - 1 ? chapterList[currentIndex + 1]?.id : null;
  const singleChapterSol = solPrice ? (chapterPrice / solPrice).toFixed(4) : 'N/A';
  const singleChapterUsdc = (chapterPrice / usdcPrice).toFixed(2);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <Animated.View entering={FadeIn} style={styles.balanceContainer}>
        <View style={styles.balanceItem}>
          <Icon name="wallet" size={16} color="#F36316" style={styles.balanceIcon} />
          <Text style={styles.balanceText}>
            SMP: {smpBalance !== null ? smpBalance.toLocaleString() : 'Loading...'}
          </Text>
        </View>
        <View style={styles.balanceItem}>
          <Icon name="star" size={16} color="#F36316" style={styles.balanceIcon} />
          <Text style={styles.balanceText}>
            Points: {weeklyPoints !== null ? weeklyPoints.toLocaleString() : 'Loading...'}
          </Text>
        </View>
        <View style={styles.balanceItem}>
          <Icon name="gem" size={16} color="#F36316" style={styles.balanceIcon} />
          <Text style={styles.balanceText}>
            Amethyst: {amethystBalance.toFixed(2)}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Home')}>
          <Icon name="home" size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {chapterTitle}
        </Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Manga', { mangaId })}
        >
          <Icon name="book" size={20} color="#ffffff" style={styles.buttonIcon} />
        </TouchableOpacity>
      </View>

      {(successMessage || error) && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={[styles.messageContainer, error ? styles.errorMessage : styles.successMessage]}
        >
          <Text style={styles.messageText}>{successMessage || error}</Text>
        </Animated.View>
      )}

      {isLocked ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Icon name="lock" size={48} color="#FF5722" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>This chapter is locked.</Text>
          <Text style={styles.lockedSubMessage}>Unlock with Payment or Subscription</Text>
          <View style={styles.paymentGrid}>
            {[
              { currency: 'SOL', price: singleChapterSol, usd: chapterPrice, paymentType: 'single' },
              { currency: 'USDC', price: singleChapterUsdc, usd: chapterPrice, paymentType: 'single' },
              {
                currency: 'SMP',
                price: SMP_READ_COST.toLocaleString(),
                usd: chapterPrice,
                paymentType: 'single',
                label: 'Single Chapter SMP',
              },
              {
                currency: 'SMP',
                price: threeChaptersSmp.toLocaleString(),
                usd: 3,
                paymentType: 'threeChapters',
                label: '3 Chapters',
              },
              {
                currency: 'SMP',
                price: fullChaptersSmp.toLocaleString(),
                usd: 15,
                paymentType: 'fullChapters',
                label: 'All Chapters',
              },
            ].map((item, index) => (
              <TouchableOpacity
                key={item.currency + item.paymentType}
                style={[
                  styles.paymentButton,
                  item.currency !== 'SMP' && !item.price ? styles.disabledButton : null,
                  item.paymentType === 'threeChapters' ? styles.threeChaptersButton : null,
                  item.paymentType === 'fullChapters' ? styles.fullChaptersButton : null,
                ]}
                onPress={() => initiatePayment(item.currency, item.paymentType)}
                disabled={item.currency !== 'SMP' && !item.price}
              >
                <Icon
                  name={item.paymentType === 'fullChapters' ? 'crown' : 'rocket'}
                  size={20}
                  color="#ffffff"
                  style={styles.buttonIcon}
                />
                <Text style={styles.paymentButtonText}>
                  {item.label || `Unlock Chapter (${item.currency})`}
                </Text>
                <Text style={styles.paymentPrice}>
                  ${item.usd.toFixed(2)} / {item.price} {item.currency}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      ) : (
        <>
          {isPremium && (
            <Animated.View entering={FadeIn} style={styles.readingOptions}>
              <TouchableOpacity
                style={[styles.smpButton, hasReadChapter ? styles.disabledButton : null]}
                onPress={handleReadWithSMP}
                disabled={hasReadChapter}
              >
                <Icon name="gem" size={20} color="#ffffff" style={styles.buttonIcon} />
                <Text style={styles.smpButtonText}>
                  {hasReadChapter
                    ? "You've earned points from this chapter!"
                    : 'Read with 1,000 SMP (Earn points)'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.readingModeText}>
                {isPremium ? 'Reading with SMP (Points Earned)' : 'Read for free (No Points)'}
              </Text>
            </Animated.View>
          )}
          <FlatList
            data={pages}
            renderItem={renderPage}
            keyExtractor={(item) => item.page_number.toString()}
            style={styles.contentContainer}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={3}
            ListFooterComponent={() => (
              <View style={styles.navigation}>
                <View style={styles.navRow}>
                  {prevChapter ? (
                    <TouchableOpacity
                      style={styles.navButton}
                      onPress={() =>
                        navigation.navigate('MangaChapter', { mangaId, chapterId: prevChapter })
                      }
                    >
                      <Icon name="chevron-left" size={16} color="#ffffff" />
                      <Text style={styles.navButtonText}>Previous Chapter</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.navPlaceholder} />
                  )}
                  <TouchableOpacity
                    style={styles.navButton}
                    onPress={() => navigation.navigate('Manga', { mangaId })}
                  >
                    <Icon name="book-open" size={16} color="#ffffff" />
                    <Text style={styles.navButtonText}>Back to Manga</Text>
                  </TouchableOpacity>
                  {nextChapterId && (
                    <TouchableOpacity
                      style={styles.navButton}
                      onPress={() =>
                        navigation.navigate('MangaChapter', { mangaId, chapterId: nextChapterId })
                      }
                    >
                      <Text style={styles.navButtonText}>Next Chapter</Text>
                      <Icon name="chevron-right" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  )}
                </View>
                <MangaCommentSection
                  mangaId={mangaId}
                  chapterId={chapterId}
                  isWalletConnected={isWalletConnected}
                  activePublicKey={activePublicKey}
                />
              </View>
            )}
          />
        </>
      )}

      <Modal
        visible={showTransactionPopup}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          console.log('Transaction modal closing requested');
          setShowTransactionPopup(false);
          setTransactionDetails(null);
          setPaymentMethod(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            style={styles.modalContent}
          >
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                console.log('Close modal button pressed');
                setShowTransactionPopup(false);
                setTransactionDetails(null);
                setPaymentMethod(null);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="times" size={20} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Confirm Transaction</Text>
            <Text style={styles.modalSubtitle}>
              Unlock{' '}
              {transactionDetails?.paymentType === 'threeChapters'
                ? '3 Chapters'
                : transactionDetails?.paymentType === 'fullChapters'
                ? 'All Chapters'
                : `Chapter ${chapterNum}`}
              for:
            </Text>
            <View style={styles.transactionDetails}>
              <Text style={styles.detailText}>
                Amount: {transactionDetails?.displayAmount} {transactionDetails?.currency}
              </Text>
              <Text style={styles.detailText}>
                USD Value: ${transactionDetails?.chapterPrice?.toFixed(2)}
              </Text>
              <Text style={styles.detailText}>
                Wallet: {activeWalletAddress?.slice(0, 6)}...{activeWalletAddress?.slice(-4)}
              </Text>
              <Text style={styles.detailText}>
                To: {MERCHANT_WALLET?.slice(0, 6)}...{MERCHANT_WALLET?.slice(-4)}
              </Text>
            </View>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  console.log('Confirm Payment modal button pressed');
                  confirmPayment();
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalButtonText}>Confirm Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  console.log('Cancel modal button pressed');
                  setShowTransactionPopup(false);
                  setTransactionDetails(null);
                  setPaymentMethod(null);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalNote}>You will need to enter your wallet password.</Text>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          console.log('Password modal close requested');
          setShowPasswordModal(false);
          setPassword('');
          setPasswordError(null);
          setPasswordAttempts(0);
          setPasswordCallback(null);
        }}
      >
        <View style={styles.passwordModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(300)}
              style={styles.passwordModalContent}
            >
              <Text style={styles.passwordModalTitle}>Enter Wallet Password</Text>
              <TextInput
                style={[styles.passwordInput, passwordError ? styles.inputError : null]}
                placeholder="Password"
                placeholderTextColor="#888"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError(null);
                }}
                secureTextEntry={true}
                autoFocus={true}
                accessibilityLabel="Wallet password input"
              />
              {passwordError && (
                <Text style={styles.passwordErrorText}>
                  {passwordError}
                  {passwordAttempts >= MAX_PASSWORD_ATTEMPTS
                    ? ''
                    : ` (${MAX_PASSWORD_ATTEMPTS - passwordAttempts} attempts left)`}
                </Text>
              )}
              <View style={styles.passwordModalButtonRow}>
                <TouchableOpacity
                  style={styles.passwordModalConfirmButton}
                  onPress={() => {
                    console.log('Password modal Confirm pressed');
                    handlePasswordSubmit();
                  }}
                  disabled={passwordAttempts >= MAX_PASSWORD_ATTEMPTS}
                  activeOpacity={0.7}
                >
                  <Text style={styles.passwordModalButtonText}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.passwordModalCancelButton}
                  onPress={() => {
                    console.log('Password modal Cancel pressed');
                    setShowPasswordModal(false);
                    setPassword('');
                    setPasswordError(null);
                    setPasswordAttempts(0);
                    setPasswordCallback(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.passwordModalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default MangaChapterScreen;