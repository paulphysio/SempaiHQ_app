import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
  Linking,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Connection, PublicKey, Transaction, SystemProgram, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  unpackAccount,
  getAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import Icon from 'react-native-vector-icons/FontAwesome5';
import * as Clipboard from 'expo-clipboard';
import { GelModal, GelInput, GelInset, GelGlass, GelButton } from '../components/gel/GelKit';
import GelOrb from '../components/nav/GelOrb';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import JupiterSwapWebView from '../components/JupiterSwapWebView';
import { AMETHYST_MINT_ADDRESS, SMP_MINT_ADDRESS, USDC_MINT_ADDRESS, SKR_MINT_ADDRESS, RPC_URL, WEB_API_BASE_URL } from '../constants';
import { AnimatedPressable, useCountUp, usePulse, useEntrance, useAnimatedVisibility, useStaggeredEntrance } from '../utils/animations';
import { logMoneyEvent } from '../services/moneyFeed';
import bs58 from 'bs58';
import { useTheme } from '../context/ThemeContext';
import { GelGate, GelPageHeader } from '../components/gel/GelGate';

const connection = new Connection(RPC_URL, 'confirmed');

// ---------------------------------------------------------------------------
// Token config
// ---------------------------------------------------------------------------
const TOKEN_MINTS = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  JUP: new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'),
  USDC: USDC_MINT_ADDRESS,
  AMETHYST: AMETHYST_MINT_ADDRESS,
  SMP: SMP_MINT_ADDRESS,
  SKR: SKR_MINT_ADDRESS,
};

const TOKEN_LOGOS = {
  SOL: require('../assets/images/sol-logo.png'),
  JUP: require('../assets/images/juplogo.png'),
  USDC: require('../assets/images/usdclogo.png'),
  AMETHYST: require('../assets/images/amethyst-logo.jpeg'),
  SMP: require('../assets/images/smp-logo.jpeg'),
  SKR: require('../assets/images/skr-logo.png'),
};

const TOKEN_NAMES = {
  SOL: 'Solana',
  JUP: 'Jupiter',
  USDC: 'USD Coin',
  AMETHYST: 'Amethyst',
  SMP: 'SMP',
  SKR: 'SKR',
};

const TOKEN_DECIMALS = {
  SOL: 9,
  JUP: 6,
  USDC: 6,
  AMETHYST: 6,
  SMP: 6,
  SKR: 6,
};

const PRICE_REFRESH_MS = 30000;
const SOL_SEND_FEE_RESERVE = 0.00001;
const PRICE_ENDPOINT = (ids) => `https://lite-api.jup.ag/price/v3?ids=${ids.join(',')}`;
const QUOTE_ENDPOINT = (inputMint, amountBaseUnits) =>
  `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${USDC_MINT_ADDRESS.toString()}&amount=${amountBaseUnits}&slippageBps=50`;

async function fetchQuoteDerivedPrice(mint, decimals) {
  try {
    const amount = Math.round(10 ** decimals);
    const res = await fetch(QUOTE_ENDPOINT(mint, amount));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.outAmount) return null;
    return Number(data.outAmount) / 10 ** 6;
  } catch (err) {
    console.error(`Quote fallback failed for ${mint}:`, err);
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
    if (data?.fallbackPrice) return 1 / data.fallbackPrice;
    return null;
  } catch (err) {
    console.error('[fetchSmpFallbackPrice] Error:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
const formatUsd = (value, opts = {}) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const { compact = false } = opts;
  if (compact && value >= 1000) {
    return `$${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)}`;
  }
  const digits = value !== 0 && value < 1 ? 4 : 2;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

const formatToken = (value, decimals = 4) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals });
};

