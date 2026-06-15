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
  Picker,
} from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
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
  adUnlockContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  adUnlockButton: {
    backgroundColor: KA_COLORS.bgElevated,
    borderColor: KA_COLORS.orangeBright,
  },
  benefactorContainer: {
    marginTop: 24,
  },
  benefactorButton: {
    backgroundColor: KA_COLORS.bgElevated,
    borderColor: KA_COLORS.gold,
  },
  benefactorStatus: {
    marginTop: 24,
    padding: 16,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.gold,
    borderRadius: 4,
    alignItems: 'center',
  },
  benefactorStatusText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    marginTop: 8,
    letterSpacing: 1,
  },
  benefactorExpiryText: {
    color: KA_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 1,
  },
  audioControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    marginBottom: 16,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
  },
  audioButton: {
    alignItems: 'center',
    opacity: 1,
  },
  audioButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 1,
  },
  chapterSelector: {
    marginBottom: 16,
  },
  chapterSelectorButton: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterSelectorText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  ratingSection: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
  },
  userRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  averageRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingLabel: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    marginRight: 8,
    letterSpacing: 1,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  star: {
    marginRight: 4,
  },
  ratingValue: {
    color: KA_COLORS.textSecondary,
    fontSize: 12,
    marginLeft: 8,
    letterSpacing: 1,
  },
  videoAdContainer: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: 200,
    marginTop: 16,
  },
  benefactorPlans: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  benefactorPlan: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 2,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: '45%',
    minWidth: 120,
  },
  benefactorPlanIcon: {
    marginBottom: 8,
  },
  benefactorPlanName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 1,
  },
  benefactorPlanPrice: {
    color: KA_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 1,
  },
  benefactorPlanChapters: {
    color: KA_COLORS.ivory,
    fontSize: 12,
    marginBottom: 4,
    letterSpacing: 1,
  },
  benefactorPlanDuration: {
    color: KA_COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 1,
  },
  chapterList: {
    maxHeight: 400,
    marginTop: 16,
  },
  chapterListItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
  },
  chapterListItemText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  authorNoteSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.gold,
    borderRadius: 4,
  },
  authorNoteTitle: {
    color: KA_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 1,
  },
  authorNoteDisplay: {
    backgroundColor: KA_COLORS.bgPrimary,
    borderRadius: 4,
    padding: 12,
  },
  authorNoteText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  authorNoteEmpty: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  editButton: {
    backgroundColor: KA_COLORS.orangePrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  editButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    fontWeight: 'bold',
  },
  authorNoteEdit: {
    backgroundColor: KA_COLORS.bgPrimary,
    borderRadius: 4,
    padding: 12,
  },
  authorNoteTextarea: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    color: KA_COLORS.ivory,
    fontSize: 14,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  authorNoteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    backgroundColor: KA_COLORS.orangePrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
  },
  saveButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
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
const FOUNDER_FUND_WALLET = new PublicKey("62PPSRhAk6hdn85MUoYAnUDisswZRfos68Zqf7N1QLkr");
const SEMPAI_HQ_WALLET = new PublicKey("4ZFvgNZygfiCSAS4aKBbQEgwJgBq5fRT9oLAH56GrF6H");

// Ad video configuration - fetch from web version
// Update this URL to your web version's domain
const WEB_BASE_URL = 'https://your-web-domain.com'; // Replace with your actual web domain
const AD_VIDEO_URI = `${WEB_BASE_URL}/ad_video.mp4`;

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

