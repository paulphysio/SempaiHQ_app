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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Modal from 'react-native-modal';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import JupiterSwapWebView from '../components/JupiterSwapWebView';
import { AMETHYST_MINT_ADDRESS, SMP_MINT_ADDRESS, USDC_MINT_ADDRESS, SKR_MINT_ADDRESS, RPC_URL, WEB_API_BASE_URL } from '../constants';
import { AnimatedPressable, useCountUp, usePulse, useEntrance, useAnimatedVisibility, useStaggeredEntrance } from '../utils/animations';

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
            console.log('[useTokenPrices] Using web API fallback for SMP price');
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
  const navigation = useNavigation();
  const { wallet, signAndSendTransaction, signTransactionOnly } = useContext(EmbeddedWalletContext);
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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
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
    if (!sendAmount || !sendAddress) {
      setError('Please enter amount and recipient address');
      return;
    }
    if (parseFloat(sendAmount) > balance) {
      setError(`Insufficient ${coinFrom} balance`);
      return;
    }
    setShowPasswordModal(true);
  };

  const handleSendSubmit = async () => {
    if (!password) {
      setError('Please enter your wallet password');
      return;
    }
    setLoading(true);
    setError(null);
    setShowSendModal(false);
    try {
      setSuccessMessage('Send functionality requires additional implementation');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Error sending:', err);
      setError(`Send failed: ${err.message}`);
    } finally {
      setLoading(false);
      setPassword('');
      setSendAmount('');
      setSendAddress('');
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
    setJupiterSwapUrl(`https://jup.ag/swap/${inputMint}-${outputMint}`);
    setJupiterPrefillAmount(amount);
    setShowJupiterWebView(true);
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      setError('Please enter your wallet password.');
      return;
    }
    setLoading(true);
    setError(null);
    setShowPasswordModal(false);

    try {
      if (showSendModal) {
        await handleSendSubmit();
        return;
      }
    } catch (err) {
      console.error('Error:', err);
      setError(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
      setPassword('');
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#141414" />

      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Swap</Text>
        <AnimatedPressable
          onPress={() => {
            spinRefresh();
            refreshPrices();
            if (isWalletConnected) checkBalance();
          }}
          style={styles.headerIconButton}
        >
          <Animated.View style={spinStyle}>
            <Icon name="sync-alt" size={16} color="#ff6200" />
          </Animated.View>
        </AnimatedPressable>
      </View>

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
          <Icon name="wifi" size={12} color="#ffcc44" />
          <Text style={styles.warnText}>{pricesError || 'Live prices unavailable'} — showing last known values</Text>
        </Animated.View>
      )}

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <Animated.View style={entranceStyle}>
          {!isWalletConnected ? (
            <View style={styles.connectPrompt}>
              <View style={styles.connectIconWrap}>
                <Icon name="wallet" size={40} color="#ff6200" />
              </View>
              <Text style={styles.connectPromptTitle}>Connect your wallet</Text>
              <Text style={styles.connectPromptText}>
                Connect to view live balances, real-time USDC pricing, and start swapping.
              </Text>
              <AnimatedPressable style={styles.connectButton} onPress={() => navigation.navigate('ConnectWallet')}>
                <Text style={styles.connectButtonText}>Connect Wallet</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <View style={styles.swapCard}>
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
                    <Icon name="chevron-down" size={12} color="#ff6200" />
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
                    <Icon name="chevron-down" size={12} color="#ff6200" />
                  </AnimatedPressable>
                </View>

                {exchangeRateLabel && (
                  <View style={styles.tokenPanelBottomRow}>
                    <Text style={styles.rateText}>{exchangeRateLabel}</Text>
                  </View>
                )}
              </View>

              {/* Swap button */}
              <AnimatedPressable
                style={[styles.swapButton, loading ? styles.disabledButton : null]}
                onPress={handleSwap}
                disabled={loading}
                scaleTo={0.97}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Icon name="exchange-alt" size={16} color="#ffffff" />
                    <Text style={styles.swapButtonText}>
                      {!amount ? 'Enter an amount' : coinFrom === coinTo ? 'Select different tokens' : 'Swap'}
                    </Text>
                  </>
                )}
              </AnimatedPressable>

              {/* Portfolio quick actions */}
              <View style={styles.portfolioSection}>
                <View style={styles.portfolioHeaderRow}>
                  <Text style={styles.portfolioTitle}>Portfolio</Text>
                  <Text style={styles.portfolioTotal}>
                    {pricesLoading ? 'Loading…' : formatUsd(animatedPortfolioTotal, { compact: true })}
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <Animated.View style={[{ flex: 1 }, portfolioButtonAnims[0]]}>
                    <AnimatedPressable
                      onPress={() => { checkAllBalances(); setShowBalanceModal(true); }}
                      style={styles.portfolioButton}
                    >
                      <Icon name="wallet" size={16} color="#ff6200" />
                      <Text style={styles.portfolioButtonText}>Balances</Text>
                    </AnimatedPressable>
                  </Animated.View>
                  <Animated.View style={[{ flex: 1 }, portfolioButtonAnims[1]]}>
                    <AnimatedPressable onPress={() => setShowSendModal(true)} style={styles.portfolioButton}>
                      <Icon name="paper-plane" size={16} color="#ff6200" />
                      <Text style={styles.portfolioButtonText}>Send</Text>
                    </AnimatedPressable>
                  </Animated.View>
                  <Animated.View style={[{ flex: 1 }, portfolioButtonAnims[2]]}>
                    <AnimatedPressable onPress={handleReceive} style={styles.portfolioButton}>
                      <Icon name="qrcode" size={16} color="#ff6200" />
                      <Text style={styles.portfolioButtonText}>Receive</Text>
                    </AnimatedPressable>
                  </Animated.View>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Password Modal */}
      <Modal isVisible={showPasswordModal} onBackdropPress={() => setShowPasswordModal(false)} avoidKeyboard useNativeDriver>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowPasswordModal(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Icon name="lock" size={28} color="#ff6200" style={{ alignSelf: 'center', marginBottom: 10 }} />
          <Text style={styles.modalTitle}>Enter Wallet Password</Text>
          <Text style={styles.modalMessage}>Confirm your password to authorize this transaction.</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#888"
            autoFocus
          />
          <AnimatedPressable style={styles.submitButton} onPress={handlePasswordSubmit} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitButtonText}>Confirm</Text>}
          </AnimatedPressable>
        </View>
      </Modal>

      {/* Token Selection Modal */}
      {(showFromModal || showToModal) && (
        <Modal isVisible={true} onBackdropPress={() => { setShowFromModal(false); setShowToModal(false); }} useNativeDriver>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={() => { setShowFromModal(false); setShowToModal(false); }}>
              <Icon name="times" size={20} color="#ff6200" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{showFromModal ? 'Select token to pay with' : 'Select token to receive'}</Text>
            <ScrollView style={styles.tokenList}>
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
                    style={[styles.tokenItem, isSelected && styles.tokenItemSelected]}
                    scaleTo={0.98}
                  >
                    <Image source={TOKEN_LOGOS[token]} style={styles.tokenLogo} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tokenName}>{TOKEN_NAMES[token]}</Text>
                      <Text style={styles.tokenSymbolMuted}>{token}</Text>
                    </View>
                    <PriceTag token={token} />
                    {isSelected && <Icon name="check" size={14} color="#ff6200" style={{ marginLeft: 10 }} />}
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Balance Modal */}
      <Modal isVisible={showBalanceModal} onBackdropPress={() => setShowBalanceModal(false)} useNativeDriver>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowBalanceModal(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Your Balances</Text>
          <View style={styles.portfolioTotalBox}>
            <Text style={styles.portfolioTotalLabel}>Total value</Text>
            <Text style={styles.portfolioTotalValue}>{pricesLoading ? '—' : formatUsd(animatedPortfolioTotal)}</Text>
            <AnimatedPressable
              onPress={() => { spinRefresh(); checkAllBalances(); refreshPrices(); }}
              style={styles.portfolioRefreshBtn}
              scaleTo={0.85}
            >
              <Animated.View style={spinStyle}>
                <Icon name="sync-alt" size={14} color="#ff6200" />
              </Animated.View>
            </AnimatedPressable>
          </View>
          <ScrollView style={styles.tokenList}>
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
        </View>
      </Modal>

      {/* Send Modal */}
      <Modal isVisible={showSendModal} onBackdropPress={() => setShowSendModal(false)} avoidKeyboard useNativeDriver>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowSendModal(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Send {coinFrom}</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Recipient Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter wallet address"
              placeholderTextColor="#888"
              value={sendAddress}
              onChangeText={setSendAddress}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              value={sendAmount}
              onChangeText={(text) => setSendAmount(text.replace(/[^0-9.]/g, ''))}
            />
            {sendAmount && priceFrom ? (
              <Text style={styles.usdValueText}>≈ {formatUsd(parseFloat(sendAmount) * priceFrom)}</Text>
            ) : null}
          </View>
          <View style={styles.tokenPanelBottomRow}>
            <Text style={styles.balancePillText}>Available: {formatToken(balance)} {coinFrom}</Text>
            <AnimatedPressable onPress={() => setSendAmount(String(balance))} scaleTo={0.9}>
              <Text style={styles.maxText}>MAX</Text>
            </AnimatedPressable>
          </View>
          <AnimatedPressable style={styles.submitButton} onPress={handleSend}>
            <Text style={styles.submitButtonText}>Continue</Text>
          </AnimatedPressable>
        </View>
      </Modal>

      {/* Receive Modal */}
      <Modal isVisible={showReceiveModal} onBackdropPress={() => setShowReceiveModal(false)} useNativeDriver>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowReceiveModal(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Icon name="qrcode" size={28} color="#ff6200" style={{ alignSelf: 'center', marginBottom: 10 }} />
          <Text style={styles.modalTitle}>Receive Crypto</Text>
          <Text style={styles.modalMessage}>Share this address to receive crypto:</Text>
          <View style={styles.addressContainer}>
            <Text style={styles.addressText} selectable>{receiveAddress}</Text>
            <TouchableOpacity onPress={() => { setSuccessMessage('Address copied to clipboard'); setTimeout(() => setSuccessMessage(''), 2000); }}>
              <Icon name="copy" size={20} color="#ff6200" />
            </TouchableOpacity>
          </View>
          <AnimatedPressable style={styles.submitButton} onPress={() => setShowReceiveModal(false)}>
            <Text style={styles.submitButtonText}>Done</Text>
          </AnimatedPressable>
        </View>
      </Modal>

      {/* Ramp Suggestion Modal */}
      <Modal isVisible={showRampSuggestion} onBackdropPress={() => setShowRampSuggestion(false)} useNativeDriver>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowRampSuggestion(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Icon name="exclamation-triangle" size={28} color="#ffcc44" style={{ alignSelf: 'center', marginBottom: 10 }} />
          <Text style={styles.modalTitle}>Insufficient Balance</Text>
          <Text style={styles.modalMessage}>
            You don't have enough {coinFrom} to complete this swap. Would you like to buy more crypto using Ramp?
          </Text>
          <AnimatedPressable style={styles.submitButton} onPress={() => { setShowRampSuggestion(false); Linking.openURL('https://ramp.network'); }}>
            <Icon name="credit-card" size={16} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.submitButtonText}>Buy Crypto with Ramp</Text>
          </AnimatedPressable>
          <TouchableOpacity style={[styles.cancelButton, { marginTop: 10 }]} onPress={() => setShowRampSuggestion(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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
          return await signTransactionOnly(tx);
        }}
        onSignTransaction={async (base64Tx) => {
          const bytes = Buffer.from(base64Tx, 'base64');
          const tx = VersionedTransaction.deserialize(bytes);
          return await signTransactionOnly(tx);
        }}
      />
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles — original dark/orange design, unchanged palette
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 4,
  },
  screenTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1f1f1f',
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
    backgroundColor: 'rgba(255,98,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  connectPromptTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  connectPromptText: { color: '#999', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  connectButton: { backgroundColor: '#ff6200', paddingVertical: 14, paddingHorizontal: 36, borderRadius: 12 },
  connectButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  swapCard: { backgroundColor: '#1c1c1c', borderRadius: 20, padding: 16 },
  tokenPanel: { backgroundColor: '#242424', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#2f2f2f' },
  tokenPanelTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tokenPanelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tokenPanelBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  amountInput: { color: '#fff', fontSize: 26, fontWeight: '700', flex: 1, padding: 0 },
  amountOutput: { color: '#e0e0e0' },
  tokenPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 30,
    gap: 6,
    borderWidth: 1,
    borderColor: '#ff6200',
  },
  tokenLogoSm: { width: 22, height: 22, borderRadius: 11 },
  tokenPickerText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  balancePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  balancePillText: { color: '#aaa', fontSize: 12 },
  usdValueText: { color: '#888', fontSize: 13 },
  maxText: { color: '#ff6200', fontSize: 12, fontWeight: '700' },
  rateText: { color: '#888', fontSize: 12 },
  priceTagSm: { color: '#ffd700', fontSize: 12, fontWeight: '600' },
  priceTagLg: { color: '#ffd700', fontSize: 14, fontWeight: '700' },
  priceSkeleton: { width: 40, height: 12, borderRadius: 4, backgroundColor: '#3a3a3a' },
  priceSkeletonLg: { width: 50, height: 14 },
  swapDirectionWrap: { alignItems: 'center', justifyContent: 'center', height: 0 },
  swapDirectionLine: { position: 'absolute', height: 1, width: '100%', backgroundColor: '#2f2f2f', top: 0 },
  swapDirectionButton: {
    position: 'absolute',
    top: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ff6200',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#1c1c1c',
    zIndex: 2,
  },
  label: { color: '#999', fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    fontSize: 15,
  },
  inputGroup: { marginBottom: 14 },
  portfolioSection: { marginTop: 18 },
  portfolioHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  portfolioTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  portfolioTotal: { color: '#ffd700', fontSize: 14, fontWeight: '700' },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  portfolioButton: {
    backgroundColor: '#242424',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2f2f2f',
  },
  portfolioButtonText: { color: '#ff6200', fontSize: 12, marginTop: 5, fontWeight: '600' },
  swapButton: {
    flexDirection: 'row',
    backgroundColor: '#ff6200',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  disabledButton: { backgroundColor: '#3a3a3a' },
  swapButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  errorText: { color: '#ff4444', fontSize: 13, flex: 1 },
  successText: { color: '#44ff88', fontSize: 13, flex: 1 },
  warnText: { color: '#ffcc44', fontSize: 12, flex: 1 },
  modalContainer: { backgroundColor: '#1c1c1c', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#2f2f2f' },
  closeButton: { alignSelf: 'flex-end', padding: 5 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#ff6200',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tokenList: { maxHeight: 340 },
  tokenItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: '#242424' },
  tokenItemSelected: { borderWidth: 1, borderColor: '#ff6200' },
  modalMessage: { color: '#999', fontSize: 13, textAlign: 'center', marginBottom: 14, lineHeight: 19 },
  balanceItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: '#242424' },
  balanceAmount: { color: '#fff', fontSize: 15, fontWeight: '700' },
  balanceValueText: { color: '#ffd700', fontSize: 12, marginTop: 2 },
  tokenLogo: { width: 34, height: 34, borderRadius: 17, marginRight: 12 },
  tokenName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tokenSymbolMuted: { color: '#888', fontSize: 12, marginTop: 1 },
  portfolioTotalBox: { backgroundColor: '#242424', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 14 },
  portfolioTotalLabel: { color: '#888', fontSize: 12 },
  portfolioTotalValue: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4 },
  portfolioRefreshBtn: { position: 'absolute', right: 12, top: 12, padding: 6 },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 10,
    marginBottom: 15,
    gap: 10,
  },
  addressText: { color: '#fff', fontSize: 12, flex: 1, fontFamily: 'monospace' },
  cancelButton: { backgroundColor: '#2f2f2f', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

export default SwapScreen;