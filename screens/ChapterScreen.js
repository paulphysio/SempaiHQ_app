import React, { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
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
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, getAccount, getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import * as SecureStore from 'expo-secure-store';
import { styles } from '../styles/ChapterScreenStyles';
import { RPC_URL, SMP_MINT_ADDRESS, USDC_MINT_ADDRESS, TARGET_WALLET, SMP_DECIMALS, AMETHYST_MINT_ADDRESS, AMETHYST_DECIMALS } from '../constants';
import bs58 from 'bs58';
import CommentSection from '../components/Comments/CommentSection';

const connection = new Connection(RPC_URL, 'confirmed');
const MIN_ATA_SOL = 0.00203928; // Minimum SOL for rent-exempt ATA
const SMP_READ_COST = 1000; // Cost in SMP tokens to read a chapter
const MAX_PASSWORD_ATTEMPTS = 3;
const PASSWORD_ERROR_TIMEOUT = 5000;
const MIN_REWARD_WALLET_SOL = 0.05; // Minimum SOL required in reward wallet for gas fees
const MIN_USER_SOL = 0; // User doesn't need SOL as merchant pays gas

const ChapterScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { novelId, chapterId } = route.params || {};
  const { 
    wallet, 
    signAndSendTransaction,
    isWalletConnected: contextWalletConnected 
  } = useContext(EmbeddedWalletContext);

  // State
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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [currentPasswordCallback, setCurrentPasswordCallback] = useState(null);
  const [hasReadChapter, setHasReadChapter] = useState(false);
  const usdcPrice = 1;
  const [visibleParagraphs, setVisibleParagraphs] = useState([]);
  const ITEMS_PER_PAGE = 20;
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

  // Fetch SMP balance
  const fetchSmpBalanceOnChain = useCallback(async (retryCount = 3, retryDelay = 1000) => {
    if (!activeWalletAddress || !activePublicKey) return 0;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const ataAddress = getAssociatedTokenAddressSync(
          new PublicKey(SMP_MINT_ADDRESS),
          activePublicKey
        );
        console.log("Fetching SMP balance for ATA:", ataAddress.toString());
        
        const ataInfo = await connection.getAccountInfo(ataAddress);
        if (!ataInfo) {
          console.log("No ATA found for SMP, returning 0 balance");
          setSmpBalance(0);
          return 0;
        }

        // Use unpackAccount to properly parse token account data
        const ata = unpackAccount(ataAddress, ataInfo);
        const balance = Number(ata.amount) / 10 ** SMP_DECIMALS;
        console.log("On-chain SMP balance:", balance);
        setSmpBalance(balance); // Update the state with the fetched balance
        return balance;

      } catch (error) {
        console.error(`Attempt ${attempt} - Error fetching on-chain SMP balance:`, error);
        if (attempt === retryCount) {
          setError("Unable to fetch SMP balance.");
          setSmpBalance(0); // Set balance to 0 on error
          setTimeout(() => setError(null), 5000);
          return 0;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
    return 0;
  }, [activeWalletAddress, activePublicKey]);

  // Fetch Amethyst balance
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

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    try {
      const cacheKey = 'priceCache';
      const cacheExpiry = 5 * 60 * 1000; // 5 minutes
      
      // Check cache first
      const cachedData = await SecureStore.getItemAsync(cacheKey);
      if (cachedData) {
        const { timestamp, solPrice, smpPrice } = JSON.parse(cachedData);
        if (Date.now() - timestamp < cacheExpiry) {
          setSolPrice(solPrice || 100);
          setSmpPrice(smpPrice || 0.01);
          return;
        }
      }

      // Fetch SMP-SOL price from Meteora with retries
      let smpSolPrice = 0.0001; // Default SMP-SOL price
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

      // Fetch SOL-USDC price from Meteora
      let solPrice = 100; // Default SOL price
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

      // Calculate SMP price in USD
      const smpPrice = smpSolPrice * solPrice;
      console.log('[fetchPrices] Calculated SMP-USD price:', smpPrice);

      setSolPrice(solPrice);
      setSmpPrice(smpPrice || 0.01);

      // Update cache
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

  // Fetch user data
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

      // Fetch on-chain balance
      await fetchSmpBalanceOnChain();
      
    } catch (error) {
      console.error('[fetchUserData] Error:', error);
      setError('Failed to load user data.');
      setTimeout(() => setError(null), 5000);
    }
  }, [activeWalletAddress, fetchSmpBalanceOnChain]);

  // Fetch novel
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

  // Check if chapter was read
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

  // Check chapter access
  const checkAccess = useCallback(async (walletAddress, novelData, chapterNum) => {
    if (!novelData || chapterNum === undefined) return;
    try {
      const advanceInfo = novelData.advance_chapters?.find((c) => c.index === chapterNum) || {
        is_advance: false,
        free_release_date: null,
      };

      setIsAdvanceChapter(advanceInfo.is_advance);
      setIsUnlockedViaSubscription(false); // Reset subscription status

      // Check if chapter is already paid for with SMP
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

      // If paid with SMP, unlock regardless of chapter type
      if (payment) {
        setIsLocked(false);
        setCanUnlockNextThree(true);
        return;
      }

      // For advance chapters, check subscription status
      if (advanceInfo.is_advance) {
        const { data: unlock, error: unlockError } = await supabase
          .from('unlocked_story_chapters')
          .select('chapter_unlocked_till, expires_at')
          .eq('wallet_address', walletAddress)
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
            setIsUnlockedViaSubscription(true); // Mark as unlocked via subscription
            return;
          }
        }

        // Advance chapter that's not unlocked
        setIsLocked(true);
        setCanUnlockNextThree(true);
      } else {
        // Regular chapter - requires SMP payment
        setIsLocked(true); // Lock until paid
        setCanUnlockNextThree(true);
      }
    } catch (error) {
      console.error('[checkAccess] Error:', error);
      setError('Failed to verify chapter access.');
      setTimeout(() => setError(null), 5000);
    }
  }, []);

  // Function to check if content should be shown
  const shouldShowContent = useCallback(() => {
    if (!isWalletConnected) return false;
    if (isUnlockedViaSubscription) return true; // Show if unlocked via subscription
    return !isLocked; // Otherwise, show only if paid with SMP
  }, [isWalletConnected, isUnlockedViaSubscription, isLocked]);

  // Password Modal Component
  const PasswordModal = ({ visible, onClose, onSubmit, error, isProcessing }) => {
    const [inputPassword, setInputPassword] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
      if (visible) {
        setInputPassword('');
        // Focus input with slight delay to ensure modal is fully visible
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }, [visible]);

    const handleSubmit = () => {
      if (!inputPassword.trim() || isProcessing) return;
      onSubmit(inputPassword);
    };

    if (!visible) return null;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.passwordModalOverlay}>
            <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
              <Animated.View
                entering={SlideInDown.springify().damping(15)}
                exiting={SlideOutDown.springify().damping(15)}
                style={styles.passwordModalContent}
              >
                <View style={styles.passwordModalHeader}>
                  <Text style={styles.passwordModalTitle}>Enter Password</Text>
                  <TouchableOpacity
                    style={styles.passwordModalCloseButton}
                    onPress={onClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="times" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                <View style={[
                  styles.passwordInputContainer,
                  error ? styles.inputError : null,
                  inputPassword ? styles.inputActive : null
                ]}>
                  <Icon name="lock" size={20} color="#E67E22" style={styles.passwordIcon} />
                  <TextInput
                    ref={inputRef}
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#666"
                    secureTextEntry
                    value={inputPassword}
                    onChangeText={setInputPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isProcessing}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="done"
                  />
                </View>

                {error && (
                  <View style={styles.passwordErrorContainer}>
                    <Icon name="exclamation-circle" size={16} color="#FF5252" style={styles.errorIcon} />
                    <Text style={styles.passwordErrorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.passwordModalButtonRow}>
                  <TouchableOpacity
                    style={styles.passwordModalCancelButton}
                    onPress={onClose}
                    disabled={isProcessing}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.passwordModalConfirmButton,
                      (!inputPassword.trim() || isProcessing) && styles.disabledButton
                    ]}
                    onPress={handleSubmit}
                    disabled={!inputPassword.trim() || isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.modalButtonText}>Confirm</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // Password Modal State and Handlers
  const [passwordModal, setPasswordModal] = useState(null);

  const handlePasswordSubmit = async (password) => {
    if (!password || isProcessing) return;

    if (passwordAttempts >= MAX_PASSWORD_ATTEMPTS) {
      setPasswordError('Maximum password attempts reached. Please try again later.');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordAttempts(0);
        setCurrentPasswordCallback(null);
      }, PASSWORD_ERROR_TIMEOUT);
      return;
    }

    setIsProcessing(true);
    try {
      await currentPasswordCallback?.(password);
      // Success - close modal and reset state
      setShowPasswordModal(false);
      setPasswordError(null);
      setPasswordAttempts(0);
      setCurrentPasswordCallback(null);
    } catch (err) {
      console.error('[handlePasswordSubmit] Error:', err);
      setPasswordAttempts(prev => prev + 1);
      
      const errorMessage = err.message.includes('Invalid password') ? 
        'Incorrect password. Please try again.' : 
        'Error processing request. Please try again.';
      
      setPasswordError(errorMessage);

      if (passwordAttempts + 1 >= MAX_PASSWORD_ATTEMPTS) {
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordAttempts(0);
          setCurrentPasswordCallback(null);
        }, PASSWORD_ERROR_TIMEOUT);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const requestPassword = useCallback((callback) => {
    setPasswordError(null);
    setPasswordAttempts(0);
    setCurrentPasswordCallback(() => callback);
    setShowPasswordModal(true);
  }, []);

  // Process chapter payment
  const processChapterPayment = useCallback(async (targetChapterId) => {
    if (!activeWalletAddress || !novel || !targetChapterId || !activePublicKey) {
      setError('Please ensure your wallet is connected and try again.');
      return false;
    }

    setError(null);
    setSuccessMessage('');
    setWarningMessage('');

    try {
      // Check if already paid
      const isPaid = await checkChapterPayment(parseInt(targetChapterId, 10));
      if (isPaid) {
        console.log('[processChapterPayment] Chapter already paid for');
        return true;
      }

      if (!TARGET_WALLET) {
        throw new Error('Configuration error: Missing reward wallet address');
      }

      const targetPublicKey = new PublicKey(TARGET_WALLET);
      console.log(`[processChapterPayment] Checking balances...`);

      // Check all balances in parallel for efficiency
      const [merchantSolBalance, userSolBalance, smpBalance] = await Promise.all([
        connection.getBalance(targetPublicKey),
        connection.getBalance(activePublicKey),
        fetchSmpBalanceOnChain()
      ]);

      console.log(`[processChapterPayment] Balances:`, {
        merchantSol: merchantSolBalance / LAMPORTS_PER_SOL,
        userSol: userSolBalance / LAMPORTS_PER_SOL,
        userSMP: smpBalance
      });

      // Verify merchant has enough SOL for gas
      if (merchantSolBalance < MIN_REWARD_WALLET_SOL * LAMPORTS_PER_SOL) {
        throw new Error(
          `The service is temporarily unavailable. Please contact support. (Insufficient merchant balance)`
        );
      }

      // Verify user has enough SOL for potential ATA creation
      if (userSolBalance < MIN_ATA_SOL * LAMPORTS_PER_SOL) {
        throw new Error(
          `You need at least ${MIN_ATA_SOL} SOL in your wallet for token account creation.`
        );
      }

      // Verify user has enough SMP
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

      // Create ATAs if they don't exist
      console.log('[processChapterPayment] Creating/getting ATAs...');
      const [sourceATA, destATA] = await Promise.all([
        getOrCreateAssociatedTokenAccount(
          connection,
          targetPublicKey, // Reward wallet pays gas
          new PublicKey(SMP_MINT_ADDRESS),
          activePublicKey
        ),
        getOrCreateAssociatedTokenAccount(
          connection,
          targetPublicKey, // Reward wallet pays gas
          new PublicKey(SMP_MINT_ADDRESS),
          targetPublicKey
        )
      ]);

      console.log('[processChapterPayment] ATAs created/found:', {
        sourceATA: sourceATA.address.toString(),
        destATA: destATA.address.toString()
      });

      // Verify source ATA has enough balance one final time before transaction
      const sourceATAInfo = await getAccount(connection, sourceATA.address);
      const sourceATABalance = Number(sourceATAInfo.amount) / 10 ** SMP_DECIMALS;
      
      if (sourceATABalance < SMP_READ_COST) {
        throw new Error(
          `Insufficient SMP tokens in your wallet. ` +
          `Required: ${SMP_READ_COST} SMP, Current: ${sourceATABalance} SMP`
        );
      }

      // Create and send transaction
      console.log('[processChapterPayment] Getting latest blockhash...');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      // Calculate the exact amount in token units
      const transferAmount = BigInt(SMP_READ_COST * (10 ** SMP_DECIMALS)); // Use SMP_DECIMALS constant
      console.log('[processChapterPayment] Transfer amount (in token units):', transferAmount.toString());
      console.log('[processChapterPayment] Transfer amount (in SMP):', SMP_READ_COST);

      // Create transfer instruction with explicit checks
      console.log('[processChapterPayment] Creating transfer instruction...');
      console.log('[processChapterPayment] Instruction parameters:', {
        sourceATA: sourceATA.address.toString(),
        destATA: destATA.address.toString(),
        authority: activePublicKey.toString(),
        amount: transferAmount.toString(),
        smpAmount: SMP_READ_COST
      });

      const transferInstruction = createTransferInstruction(
        sourceATA.address,
        destATA.address,
        activePublicKey,
        transferAmount
      );

      // Create transaction
      console.log('[processChapterPayment] Creating transaction...');
      const transaction = new Transaction();
      transaction.add(transferInstruction);
      
      // Set transaction properties
      console.log('[processChapterPayment] Setting transaction properties...');
      transaction.feePayer = activePublicKey;
      transaction.recentBlockhash = blockhash;

      console.log('[processChapterPayment] Transaction created:', {
        feePayer: transaction.feePayer.toString(),
        recentBlockhash: transaction.recentBlockhash,
        instructions: transaction.instructions.length
      });

      // Get user to sign transaction
      let signature;
      try {
        signature = await new Promise((resolve, reject) => {
          requestPassword(async (pwd) => {
            try {
              console.log('[processChapterPayment] Requesting transaction signature...');
              const sig = await signAndSendTransaction(transaction, pwd);
              if (!sig) {
                throw new Error('Failed to get transaction signature');
              }
              console.log('[processChapterPayment] Transaction signed:', sig);
              resolve(sig);
            } catch (err) {
              console.error('[processChapterPayment] Transaction signing error:', err);
              setPasswordAttempts(prev => prev + 1);
              reject(err);
            }
          });
        });

        if (!signature) {
          throw new Error('Transaction signing failed - no signature returned');
        }

        // Wait for transaction confirmation with retries
        console.log('[processChapterPayment] Confirming transaction...');
        let tx = null;
        for (let i = 0; i < 5; i++) { // Increased retries to 5
          try {
            tx = await connection.getTransaction(signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            });
            if (tx?.meta && !tx.meta.err) {
              console.log('[processChapterPayment] Transaction confirmed:', {
                signature,
                slot: tx.slot,
                blockTime: tx.blockTime
              });
              break;
            }
            console.log(`[processChapterPayment] Attempt ${i + 1}: Transaction pending, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
          } catch (err) {
            console.warn(`[processChapterPayment] Attempt ${i + 1} error:`, err);
            if (i === 4) throw new Error('Transaction confirmation failed after retries');
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
          }
        }

        if (!tx?.meta) {
          throw new Error('Transaction not found after retries');
        }

        if (tx.meta.err) {
          throw new Error(`Transaction failed on chain: ${tx.meta.err}`);
        }

        // Verify the token transfer by checking post balances
        const postTokenBalances = tx.meta.postTokenBalances || [];
        const preTokenBalances = tx.meta.preTokenBalances || [];
        
        console.log('[processChapterPayment] Detailed token balances:', {
          pre: preTokenBalances.map(b => ({
            accountIndex: b.accountIndex,
            mint: b.mint,
            owner: b.owner,
            amount: b.uiTokenAmount
          })),
          post: postTokenBalances.map(b => ({
            accountIndex: b.accountIndex,
            mint: b.mint,
            owner: b.owner,
            amount: b.uiTokenAmount
          }))
        });

        // Find the user's token balance changes
        const userPreBalance = preTokenBalances.find(b => 
          b.owner === activeWalletAddress && 
          b.mint === SMP_MINT_ADDRESS
        );
        const userPostBalance = postTokenBalances.find(b => 
          b.owner === activeWalletAddress && 
          b.mint === SMP_MINT_ADDRESS
        );

        console.log('[processChapterPayment] User balance check:', {
          activeWalletAddress,
          SMP_MINT_ADDRESS,
          preBalance: userPreBalance?.uiTokenAmount,
          postBalance: userPostBalance?.uiTokenAmount
        });

        // If we can't find the balances by owner, try by account index
        if (!userPreBalance || !userPostBalance) {
          console.log('[processChapterPayment] Trying to find balances by account index...');
          // Get all token accounts involved in the transaction
          const accounts = tx.transaction.message.accountKeys;
          console.log('[processChapterPayment] Transaction accounts:', accounts.map(a => a.toString()));
          
          // Find the index of the source ATA
          const sourceATAIndex = accounts.findIndex(a => a.toString() === sourceATA.address.toString());
          console.log('[processChapterPayment] Source ATA index:', sourceATAIndex);
          
          if (sourceATAIndex !== -1) {
            const sourcePreBalance = preTokenBalances.find(b => b.accountIndex === sourceATAIndex);
            const sourcePostBalance = postTokenBalances.find(b => b.accountIndex === sourceATAIndex);
            
            if (sourcePreBalance && sourcePostBalance) {
              console.log('[processChapterPayment] Found balances by account index:', {
                pre: sourcePreBalance.uiTokenAmount,
                post: sourcePostBalance.uiTokenAmount
              });

              const balanceChange = Number(sourcePreBalance.uiTokenAmount.uiAmount) - Number(sourcePostBalance.uiTokenAmount.uiAmount);
              console.log('[processChapterPayment] Balance change:', balanceChange);

              // Verify the amount with tolerance
              const tolerance = 0.001;
              if (Math.abs(balanceChange - SMP_READ_COST) <= tolerance) {
                // Record payment in database
                const { error: paymentError } = await supabase
                  .from('chapter_payments')
                  .insert({
                    wallet_address: activeWalletAddress,
                    novel_id: novelId,
                    chapter_number: parseInt(targetChapterId, 10),
                    amount: SMP_READ_COST
                  });

                if (paymentError) {
                  console.error('[processChapterPayment] Database error:', paymentError);
                  throw paymentError;
                }

                console.log('[processChapterPayment] Payment recorded in database');
                setSuccessMessage(`Payment successful! ${SMP_READ_COST.toLocaleString()} SMP sent for Chapter ${parseInt(targetChapterId, 10) + 1}.`);
                setSmpBalance(prev => prev - SMP_READ_COST);
                
                // Update UI state to show chapter content
                setIsLocked(false);
                setCanUnlockNextThree(true);
                
                // Reset any error states
                setError(null);
                setWarningMessage(null);
                
                console.log('[processChapterPayment] Chapter unlocked, updating UI state');
                setTimeout(() => setSuccessMessage(''), 5000);
                return true;
              }
            }
          }
        }

        // If we get here, we couldn't validate the transfer
        console.error('[processChapterPayment] Token balance validation failed:', {
          sourceATA: sourceATA.address.toString(),
          destATA: destATA.address.toString(),
          activeWalletAddress,
          SMP_MINT_ADDRESS,
          accounts: tx.transaction.message.accountKeys.map(a => a.toString())
        });
        throw new Error('Token transfer validation failed: Could not verify balance changes');

      } catch (error) {
        console.error('[processChapterPayment] Error:', error);
        const errorMessage = error.message.includes('Invalid password') ? 'Incorrect password. Please try again.' :
                           error.message.includes('Insufficient') ? error.message :
                           error.message.includes('service is temporarily unavailable') ? error.message :
                           'Transaction failed. Please try again later.';
        
        setError(errorMessage);
        
        if (error.message.includes('Insufficient SMP tokens')) {
          setWarningMessage('Need SMP tokens to continue reading');
          setTimeout(() => {
            navigation.navigate('TokenSwap', {
              returnScreen: 'Chapter',
              returnParams: { novelId, chapterId }
            });
          }, 2000);
        }
        
        setTimeout(() => {
          setError(null);
          setWarningMessage(null);
        }, 5000);
        return false;
      }
    } catch (error) {
      console.error('[processChapterPayment] Error:', error);
      const errorMessage = error.message.includes('Invalid password') ? 'Incorrect password. Please try again.' :
                          error.message.includes('Insufficient') ? error.message :
                          error.message.includes('service is temporarily unavailable') ? error.message :
                          'Transaction failed. Please try again later.';
      
      setError(errorMessage);
      
      if (error.message.includes('Insufficient SMP tokens')) {
        setWarningMessage('Need SMP tokens to continue reading');
        setTimeout(() => {
          navigation.navigate('TokenSwap', {
            returnScreen: 'Chapter',
            returnParams: { novelId, chapterId }
          });
        }, 2000);
      }
      
      setTimeout(() => {
        setError(null);
        setWarningMessage(null);
      }, 5000);
      return false;
    }
  }, [activeWalletAddress, novel, novelId, activePublicKey, checkChapterPayment, requestPassword, signAndSendTransaction]);

  // Handle next chapter navigation
  const handleNextChapter = async (nextChapterId) => {
    if (!nextChapterId) return;
    
    const paymentSuccess = await processChapterPayment(nextChapterId);
    if (paymentSuccess) {
      navigation.navigate('Chapter', { novelId, chapterId: nextChapterId });
    }
  };

  // Check payment on component mount
  useEffect(() => {
    if (chapterId && userId) {
      checkChapterPayment(parseInt(chapterId, 10)).then(isPaid => {
        setIsLocked(!isPaid);
      });
    }
  }, [chapterId, userId, checkChapterPayment]);

  // Initialize
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

  // Check access and read status
  useEffect(() => {
    if (novel && chapterId && isWalletConnected) {
      checkAccess(activeWalletAddress, novel, parseInt(chapterId, 10));
      checkHasReadChapter(chapterId);
    }
  }, [novel, activeWalletAddress, chapterId, checkAccess, checkHasReadChapter, isWalletConnected]);

  // Auto-process SMP payment
  useEffect(() => {
    if (!loading && novel && !isLocked && readingMode === 'paid' && isWalletConnected) {
      processChapterPayment(chapterId);
    }
  }, [loading, novel, isLocked, readingMode, processChapterPayment, isWalletConnected]);

  // Manual fetch
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

  // Update the loadMoreParagraphs function
  const loadMoreParagraphs = useCallback(() => {
    if (!paragraphs || !Array.isArray(paragraphs)) return;
    
    const nextBatch = paragraphs.slice(
      visibleParagraphs.length,
      visibleParagraphs.length + ITEMS_PER_PAGE
    );
    if (nextBatch.length > 0) {
      setVisibleParagraphs(prev => [...prev, ...nextBatch]);
    }
  }, [paragraphs, visibleParagraphs.length]);

  // Update the useEffect for paragraphs initialization
  useEffect(() => {
    if (paragraphs && Array.isArray(paragraphs) && paragraphs.length > 0) {
      setVisibleParagraphs(paragraphs.slice(0, ITEMS_PER_PAGE));
    } else {
      setVisibleParagraphs([]);
    }
  }, [paragraphs]);

  // Update the content parsing logic
  const chapterContent = novel?.chaptercontents?.[chapterId] || '';
  const paragraphs = useMemo(() => {
    if (!chapterContent) return [];
    return chapterContent
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.trim());
  }, [chapterContent]);

  // Render paragraph
  const renderParagraph = useCallback(({ item, index }) => {
    const AnimatedText = Animated.createAnimatedComponent(Text);
    return (
      <AnimatedText
        entering={FadeIn.delay(50 * (index % ITEMS_PER_PAGE))}
        style={styles.paragraph}
      >
        {item}
      </AnimatedText>
    );
  }, []);

  // Add an effect to periodically update the balance
  useEffect(() => {
    if (!isWalletConnected) return;

    // Initial fetch
    fetchSmpBalanceOnChain();

    // Set up periodic balance updates
    const intervalId = setInterval(() => {
      fetchSmpBalanceOnChain();
    }, 30000); // Update every 30 seconds

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [isWalletConnected, fetchSmpBalanceOnChain]);

  // Check if user has paid for the chapter
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

  // UI
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
      {!isWalletConnected ? (
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
      ) : !shouldShowContent() ? (
        <Animated.View entering={FadeIn} style={styles.lockedContainer}>
          <Icon name="gem" size={48} color="#E67E22" style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Read this Chapter</Text>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.smpButton}
              onPress={() => processChapterPayment(chapterId)}
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
                returnParams: { novelId, chapterId }
              })}
            >
              <Icon name="shopping-cart" size={16} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.getSmpButtonText}>Get SMP Tokens</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : (
        <FlatList
          data={visibleParagraphs}
          renderItem={renderParagraph}
          keyExtractor={(item, index) => `para-${index}`}
          style={styles.contentContainer}
          onEndReached={loadMoreParagraphs}
          onEndReachedThreshold={0.5}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          initialNumToRender={10}
          windowSize={5}
          ListHeaderComponent={
            hasReadChapter ? (
              <Animated.View entering={FadeIn} style={styles.readingOptions}>
                <Text style={styles.readingModeText}>
                  You've earned points from this chapter
                </Text>
              </Animated.View>
            ) : null
          }
          ListFooterComponent={
            <Animated.View entering={FadeIn}>
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
            </Animated.View>
          }
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
      <PasswordModal
        visible={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordError(null);
          setCurrentPasswordCallback(null);
        }}
        onSubmit={handlePasswordSubmit}
        error={passwordError}
        isProcessing={isProcessing}
      />
    </SafeAreaView>
  );
};

export default ChapterScreen;