// Helper: Create payment transaction on client side (updated to match web version 50/30/20 split)
async function createPaymentTransactionClient({ paymentMint, paymentAmount, userPublicKey, authorPublicKey, smpMintAddress }) {
  const [creatorAmount, sempaiHqAmount, founderFundAmount] = splitAmountWithResidual(
    paymentAmount,
    [50, 30, 20]
  );
  
  const instructions = [];
  
  if (!paymentMint) {
    // SOL transfer - 50% to creator, 30% to Sempai HQ, 20% to Founder Fund
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
    // Token transfer - 50% to creator, 30% to Sempai HQ, 20% to Founder Fund
    const userAta = getAssociatedTokenAddressSync(paymentMint, userPublicKey);
    const creatorAta = getAssociatedTokenAddressSync(paymentMint, authorPublicKey);
    const sempaiHqAta = getAssociatedTokenAddressSync(paymentMint, SEMPAI_HQ_WALLET, true);
    const founderFundAta = getAssociatedTokenAddressSync(paymentMint, FOUNDER_FUND_WALLET, true);

    let reroutedToFounderFund = 0;
    
    // Check if ATAs exist and route accordingly
    const [creatorAtaInfo, sempaiHqAtaInfo, founderFundAtaInfo] = await connection.getMultipleAccountsInfo([
      creatorAta,
      sempaiHqAta,
      founderFundAta,
    ]);

    // Check user's SOL balance for ATA creation costs
    const userBalance = await connection.getBalance(userPublicKey);
    const ataRentExemption = 0.00203928 * 1000000000; // Approximate rent exemption in lamports
    const requiredSolForAtas = (!creatorAtaInfo ? ataRentExemption : 0) + (!sempaiHqAtaInfo ? ataRentExemption : 0);

    // Creator - Create ATA if missing and user has enough SOL
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
    
    // Sempai HQ - Create ATA if missing and user has enough SOL
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
    
    // Founder Fund - Create ATA if missing and user has enough SOL
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

    // Build transfer instructions
    if (creatorDestAta && creatorDestAmount > 0) {
      instructions.push(createTransferInstruction(userAta, creatorDestAta, userPublicKey, creatorDestAmount));
    }
    if (sempaiHqDestAta && sempaiHqDestAmount > 0) {
      instructions.push(createTransferInstruction(userAta, sempaiHqDestAta, userPublicKey, sempaiHqDestAmount));
    }

    // Founder Fund gets its share + any rerouted shares
    const totalFounderFundAmount = founderFundDestAmount + reroutedToFounderFund;
    if (totalFounderFundAmount > 0 && founderFundDestAta) {
      instructions.push(createTransferInstruction(userAta, founderFundDestAta, userPublicKey, totalFounderFundAmount));
    }
    
    // Burn SMP tokens if applicable
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
  
  // Ad unlock system
  const [hasUsedAdUnlockToday, setHasUsedAdUnlockToday] = useState(false);
  const [showAdOption, setShowAdOption] = useState(false);
  const [showVideoAd, setShowVideoAd] = useState(false);
  const videoRef = useRef(null);
  
  // Benefactor subscription system
  const [benefactorAccess, setBenefactorAccess] = useState(null);
  const [showBenefactorOption, setShowBenefactorOption] = useState(false);
  const [showBenefactorModal, setShowBenefactorModal] = useState(false);
  
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
      const chapterNum = parseInt(chapterId, 10);
      
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

      // Build transaction
      const transaction = await createPaymentTransactionClient({
        paymentMint,
        paymentAmount,
        userPublicKey: activePublicKey,
        authorPublicKey,
        smpMintAddress: paymentMint,
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
        blue:  { price: 0.1,   chapters: 3,   name: 'Blue' },
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

      // Get selected token from plan (USDC, SOL, or SKR - never SMP)
      const currency = plan.selectedToken || 'USDC';

      let paymentAmount = 0;
      let paymentMint = null;

      if (currency === 'USDC') {
        paymentMint = new PublicKey(USDC_MINT_ADDRESS);
        paymentAmount = Math.floor(tier.price * 1_000_000);
      } else if (currency === 'SOL') {
        paymentAmount = Math.floor(tier.price * (solPrice || 100) * 1_000_000_000);
      } else {
        throw new Error('Invalid token selected. Only USDC or SOL are allowed for benefactor plans.');
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
          payment_signature: paymentResult.signature,
        });
      
      if (subError) throw new Error(subError.message);

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
          
          {/* Ad unlock option */}
          {showAdOption && (
            <View style={styles.adUnlockContainer}>
              <Text style={styles.lockedSubMessage}>You don't have enough SMP. Watch an ad to unlock for free!</Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.adUnlockButton]}
                onPress={handleAdBasedUnlock}
                disabled={isProcessing || hasUsedAdUnlockToday}
              >
                <FontAwesome5 name="video" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
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
          
          {/* Benefactor subscription option */}
          {showBenefactorOption && !benefactorAccess && (
            <View style={styles.benefactorContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.benefactorButton]}
                onPress={() => setShowBenefactorModal(true)}
                disabled={isProcessing}
              >
                <FontAwesome5 name="crown" size={16} color={KA_COLORS.gold} style={styles.buttonIcon} />
                <Text style={styles.actionButtonText}>Subscribe to Writer</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Benefactor status */}
          {benefactorAccess && (
            <View style={styles.benefactorStatus}>
              <FontAwesome5 name="star" size={16} color={KA_COLORS.gold} style={styles.buttonIcon} />
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
          {/* Audio controls */}
          <View style={styles.audioControls}>
            <TouchableOpacity style={styles.audioButton} onPress={readText} disabled={isSpeaking}>
              <FontAwesome5 name="volume-up" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
              <Text style={styles.audioButtonText}>Read Aloud</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.audioButton} onPress={pauseText} disabled={!isSpeaking || isPaused}>
              <FontAwesome5 name="pause" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
              <Text style={styles.audioButtonText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.audioButton} onPress={resumeText} disabled={!isSpeaking || !isPaused}>
              <FontAwesome5 name="play" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
              <Text style={styles.audioButtonText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.audioButton} onPress={stopText} disabled={!isSpeaking}>
              <FontAwesome5 name="stop" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
              <Text style={styles.audioButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
          
          {/* Chapter selector */}
          <View style={styles.chapterSelector}>
            <TouchableOpacity style={styles.chapterSelectorButton} onPress={() => setShowChapterSelector(true)}>
              <FontAwesome5 name="book-open" size={16} color={KA_COLORS.ivory} style={styles.buttonIcon} />
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
                        color={star <= (userRating || 0) ? KA_COLORS.goldBright : KA_COLORS.textMuted}
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
                      color={star <= Math.round(averageRating || 0) ? KA_COLORS.goldBright : KA_COLORS.textMuted}
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
              <FontAwesome5 name="times" size={20} color={KA_COLORS.ivory} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Watch Ad to Unlock</Text>
            <Text style={styles.modalSubtitle}>Please watch the ad to unlock this chapter for free</Text>
            <Video
              ref={videoRef}
          source={{ uri: AD_VIDEO_URI }}
          style={styles.video}
          useNativeControls
n          resizeMode="contain"
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
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowBenefactorModal(false)}
            >
              <FontAwesome5 name="times" size={20} color={KA_COLORS.ivory} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Subscribe to Writer</Text>
            <Text style={styles.modalSubtitle}>Choose a subscription plan</Text>
            
            <View style={styles.benefactorPlans}>
              {[
                { id: 'blue', price: 0.1, chapters: 3, name: 'Blue', color: KA_COLORS.textSecondary },
                { id: 'iron', price: 2, chapters: 6, name: 'Iron', color: '#808080' },
                { id: 'silver', price: 3, chapters: 10, name: 'Silver', color: '#C0C0C0' },
                { id: 'gold', price: 5, chapters: 999, name: 'Gold', color: KA_COLORS.gold },
              ].map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.benefactorPlan, { borderColor: plan.color }]}
                  onPress={() => handleBenefactorUnlock({ ...plan, selectedToken: 'USDC' })}
                  disabled={isProcessing}
                >
                  <FontAwesome5 name="crown" size={24} color={plan.color} style={styles.benefactorPlanIcon} />
                  <Text style={[styles.benefactorPlanName, { color: plan.color }]}>{plan.name}</Text>
                  <Text style={styles.benefactorPlanPrice}>${plan.price}</Text>
                  <Text style={styles.benefactorPlanChapters}>
                    {plan.chapters === 999 ? 'Unlimited' : `${plan.chapters} chapters`}
                  </Text>
                  <Text style={styles.benefactorPlanDuration}>
                    {plan.chapters === 999 ? '30 days' : '14 days'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
              <FontAwesome5 name="times" size={20} color={KA_COLORS.ivory} />
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