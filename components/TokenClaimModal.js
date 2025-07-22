import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { supabase } from '../services/supabaseClient';
import { getUserDetails } from '../utils/userManagement';
import { fetchSolBalance } from '../utils/solana';

const MAX_CLAIMS = 500;
const MINIMUM_SOL_FOR_AIRDROP = 0.005; // 0.5 USD worth of SOL (assuming 1 SOL = $100)

const TokenClaimModal = ({ visible, onClose, onTokenClaim, userId }) => {
  const [claimCount, setClaimCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isEligible, setIsEligible] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;
  const [solBalance, setSolBalance] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);

  const checkEligibility = useCallback(async () => {
    if (!userId) {
      console.error('[TokenClaimModal] No userId provided');
      setErrorMessage('User not authenticated. Please sign in.');
      setIsEligible(false);
      return false;
    }
    try {
      setIsCheckingEligibility(true);
      const { data, error } = await supabase
        .from('user_activity')
        .select('has_claimed_airdrop')
        .eq('user_id', userId)
        .single();
      if (error && error.code === 'PGRST116') {
        console.log('[TokenClaimModal] No user_activity entry for user:', userId);
        return true; // Eligible if no entry exists
      }
      if (error) {
        console.error('[TokenClaimModal] Eligibility check error:', error.message);
        throw new Error(`Failed to check eligibility: ${error.message}`);
      }
      console.log('[TokenClaimModal] Eligibility check result:', data.has_claimed_airdrop);
      return !data.has_claimed_airdrop;
    } catch (err) {
      console.error('[TokenClaimModal] Unexpected eligibility error:', err.message);
      setErrorMessage('Unable to verify eligibility. Please try again.');
      return false;
    } finally {
      setIsCheckingEligibility(false);
    }
  }, [userId]);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        // Fetch claim count
        const { count, error: countError } = await supabase
          .from('airdrop_transactions')
          .select('id', { count: 'exact' });
        if (countError) {
          throw new Error(`Supabase count error: ${countError.message}`);
        }
        console.log('[TokenClaimModal] Fetched claim count:', count);
        setClaimCount(count || 0);

        // Fetch wallet address and SOL balance
        let userWallet = null;
        if (userId) {
          try {
            const userDetails = await getUserDetails(userId);
            if (userDetails && userDetails.wallet_address) {
              setWalletAddress(userDetails.wallet_address);
              userWallet = userDetails.wallet_address;
              const sol = await fetchSolBalance(userDetails.wallet_address);
              setSolBalance(sol);
            } else {
              setWalletAddress(null);
              setSolBalance(null);
            }
          } catch (err) {
            setWalletAddress(null);
            setSolBalance(null);
            console.error('[TokenClaimModal] Failed to fetch wallet address or SOL balance:', err.message);
          }
        }

        // Check eligibility
        const eligible = await checkEligibility();
        setIsEligible(eligible);
        if (!eligible) {
          setErrorMessage('You have already claimed the airdrop.');
        }
      } catch (err) {
        console.error('[TokenClaimModal] Initialization error:', err.message);
        setErrorMessage('Failed to load airdrop status. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (visible) {
      initialize();
      setErrorMessage(null);
      setRetryCount(0);
    }
  }, [visible, checkEligibility]);

  // Default onTokenClaim implementation
  const defaultOnTokenClaim = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('airdrop-function/airdrop', {
        body: JSON.stringify({ user_id: userId }),
        method: 'POST',
      });
      if (error) {
        throw new Error(error.message || 'Failed to claim airdrop');
      }
      if (!data.signature) {
        throw new Error('No transaction signature returned');
      }
      return data.signature;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const handleClaim = async () => {
    if (isLoading || isCheckingEligibility || claimCount >= MAX_CLAIMS || !isEligible) return;
    setIsLoading(true);
    setErrorMessage(null);

    let attempts = retryCount;
    while (attempts < MAX_RETRIES) {
      try {
        console.log(`[TokenClaimModal] Attempt ${attempts + 1}/${MAX_RETRIES} to claim tokens`);
        const signature = await (onTokenClaim || defaultOnTokenClaim)();
        console.log('[TokenClaimModal] Airdrop successful, signature:', signature);
        Alert.alert('Success', `Airdrop claimed!\nTransaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
        setClaimCount(prev => prev + 1);
        setRetryCount(0);
        onClose();
        return;
      } catch (err) {
        const errorMsg = err.message || 'Unknown error occurred';
        console.error(
          `[TokenClaimModal] Attempt ${attempts + 1}/${MAX_RETRIES} failed:`,
          JSON.stringify({ message: errorMsg, stack: err.stack }, null, 2)
        );
        // Stop retries for non-recoverable errors
        if (
          errorMsg.includes('already claimed') ||
          errorMsg.includes('Invalid user id') ||
          errorMsg.includes('Airdrop limit reached') ||
          errorMsg.includes('Failed to retrieve user wallet') ||
          errorMsg.includes('Invalid user wallet address') ||
          errorMsg.includes('No wallet address found for user') ||
          errorMsg.includes('Airdrop wallet has insufficient SOL') ||
          errorMsg.includes('User has already claimed airdrop') ||
          errorMsg.includes('non-2xx status code') ||
          errorMsg.includes('Failed to log transaction')
        ) {
          setErrorMessage(errorMsg);
          break;
        }

        attempts++;
        setRetryCount(attempts);
        if (attempts < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempts);
          console.log(`[TokenClaimModal] Retrying in ${delay / 1000}s...`);
          setErrorMessage(`Retrying (${attempts}/${MAX_RETRIES}) in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          setErrorMessage('Airdrop service unavailable. Please try again later or contact support.');
        }
      }
    }
    setIsLoading(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={['#FF8C00', '#FFA500']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.modalContainer}
        >
          <View style={styles.ornateBorder}>
            <View style={styles.contentContainer}>
              <Text style={styles.title}>Token Faucet</Text>
              {isCheckingEligibility ? (
                <Text style={styles.message}>Checking eligibility...</Text>
              ) : (
                <Text style={styles.message}>
                  {claimCount >= MAX_CLAIMS
                    ? 'Sorry, the faucet has been emptied out!'
                    : isEligible
                    ? 'Claim your 1 million Sempai Tokens'
                    : 'You are not eligible for this airdrop.'}
                </Text>
              )}
              <View style={styles.counterContainer}>
                <Text style={styles.counterText}>
                  Claims: {claimCount}/{MAX_CLAIMS}
                </Text>
              </View>
              {errorMessage && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}
              {isEligible && solBalance !== null && solBalance < MINIMUM_SOL_FOR_AIRDROP && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>
                    Warning: Your wallet has less than 0.5 USD worth of SOL. You need at least 0.5 USD worth of SOL to pay for transaction fees and account creation. Please reconnect your wallet after topping up your wallet before claiming. 
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.claimButton,
                  (isLoading || isCheckingEligibility || claimCount >= MAX_CLAIMS || !isEligible || solBalance !== null && solBalance < MINIMUM_SOL_FOR_AIRDROP) && styles.claimButtonDisabled,
                ]}
                onPress={handleClaim}
                disabled={isLoading || isCheckingEligibility || claimCount >= MAX_CLAIMS || !isEligible || (solBalance !== null && solBalance < MINIMUM_SOL_FOR_AIRDROP)}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#FFF" style={styles.loadingSpinner} />
                    <Text style={[styles.claimButtonText, { marginLeft: 8 }]}>
                      Claiming...
                    </Text>
                  </View>
                ) : (
                  <Text style={[
                    styles.claimButtonText,
                    (claimCount >= MAX_CLAIMS || !isEligible) && styles.claimButtonTextDisabled,
                  ]}>
                    Claim Tokens
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: Dimensions.get('window').width * 0.9,
    maxWidth: 400,
    borderRadius: 20,
    padding: 3,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  ornateBorder: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 2,
    overflow: 'hidden',
  },
  contentContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF8C00',
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  counterContainer: {
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
    minWidth: 150,
    alignItems: 'center',
  },
  counterText: {
    fontSize: 16,
    color: '#FF8C00',
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#FFF0F0',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFB6B6',
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    marginRight: 8,
  },
  claimButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 200,
    alignItems: 'center',
  },
  claimButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  claimButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  claimButtonTextDisabled: {
    color: '#666666',
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default TokenClaimModal;