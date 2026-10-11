import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getBadgesStyles } from '../styles/BadgesStyles';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token';
import {
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
  RPC_URL,
  USDC_DECIMALS,
  SKR_DECIMALS,
} from '../constants';

const connection = new Connection(RPC_URL, 'confirmed');

const BadgesScreen = () => {
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const signAndSendTransaction = walletContext?.signAndSendTransaction;
  const isWalletConnected = !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();
  const activePublicKey = wallet?.publicKey;
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { writerId: routeWriterId } = route.params || {};
  const { isDark, colors } = useTheme();
  const styles = getBadgesStyles(isDark);

  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userBadges, setUserBadges] = useState([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USDC');
  const [isProcessing, setIsProcessing] = useState(false);
  const [solBalance, setSolBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [skrBalance, setSkrBalance] = useState(0);
  const [solPrice, setSolPrice] = useState(0);
  const [writers, setWriters] = useState([]);
  const [selectedWriter, setSelectedWriter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const getBadgeImage = (badge) => {
    if (badge.image_url && badge.image_url !== 'local') {
      return { uri: badge.image_url };
    }
    // Use local images for default badges
    const type = badge.type?.toLowerCase();
    if (type === 'gold') return require('../assets/plan-image/Gold.png');
    if (type === 'silver') return require('../assets/plan-image/Sliver.png');
    if (type === 'blue') return require('../assets/plan-image/Blue.png');
    if (type === 'iron') return require('../assets/plan-image/Black.png');
    return require('../assets/plan-image/Blue.png');
  };

  useEffect(() => {
    fetchBadges();
    fetchWriters();
    fetchSolPrice();
    if (activeWalletAddress) {
      fetchBalances();
    }
  }, [activeWalletAddress]);

  // Auto-select writer if coming from ChapterScreen
  useEffect(() => {
    if (routeWriterId && writers.length > 0) {
      const writer = writers.find(w => w.id === routeWriterId);
      if (writer) {
        setSelectedWriter(writer);
      }
    }
  }, [routeWriterId, writers]);

  const fetchSolPrice = async () => {
    try {
      const response = await fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112');
      const data = await response.json();
      if (data?.data?.['So11111111111111111111111111111111111111112']?.price) {
        setSolPrice(data.data['So11111111111111111111111111111111111111112'].price);
      }
    } catch (error) {
      console.error('[BadgesScreen] Error fetching SOL price:', error);
      // Fallback to a reasonable default
      setSolPrice(150);
    }
  };

  useEffect(() => {
    fetchBadges();
  }, [selectedWriter]);

  const fetchWriters = async () => {
    try {
      const { data: writersData, error: writersError } = await supabase
        .from('users')
        .select('id, name, wallet_address')
        .eq('isWriter', true)
        .order('name', { ascending: true });

      if (writersError) throw writersError;
      setWriters(writersData || []);
    } catch (error) {
      console.error('[BadgesScreen] Error fetching writers:', error);
    }
  };

  const fetchBadges = async () => {
    try {
      setLoading(true);

      // Fetch available badges, filtered by selected writer if any
      let query = supabase
        .from('badges')
        .select('*')
        .order('price', { ascending: true });

      if (selectedWriter) {
        query = query.eq('writer_id', selectedWriter.id);
      }

      const { data: availableBadges, error: badgesError } = await query;

      if (badgesError) throw badgesError;

      // If writer has no custom badges, use default badges
      if (selectedWriter && (!availableBadges || availableBadges.length === 0)) {
        const defaultBadges = [
          {
            id: `default-blue-${selectedWriter.id}`,
            name: 'Blue Badge',
            description: 'Unlock 3 chapters',
            price: 1,
            type: 'blue',
            image_url: 'local',
            writer_id: selectedWriter.id,
          },
          {
            id: `default-iron-${selectedWriter.id}`,
            name: 'Iron Badge',
            description: 'Unlock 6 chapters',
            price: 2,
            type: 'iron',
            image_url: 'local',
            writer_id: selectedWriter.id,
          },
          {
            id: `default-silver-${selectedWriter.id}`,
            name: 'Silver Badge',
            description: 'Unlock 10 chapters',
            price: 3,
            type: 'silver',
            image_url: 'local',
            writer_id: selectedWriter.id,
          },
          {
            id: `default-gold-${selectedWriter.id}`,
            name: 'Gold Badge',
            description: 'Unlock all chapters',
            price: 5,
            type: 'gold',
            image_url: 'local',
            writer_id: selectedWriter.id,
          },
        ];
        setBadges(defaultBadges);
      } else {
        setBadges(availableBadges || []);
      }

      // Fetch user's badges
      if (user && user.id) {
        const { data: userBadgesData, error: userBadgesError } = await supabase
          .from('user_badges')
          .select('*, badges(*)')
          .eq('user_id', user.id);

        if (userBadgesError) throw userBadgesError;
        setUserBadges(userBadgesData || []);
      }
    } catch (error) {
      console.error('[BadgesScreen] Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalances = useCallback(async () => {
    if (!activeWalletAddress || !activePublicKey) return;

    try {
      // Fetch SOL balance
      const solBal = await connection.getBalance(activePublicKey);
      setSolBalance(solBal / 1e9);

      // Fetch USDC balance
      const usdcMint = new PublicKey(USDC_MINT_ADDRESS);
      const usdcAta = getAssociatedTokenAddressSync(usdcMint, activePublicKey);
      const usdcAtaInfo = await connection.getAccountInfo(usdcAta);
      const usdcBal = usdcAtaInfo ? Number(usdcAtaInfo.data.readBigUInt64LE(64)) / 10 ** USDC_DECIMALS : 0;
      setUsdcBalance(usdcBal);

      // Fetch SKR balance
      const skrMint = new PublicKey(SKR_MINT_ADDRESS);
      const skrAta = getAssociatedTokenAddressSync(skrMint, activePublicKey);
      const skrAtaInfo = await connection.getAccountInfo(skrAta);
      const skrBal = skrAtaInfo ? Number(skrAtaInfo.data.readBigUInt64LE(64)) / 10 ** SKR_DECIMALS : 0;
      setSkrBalance(skrBal);

      // Fetch SOL price
      try {
        const response = await fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112');
        const data = await response.json();
        if (data?.data?.['So11111111111111111111111111111111111111112']?.price) {
          setSolPrice(data.data['So11111111111111111111111111111111111111112'].price);
        }
      } catch (error) {
        console.error('[BadgesScreen] Error fetching SOL price:', error);
      }
    } catch (error) {
      console.error('[BadgesScreen] Error fetching balances:', error);
    }
  }, [activeWalletAddress, activePublicKey]);

  const handlePurchaseBadge = useCallback(async () => {
    if (!selectedBadge) {
      alert('Please select a badge');
      return;
    }

    if (!wallet || !wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (!signAndSendTransaction) {
      alert('Wallet not ready for transactions. Please reconnect.');
      return;
    }

    setIsProcessing(true);

    try {
      // Check for existing active subscription before payment
      const { data: existingSubscription } = await supabase
        .from('writer_subscriptions')
        .select('*')
        .eq('benefactor_wallet', activeWalletAddress)
        .eq('writer_id', selectedBadge.writer_id)
        .eq('is_active', true)
        .maybeSingle();

      if (existingSubscription) {
        throw new Error('You already have an active subscription to this writer. Please wait for it to expire.');
      }

      const badgePrice = selectedBadge.price || 0;
      let paymentAmount = 0;
      let paymentMint = null;

      if (selectedCurrency === 'USDC') {
        paymentMint = new PublicKey(USDC_MINT_ADDRESS);
        paymentAmount = Math.round(badgePrice * 1e6);
      } else if (selectedCurrency === 'SOL') {
        const currentSolPrice = solPrice || 150; // Fallback if price not loaded
        paymentAmount = Math.round((badgePrice / currentSolPrice) * 1e9);
      } else if (selectedCurrency === 'SKR') {
        paymentMint = new PublicKey(SKR_MINT_ADDRESS);
        paymentAmount = Math.round(badgePrice * 1e6);
      } else {
        throw new Error('Invalid currency');
      }

      // Comprehensive balance checking BEFORE transaction
      if (!paymentMint) {
        // SOL balance check
        const solBalance = await connection.getBalance(activePublicKey);
        const requiredLamports = paymentAmount + 10000; // Add buffer for transaction fee
        if (solBalance < requiredLamports) {
          throw new Error(`Insufficient SOL balance. You have ${(solBalance / 1e9).toFixed(4)} SOL but need ${(requiredLamports / 1e9).toFixed(4)} SOL. Please use USDC or SKR instead.`);
        }
      } else {
        // Token balance check
        try {
          const userAta = getAssociatedTokenAddressSync(paymentMint, activePublicKey);
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
          console.error('[BadgesScreen] Token balance check failed:', balanceError);
          if (balanceError.message.includes('No') || balanceError.message.includes('Insufficient')) {
            throw balanceError; // Re-throw our custom error
          }
          throw new Error(`Failed to check ${selectedCurrency} balance. Please try SOL instead.`);
        }
      }

      // Build transaction
      const instructions = [];
      const treasuryWallet = new PublicKey('4ZFvgNZygfiCSAS4aKBbQEgwJgBq5fRT9oLAH56GrF6H');

      if (!paymentMint) {
        // SOL transfer to treasury
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: activePublicKey,
            toPubkey: treasuryWallet,
            lamports: paymentAmount,
          })
        );
      } else {
        // Token transfer to treasury
        const userAta = getAssociatedTokenAddressSync(paymentMint, activePublicKey);
        const treasuryAta = getAssociatedTokenAddressSync(paymentMint, treasuryWallet, true);

        // Check if treasury ATA exists, create if needed
        const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
        if (!treasuryAtaInfo) {
          // Need to create treasury ATA first - this requires the treasury owner to do it
          // For now, throw an error if it doesn't exist
          throw new Error(`Treasury ${selectedCurrency} account not found. Please contact support.`);
        }

        instructions.push(
          createTransferInstruction(userAta, treasuryAta, activePublicKey, paymentAmount)
        );
      }

      const transaction = new Transaction();
      transaction.add(...instructions);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = activePublicKey;

      // Sign and send transaction
      const signature = await signAndSendTransaction(transaction);

      // Confirm transaction
      let retryCount = 0;
      const confirmMaxRetries = 3;
      let confirmation;

      while (retryCount < confirmMaxRetries) {
        try {
          confirmation = await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed'
          );
          break;
        } catch (confirmError) {
          retryCount++;
          if (retryCount >= confirmMaxRetries) {
            throw new Error('Transaction confirmation failed');
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (confirmation.value.err) {
        // Check for specific insufficient balance error
        const errorString = JSON.stringify(confirmation.value.err);
        if (errorString.includes('insufficient') || errorString.includes('lamports')) {
          throw new Error('Insufficient balance. Please check your wallet balance and try again.');
        }
        throw new Error('Transaction failed on blockchain');
      }

      // Call benefactor-payment edge function with retry logic
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Map badge type to plan type
      const planType = selectedBadge.type || 'blue'; // Default to blue if no type specified

      let edgeFunctionSuccess = false;
      let edgeFunctionError = null;
      const maxRetries = 3;

      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          const response = await fetch('https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/benefactor-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              writerId: selectedBadge.writer_id,
              badgeId: selectedBadge.id,
              planType,
              signature,
              userPublicKey: activeWalletAddress,
              currency: selectedCurrency,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            console.error('[BadgesScreen] Edge function error:', data.error);
            throw new Error(data.error || 'Failed to record purchase');
          }

          edgeFunctionSuccess = true;
          break;
        } catch (edgeError) {
          edgeFunctionError = edgeError;
          console.error(`[BadgesScreen] Edge function attempt ${retry + 1} failed:`, edgeError.message);
          if (retry < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
          }
        }
      }

      if (!edgeFunctionSuccess) {
        throw new Error(`Payment sent but failed to record. Transaction signature: ${signature}. Please contact support with this signature.`);
      }

      // Refresh user badges and balances
      await fetchBadges();
      await fetchBalances();
      setShowPurchaseModal(false);
      setSelectedBadge(null);

    } catch (error) {
      console.error('[BadgesScreen] Purchase error:', error.message);
      alert(error.message || 'Purchase failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedBadge, selectedCurrency, wallet, signAndSendTransaction, solPrice, selectedBadge?.writer_id, activeWalletAddress]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Badges</Text>
        <Text style={styles.subtitle}>Collect and display your achievements</Text>
      </View>

      {/* Writer Search and Selection */}
      <View style={styles.writerSection}>
        <Text style={styles.writerSectionTitle}>Select Writer</Text>
        <View style={styles.searchBar}>
          <FontAwesome5 name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search writers..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.writerList}>
          <TouchableOpacity
            style={[styles.writerChip, !selectedWriter && styles.writerChipSelected]}
            onPress={() => setSelectedWriter(null)}
          >
            <Text style={[styles.writerChipText, !selectedWriter && styles.writerChipTextSelected]}>All Writers</Text>
          </TouchableOpacity>
          {writers
            .filter(writer => writer.name?.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(writer => (
              <TouchableOpacity
                key={writer.id}
                style={[styles.writerChip, selectedWriter?.id === writer.id && styles.writerChipSelected]}
                onPress={() => setSelectedWriter(writer)}
              >
                <Text style={[styles.writerChipText, selectedWriter?.id === writer.id && styles.writerChipTextSelected]}>
                  {writer.name || 'Unknown'}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* User's Badges */}
        {userBadges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Badges</Text>
            <View style={styles.badgesGrid}>
              {userBadges.map((userBadge) => (
                <View key={userBadge.id} style={styles.badgeCard}>
                  <Image
                    source={getBadgeImage(userBadge.badges)}
                    style={styles.badgeImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.badgeName}>{userBadge.badges?.name}</Text>
                  <Text style={styles.badgeDescription}>{userBadge.badges?.description}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Available Badges - only show when a specific writer is selected */}
        {selectedWriter && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Badges</Text>
            <View style={styles.badgesGrid}>
              {badges.map((badge) => {
                const isOwned = userBadges.some(ub => ub.badge_id === badge.id);
                return (
                  <View key={badge.id} style={[styles.badgeCard, isOwned && styles.ownedBadge]}>
                    <Image
                      source={getBadgeImage(badge)}
                      style={styles.badgeImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.badgeName}>{badge.name}</Text>
                    <Text style={styles.badgeDescription}>{badge.description}</Text>
                    {!isOwned ? (
                      <TouchableOpacity
                        style={styles.purchaseButton}
                        onPress={() => {
                          setSelectedBadge(badge);
                          setShowPurchaseModal(true);
                        }}
                      >
                        <FontAwesome5 name="crown" size={16} color={colors.textPrimary} />
                        <Text style={styles.purchaseButtonText}>
                          ${badge.price || 0}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.ownedBadgeContainer}>
                        <FontAwesome5 name="check-circle" size={16} color={colors.gold} />
                        <Text style={styles.ownedText}>Owned</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Purchase Modal */}
      <Modal
        visible={showPurchaseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPurchaseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowPurchaseModal(false)}
            >
              <FontAwesome5 name="times" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Purchase Badge</Text>
            <Text style={styles.modalSubtitle}>{selectedBadge?.name}</Text>
            <Text style={styles.modalPrice}>${selectedBadge?.price || 0}</Text>

            {/* Currency Selector */}
            <View style={styles.currencySelector}>
              <TouchableOpacity
                style={[styles.currencyOption, selectedCurrency === 'USDC' && styles.currencyOptionSelected]}
                onPress={() => setSelectedCurrency('USDC')}
              >
                <FontAwesome5 name="dollar-sign" size={16} color={selectedCurrency === 'USDC' ? colors.gold : colors.textSecondary} />
                <Text style={[styles.currencyOptionText, selectedCurrency === 'USDC' && styles.currencyOptionTextSelected]}>USDC</Text>
                <Text style={styles.currencyBalance}>{usdcBalance.toFixed(2)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.currencyOption, selectedCurrency === 'SOL' && styles.currencyOptionSelected]}
                onPress={() => setSelectedCurrency('SOL')}
              >
                <FontAwesome5 name="coins" size={16} color={selectedCurrency === 'SOL' ? colors.gold : colors.textSecondary} />
                <Text style={[styles.currencyOptionText, selectedCurrency === 'SOL' && styles.currencyOptionTextSelected]}>SOL</Text>
                <Text style={styles.currencyBalance}>{solBalance.toFixed(4)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.currencyOption, selectedCurrency === 'SKR' && styles.currencyOptionSelected]}
                onPress={() => setSelectedCurrency('SKR')}
              >
                <FontAwesome5 name="gem" size={16} color={selectedCurrency === 'SKR' ? colors.gold : colors.textSecondary} />
                <Text style={[styles.currencyOptionText, selectedCurrency === 'SKR' && styles.currencyOptionTextSelected]}>SKR</Text>
                <Text style={styles.currencyBalance}>{skrBalance.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, isProcessing && styles.confirmButtonDisabled]}
              onPress={handlePurchaseBadge}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm Purchase</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default BadgesScreen;
