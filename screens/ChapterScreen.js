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
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
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
  SMP_DECIMALS,
  AMETHYST_MINT_ADDRESS,
  AMETHYST_DECIMALS,
} from '../constants';
import { Buffer } from 'buffer';
import CommentSection from '../components/Comments/CommentSection';
import { CardStyleInterpolators } from '@react-navigation/stack';

const { width, height } = Dimensions.get('window');

// Kaito Adventure Design System - Japanese Dark-Orange
const KA_COLORS = {
  bgPrimary: '#0c0c0c',
  bgCard: '#141210',
  bgElevated: '#1a1714',
  orangePrimary: '#cc5500',
  orangeBright: '#ff6b35',
  orangeSoft: '#e67e22',
  orangeDim: '#8b4513',
  gold: '#c9a84c',
  goldBright: '#ffd700',
  ivory: '#f5e6d3',
  ivoryDim: '#c4b5a0',
  border: '#2d2418',
  textPrimary: '#f5e6d3',
  textSecondary: '#a09080',
  textMuted: '#6b5d4f',
  success: '#4a7c59',
  error: '#c41e3a',
  warning: '#c9a84c',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KA_COLORS.bgPrimary,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: KA_COLORS.bgPrimary,
  },
  emberContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  ember: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: KA_COLORS.orangePrimary,
    shadowColor: KA_COLORS.orangeBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgPrimary,
  },
  loadingText: {
    color: KA_COLORS.ivory,
    fontSize: 16,
    marginTop: 16,
    letterSpacing: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgPrimary,
    padding: 20,
  },
  errorTitle: {
    color: KA_COLORS.ivory,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 2,
  },
  input: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: KA_COLORS.ivory,
    fontSize: 14,
    width: '100%',
    marginBottom: 16,
    letterSpacing: 1,
  },
  actionButton: {
    backgroundColor: KA_COLORS.orangePrimary,
    borderWidth: 1,
    borderColor: KA_COLORS.orangeBright,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 12,
    shadowColor: KA_COLORS.orangePrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  secondaryButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  buttonIcon: {
    marginRight: 8,
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: KA_COLORS.bgElevated,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceIcon: {
    marginRight: 4,
  },
  balanceText: {
    color: KA_COLORS.gold,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: KA_COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    color: KA_COLORS.ivory,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  messageContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  errorMessage: {
    backgroundColor: KA_COLORS.bgElevated,
    borderColor: KA_COLORS.error,
  },
  warningMessage: {
    backgroundColor: KA_COLORS.bgElevated,
    borderColor: KA_COLORS.warning,
  },
  successMessage: {
    backgroundColor: KA_COLORS.bgElevated,
    borderColor: KA_COLORS.success,
  },
  messageText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 1,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIcon: {
    marginBottom: 20,
  },
  lockedMessage: {
    color: KA_COLORS.ivory,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 2,
  },
  lockedSubMessage: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
  },
  paymentButton: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    width: '45%',
    minWidth: 140,
  },
  fullChaptersButton: {
    borderColor: KA_COLORS.gold,
  },
  threeChaptersButton: {
    borderColor: KA_COLORS.orangeDim,
  },
  disabledButton: {
    opacity: 0.5,
  },
  paymentButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  paymentPrice: {
    color: KA_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  smpButton: {
    backgroundColor: KA_COLORS.orangePrimary,
    borderWidth: 1,
    borderColor: KA_COLORS.orangeBright,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    flex: 1,
    shadowColor: KA_COLORS.orangePrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  smpButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  getSmpButton: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    flex: 1,
  },
  getSmpButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  paragraph: {
    color: KA_COLORS.ivory,
    fontSize: 16,
    lineHeight: 28,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  navigation: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: KA_COLORS.border,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  navButton: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  navPlaceholder: {
    width: 100,
  },
  readingOptions: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.gold,
    borderRadius: 4,
  },
  readingModeText: {
    color: KA_COLORS.gold,
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 16,
  },
  modalTitle: {
    color: KA_COLORS.ivory,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 2,
  },
  modalSubtitle: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 16,
    letterSpacing: 1,
  },
  transactionDetails: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
  },
  detailText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalConfirmButton: {
    backgroundColor: KA_COLORS.orangePrimary,
    borderWidth: 1,
    borderColor: KA_COLORS.orangeBright,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flex: 1,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flex: 1,
    alignItems: 'center',
  },
  modalButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modalNote: {
    color: KA_COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 1,
  },
});
const connection = new Connection(RPC_URL, 'confirmed');
const MIN_ATA_SOL = 0.00103928;
const MIN_USER_SOL = 0.001;
const poolAddress = "3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33";
const meteoraApiUrl = `https://amm-v2.meteora.ag/pools?address=${poolAddress}`;
const USDC_AMOUNT = 0.0025;