const tokenAccountExists = async (mint, owner) => {
  try {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    await getAccount(connection, ata);
    return true;
  } catch (err) {
    if (err.name === 'TokenAccountNotFoundError') return false;
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Price hook
// ---------------------------------------------------------------------------
function useTokenPrices() {
  const [prices, setPrices] = useState({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState(null);

  const fetchPrices = useCallback(async () => {
    try {
      setPricesError(null);
      const ids = Object.values(TOKEN_MINTS).map((mint) => mint.toString());
      const res = await fetch(PRICE_ENDPOINT(ids));
      if (!res.ok) throw new Error(`Price API error: ${res.status}`);
      const json = await res.json();

      const usdcUsdPrice = json?.[USDC_MINT_ADDRESS.toString()]?.usdPrice;
      if (!usdcUsdPrice) throw new Error('USDC price missing from response');

      const next = {};
      for (const [key, mint] of Object.entries(TOKEN_MINTS)) {
        const entry = json?.[mint.toString()];
        next[key] = entry?.usdPrice ? entry.usdPrice / usdcUsdPrice : null;
      }

      const missing = Object.entries(next).filter(([key, price]) => key !== 'USDC' && !price);
      if (missing.length) {
        const fallbacks = await Promise.all(
          missing.map(([key]) => fetchQuoteDerivedPrice(TOKEN_MINTS[key].toString(), TOKEN_DECIMALS[key]))
        );
        missing.forEach(([key], i) => {
          if (fallbacks[i]) next[key] = fallbacks[i];
        });

        if (!next.SMP) {
          const webFallback = await fetchSmpFallbackPrice();
          if (webFallback) {
            next.SMP = webFallback;
            if (__DEV__) console.log('[useTokenPrices] Using web API fallback for SMP price');
          }
        }
      }

      setPrices(next);
    } catch (err) {
      console.error('Error fetching prices:', err);
      setPricesError('Live prices unavailable');
    } finally {
      setPricesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return { prices, pricesLoading, pricesError, refreshPrices: fetchPrices };
}

const SwapScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getSwapScreenStyles(colors, isDark), [isDark]);
  const { wallet, signAndSendTransaction, signTransactionOnly, setShowModal } = useContext(EmbeddedWalletContext);
  const isWalletConnected = !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();

  const { prices, pricesLoading, pricesError, refreshPrices } = useTokenPrices();

  const [amount, setAmount] = useState('');
  const [coinFrom, setCoinFrom] = useState('AMETHYST');
  const [coinTo, setCoinTo] = useState('SMP');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showRampSuggestion, setShowRampSuggestion] = useState(false);
  const [allBalances, setAllBalances] = useState({});
  const [showJupiterWebView, setShowJupiterWebView] = useState(false);
  const [jupiterSwapUrl, setJupiterSwapUrl] = useState('');
  const [jupiterPrefillAmount, setJupiterPrefillAmount] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendAddress, setSendAddress] = useState('');
  const [receiveAddress, setReceiveAddress] = useState('');

  const spinAnim = useRef(new Animated.Value(0)).current;
  const directionAnim = useRef(new Animated.Value(0)).current; // cumulative rotation
  const entranceStyle = useEntrance();
  const portfolioButtonAnims = useStaggeredEntrance(3, { delayStep: 70 });

  // Animated visibility for banners — keeps the last message visible while
  // it fades/slides out instead of yanking it off screen.
  const [displayedError, setDisplayedError] = useState(null);
  const [displayedSuccess, setDisplayedSuccess] = useState('');
  useEffect(() => { if (error) setDisplayedError(error); }, [error]);
  useEffect(() => { if (successMessage) setDisplayedSuccess(successMessage); }, [successMessage]);
  const errorVis = useAnimatedVisibility(!!error);
  const successVis = useAnimatedVisibility(!!successMessage);
  const priceWarnVis = useAnimatedVisibility(!!pricesError);

  const spinRefresh = () => {
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  };

  const spinStyle = {
    transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  };

  const directionStyle = {
    transform: [
      { rotate: directionAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
    ],
  };

  // -------------------------------------------------------------------------
  // Derived pricing values
  // -------------------------------------------------------------------------
  const priceFrom = prices[coinFrom];
  const priceTo = prices[coinTo];

  const inputUsdValue = useMemo(() => {
    const amt = parseFloat(amount);
    if (!amt || !priceFrom) return null;
    return amt * priceFrom;
  }, [amount, priceFrom]);

  const estimatedOutput = useMemo(() => {
    const amt = parseFloat(amount);
    if (!amt || !priceFrom || !priceTo) return null;
    return (amt * priceFrom) / priceTo;
  }, [amount, priceFrom, priceTo]);

  const exchangeRateLabel = useMemo(() => {
    if (!priceFrom || !priceTo) return null;
    return `1 ${coinFrom} ≈ ${formatToken(priceFrom / priceTo, 6)} ${coinTo}`;
  }, [priceFrom, priceTo, coinFrom, coinTo]);

  const portfolioUsdTotal = useMemo(() => {
    return Object.entries(allBalances).reduce((sum, [token, bal]) => {
      const p = prices[token];
      if (!p || !bal) return sum;
      return sum + bal * p;
    }, 0);
  }, [allBalances, prices]);

  const animatedPortfolioTotal = useCountUp(portfolioUsdTotal, { duration: 600 });
  const animatedBalance = useCountUp(balance, { duration: 450 });
  const maxSendableBalance = coinFrom === 'SOL' ? Math.max(0, balance - SOL_SEND_FEE_RESERVE) : balance;
  const formatSendAmount = (value) => value.toFixed(TOKEN_DECIMALS[coinFrom]).replace(/\.?0+$/, '');

  // -------------------------------------------------------------------------
  // Balance fetching
  // -------------------------------------------------------------------------
  const checkAllBalances = useCallback(async () => {
    if (!activeWalletAddress) {
      setAllBalances({});
      return;
    }
    try {
      const balances = {};
      for (const [tokenKey, mintAddress] of Object.entries(TOKEN_MINTS)) {
        let bal = 0;
        if (tokenKey === 'SOL') {
          const solBalance = await connection.getBalance(new PublicKey(activeWalletAddress));
          bal = solBalance / 1_000_000_000;
        } else {
          const ataAddress = getAssociatedTokenAddressSync(mintAddress, new PublicKey(activeWalletAddress));
          const ataInfo = await connection.getAccountInfo(ataAddress);
          if (ataInfo) {
            const ata = unpackAccount(ataAddress, ataInfo);
            bal = Number(ata.amount) / 10 ** TOKEN_DECIMALS[tokenKey];
          }
        }
        balances[tokenKey] = bal;
      }
      setAllBalances(balances);
    } catch (err) {
      console.error('Error fetching all balances:', err);
      setAllBalances({});
    }
  }, [activeWalletAddress]);

  const checkBalance = useCallback(async () => {
    if (!activeWalletAddress) {
      setBalance(0);
      return;
    }
    try {
      const mintAddress = TOKEN_MINTS[coinFrom];
      let bal = 0;
      if (coinFrom === 'SOL') {
        const solBalance = await connection.getBalance(new PublicKey(activeWalletAddress));
        bal = solBalance / 1_000_000_000;
      } else {
        const ataAddress = getAssociatedTokenAddressSync(mintAddress, new PublicKey(activeWalletAddress));
        const ataInfo = await connection.getAccountInfo(ataAddress);
        if (ataInfo) {
          const ata = unpackAccount(ataAddress, ataInfo);
          bal = Number(ata.amount) / 10 ** TOKEN_DECIMALS[coinFrom];
        }
      }
      setBalance(bal);
    } catch (err) {
      console.error('Error fetching balance:', err);
      setBalance(0);
    }
  }, [activeWalletAddress, coinFrom]);

  useEffect(() => {
    if (isWalletConnected) checkBalance();
  }, [isWalletConnected, activeWalletAddress, coinFrom, checkBalance]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleSwapDirection = () => {
    Animated.timing(directionAnim, {
      toValue: (directionAnim.__getValue ? directionAnim.__getValue() : 0) + 1,
      duration: 350,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();
    setCoinFrom(coinTo);
    setCoinTo(coinFrom);
    setAmount('');
  };

  const handleSend = async () => {
    if (!isWalletConnected) {
      setError('Please connect your wallet to send.');
      return;
    }

    const trimmedAddress = sendAddress.trim();
    const amountNumber = parseFloat(sendAmount);
    if (!sendAmount || !trimmedAddress || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError('Please enter a valid amount and recipient address');
      return;
    }

    let recipientPublicKey;
    try {
      recipientPublicKey = new PublicKey(trimmedAddress);
    } catch (_) {
      setError('Invalid recipient wallet address');
      return;
    }

    const maxSendable = coinFrom === 'SOL' ? maxSendableBalance : balance;
    if (amountNumber > maxSendable) {
      setError(
        coinFrom === 'SOL'
          ? `Insufficient SOL balance. Leave at least ${SOL_SEND_FEE_RESERVE} SOL for the network fee.`
          : `Insufficient ${coinFrom} balance`
      );
      return;
    }

    const sender = wallet.publicKey;
    const mint = TOKEN_MINTS[coinFrom];
    const rawAmount = coinFrom === 'SOL'
      ? Math.floor(amountNumber * LAMPORTS_PER_SOL)
      : Math.floor(amountNumber * 10 ** TOKEN_DECIMALS[coinFrom]);

    if (rawAmount <= 0) {
      setError('Amount is too small to send');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let transaction;
      if (coinFrom === 'SOL') {
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: sender,
            toPubkey: recipientPublicKey,
            lamports: rawAmount,
          })
        );
      } else {
        const senderATA = getAssociatedTokenAddressSync(mint, sender);
        const recipientATA = getAssociatedTokenAddressSync(mint, recipientPublicKey);
        const instructions = [];

        if (!(await tokenAccountExists(mint, sender))) {
          instructions.push(createAssociatedTokenAccountInstruction(sender, senderATA, sender, mint));
        }
        if (!(await tokenAccountExists(mint, recipientPublicKey))) {
          instructions.push(createAssociatedTokenAccountInstruction(sender, recipientATA, recipientPublicKey, mint));
        }
        instructions.push(createTransferInstruction(senderATA, recipientATA, sender, rawAmount));

        transaction = new Transaction().add(...instructions);
      }

      transaction.feePayer = sender;
      const signature = await signAndSendTransaction(transaction);

      logMoneyEvent({
        event_type: 'token_send',
        direction: 'out',
        asset: coinFrom,
        amount: amountNumber,
        wallet: activeWalletAddress,
        counterparty: trimmedAddress,
        title: `Send ${amountNumber} ${coinFrom}`,
        tx_sig: signature,
        meta: { to: trimmedAddress },
      });

      setSuccessMessage(`Sent ${amountNumber} ${coinFrom}. Signature: ${signature}`);
      setSendAmount('');
      setSendAddress('');
      setShowSendModal(false);
      await Promise.all([checkBalance(), checkAllBalances()]);
    } catch (err) {
      console.error('Error sending:', err);
      if (err?.message !== 'Password entry cancelled') {
        setError(`Send failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = () => {
    setReceiveAddress(activeWalletAddress);
    setShowReceiveModal(true);
  };

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!isWalletConnected) {
      setError('Please connect your wallet to swap.');
      return;
    }
    if (coinFrom === coinTo) {
      setError('Please select different tokens to swap.');
      return;
    }
    if (parseFloat(amount) > balance) {
      setShowRampSuggestion(true);
      return;
    }

    const inputMint = TOKEN_MINTS[coinFrom].toString();
    const outputMint = TOKEN_MINTS[coinTo].toString();
    setJupiterSwapUrl(`https://jup.ag/swap?inputMint=${inputMint}&outputMint=${outputMint}`);
    setJupiterPrefillAmount(amount);
    setShowJupiterWebView(true);
  };

  // Log a completed Jupiter swap signing to the DAO money feed. The signed tx's
  // first signature is the txid. Works for both signAndSendTransaction and
  // signTransaction flows — Jupiter may use either.
  const logJupiterSwap = (signedB64) => {
    try {
      console.log('[moneyFeed] jupiter swap signed, logging to feed…');
      // Versioned tx wire format: [sig-count (shortvec)] [64-byte sigs…] [message…].
      // signatures[] objects deserialize unreliably, so read the raw bytes directly.
      const raw = Buffer.from(signedB64, 'base64');
      const sigCount = raw[0]; // shortvec; <128 fits in one byte (always true here)
      if (!sigCount || sigCount > 8 || raw.length < 1 + sigCount * 64) {
        console.warn('[moneyFeed] jupiter swap: unexpected tx layout');
        return;
      }
      const sig = bs58.encode(raw.slice(1, 65)); // first signature = fee payer's = txid
      console.log('[moneyFeed] jupiter swap sig:', sig);
      logMoneyEvent({
        event_type: 'jupiter_swap',
        direction: 'swap',
        asset: coinFrom,
        amount: parseFloat(amount) || null,
        wallet: activeWalletAddress,
        title: `Swap ${coinFrom} → ${coinTo}`,
        detail: `${amount || '?'} ${coinFrom}`,
        tx_sig: sig,
        meta: { from: coinFrom, to: coinTo, amountIn: amount },
      });
    } catch (e) {
      console.warn('[moneyFeed] jupiter swap log failed:', e?.message);
    }
  };

  // -------------------------------------------------------------------------
  // Small reusable bits
  // -------------------------------------------------------------------------
  const PriceTag = ({ token, size = 'sm' }) => {
    const pulse = usePulse();
    if (pricesLoading) {
      return <Animated.View style={[styles.priceSkeleton, size === 'lg' && styles.priceSkeletonLg, { opacity: pulse }]} />;
    }
    const p = prices[token];
    return (
      <Text style={size === 'sm' ? styles.priceTagSm : styles.priceTagLg}>
        {p ? formatUsd(p) : '--'}
      </Text>
    );
  };

  if (!isWalletConnected) {
    return <GelGate icon="exchange-alt" headerTitle="Swap" subtitle="Connect a wallet to see live balances and swap tokens." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <GelPageHeader
        title="Swap"
        subtitle="Trade tokens at live prices"
        right={
          <GelOrb
            icon="sync-alt"
            size={36}
            breathe={false}
            iconSize={13}
            label="Refresh prices"
            onPress={() => { spinRefresh(); refreshPrices(); if (isWalletConnected) checkBalance(); }}
          />
        }
      />

      {/* Messages */}
      {errorVis.shouldRender && (
        <Animated.View
          style={[
            styles.messageBanner,
            {
              opacity: errorVis.anim,
              transform: [{ translateY: errorVis.anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
            },
          ]}
        >
          <Icon name="exclamation-circle" size={14} color="#ff4444" />
          <Text style={styles.errorText}>{displayedError}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Icon name="times" size={14} color="#ff4444" />
          </TouchableOpacity>
        </Animated.View>
      )}
      {successVis.shouldRender && (
        <Animated.View
          style={[
            styles.messageBanner,
            styles.successBanner,
            {
              opacity: successVis.anim,
              transform: [{ translateY: successVis.anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
            },
          ]}
        >
          <Icon name="check-circle" size={14} color="#44ff88" />
          <Text style={styles.successText}>{displayedSuccess}</Text>
        </Animated.View>
      )}
      {priceWarnVis.shouldRender && (
        <Animated.View style={[styles.messageBanner, styles.warnBanner, { opacity: priceWarnVis.anim }]}>
          <Icon name="wifi" size={12} color={colors.accent} />
          <Text style={styles.warnText}>{pricesError || 'Live prices unavailable'} — showing last known values</Text>
        </Animated.View>
      )}

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <Animated.View style={entranceStyle}>
          {!isWalletConnected ? (
            <View style={styles.connectPrompt}>
              <View style={styles.connectIconWrap}>
                <Icon name="wallet" size={40} color={colors.accent} />
              </View>
              <Text style={styles.connectPromptTitle}>Connect your wallet</Text>
              <Text style={styles.connectPromptText}>
                Connect to view live balances, real-time USDC pricing, and start swapping.
              </Text>
              <GelButton label="Connect wallet" icon="wallet" onPress={() => setShowModal(true)} style={{ alignSelf: 'stretch' }} />
            </View>
          ) : (
            <GelGlass radius={30} glow padding={14}>
              {/* From */}
              <View style={styles.tokenPanel}>
                <View style={styles.tokenPanelTopRow}>
                  <Text style={styles.label}>You pay</Text>
                  <TouchableOpacity onPress={checkBalance} style={styles.balancePill}>
                    <Icon name="wallet" size={11} color="#aaa" />
                    <Text style={styles.balancePillText}>{formatToken(animatedBalance)} {coinFrom}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.tokenPanelRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#555"
                  />
                  <AnimatedPressable style={styles.tokenPicker} onPress={() => setShowFromModal(true)}>
                    <Image source={TOKEN_LOGOS[coinFrom]} style={styles.tokenLogoSm} />
                    <Text style={styles.tokenPickerText}>{coinFrom}</Text>
                    <Icon name="chevron-down" size={12} color={colors.accent} />
                  </AnimatedPressable>
                </View>

                <View style={styles.tokenPanelBottomRow}>
                  <Text style={styles.usdValueText}>{inputUsdValue !== null ? formatUsd(inputUsdValue) : '$0.00'}</Text>
                  <AnimatedPressable onPress={() => setAmount(String(balance))} scaleTo={0.9}>
                    <Text style={styles.maxText}>MAX</Text>
                  </AnimatedPressable>
                </View>
              </View>

              {/* Swap direction button */}
              <View style={styles.swapDirectionWrap}>
                <View style={styles.swapDirectionLine} />
                <AnimatedPressable style={styles.swapDirectionButton} onPress={handleSwapDirection} scaleTo={0.85}>
                  <Animated.View style={directionStyle}>
                    <Icon name="exchange-alt" size={14} color="#fff" style={{ transform: [{ rotate: '90deg' }] }} />
                  </Animated.View>
                </AnimatedPressable>
              </View>

              {/* To */}
              <View style={styles.tokenPanel}>
                <View style={styles.tokenPanelTopRow}>
                  <Text style={styles.label}>You receive (est.)</Text>
                  <PriceTag token={coinTo} />
                </View>

                <View style={styles.tokenPanelRow}>
                  <Text style={[styles.amountInput, styles.amountOutput]}>
                    {estimatedOutput !== null ? formatToken(estimatedOutput, 6) : '0.00'}
                  </Text>
                  <AnimatedPressable style={styles.tokenPicker} onPress={() => setShowToModal(true)}>
                    <Image source={TOKEN_LOGOS[coinTo]} style={styles.tokenLogoSm} />
                    <Text style={styles.tokenPickerText}>{coinTo}</Text>
                    <Icon name="chevron-down" size={12} color={colors.accent} />
                  </AnimatedPressable>
                </View>

                {exchangeRateLabel && (
                  <View style={styles.tokenPanelBottomRow}>
                    <Text style={styles.rateText}>{exchangeRateLabel}</Text>
                  </View>
                )}
              </View>

              {/* Swap button */}
              <GelButton
                label={!amount ? 'Enter an amount' : coinFrom === coinTo ? 'Select different tokens' : `Swap ${coinFrom} → ${coinTo}`}
                icon="exchange-alt"
                loading={loading}
                disabled={loading || !amount || coinFrom === coinTo}
                onPress={handleSwap}
                style={{ marginTop: 16 }}
              />

              {/* Portfolio quick actions */}
              <View style={styles.portfolioSection}>
                <View style={styles.portfolioHeaderRow}>
                  <Text style={styles.portfolioTitle}>Portfolio</Text>
                  <Text style={styles.portfolioTotal}>
                    {pricesLoading ? 'Loading…' : formatUsd(animatedPortfolioTotal, { compact: true })}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 }}>
                  {[
                    { icon: 'wallet', label: 'Balances', onPress: () => { checkAllBalances(); setShowBalanceModal(true); } },
                    { icon: 'paper-plane', label: 'Send', onPress: () => setShowSendModal(true) },
                    { icon: 'qrcode', label: 'Receive', onPress: handleReceive },
                  ].map((a, i) => (
                    <Animated.View key={a.label} style={[{ alignItems: 'center' }, portfolioButtonAnims[i]]}>
                      <GelOrb icon={a.icon} size={54} onPress={a.onPress} label={a.label} breathe={false} iconSize={18} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginTop: 8 }}>{a.label}</Text>
                    </Animated.View>
                  ))}
                </View>
              </View>
            </GelGlass>
          )}
        </Animated.View>
      </ScrollView>

      {/* choose a token */}
      <GelModal
        visible={showFromModal || showToModal}
        onClose={() => { setShowFromModal(false); setShowToModal(false); }}
        variant="sheet"
        title={showFromModal ? 'Pay with' : 'Receive'}
      >
        <ScrollView style={{ maxHeight: 420, marginTop: 8 }} showsVerticalScrollIndicator={false}>
          {Object.keys(TOKEN_MINTS).map((token) => {
            const isSelected = showFromModal ? token === coinFrom : token === coinTo;
            const isDisabled = showFromModal ? token === coinTo : token === coinFrom;
            return (
              <AnimatedPressable
                key={token}
                disabled={isDisabled}
                onPress={() => {
                  if (showFromModal) setCoinFrom(token);
                  else setCoinTo(token);
                  setShowFromModal(false);
                  setShowToModal(false);
                }}
                style={[styles.tokenItem, isSelected && styles.tokenItemSelected, isDisabled && { opacity: 0.4 }]}
                scaleTo={0.98}
              >
                <Image source={TOKEN_LOGOS[token]} style={styles.tokenLogo} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tokenName}>{TOKEN_NAMES[token]}</Text>
                  <Text style={styles.tokenSymbolMuted}>{token}</Text>
                </View>
                <PriceTag token={token} />
                {isSelected && <Icon name="check" size={14} color={colors.accent} style={{ marginLeft: 10 }} />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </GelModal>

      {/* balances */}
      <GelModal visible={showBalanceModal} onClose={() => setShowBalanceModal(false)} variant="sheet" icon="coins" title="Your balances">
        <GelInset style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.portfolioTotalLabel}>Total value</Text>
            <Text style={styles.portfolioTotalValue}>{pricesLoading ? '—' : formatUsd(animatedPortfolioTotal)}</Text>
          </View>
          <AnimatedPressable onPress={() => { spinRefresh(); checkAllBalances(); refreshPrices(); }} style={styles.portfolioRefreshBtn} scaleTo={0.85} accessibilityLabel="Refresh balances">
            <Animated.View style={spinStyle}>
              <Icon name="sync-alt" size={14} color={colors.accent} />
            </Animated.View>
          </AnimatedPressable>
        </GelInset>
        <ScrollView style={{ maxHeight: 360, marginTop: 6 }} showsVerticalScrollIndicator={false}>
          {Object.keys(TOKEN_MINTS).map((token) => {
            const bal = allBalances[token] || 0;
            const price = prices[token];
            const value = price ? bal * price : null;
            return (
              <View key={token} style={styles.balanceItem}>
                <Image source={TOKEN_LOGOS[token]} style={styles.tokenLogo} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tokenName}>{TOKEN_NAMES[token]}</Text>
                  <Text style={styles.tokenSymbolMuted}>{price ? `${formatUsd(price)} / ${token}` : 'Price unavailable'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.balanceAmount}>{formatToken(bal)}</Text>
                  <Text style={styles.balanceValueText}>{value !== null ? formatUsd(value) : '--'}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </GelModal>

      {/* send */}
      <GelModal
        visible={showSendModal}
        onClose={() => { if (!loading) setShowSendModal(false); }}
        dismissable={!loading}
        variant="sheet"
        icon="paper-plane"
        title={`Send ${coinFrom}`}
        actions={[{ label: 'Send', icon: 'paper-plane', loading, onPress: handleSend }]}
      >
        <GelInput label="To (wallet address)" placeholder="Paste the Solana address" value={sendAddress} onChangeText={setSendAddress} autoCapitalize="none" autoCorrect={false} />
        <GelInput
          label="Amount"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={sendAmount}
          onChangeText={(text) => setSendAmount(text.replace(/[^0-9.]/g, ''))}
          hint={sendAmount && priceFrom ? `≈ ${formatUsd(parseFloat(sendAmount) * priceFrom)}` : undefined}
        />
        <View style={[styles.tokenPanelBottomRow, { marginTop: 10, paddingHorizontal: 6 }]}>
          <Text style={styles.balancePillText}>Available: {formatToken(balance)} {coinFrom}</Text>
          <AnimatedPressable onPress={() => setSendAmount(formatSendAmount(maxSendableBalance))} scaleTo={0.9} disabled={loading}>
            <Text style={styles.maxText}>MAX</Text>
          </AnimatedPressable>
        </View>
      </GelModal>

      {/* receive */}
      <GelModal
        visible={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        icon="qrcode"
        title="Receive crypto"
        subtitle="Share this address to receive tokens on Solana."
        actions={[
          {
            label: 'Copy address',
            icon: 'copy',
            variant: 'secondary',
            onPress: async () => {
              try { await Clipboard.setStringAsync(receiveAddress || ''); } catch {}
              setSuccessMessage('Address copied');
              setTimeout(() => setSuccessMessage(''), 2000);
            },
          },
          { label: 'Done', onPress: () => setShowReceiveModal(false) },
        ]}
      >
        <GelInset>
          <Text style={styles.addressText} selectable>{receiveAddress}</Text>
        </GelInset>
      </GelModal>

      {/* not enough balance */}
      <GelModal
        visible={showRampSuggestion}
        onClose={() => setShowRampSuggestion(false)}
        icon="exclamation-triangle"
        tone={colors.gold}
        title="Not enough balance"
        subtitle={`You don't have enough ${coinFrom} for this swap. Buy some with a card through Ramp?`}
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setShowRampSuggestion(false) },
          { label: 'Buy with Ramp', icon: 'credit-card', onPress: () => { setShowRampSuggestion(false); Linking.openURL('https://ramp.network'); } },
        ]}
      />

      {/* Jupiter Swap WebView */}
      <JupiterSwapWebView
        visible={showJupiterWebView}
        onClose={async () => {
          setShowJupiterWebView(false);
          setJupiterSwapUrl('');
          await checkAllBalances();
          await checkBalance();
          refreshPrices();
        }}
        swapUrl={jupiterSwapUrl}
        walletAddress={activeWalletAddress}
        prefillAmount={jupiterPrefillAmount}
        onSignAndSendTransaction={async (base64Tx) => {
          const bytes = Buffer.from(base64Tx, 'base64');
          const tx = VersionedTransaction.deserialize(bytes);
          const signedB64 = await signTransactionOnly(tx);
          logJupiterSwap(signedB64);
          return signedB64;
        }}
        onSignTransaction={async (base64Tx) => {
          const bytes = Buffer.from(base64Tx, 'base64');
          const tx = VersionedTransaction.deserialize(bytes);
          const signedB64 = await signTransactionOnly(tx);
          logJupiterSwap(signedB64);
          return signedB64;
        }}
      />
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles — original dark/orange design, unchanged palette
// ---------------------------------------------------------------------------
export const getSwapScreenStyles = (c, isDark = true) => {
  const panel = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.92)';
  const line = isDark ? 'rgba(255,255,255,0.09)' : `rgba(${c.accentRgb},0.16)`;
  const soft = isDark ? 'rgba(255,255,255,0.08)' : `rgba(${c.accentRgb},0.10)`;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 4,
  },
  screenTitle: { color: c.textPrimary, fontSize: 22, fontWeight: '800' },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.12)',
    marginHorizontal: 15,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  successBanner: { backgroundColor: 'rgba(68,255,136,0.12)' },
  warnBanner: { backgroundColor: 'rgba(255,204,68,0.10)' },
  scrollContent: { flex: 1, paddingHorizontal: 15 },
  scrollContentContainer: { paddingTop: 10, paddingBottom: 100 },
  connectPrompt: { alignItems: 'center', padding: 40, marginTop: 30 },
  connectIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(243, 99, 22,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  connectPromptTitle: { color: c.textPrimary, fontSize: 18,   marginBottom: 8 },
  connectPromptText: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  connectButton: { backgroundColor: c.accent, paddingVertical: 14, paddingHorizontal: 36, borderRadius: 999 },
  connectButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  swapCard: {},
  tokenPanel: { backgroundColor: panel, borderRadius: 22, padding: 14, borderWidth: 1, borderColor: line },
  tokenPanelTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tokenPanelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tokenPanelBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  amountInput: { color: c.textPrimary, fontSize: 26, flex: 1, minWidth: 0, padding: 0 },
  amountOutput: { color: c.textSecondary },
  tokenPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
    flexShrink: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 30,
    gap: 6,
    borderWidth: 1,
    borderColor: c.accent,
  },
  tokenLogoSm: { width: 22, height: 22, borderRadius: 11 },
  tokenPickerText: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
  balancePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  balancePillText: { color: c.textMuted, fontSize: 12 },
  usdValueText: { color: c.textMuted, fontSize: 13 },
  maxText: { color: c.accent, fontSize: 12, fontWeight: '700' },
  rateText: { color: c.textMuted, fontSize: 12 },
  priceTagSm: { color: c.gold, fontSize: 12, fontWeight: '600' },
  priceTagLg: { color: c.gold, fontSize: 14, fontWeight: '700' },
  priceSkeleton: { width: 40, height: 12, borderRadius: 4, backgroundColor: soft },
  priceSkeletonLg: { width: 50, height: 14 },
  swapDirectionWrap: { alignItems: 'center', justifyContent: 'center', height: 0 },
  swapDirectionLine: { position: 'absolute', height: 1, width: '100%', backgroundColor: 'transparent', top: 0 },
  swapDirectionButton: {
    position: 'absolute',
    top: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: isDark ? c.bgCard : '#FFFFFF',
    zIndex: 2,
  },
  label: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: c.bgCard,
    color: c.textPrimary,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: line,
    fontSize: 15,
  },
  inputGroup: { marginBottom: 14 },
  portfolioSection: { marginTop: 18 },
  portfolioHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  portfolioTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
  portfolioTotal: { color: c.gold, fontSize: 14, fontWeight: '700' },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  portfolioButton: {
    backgroundColor: panel,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: line,
  },
  portfolioButtonText: { color: c.accent, fontSize: 12, marginTop: 5, fontWeight: '600' },
  swapButton: {
    flexDirection: 'row',
    backgroundColor: c.accent,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  disabledButton: { opacity: 0.55 },
  swapButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 },
  errorText: { color: c.danger || '#E5484D', fontSize: 13, flex: 1 },
  successText: { color: c.success || '#1F9D55', fontSize: 13, flex: 1 },
  warnText: { color: c.warning || '#B7791F', fontSize: 12, flex: 1 },
  modalContainer: { backgroundColor: c.bgCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: line },
  closeButton: { alignSelf: 'flex-end', padding: 5 },
  modalTitle: { color: c.textPrimary, fontSize: 18,   marginBottom: 6, textAlign: 'center' },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: c.accent,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tokenList: { maxHeight: 340 },
  tokenItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 22, marginBottom: 8, backgroundColor: panel, borderWidth: 1, borderColor: line },
  tokenItemSelected: { borderWidth: 1, borderColor: c.accent },
  modalMessage: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 14, lineHeight: 19 },
  balanceItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 22, marginBottom: 8, backgroundColor: panel, borderWidth: 1, borderColor: line },
  balanceAmount: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
  balanceValueText: { color: c.gold, fontSize: 12, marginTop: 2 },
  tokenLogo: { width: 34, height: 34, borderRadius: 17, marginRight: 12 },
  tokenName: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
  tokenSymbolMuted: { color: c.textMuted, fontSize: 12, marginTop: 1 },
  portfolioTotalBox: { backgroundColor: panel, borderRadius: 22, padding: 16, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: line },
  portfolioTotalLabel: { color: c.textMuted, fontSize: 12 },
  portfolioTotalValue: { color: c.textPrimary, fontSize: 26, fontWeight: '800', marginTop: 4 },
  portfolioRefreshBtn: { position: 'absolute', right: 12, top: 12, padding: 6 },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bgCard,
    padding: 14,
    borderRadius: 10,
    marginBottom: 15,
    gap: 10,
  },
  addressText: { color: c.textPrimary, fontSize: 13, lineHeight: 19, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cancelButton: { backgroundColor: soft, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  cancelButtonText: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
});
};

export default SwapScreen;