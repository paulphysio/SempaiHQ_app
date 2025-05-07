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
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  getAssociatedTokenAddressSync,
  unpackAccount,
} from '@solana/spl-token';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
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

const MangaChapterScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { mangaId, chapterId } = route.params || {};
  const { wallet } = useContext(EmbeddedWalletContext);

  const [manga, setManga] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [pages, setPages] = useState([]);
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
  const [smpPrice, setSmpPrice] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordCallback, setPasswordCallback] = useState(null);
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [hasReadChapter, setHasReadChapter] = useState(false);
  const [amethystBalance, setAmethystBalance] = useState(0);
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
        const [solResponse, smpResponse] = await Promise.all([
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'),
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=smp-token-id&vs_currencies=usd'),
        ]);
        const [solData, smpData] = await Promise.all([solResponse.json(), smpResponse.json()]);
        setSolPrice(solData.solana?.usd || 100);
        setSmpPrice(smpData['smp-token-id']?.usd || null);
        return;
      } catch (error) {
        console.error(`Attempt ${attempt} - Error fetching prices:`, error);
        if (attempt === retryCount) {
          setError('Failed to fetch price data. Using default values.');
          setSolPrice(100);
          setSmpPrice(null);
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
      if (userError) throw new Error(`Failed to fetch user data: ${userError.message}`);
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
      setError('Unable to load wallet balances.');
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
        .select('id, chapter_number, title, is_premium')
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
    } catch (error) {
      console.error('Error fetching manga:', error);
      setError(`Unable to load manga: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (!mangaData || !chapterData) return;
    try {
      // Non-connected users: Allow up to 2 free chapters
      if (!isWalletConnected) {
        if (chapterData.chapter_number <= 2) {
          setIsLocked(false);
        } else {
          setIsLocked(true);
        }
        return;
      }

      // Connected users: Non-premium chapters are free
      if (!chapterData.is_premium) {
        setIsLocked(false);
        return;
      }

      // Connected users: Check if chapter is unlocked
      if (userId) {
        const { data: unlock, error: unlockError } = await supabase
          .from('unlocked_manga_chapters')
          .select('chapter_id, expires_at')
          .eq('user_id', userId)
          .eq('manga_id', mangaData.id)
          .eq('chapter_id', chapterData.id)
          .single();
        if (unlockError && unlockError.code !== 'PGRST116') throw new Error(`Unlock check failed: ${unlockError.message}`);
        if (unlock && (!unlock.expires_at || new Date(unlock.expires_at) > new Date())) {
          setIsLocked(false);
          return;
        }
      }

      setIsLocked(true);
    } catch (error) {
      console.error('Error checking access:', error);
      setError('Failed to verify chapter access.');
      setIsLocked(true);
      setTimeout(() => setError(null), 5000);
    }
  }, [isWalletConnected]);

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

      new PublicKey(SMP_MINT_ADDRESS);

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
      if (walletBalance.amount < 1000) throw new Error(`Insufficient SMP balance: ${walletBalance.amount.toLocaleString()} SMP`);

      const sourceATA = await getOrCreateAssociatedTokenAccount(
        connection,
        activePublicKey,
        new PublicKey(SMP_MINT_ADDRESS),
        activePublicKey
      );
      const smpBalanceOnChain = Number((await getAccount(connection, sourceATA.address)).amount) / 10 ** SMP_DECIMALS;
      if (smpBalanceOnChain < 1000) throw new Error(`Insufficient SMP balance on-chain: ${smpBalanceOnChain.toLocaleString()} SMP`);

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

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const destATA = await getOrCreateAssociatedTokenAccount(
        connection,
        activePublicKey,
        new PublicKey(SMP_MINT_ADDRESS),
        targetPublicKey
      );
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: activePublicKey,
      }).add(
        createTransferInstruction(
          sourceATA.address,
          destATA.address,
          activePublicKey,
          1000 * 10 ** SMP_DECIMALS,
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

      const newSmpBalance = walletBalance.amount - 1000;
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
            amount_change: -1000,
            wallet_address: activeWalletAddress,
            source_user_id: userData.id,
            destination_chain: 'SOL',
          },
        ]),
      ]);

      setSuccessMessage(`Payment successful! 1,000 SMP sent. You earned ${readerReward} points.`);
      setSmpBalance(newSmpBalance);
      setWeeklyPoints(newReaderBalance);
      setHasReadChapter(true);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error in updateTokenBalance:', error);
      setError(
        error.message.includes('Insufficient SMP balance')
          ? 'Not enough SMP tokens to read this chapter.'
          : `Payment failed: ${error.message}`
      );
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress, manga, chapterId, isPremium, activePublicKey, requestPassword, amethystBalance]);

  const initiatePayment = async (currency) => {
    if (!activeWalletAddress || !activePublicKey) {
      setError('Please connect your wallet to proceed.');
      return;
    }
    try {
      await fetchPrices();
      const usdAmount = 2.5; // Default payment amount for a single chapter
      let amount, decimals, mint, displayAmount;

      if (currency === 'SOL') {
        if (!solPrice) throw new Error('SOL price not available');
        amount = Math.round((usdAmount / solPrice) * 1_000_000_000);
        decimals = 9;
        displayAmount = (amount / 1_000_000_000).toFixed(4);
      } else {
        const price = currency === 'USDC' ? usdcPrice : smpPrice;
        if (!price) throw new Error(`${currency} price not available`);
        mint = currency === 'USDC' ? USDC_MINT_ADDRESS : SMP_MINT_ADDRESS;
        decimals = currency === 'USDC' ? 6 : SMP_DECIMALS;
        amount = Math.round((usdAmount / price) * 10 ** decimals);
        displayAmount = (amount / 10 ** decimals).toFixed(2);
      }

      setTransactionDetails({ currency, amount, displayAmount, decimals, mint });
      setShowTransactionPopup(true);
    } catch (error) {
      console.error('Error initiating payment:', error);
      setError(`Failed to initiate payment: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const confirmPayment = async () => {
    if (!transactionDetails) return;
    const { currency, amount, decimals, mint } = transactionDetails;
    try {
      let targetPublicKey;
      try {
        targetPublicKey = new PublicKey(TARGET_WALLET);
      } catch (err) {
        throw new Error(`Invalid TARGET_WALLET: ${err.message}`);
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
        await processUnlock(signature, amount / 1_000_000_000, currency);
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
        await processUnlock(signature, amount / 10 ** decimals, currency);
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
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
    }
  };

  const processUnlock = async (signature, amount, currency) => {
    try {
      const response = await fetch('https://sempaihq.xyz/api/unlock-manga-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          manga_id: mangaId,
          chapter_id: chapterId,
          signature,
          userPublicKey: activeWalletAddress,
          amount,
          currency,
          solPrice,
          smpPrice,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        setIsLocked(false);
        setSuccessMessage('Chapter unlocked successfully!');
        setTimeout(() => setSuccessMessage(''), 5000);
        await checkAccess(userId, manga, chapter);
      } else {
        throw new Error(result.error || 'Failed to unlock chapter.');
      }
    } catch (error) {
      console.error('Error processing unlock:', error);
      setError(`Failed to unlock chapter: ${error.message}`);
      setTimeout(() => setError(null), 5000);
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
    if (hasReadChapter) {
      return;
    }
    await updateTokenBalance();
  };

  useEffect(() => {
    if (!mangaId || !chapterId) {
      setError('Invalid manga or chapter ID. Please enter values below.');
      setUseInput(true);
      setLoading(false);
      return;
    }

    const initialize = async () => {
      const chapterNum = parseInt(chapter?.chapter_number, 10);
      if (!isWalletConnected && chapterNum > 2) {
        setError('Connect your wallet to read Chapter 3 and beyond.');
        setLoading(false);
        return;
      }

      await Promise.all([
        fetchPrices(),
        isWalletConnected ? fetchUserBalances() : Promise.resolve(),
        fetchManga(mangaId, chapterId),
      ]);
    };
    initialize();
  }, [mangaId, chapterId, fetchManga, fetchUserBalances, fetchPrices, isWalletConnected]);

  useEffect(() => {
    if (manga && chapter) {
      checkAccess(userId, manga, chapter);
      if (isWalletConnected) {
        checkHasReadChapter();
      }
    }
  }, [manga, chapter, userId, checkAccess, checkHasReadChapter, isWalletConnected]);

  useEffect(() => {
    if (!loading && manga && !isLocked && isPremium && isWalletConnected) {
      updateTokenBalance();
    }
  }, [loading, manga, isLocked, isPremium, updateTokenBalance, isWalletConnected]);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F36316" />
        <Text style={styles.loadingText}>Loading Chapter...</Text>
      </SafeAreaView>
    );
  }

  if (useInput || (error && (!isWalletConnected && chapter?.chapter_number <= 2))) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Animated.View entering={SlideInDown} exiting={SlideOutDown}>
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

  const chapterTitle = chapter.title || `Chapter ${chapter.chapter_number}`;
  const chapterNum = parseInt(chapter.chapter_number, 10);

  const { data: chaptersData } = supabase
    .from('manga_chapters')
    .select('id, chapter_number')
    .eq('manga_id', mangaId)
    .order('chapter_number', { ascending: true });
  const chapterList = chaptersData || [];
  const currentIndex = chapterList.findIndex((ch) => ch.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapterList[currentIndex - 1]?.id : null;
  const nextChapter = currentIndex < chapterList.length - 1 ? chapterList[currentIndex + 1]?.id : null;

  const singleChapterSol = solPrice ? (2.5 / solPrice).toFixed(4) : 'N/A';
  const singleChapterUsdc = (2.5 / usdcPrice).toFixed(2);
  const singleChapterSmp = smpPrice ? (2.5 / smpPrice).toFixed(2) : 'N/A';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      {isWalletConnected && (
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
      )}

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
          <Icon name="book" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {(successMessage || (error && isWalletConnected)) && (
        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={[styles.messageContainer, error ? styles.errorMessage : styles.successMessage]}
        >
          <Text style={styles.messageText}>{successMessage || error}</Text>
        </Animated.View>
      )}

      {isLocked && !isWalletConnected ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Icon name="lock" size={48} color="#FF5252" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Connect Wallet to Continue Reading</Text>
          <Text style={styles.lockedSubMessage}>
            Please connect your wallet to unlock Chapter {chapterNum} and beyond.
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <Icon name="wallet" size={16} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.actionButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : isLocked && isWalletConnected ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Icon name="lock" size={48} color="#FF5252" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>This chapter is locked.</Text>
          <Text style={styles.lockedSubMessage}>Unlock with a Payment</Text>
          <View style={styles.paymentGrid}>
            {[
              { currency: 'SOL', price: singleChapterSol, usd: 2.5 },
              { currency: 'USDC', price: singleChapterUsdc, usd: 2.5 },
              { currency: 'SMP', price: singleChapterSmp, usd: 2.5 },
            ].map(({ currency, price, usd }, index) => (
              <TouchableOpacity
                key={currency}
                style={[
                  styles.paymentButton,
                  (currency !== 'USDC' && !price) ? styles.disabledButton : null,
                ]}
                onPress={() => initiatePayment(currency)}
                disabled={currency !== 'USDC' && !price}
              >
                <Icon
                  name="rocket"
                  size={20}
                  color="#ffffff"
                  style={styles.buttonIcon}
                />
                <Text style={styles.paymentButtonText}>
                  Unlock Chapter ({currency})
                </Text>
                <Text style={styles.paymentPrice}>
                  ${usd} / {price} {currency}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      ) : (
        <FlatList
          data={pages}
          renderItem={renderPage}
          keyExtractor={(item) => `page-${item.page_number}`}
          style={styles.contentContainer}
          ListHeaderComponent={
            <>
              {isWalletConnected && isPremium && (
                <Animated.View entering={FadeIn} style={styles.readingOptions}>
                  <TouchableOpacity
                    style={[styles.smpButton, hasReadChapter ? styles.disabledButton : null]}
                    onPress={handleReadWithSMP}
                    disabled={hasReadChapter}
                  >
                    <Icon name="gem" size={16} color="#ffffff" style={styles.buttonIcon} />
                    <Text style={styles.smpButtonText}>
                      {hasReadChapter ? "You've earned points from this page" : 'Read with 1,000 SMP (Earn Points)'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.readingModeText}>
                    {isPremium ? 'Reading with SMP (Points Earned)' : 'Reading for Free (No Points)'}
                  </Text>
                </Animated.View>
              )}
            </>
          }
          ListFooterComponent={
            <Animated.View entering={FadeIn}>
              <View style={styles.navigation}>
                <View style={styles.navRow}>
                  {prevChapter ? (
                    <TouchableOpacity
                      style={styles.navButton}
                      onPress={() => navigation.navigate('MangaChapter', { mangaId, chapterId: prevChapter })}
                    >
                      <Icon name="chevron-left" size={16} color="#ffffff" style={styles.buttonIcon} />
                      <Text style={styles.navButtonText}>Previous</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.navPlaceholder} />
                  )}
                  <TouchableOpacity
                    style={styles.navButton}
                    onPress={() => navigation.navigate('Manga', { mangaId })}
                  >
                    <Icon name="book-open" size={16} color="#ffffff" style={styles.buttonIcon} />
                    <Text style={styles.navButtonText}>Back to Manga</Text>
                  </TouchableOpacity>
                  {nextChapter ? (
                    <TouchableOpacity
                      style={styles.navButton}
                      onPress={() => navigation.navigate('MangaChapter', { mangaId, chapterId: nextChapter })}
                    >
                      <Text style={styles.navButtonText}>Next</Text>
                      <Icon name="chevron-right" size={16} color="#ffffff" style={styles.buttonIcon} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.navPlaceholder} />
                  )}
                </View>
              </View>
              <MangaCommentSection
                mangaId={mangaId}
                chapterId={chapterId}
                isWalletConnected={isWalletConnected}
                activePublicKey={activePublicKey}
              />
            </Animated.View>
          }
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
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
              Unlock Chapter {chapterNum} for:
            </Text>
            <View style={styles.transactionDetails}>
              <Text style={styles.detailText}>
                Amount: {transactionDetails?.displayAmount} {transactionDetails?.currency}
              </Text>
              <Text style={styles.detailText}>
                USD Value: $2.5
              </Text>
              <Text style={styles.detailText}>
                Wallet: {activeWalletAddress?.slice(0, 6)}...{activeWalletAddress?.slice(-4)}
              </Text>
              <Text style={styles.detailText}>
                To: {TARGET_WALLET.slice(0, 6)}...{TARGET_WALLET.slice(-4)}
              </Text>
            </View>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={confirmPayment}>
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
        onRequestClose={() => {}}
      >
        <View style={styles.passwordModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.passwordModalContent}>
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
                secureTextEntry
                autoFocus
                accessibilityLabel="Wallet password input"
              />
              {passwordError && (
                <Text style={styles.passwordErrorText}>
                  {passwordError}
                  {passwordAttempts >= MAX_PASSWORD_ATTEMPTS ? '' : ` (${MAX_PASSWORD_ATTEMPTS - passwordAttempts} attempts left)`}
                </Text>
              )}
              <View style={styles.passwordModalButtonRow}>
                <TouchableOpacity
                  style={styles.passwordModalConfirmButton}
                  onPress={handlePasswordSubmit}
                  disabled={passwordAttempts >= MAX_PASSWORD_ATTEMPTS}
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
                    setPasswordCallback(null);
                  }}
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