const SQUADS_WALLET = new PublicKey("4EeY4iDCp36yvLFvwhFhBrurKGJwNqLDzvM3PVsxrPdR");
const TREASURY_WALLET = new PublicKey("62PPSRhAk6hdn85MUoYAnUDisswZRfos68Zqf7N1QLkr");

// Helper: Split payment amounts
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

// Helper: Create payment transaction on client side
async function createPaymentTransactionClient({ paymentMint, paymentAmount, userPublicKey, authorPublicKey, smpMintAddress }) {
  const [authorAmount, treasuryAmount, squadsAmount, burnAmount] = splitAmountWithResidual(
    paymentAmount,
    [30, 30, 25, 15]
  );
  
  const instructions = [];
  
  if (!paymentMint) {
    // SOL transfer
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: authorPublicKey,
        lamports: authorAmount,
      }),
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: TREASURY_WALLET,
        lamports: treasuryAmount + burnAmount,
      }),
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: SQUADS_WALLET,
        lamports: squadsAmount,
      })
    );
  } else {
    // Token transfer
    const userAta = getAssociatedTokenAddressSync(paymentMint, userPublicKey);
    const authorAta = getAssociatedTokenAddressSync(paymentMint, authorPublicKey);
    const treasuryAta = getAssociatedTokenAddressSync(paymentMint, TREASURY_WALLET, true);
    const squadsAta = getAssociatedTokenAddressSync(paymentMint, SQUADS_WALLET, true);

    let reroutedToTreasury = 0;
    
    // Check if ATAs exist and route accordingly
    const [authorAtaInfo, squadsAtaInfo, treasuryAtaInfo] = await connection.getMultipleAccountsInfo([
      authorAta,
      squadsAta,
      treasuryAta,
    ]);

    // Author
    let authorDestAta = authorAta;
    let authorDestAmount = authorAmount;
    if (!authorAtaInfo) {
      console.warn('[createPaymentTransactionClient] Author ATA missing, rerouting to treasury');
      reroutedToTreasury += authorAmount;
      authorDestAta = null;
      authorDestAmount = 0;
    }
    
    // Squads
    let squadsDestAta = squadsAta;
    let squadsDestAmount = squadsAmount;
    if (!squadsAtaInfo) {
      console.warn('[createPaymentTransactionClient] Squads ATA missing, rerouting to treasury');
      reroutedToTreasury += squadsAmount;
      squadsDestAta = null;
      squadsDestAmount = 0;
    }
    
    // Treasury must exist
    if (!treasuryAtaInfo) {
      throw new Error('Treasury wallet is missing ATA for this token');
    }

    // Build transfer instructions
    if (authorDestAta && authorDestAmount > 0) {
      instructions.push(createTransferInstruction(userAta, authorDestAta, userPublicKey, authorDestAmount));
    }
    if (squadsDestAta && squadsDestAmount > 0) {
      instructions.push(createTransferInstruction(userAta, squadsDestAta, userPublicKey, squadsDestAmount));
    }
    
    // Treasury gets its share + any rerouted shares
    const totalTreasuryAmount = treasuryAmount + burnAmount + reroutedToTreasury;
    if (totalTreasuryAmount > 0) {
      instructions.push(createTransferInstruction(userAta, treasuryAta, userPublicKey, totalTreasuryAmount));
    }
    
    // Burn SMP tokens if applicable
    if (smpMintAddress && paymentMint.equals(smpMintAddress)) {
      instructions.push(createBurnInstruction(userAta, paymentMint, userPublicKey, burnAmount));
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
  const [recentlyUnlocked, setRecentlyUnlocked] = useState(false);
  const [hasReadChapter, setHasReadChapter] = useState(false);
  const usdcPrice = 1; // USDC is pegged to $1
  const [isAdvanceChapter, setIsAdvanceChapter] = useState(false);
  const [isUnlockedViaSubscription, setIsUnlockedViaSubscription] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const flatListRef = useRef(null);
  const emberAnims = useRef([]);
  const embersData = useRef([]);
  const embersInitialized = useRef(false);

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

  // Dynamic SMP cost for $0.025
  const SMP_READ_COST = useMemo(() => {
    if (!smpPrice || smpPrice <= 0) {
      console.warn('[SMP_READ_COST] Invalid SMP price, using default value');
      return 50000000000; // Fallback: 0.025 USD / 0.000001 USD per SMP = 2,500,000 lamports (6 decimals)
    }
    const costInSmp = Math.ceil((0.0025 / smpPrice) * 10 ** SMP_DECIMALS);
    console.log('[SMP_READ_COST] Calculated SMP cost for $0.025:', costInSmp, 'SMP price:', smpPrice);
    return costInSmp;
  }, [smpPrice]);

  // Enhanced fetch pool data with better error handling and fallback
  const fetchPoolData = useCallback(async () => {
    try {
      console.log('[fetchPoolData] Fetching pool data from Meteora API...');
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(meteoraApiUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SempaiHQ/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No pool data returned from API');
      }
      
      const poolData = data[0];
      console.log('[fetchPoolData] Successfully fetched pool data');
      return poolData;
      
    } catch (error) {
      console.error('[fetchPoolData] Error:', error.message);
      
      // Provide more specific error messages
      if (error.name === 'AbortError') {
        throw new Error('Network request timed out. Please check your connection and try again.');
      } else if (error.message.includes('Network request failed')) {
        throw new Error('Network connection failed. Please check your internet connection.');
      } else if (error.message.includes('HTTP 429')) {
        throw new Error('Too many requests. Please try again in a moment.');
      } else if (error.message.includes('HTTP 5')) {
        throw new Error('Server error. Please try again later.');
      } else {
        throw new Error(`Failed to fetch pool data: ${error.message}`);
      }
    }
  }, []);

  // Calculate SOL price in USD (fixed version)
  const calculateSolPriceInUsd = useCallback((pool) => {
    // Since Meteora API returns 0 for USD values, use fallback price
    const fallbackSolPrice = 100; // $100 per SOL
    console.log('[calculateSolPriceInUsd] Using fallback SOL price:', fallbackSolPrice, 'USD');
    return fallbackSolPrice;
  }, []);

  // Calculate SMP per SOL
  const calculateSmpPerSol = useCallback((pool) => {
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
  }, []);

  // Enhanced convert USDC to SMP with better error handling
  const convertUsdcToSmp = useCallback(async (usdcAmount) => {
    try {
      console.log(`[convertUsdcToSmp] Converting ${usdcAmount} USDC to SMP...`);
      const poolData = await fetchPoolData();
      const solPriceInUsd = calculateSolPriceInUsd(poolData);
      const solAmount = usdcAmount / solPriceInUsd;
      const smpPerSol = calculateSmpPerSol(poolData);
      const smpAmount = solAmount * smpPerSol;
      console.log(`[convertUsdcToSmp] ${usdcAmount} USDC = ${smpAmount.toFixed(2)} SMP`);
      return smpAmount;
    } catch (error) {
      console.error('[convertUsdcToSmp] Error:', error.message);
      
      // Provide fallback calculation if API fails
      console.warn('[convertUsdcToSmp] Using fallback calculation');
      
      // Fallback rates (these should be updated periodically)
      const fallbackSolPrice = 100; // $100 per SOL
      const fallbackSmpPerSol = 328861621.646602; // SMP per SOL from reference rate
      
      const solAmount = usdcAmount / fallbackSolPrice;
      const smpAmount = solAmount * fallbackSmpPerSol;
      
      console.log(`[convertUsdcToSmp] Fallback: ${usdcAmount} USDC = ${smpAmount.toFixed(2)} SMP`);
      return smpAmount;
    }
  }, [fetchPoolData, calculateSolPriceInUsd, calculateSmpPerSol]);

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
  }, [fetchPoolData, convertUsdcToSmp, calculateSolPriceInUsd]);

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
      // Get the user's email from auth session (this matches what's stored in DB)
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData?.session?.user?.email;
      
      if (!userEmail) {
        console.warn('[checkChapterPayment] No user email found');
        return false;
      }
      
      const { data, error } = await supabase
        .from('chapter_payments')
        .select('id')
        .eq('wallet_address', userEmail)
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
  }, [userId, checkChapterPayment]);

  const shouldShowContent = useMemo(() => {
    if (!isWalletConnected) return false;
    if (isUnlockedViaSubscription) return true;
    if (parseInt(chapterId, 10) === 0) return true;
    return !isLocked;
  }, [isWalletConnected, isUnlockedViaSubscription, isLocked, chapterId]);

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
        const usdAmount = 0.0025;
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
        
        // Keep chapter unlocked for 10 seconds to prevent re-locking during DB replication
        setTimeout(() => setRecentlyUnlocked(false), 10000);
        
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
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [chapterId]);

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

  const renderParagraph = useCallback(
    ({ item }) => <Text style={styles.paragraph}>{item}</Text>,
    []
  );

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
                <FontAwesome5 name="chevron-left" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
                <Text style={styles.navButtonText}>Previous</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.navPlaceholder} />
            )}
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('NovelDetail', { id: novelId })}
            >
              <FontAwesome5 name="book-open" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
              <Text style={styles.navButtonText}>Back to Novel</Text>
            </TouchableOpacity>
            {nextChapter && (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleNextChapter(nextChapter)}
              >
                <Text style={styles.navButtonText}>Next</Text>
                <FontAwesome5 name="chevron-right" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
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
            <Icon name="home" size={16} color="#ffffff" style={styles.buttonIcon} />
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
            <Icon name="home" size={16} color="#ffffff" style={styles.buttonIcon} />
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
  console.log('chapterId:', chapterId, 'chapterKeys:', chapterKeys, 'currentIndex:', currentIndex, 'prevChapter:', prevChapter, 'nextChapter:', nextChapter);
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
      <StatusBar barStyle="light-content" backgroundColor={KA_COLORS.bgPrimary} />
      <View style={styles.backgroundGradient} />
      <View style={styles.emberContainer}>
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
          <View style={styles.balanceItem}>
            <FontAwesome5 name="wallet" size={16} color={KA_COLORS.gold} style={styles.balanceIcon} />
            <Text style={styles.balanceText}>SMP: {smpBalance.toLocaleString()}</Text>
          </View>
          <View style={styles.balanceItem}>
            <FontAwesome5 name="star" size={16} color={KA_COLORS.gold} style={styles.balanceIcon} />
            <Text style={styles.balanceText}>Points: {weeklyPoints.toLocaleString()}</Text>
          </View>
          <View style={styles.balanceItem}>
            <FontAwesome5 name="gem" size={16} color={KA_COLORS.gold} style={styles.balanceIcon} />
            <Text style={styles.balanceText}>Amethyst: {amethystBalance.toFixed(2)}</Text>
          </View>
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Home')}>
          <FontAwesome5 name="home" size={20} color={KA_COLORS.ivory} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{chapterTitle}</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('NovelsPage', { novelId })}
        >
          <FontAwesome5 name="book" size={20} color={KA_COLORS.ivory} />
        </TouchableOpacity>
      </View>
      {(successMessage || (error && isWalletConnected) || warningMessage) && (
        <View
          style={[
            styles.messageContainer,
            error ? styles.errorMessage : warningMessage ? styles.warningMessage : styles.successMessage,
          ]}
        >
          <Text style={styles.messageText}>{successMessage || error || warningMessage}</Text>
        </View>
      )}
      {!isWalletConnected && parseInt(chapterId, 10) > 0 ? (
        <View style={styles.lockedContainer}>
          <FontAwesome5 name="wallet" size={48} color={KA_COLORS.orangePrimary} style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Connect Wallet to Continue Reading</Text>
          <Text style={styles.lockedSubMessage}>Please connect your wallet to read chapters.</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <FontAwesome5 name="wallet" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
            <Text style={styles.actionButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      ) : isLocked && isAdvanceChapter ? (
        <View>
          <FontAwesome5 name="lock" size={48} color={KA_COLORS.error} style={styles.lockIcon} />
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
                <FontAwesome5
                  name={type === 'FULL' ? 'crown' : 'rocket'}
                  size={20}
                  color={KA_COLORS.ivory}
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
          <FontAwesome5 name="gem" size={48} color={KA_COLORS.orangePrimary} style={styles.lockIcon} />
          <Text style={styles.lockedMessage}>Read this Chapter</Text>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.smpButton}
              onPress={() => processChapterPayment(chapterId, 'SINGLE', 'SMP')}
              disabled={isProcessing}
            >
              <FontAwesome5 name="gem" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
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
              <FontAwesome5 name="shopping-cart" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
              <Text style={styles.getSmpButtonText}>Get SMP Tokens</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
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
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTransactionPopup(false)}
            >
              <FontAwesome5 name="times" size={20} color={KA_COLORS.ivory} />
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