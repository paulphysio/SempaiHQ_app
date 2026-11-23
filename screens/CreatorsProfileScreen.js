import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Linking, ActivityIndicator, Animated, Easing, TextInput, RefreshControl, Clipboard, Share } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GelModal, GelInput, GelChips } from '../components/gel/GelKit';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase, FUNCTIONS_URL } from '../services/supabaseClient';
import { safeFetch } from '../utils/urlValidation';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { getProfileStyles, getProfileMangaStyles, getProfilePalette, INK } from '../styles/ProfileStyles';
import pioneerBadgeImg from '../assets/badges/pioneer.webp';
import seekerBadgeImg from '../assets/badges/seeker.webp';
import { getUserReadingTime, formatReadingTime } from '../hooks/useReadingTimer';
import { logMoneyEvent } from '../services/moneyFeed';
import { getReaderRank, buildTwitterUrl, buildWebsiteUrl } from './ProfileScreen';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferInstruction, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import { readerAction } from '../services/readerActions';
import {
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
  RPC_URL,
  USDC_DECIMALS,
  SKR_DECIMALS,
} from '../constants';
import {
  useReduceMotion,
  PressScale,
  StaggerIn,
  MangaPanel,
  Halftone,
  SpeedLines,
  SakuraField,
  CountUp,
  SfxText,
  SlashBanner,
  ShineSweep,
  InkBar,
  SpeechBubble,
  InkButton,
} from '../components/MangaUI';
import { toast } from '../components/Toast';

import { gelAlert } from '../components/gel/GelAlert';
const connection = new Connection(RPC_URL, 'confirmed');

const EMPTY_STATS = { total_seconds: 0, total_chapters: 0, total_novels: 0, last_read_at: null };

const CreatorsProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  // Accept both param names: some callers passed { userId } and got an empty profile.
  const { id: idParam, userId: userIdParam } = route.params || {};
  const id = idParam || userIdParam;
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const signAndSendTransaction = walletContext?.signAndSendTransaction;
  const isWalletConnected = !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();
  const { isDark, colors } = useTheme();
  const palette = useMemo(() => getProfilePalette(isDark), [isDark]);
  const styles = useMemo(() => getProfileMangaStyles(isDark), [isDark]);
  const themedStyles = useMemo(() => getProfileStyles(isDark), [isDark]); // modals only
  const reduceMotion = useReduceMotion();

  const [creatorData, setCreatorData] = useState(null);
  const [novels, setNovels] = useState([]);
  const [userBadges, setUserBadges] = useState([]);
  const [readingStats, setReadingStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isWriter, setIsWriter] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isBenefactor, setIsBenefactor] = useState(false);
  const [benefactorLevel, setBenefactorLevel] = useState(null);
  const [isPioneer, setIsPioneer] = useState(false);
  const [isSeeker, setIsSeeker] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBadgePurchaseModal, setShowBadgePurchaseModal] = useState(false);
  const [writerBadges, setWriterBadges] = useState([]);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USDC');
  const [isProcessingBadgePurchase, setIsProcessingBadgePurchase] = useState(false);
  const [solPrice, setSolPrice] = useState(0);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [tipCurrency, setTipCurrency] = useState('SOL');
  const [tipSending, setTipSending] = useState(false);
  const [seekerEarned, setSeekerEarned] = useState(false);
  const [canMessageCreator, setCanMessageCreator] = useState(null); // null = checking

  const reqRef = useRef(0);
  const copiedTimer = useRef(null);

  // Avatar ring animations (same as ProfileScreen)
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const sunPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const p = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    const sun = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulse, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sunPulse, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    p.start();
    s.start();
    sun.start();
    return () => {
      p.stop();
      s.stop();
      sun.stop();
    };
  }, [reduceMotion]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const getBadgeImage = (badge) => {
    if (badge.image_url && badge.image_url !== 'local') {
      return { uri: badge.image_url };
    }
    const type = badge.type?.toLowerCase();
    if (type === 'gold') return require('../assets/plan-image/Gold.png');
    if (type === 'silver') return require('../assets/plan-image/Sliver.png');
    if (type === 'blue') return require('../assets/plan-image/Blue.png');
    if (type === 'iron') return require('../assets/plan-image/Black.png');
    return require('../assets/plan-image/Blue.png');
  };

  const getBenefactorBadgeImage = () => {
    if (!isBenefactor) return null;
    const level = benefactorLevel?.toLowerCase();
    if (level === 'gold') return require('../assets/plan-image/Gold.png');
    if (level === 'silver') return require('../assets/plan-image/Sliver.png');
    if (level === 'blue') return require('../assets/plan-image/Blue.png');
    return require('../assets/plan-image/Black.png');
  };

  // Fetch live SOL price
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112');
        const data = await response.json();
        if (data?.data?.['So11111111111111111111111111111111111111112']?.price) {
          setSolPrice(data.data['So11111111111111111111111111111111111111112'].price);
        }
      } catch (error) {
        console.error('[CreatorsProfileScreen] Error fetching SOL price:', error);
        setSolPrice(150);
      }
    };
    fetchSolPrice();
  }, []);

  const fetchWriterBadges = useCallback(async () => {
    if (!id) return;
    try {
      const { data: badgesData, error: badgesError } = await supabase
        .from('badges')
        .select('*')
        .eq('writer_id', id)
        .order('price', { ascending: true });

      if (badgesError) throw badgesError;

      if (!badgesData || badgesData.length === 0) {
        setWriterBadges([
          { id: 'default-blue', name: 'Blue Badge', description: 'Unlock 3 chapters', price: 1, type: 'blue', image_url: 'local', writer_id: id },
          { id: 'default-iron', name: 'Iron Badge', description: 'Unlock 6 chapters', price: 2, type: 'iron', image_url: 'local', writer_id: id },
          { id: 'default-silver', name: 'Silver Badge', description: 'Unlock 10 chapters', price: 3, type: 'silver', image_url: 'local', writer_id: id },
          { id: 'default-gold', name: 'Gold Badge', description: 'Unlock all chapters', price: 5, type: 'gold', image_url: 'local', writer_id: id },
        ]);
      } else {
        setWriterBadges(badgesData);
      }
    } catch (error) {
      console.error('[CreatorsProfileScreen] Error fetching writer badges:', error);
    }
  }, [id]);

  const fetchProfileDetails = useCallback(async ({ silent = false } = {}) => {
    const req = ++reqRef.current;
    const alive = () => req === reqRef.current;

    if (!id) {
      setError('No profile ID provided. Please select a profile.');
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');

    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, isWriter, isArtist, isSuperuser, name, wallet_address, image, is_benefactor, benefactor_level')
        .eq('id', id)
        .single();

      if (userError || !user) throw new Error(`User not found: ${userError?.message || 'No user data'}`);
      if (!alive()) return;

      const [badgesRes, profileRes, novelsRes, readingRes] = await Promise.all([
        supabase.from('user_badges').select('*, badges(*)').eq('user_id', user.id),
        supabase.from('writer_profiles').select('bio, twitter, discord, website').eq('user_id', user.id).maybeSingle(),
        supabase.from('novels').select('id, title, image, summary').eq('user_id', user.id).eq('is_visible', true),
        Promise.resolve(getUserReadingTime(user.id)).catch(() => null),
      ]);
      if (!alive()) return;

      const badgeRows = Array.isArray(badgesRes?.data) ? badgesRes.data : [];
      const normalised = badgeRows
        .filter((b) => b?.badges)
        .map((b) => ({
          id: b.id || b.badge_id,
          name: b.badges.name || 'Badge',
          type: b.badges.type || null,
          image_url: b.badges.image_url || null,
          acquired_at: b.acquired_at || null,
        }))
        .sort((a, b) => new Date(b.acquired_at || 0) - new Date(a.acquired_at || 0));

      setIsWriter(!!user.isWriter);
      setIsArtist(!!user.isArtist);
      setIsSuperuser(!!user.isSuperuser);
      setIsBenefactor(!!user.is_benefactor);
      setBenefactorLevel(user.benefactor_level || null);
      setIsPioneer(normalised.some((b) => b.type === 'pioneer'));
        setIsSeeker(normalised.some((b) => b.type === 'seeker'));
      setUserBadges(normalised);
      setReadingStats(readingRes ? { ...EMPTY_STATS, ...readingRes } : EMPTY_STATS);
      setIsOwnProfile(!!activeWalletAddress && activeWalletAddress === user.wallet_address);
      setAvatarFailed(false);
      setCreatorData({ ...user, ...(profileRes?.data || {}) });
      setNovels(Array.isArray(novelsRes?.data) ? novelsRes.data : []);
    } catch (err) {
      if (alive()) setError(err?.message || 'Something went wrong.');
    } finally {
      if (alive()) setLoading(false);
    }
  }, [id, activeWalletAddress]);

  useEffect(() => {
    fetchProfileDetails();
    fetchWriterBadges();
    return () => {
      reqRef.current += 1;
    };
  }, [fetchProfileDetails, fetchWriterBadges]);

  // Messaging is subscribers-only: an active (unexpired) writer_subscriptions
  // row for this creator + the viewer's wallet. Profile stays public for all.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id || !activeWalletAddress) {
        if (alive) setCanMessageCreator(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('writer_subscriptions')
          .select('id')
          .eq('writer_id', id)
          .eq('benefactor_wallet', activeWalletAddress)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .limit(1);
        if (error) throw error;
        if (alive) setCanMessageCreator(!!data?.length);
      } catch (err) {
        console.warn('[CreatorsProfileScreen] subscription check failed:', err?.message);
        if (alive) setCanMessageCreator(false);
      }
    })();
    return () => { alive = false; };
  }, [id, activeWalletAddress]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfileDetails({ silent: true });
    fetchWriterBadges();
    setRefreshing(false);
  }, [fetchProfileDetails, fetchWriterBadges]);

  const getDashboardButtonProps = () => {
    if (isSuperuser || (isWriter && isArtist)) {
      return {
        text: 'Dashboard',
        action: () =>
          gelAlert('Choose Dashboard', '', [
            { text: 'Novel', onPress: () => navigation.navigate('NovelDashboard') },
            { text: 'Manga', onPress: () => navigation.navigate('MangaDashboard') },
            { text: 'Cancel', style: 'cancel' },
          ]),
      };
    } else if (isWriter) {
      return { text: 'Novel Dashboard', action: () => navigation.navigate('NovelDashboard') };
    } else if (isArtist) {
      return { text: 'Manga Dashboard', action: () => navigation.navigate('MangaDashboard') };
    }
    return { text: 'Apply', action: () => navigation.navigate('Apply') };
  };
  const dashboardButton = getDashboardButtonProps();

  const openUrl = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => toast.error(`Could not open link — ${url}`));
  };

  const copyWallet = async () => {
    const addr = creatorData?.wallet_address;
    if (!addr) return;
    try {
      Clipboard.setString(addr);
    } catch (e) {
      try {
        await Share.share({ message: addr });
      } catch (e2) {
        return;
      }
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  const handleSendMessage = async () => {
    if (canMessageCreator === false) {
      toast.info(`Subscribers only — ${`Buy ${creatorData?.name || 'this creator'}'s badge to send them a message.`}`);
      return;
    }
    if (!messageText.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (!isWalletConnected) {
      toast.error('Please connect your wallet to send messages');
      return;
    }

    setIsSendingMessage(true);
    try {
      const { error } = await supabase
        .from('private_messages')
        .insert({
          sender_wallet: activeWalletAddress,
          recipient_wallet: creatorData.wallet_address,
          content: messageText.trim(),
          status: 'sent',
        });

      if (error) throw error;

      toast.success('Message sent successfully!');
      setMessageText('');
      setShowMessageModal(false);
    } catch (error) {
      console.error('[CreatorsProfileScreen] Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleTip = async () => {
    const amount = parseFloat(tipAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Invalid amount — Enter a tip amount greater than 0.');
      return;
    }
    if (amount > 100000) {
      toast.error('Amount too large — Please keep tips under 100,000.');
      return;
    }
    if (!creatorData?.wallet_address) {
      toast.info('Unavailable — This creator has no wallet address to receive tips.');
      return;
    }
    if (!isWalletConnected || !wallet?.publicKey || !signAndSendTransaction) {
      toast.error('Wallet required — Please connect your wallet to send a tip.');
      return;
    }

    // Seeker: a creator without an SKR account gets one opened by this tip.
    let opensSkrAccount = false;
    if (tipCurrency === 'SKR') {
      try {
        const ata = getAssociatedTokenAddressSync(new PublicKey(SKR_MINT_ADDRESS), new PublicKey(creatorData.wallet_address), true);
        opensSkrAccount = !(await connection.getAccountInfo(ata));
      } catch { /* checked again when sending */ }
    }
    const who = creatorData?.name || 'this creator';
    gelAlert(
      opensSkrAccount ? 'Open their SKR account' : 'Confirm tip',
      opensSkrAccount
        ? `${who} doesn't have an SKR account yet. Your tip of ${amount} SKR will open one for them (about 0.002 SOL network fee), and you'll earn the Seeker badge.`
        : `Send ${amount} ${tipCurrency} to ${who}?\n\nThis will prompt your wallet to sign the transaction.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, send tip', onPress: () => { void sendTip(amount); } },
      ]
    );
  };

  const sendTip = async (amount) => {
    setTipSending(true);
    try {
      const activePublicKey = wallet.publicKey;
      const creatorWallet = creatorData.wallet_address;
      const creatorPublicKey = new PublicKey(creatorWallet);
      const instructions = [];
      let baseUnits;
      let openedSkrAccount = false;

      if (tipCurrency === 'SOL') {
        baseUnits = Math.floor(amount * 1e9);
        if (baseUnits <= 0) throw new Error('Amount too small.');
        const solBalance = await connection.getBalance(activePublicKey);
        const required = baseUnits + 10000;
        if (solBalance < required) {
          throw new Error(`Insufficient SOL. You have ${(solBalance / 1e9).toFixed(4)} SOL.`);
        }
        instructions.push(
          SystemProgram.transfer({ fromPubkey: activePublicKey, toPubkey: creatorPublicKey, lamports: baseUnits })
        );
      } else {
        const mint = new PublicKey(tipCurrency === 'USDC' ? USDC_MINT_ADDRESS : SKR_MINT_ADDRESS);
        const decimals = tipCurrency === 'USDC' ? USDC_DECIMALS : SKR_DECIMALS;
        baseUnits = Math.floor(amount * 10 ** decimals);
        if (baseUnits <= 0) throw new Error('Amount too small.');
        const userAta = getAssociatedTokenAddressSync(mint, activePublicKey);
        const creatorAta = getAssociatedTokenAddressSync(mint, creatorPublicKey, true);
        const ataInfo = await connection.getAccountInfo(userAta);
        if (!ataInfo) throw new Error(`No ${tipCurrency} account found in your wallet.`);
        const tokenBalance = Number(ataInfo.data.readBigUInt64LE(64));
        if (tokenBalance < baseUnits) {
          throw new Error(`Insufficient ${tipCurrency}. You have ${(tokenBalance / 10 ** decimals).toFixed(2)}.`);
        }
        // Creators who've never held this token have no account for it yet:
        // the tip opens it (the tipper pays the small rent).
        const creatorAtaInfo = await connection.getAccountInfo(creatorAta);
        if (!creatorAtaInfo) {
          const ATA_RENT_LAMPORTS = 2039280;
          const solBalance = await connection.getBalance(activePublicKey);
          if (solBalance < ATA_RENT_LAMPORTS + 10000) {
            throw new Error(`${creatorData?.name || 'This creator'} needs a ${tipCurrency} account first — add about 0.003 SOL to your wallet to open it with your tip.`);
          }
          instructions.push(createAssociatedTokenAccountIdempotentInstruction(activePublicKey, creatorAta, creatorPublicKey, mint));
          if (tipCurrency === 'SKR') openedSkrAccount = true;
        }
        instructions.push(createTransferInstruction(userAta, creatorAta, activePublicKey, baseUnits));
      }

      const transaction = new Transaction();
      transaction.add(...instructions);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = activePublicKey;

      const signature = await signAndSendTransaction(transaction);

      let confirmation;
      let retries = 0;
      while (retries < 3) {
        try {
          confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
          break;
        } catch (e) {
          retries++;
          if (retries >= 3) throw new Error('Transaction confirmation failed');
          await new Promise((r) => setTimeout(r, 1000 * retries));
        }
      }
      if (confirmation?.value?.err) throw new Error('Transaction failed on-chain.');

      logMoneyEvent({
        event_type: 'creator_tip',
        direction: 'out',
        asset: tipCurrency,
        amount,
        usd_value: tipCurrency === 'SOL' ? amount * (solPrice || 0) : amount,
        wallet: activeWalletAddress,
        counterparty: creatorWallet,
        title: `Tip ${creatorData?.name || 'creator'} ${amount} ${tipCurrency}`,
        tx_sig: signature,
        meta: { creator_id: id, currency: tipCurrency },
      });

      // Record the tip (non-fatal if it fails — the transfer already landed).
      try {
        const { data: tipper } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', activeWalletAddress)
          .maybeSingle();
        await supabase.from('creator_tips').insert({
          creator_id: id,
          tipper_id: tipper?.id || null,
          tipper_wallet: activeWalletAddress,
          creator_wallet: creatorWallet,
          currency: tipCurrency,
          amount,
          tx_signature: signature,
        });
      } catch (recordErr) {
        console.warn('[CreatorsProfileScreen] tip record failed:', recordErr?.message);
      }

      // Seeker badge: the server checks on-chain that this tip opened the
      // creator's SKR account, then awards it (retry once — the RPC may lag).
      if (openedSkrAccount) {
        let res = await readerAction('seeker_badge', { signature, creatorWallet });
        if (!res.ok && /not found/i.test(res.error || '')) {
          await new Promise((r) => setTimeout(r, 2500));
          res = await readerAction('seeker_badge', { signature, creatorWallet });
        }
        if (res.ok && res.granted) setSeekerEarned(true);
        else if (!res.ok) console.warn('[CreatorsProfileScreen] seeker badge:', res.error);
      }

      toast.info(`Tip sent — ${`Thank you for supporting ${creatorData?.name || 'the creator'}!`}`);
      setShowTipModal(false);
      setTipAmount('');
      setTipCurrency('SOL');
    } catch (error) {
      console.error('[CreatorsProfileScreen] Tip error:', error.message);
      toast.error(`Tip failed — ${error.message || 'Something went wrong.'}`);
    } finally {
      setTipSending(false);
    }
  };

  const handleBadgePurchase = useCallback(async () => {
    if (!selectedBadge) {
      toast.error('Please select a badge');
      return;
    }

    if (!wallet || !wallet.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!signAndSendTransaction) {
      toast.error('Wallet not ready for transactions. Please reconnect.');
      return;
    }

    setIsProcessingBadgePurchase(true);

    try {
      const badgePrice = selectedBadge.price || 0;
      let paymentAmount = 0;
      let paymentMint = null;

      if (selectedCurrency === 'USDC') {
        paymentMint = new PublicKey(USDC_MINT_ADDRESS);
        paymentAmount = Math.floor(badgePrice * 1e6);
      } else if (selectedCurrency === 'SOL') {
        const currentSolPrice = solPrice || 150;
        paymentAmount = Math.floor((badgePrice / currentSolPrice) * 1e9);
      } else if (selectedCurrency === 'SKR') {
        paymentMint = new PublicKey(SKR_MINT_ADDRESS);
        paymentAmount = Math.floor(badgePrice * 1e6);
      } else {
        throw new Error('Invalid currency');
      }

      if (!paymentMint) {
        const solBalance = await connection.getBalance(wallet.publicKey);
        const requiredLamports = paymentAmount + 10000;
        if (solBalance < requiredLamports) {
          throw new Error(`Insufficient SOL balance. You have ${(solBalance / 1e9).toFixed(4)} SOL but need ${(requiredLamports / 1e9).toFixed(4)} SOL. Please use USDC or SKR instead.`);
        }
      } else {
        try {
          const userAta = getAssociatedTokenAddressSync(paymentMint, wallet.publicKey);
          const ataInfo = await connection.getAccountInfo(userAta);
          if (!ataInfo) {
            throw new Error(`No ${selectedCurrency} account found. Please use SOL instead.`);
          }
          const tokenBalance = Number(ataInfo.data.readBigUInt64LE(64));
          const decimals = selectedCurrency === 'USDC' ? USDC_DECIMALS : SKR_DECIMALS;
          const tokenBalanceFormatted = tokenBalance / (10 ** decimals);
          if (tokenBalance < paymentAmount) {
            throw new Error(`Insufficient ${selectedCurrency} balance. You have ${tokenBalanceFormatted.toFixed(2)} but need ${(paymentAmount / (10 ** decimals)).toFixed(2)}.`);
          }
        } catch (balanceError) {
          console.error('[CreatorsProfileScreen] Token balance check failed:', balanceError);
          if (balanceError.message.includes('No') || balanceError.message.includes('Insufficient')) {
            throw balanceError;
          }
          throw new Error(`Failed to check ${selectedCurrency} balance. Please try SOL instead.`);
        }
      }

      const instructions = [];
      const activePublicKey = wallet.publicKey;

      if (!paymentMint) {
        const treasuryWallet = new PublicKey('71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD');
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: activePublicKey,
            toPubkey: treasuryWallet,
            lamports: paymentAmount,
          })
        );
      } else {
        const userAta = getAssociatedTokenAddressSync(paymentMint, activePublicKey);
        const treasuryWallet = new PublicKey('71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD');
        const treasuryAta = getAssociatedTokenAddressSync(paymentMint, treasuryWallet, true);

        instructions.push(
          createTransferInstruction(userAta, treasuryAta, activePublicKey, paymentAmount)
        );
      }

      const transaction = new Transaction();
      transaction.add(...instructions);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = activePublicKey;

      const signature = await signAndSendTransaction(transaction);

      let retryCount = 0;
      const maxRetries = 3;
      let confirmation;

      while (retryCount < maxRetries) {
        try {
          confirmation = await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed'
          );
          break;
        } catch (confirmError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error('Transaction confirmation failed');
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (confirmation.value.err) {
        const errorString = JSON.stringify(confirmation.value.err);
        if (errorString.includes('insufficient') || errorString.includes('lamports')) {
          throw new Error('Insufficient balance. Please check your wallet balance and try again.');
        }
        throw new Error('Transaction failed on blockchain');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const planType = selectedBadge.type || 'blue';

      const response = await safeFetch(`${FUNCTIONS_URL}/benefactor-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          writerId: id,
          badgeId: selectedBadge.id,
          planType,
          signature,
          userPublicKey: activeWalletAddress,
          currency: selectedCurrency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[CreatorsProfileScreen] Edge function error:', data.error);
        throw new Error(data.error || 'Failed to record purchase');
      }

      toast.success('Badge purchased successfully!');
      setShowBadgePurchaseModal(false);
      setSelectedBadge(null);
      await fetchWriterBadges();

    } catch (error) {
      console.error('[CreatorsProfileScreen] Purchase error:', error.message);
      toast.error(error.message || 'Purchase failed. Please try again.');
    } finally {
      setIsProcessingBadgePurchase(false);
    }
  }, [selectedBadge, selectedCurrency, wallet, signAndSendTransaction, id, activeWalletAddress, solPrice, fetchWriterBadges]);

  // ------------------------------------------------------------------ derived
  const displayName = creatorData?.name || creatorData?.wallet_address?.slice(0, 8) || 'Unknown';
  const shortWallet = creatorData?.wallet_address
    ? `${creatorData.wallet_address.slice(0, 6)}...${creatorData.wallet_address.slice(-4)}`
    : '';
  const rank = useMemo(() => getReaderRank(readingStats.total_seconds), [readingStats.total_seconds]);
  const benefactorImg = getBenefactorBadgeImage();
  const twitterUrl = buildTwitterUrl(creatorData?.twitter);
  const websiteUrl = buildWebsiteUrl(creatorData?.website);
  const hasSocials = !!(creatorData?.twitter || creatorData?.discord || creatorData?.website);
  const bottomPad = Math.max(insets?.bottom || 0, 8) + 12 + 68 + 28;

  const roleChips = [
    isSuperuser && { key: 'admin', label: 'ADMIN', icon: 'shield-alt', color: palette.error },
    isWriter && { key: 'writer', label: 'WRITER', icon: 'pen-nib', color: palette.accent },
    isArtist && { key: 'artist', label: 'ARTIST', icon: 'palette', color: palette.gold },
    isBenefactor && {
      key: 'benefactor',
      label: `${(benefactorLevel || 'benefactor').toString().toUpperCase()}`,
      icon: 'crown',
      color: palette.goldBright,
    },
  ].filter(Boolean);

  const iconBox = (name, color, brand) => <FontAwesome5 name={name} size={18} color={color} brand={brand} />;

  // ------------------------------------------------------------------ panels
  const renderHero = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <SpeedLines color={palette.accent} reduceMotion={reduceMotion} />
      <Halftone color={palette.accent} corner="tr" />
      <Halftone color={palette.gold} corner="bl" rows={4} cols={6} />
      {isOwnProfile ? (
        <View style={styles.ownTag}>
          <Text style={styles.ownTagText}>YOU</Text>
        </View>
      ) : null}
      <SfxText
        color={palette.accentBright}
        outline={isDark ? palette.bg : palette.textPrimary}
        size={26}
        tilt={-10}
        reduceMotion={reduceMotion}
        style={{ top: 10, left: 14 }}
      >
        ドン!
      </SfxText>

      <View style={styles.heroBody}>
        <View style={styles.avatarWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.avatarPulse,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.22] }) }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.avatarDashed,
              { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
            ]}
          />
          <View style={styles.avatarCore}>
            {creatorData?.image && !avatarFailed ? (
              <Image source={{ uri: creatorData.image }} style={styles.avatarImg} onError={() => setAvatarFailed(true)} accessibilityLabel="Profile picture" />
            ) : (
              <Text style={styles.avatarInitial}>{String(displayName).charAt(0).toUpperCase()}</Text>
            )}
          </View>
        </View>

        <View style={styles.nameRow}>
          <View style={styles.namePlate}>
            <Text style={styles.nameText} numberOfLines={1}>
              {displayName}
            </Text>
            <ShineSweep color={palette.textOnAccent} reduceMotion={reduceMotion} />
          </View>
          {isPioneer ? <Image source={pioneerBadgeImg} style={styles.nameBadge} accessibilityLabel="Pioneer badge" /> : null}
          {isSeeker ? <Image source={seekerBadgeImg} style={styles.nameBadge} accessibilityLabel="Seeker badge" /> : null}
          {benefactorImg ? <Image source={benefactorImg} style={styles.nameBadge} accessibilityLabel="Benefactor badge" /> : null}
        </View>

        {roleChips.length > 0 ? (
          <View style={styles.chipRow}>
            {roleChips.map((r) => (
              <View key={r.key} style={[styles.chip, { backgroundColor: palette.bgElevated }]}>
                <View style={styles.chipInner}>
                  <FontAwesome5 name={r.icon} size={11} color={r.color} />
                  <Text style={[styles.chipText, { color: r.color }]}>{r.label}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <SpeechBubble palette={palette}>
          <Text style={styles.bioText}>{creatorData?.bio || 'No bio provided.'}</Text>
        </SpeechBubble>

        {!isOwnProfile && isWalletConnected && (
          <View style={styles.actionsRow}>
            <View style={styles.actionCell}>
              <InkButton
                label={canMessageCreator === false ? 'MESSAGE 🔒' : 'MESSAGE'}
                palette={palette}
                isDark={isDark}
                variant={canMessageCreator === false ? 'ghost' : 'primary'}
                icon={<FontAwesome5 name={canMessageCreator === false ? 'lock' : 'envelope'} size={14} color={canMessageCreator === false ? palette.textPrimary : palette.textOnAccent} />}
                onPress={() => {
                  if (canMessageCreator !== false) {
                    // straight into the conversation (history, photos, replies…)
                    if (creatorData?.id) navigation.navigate('Chat', { userId: creatorData.id });
                    else setShowMessageModal(true);
                  } else {
                    toast.info(`Subscribers only — ${`Buy ${creatorData?.name || 'this creator'}'s badge to unlock messaging.`}`);
                  }
                }}
              />
            </View>
            <View style={styles.actionCell}>
              <InkButton
                label="BUY BADGE"
                palette={palette}
                isDark={isDark}
                icon={<FontAwesome5 name="shopping-cart" size={14} color={palette.textOnAccent} />}
                onPress={() => setShowBadgePurchaseModal(true)}
              />
            </View>
          </View>
        )}

        {!isOwnProfile && isWalletConnected && (
          <View style={styles.actionsRow}>
            <View style={styles.actionCell}>
              <InkButton
                label={`TIP ${displayName.toUpperCase()}`}
                palette={palette}
                isDark={isDark}
                variant="ghost"
                icon={<FontAwesome5 name="gift" size={14} color={palette.goldBright} />}
                onPress={() => setShowTipModal(true)}
              />
            </View>
          </View>
        )}
      </View>
    </MangaPanel>
  );

  const renderStats = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="READING STATS" subtitle="読書記録" palette={palette} />
        <View style={styles.statsRow}>
          {[
            { key: 'time', icon: 'clock', color: palette.gold, value: readingStats.total_seconds, label: 'Total Time', fmt: formatReadingTime },
            { key: 'chapters', icon: 'book-open', color: palette.accent, value: readingStats.total_chapters, label: 'Chapters', fmt: (n) => String(n) },
            { key: 'novels', icon: 'layer-group', color: palette.success, value: readingStats.total_novels, label: 'Novels', fmt: (n) => String(n) },
          ].map((s) => (
            <View key={s.key} style={styles.statTile}>
              <View style={[styles.statTileTop, { backgroundColor: s.color }]} />
              <View style={styles.statIconWrap}>{iconBox(s.icon, s.color)}</View>
              <CountUp value={s.value} format={s.fmt} style={styles.statValue} reduceMotion={reduceMotion} />
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.rankBox}>
          <View style={styles.rankTop}>
            <View style={styles.rankLevel}>
              <Text style={styles.rankLevelLv}>LV</Text>
              <Text style={styles.rankLevelNum}>{rank.level}</Text>
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.rankTitle}>{rank.cur.title.toUpperCase()}</Text>
              <Text style={styles.rankJp}>{rank.cur.jp}</Text>
            </View>
          </View>
          <InkBar progress={rank.progress} palette={palette} reduceMotion={reduceMotion} />
          <Text style={styles.rankHint}>
            {rank.next ? `${formatReadingTime(rank.remaining)} more to become “${rank.next.title}”` : 'Maximum rank reached. A true legend.'}
          </Text>
        </View>

        {readingStats.last_read_at ? (
          <Text style={styles.lastRead}>Last read: {new Date(readingStats.last_read_at).toLocaleDateString()}</Text>
        ) : null}
      </View>
    </MangaPanel>
  );

  const renderBadges = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="BADGES" subtitle="称号" palette={palette} />
        {userBadges.length > 0 ? (
          <View style={styles.badgeGrid}>
            {userBadges.map((b, i) => (
              <StaggerIn key={b.id || i} index={i} base={500} step={70} from={14} reduceMotion={reduceMotion} style={styles.badgeCell}>
                <View style={[styles.badgeFrame, { transform: [{ rotate: i % 2 ? '4deg' : '-4deg' }] }]}>
                  {b.type === 'pioneer' || b.type === 'seeker' ? (
                    <Image source={b.type === 'seeker' ? seekerBadgeImg : pioneerBadgeImg} style={styles.badgeImg} />
                  ) : b.image_url ? (
                    <Image source={{ uri: b.image_url }} style={styles.badgeImg} />
                  ) : (
                    <FontAwesome5 name="medal" size={26} color={palette.gold} />
                  )}
                </View>
                <Text style={styles.badgeName} numberOfLines={2}>
                  {b.name}
                </Text>
              </StaggerIn>
            ))}
          </View>
        ) : (
          <Text style={styles.placeholder}>No badges earned yet.</Text>
        )}
      </View>
    </MangaPanel>
  );

  const renderCreations = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="CREATIONS" subtitle="作品" palette={palette} />
        {novels.length > 0 ? (
          <View style={styles.workGrid}>
            {novels.map((novel, i) => (
              <StaggerIn key={novel.id} index={i} base={450} step={90} from={20} reduceMotion={reduceMotion} style={styles.workCell}>
                <PressScale
                  onPress={() => navigation.navigate('NovelDetail', { id: novel.id })}
                  accessibilityLabel={`Open ${novel.title}`}
                  scaleTo={0.96}
                >
                  <View style={{ transform: [{ rotate: i % 2 ? '1.2deg' : '-1.2deg' }] }}>
                    <View style={styles.workCover}>
                      <View style={styles.workSpine} />
                      {novel.image ? (
                        <Image source={{ uri: novel.image }} style={styles.workImg} resizeMode="cover" />
                      ) : (
                        <View style={[styles.workImg, styles.workImgEmpty]}>
                          <FontAwesome5 name="book" size={30} color={palette.textMuted} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.workTitle} numberOfLines={2}>
                      {novel.title}
                    </Text>
                    {novel.summary ? (
                      <Text style={styles.workSummary} numberOfLines={2}>
                        {novel.summary}
                      </Text>
                    ) : null}
                  </View>
                </PressScale>
              </StaggerIn>
            ))}
          </View>
        ) : (
          <Text style={styles.placeholder}>No creations yet. Begin your journey.</Text>
        )}
      </View>
    </MangaPanel>
  );

  const renderConnect = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="CONNECT" subtitle="つながり" palette={palette} />
        {hasSocials ? (
          <View style={styles.socialRow}>
            {creatorData?.twitter ? (
              <PressScale onPress={() => openUrl(twitterUrl)} disabled={!twitterUrl} accessibilityLabel="Open Twitter profile">
                <View style={styles.socialChip}>
                  <FontAwesome5 name="twitter" size={16} color="#1DA1F2" brand />
                  <Text style={styles.socialText}>@{String(creatorData.twitter).replace(/^@/, '')}</Text>
                </View>
              </PressScale>
            ) : null}
            {creatorData?.discord ? (
              <View style={styles.socialChip}>
                <FontAwesome5 name="discord" size={16} color="#7289DA" brand />
                <Text style={styles.socialText}>{creatorData.discord}</Text>
              </View>
            ) : null}
            {creatorData?.website ? (
              <PressScale onPress={() => openUrl(websiteUrl)} disabled={!websiteUrl} accessibilityLabel="Open website">
                <View style={styles.socialChip}>
                  <FontAwesome5 name="globe" size={16} color={palette.accent} />
                  <Text style={styles.socialText}>Website</Text>
                </View>
              </PressScale>
            ) : null}
          </View>
        ) : (
          <Text style={styles.placeholder}>No social links added</Text>
        )}

        {shortWallet ? (
          <View style={styles.walletRow}>
            <View style={styles.walletLeft}>
              <FontAwesome5 name="wallet" size={14} color={palette.gold} />
              <Text style={styles.walletText} numberOfLines={1}>
                {shortWallet}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {copied ? <Text style={styles.copiedTag}>COPIED</Text> : null}
              <PressScale onPress={copyWallet} accessibilityLabel="Copy wallet address">
                <View style={styles.copyBtn}>
                  <FontAwesome5 name={copied ? 'check' : 'copy'} size={13} color={copied ? palette.success : palette.textPrimary} />
                </View>
              </PressScale>
            </View>
          </View>
        ) : null}
      </View>
    </MangaPanel>
  );

  const renderSettings = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="SETTINGS" subtitle="設定" palette={palette} />
        <View style={styles.actionsRow}>
          <View style={styles.actionCell}>
            <InkButton
              label="EDIT"
              palette={palette}
              isDark={isDark}
              icon={<FontAwesome5 name="edit" size={14} color={palette.textOnAccent} />}
              onPress={() => navigation.navigate('EditProfile')}
            />
          </View>
          <View style={styles.actionCell}>
            <InkButton
              label={dashboardButton.text.toUpperCase()}
              palette={palette}
              isDark={isDark}
              variant="ghost"
              icon={<FontAwesome5 name="rocket" size={14} color={palette.textPrimary} />}
              onPress={dashboardButton.action}
            />
          </View>
        </View>
      </View>
    </MangaPanel>
  );

  // ------------------------------------------------------------------ states
  const renderLoading = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>LOADING...</Text>
      </View>
    </MangaPanel>
  );

  const renderError = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.centerBox}>
        <View style={[styles.stateIconWrap, { borderColor: palette.error }]}>
          <FontAwesome5 name="exclamation-triangle" size={28} color={palette.error} />
        </View>
        <Text style={styles.errorText}>{error}</Text>
        <View style={{ marginTop: 20 }}>
          <InkButton
            label="TRY AGAIN"
            palette={palette}
            isDark={isDark}
            icon={<FontAwesome5 name="sync-alt" size={14} color={palette.textOnAccent} />}
            onPress={() => fetchProfileDetails()}
          />
        </View>
      </View>
    </MangaPanel>
  );

  const showProfile = !loading && !error && !!creatorData;

  let panels = [];
  if (loading) panels = [renderLoading()];
  else if (error) panels = [renderError()];
  else if (showProfile) {
    panels = [renderHero(), renderStats(), renderBadges(), renderCreations(), renderConnect()];
    if (isOwnProfile) panels.push(renderSettings());
  }

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sunDisc,
          { transform: [{ scale: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] },
        ]}
      />
      <View pointerEvents="none" style={styles.sunRing} />
      <SakuraField palette={palette} reduceMotion={reduceMotion} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} colors={[palette.accent]} />
        }
      >
        <StaggerIn index={0} base={0} reduceMotion={reduceMotion} from={-16}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>CREATOR PROFILE</Text>
            <View style={styles.titleSlashRow}>
              <View style={styles.titleSlash} />
              <View style={styles.titleSlashThin} />
            </View>
            <Text style={styles.subtitle}>武士道 • Bushido</Text>
          </View>
        </StaggerIn>

        {panels.map((panel, i) => (
          <StaggerIn key={`${loading ? 'l' : error ? 'e' : 'ok'}-${i}`} index={i + 1} reduceMotion={reduceMotion}>
            {panel}
          </StaggerIn>
        ))}
      </ScrollView>

      {/* buy this creator's badge */}
      <GelModal
        visible={showBadgePurchaseModal}
        onClose={() => setShowBadgePurchaseModal(false)}
        variant="sheet"
        icon="medal"
        title="Support with a badge"
        subtitle={`Back ${creatorData?.name || 'this creator'} and wear their badge.`}
        actions={writerBadges.length && selectedBadge
          ? [{ label: `Buy for $${selectedBadge.price || 0}`, icon: 'medal', loading: isProcessingBadgePurchase, onPress: handleBadgePurchase }]
          : writerBadges.length
          ? []
          : [{ label: 'Browse all badges', icon: 'th-large', onPress: () => { setShowBadgePurchaseModal(false); navigation.navigate('Badges'); } }]}
      >
        {writerBadges.length > 0 ? (
          <>
            <ScrollView style={{ maxHeight: 320, marginTop: 10 }} showsVerticalScrollIndicator={false}>
              {writerBadges.map((badge) => (
                <TouchableOpacity
                  key={badge.id}
                  style={[themedStyles.badgeOption, selectedBadge?.id === badge.id && themedStyles.badgeOptionSelected]}
                  onPress={() => setSelectedBadge(badge)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedBadge?.id === badge.id }}
                >
                  <Image source={getBadgeImage(badge)} style={themedStyles.badgeOptionImage} />
                  <View style={themedStyles.badgeOptionInfo}>
                    <Text style={themedStyles.badgeOptionName}>{badge.name}</Text>
                    <Text style={themedStyles.badgeOptionDescription}>{badge.description}</Text>
                    <Text style={themedStyles.badgeOptionPrice}>${badge.price || 0}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedBadge ? <GelChips options={['USDC', 'SOL', 'SKR']} value={selectedCurrency} onChange={setSelectedCurrency} /> : null}
          </>
        ) : (
          <Text style={[themedStyles.modalMessage, { textAlign: 'center', marginTop: 14 }]}>No badges for this creator yet.</Text>
        )}
      </GelModal>

      {/* private message */}
      <GelModal
        visible={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        variant="sheet"
        icon="envelope"
        title={`Message ${creatorData?.name || 'this creator'}`}
        subtitle="Only they can read it."
        actions={[{ label: 'Send', icon: 'paper-plane', loading: isSendingMessage, disabled: !messageText.trim(), onPress: handleSendMessage }]}
      >
        <GelInput multiline placeholder="Write your message…" value={messageText} onChangeText={setMessageText} />
      </GelModal>

      {/* Seeker badge earned */}
      <GelModal
        visible={seekerEarned}
        onClose={() => setSeekerEarned(false)}
        actions={[{ label: 'Nice!', icon: 'star', onPress: () => setSeekerEarned(false) }]}
      >
        <View style={{ alignItems: 'center' }}>
          <Image source={seekerBadgeImg} style={{ width: 84, height: 84, marginBottom: 12 }} accessibilityLabel="Seeker badge" />
          <Text style={[themedStyles.modalTitle, { textAlign: 'center' }]}>Seeker badge earned</Text>
          <Text style={[themedStyles.modalMessage, { textAlign: 'center', marginTop: 8 }]}>
            {`You opened ${creatorData?.name || 'this creator'}'s SKR account with your tip. Thanks for helping creators get paid in SKR!`}
          </Text>
        </View>
      </GelModal>

      {/* tip jar */}
      <GelModal
        visible={showTipModal}
        onClose={() => !tipSending && setShowTipModal(false)}
        dismissable={!tipSending}
        variant="sheet"
        icon="hand-holding-heart"
        tone={palette.gold}
        title="Tip jar"
        subtitle={`Send a tip to ${creatorData?.name || 'this creator'} — it goes straight to their wallet.`}
        actions={[{
          label: tipAmount ? `Send ${tipAmount} ${tipCurrency}` : 'Send tip',
          icon: 'paper-plane',
          loading: tipSending,
          disabled: !tipAmount,
          onPress: handleTip,
        }]}
      >
        <GelChips options={['SOL', 'USDC', 'SKR']} value={tipCurrency} onChange={setTipCurrency} disabled={tipSending} />
        <GelInput
          placeholder={tipCurrency === 'SOL' ? '0.05' : '5.00'}
          keyboardType="decimal-pad"
          value={tipAmount}
          onChangeText={setTipAmount}
          editable={!tipSending}
          hint={`${tipCurrency} → ${creatorData?.wallet_address ? `${creatorData.wallet_address.slice(0, 6)}…${creatorData.wallet_address.slice(-4)}` : 'creator wallet'}`}
          style={{ marginTop: 12 }}
        />
      </GelModal>
    </View>
  );
};

export default CreatorsProfileScreen;
