import React, { useState, useEffect } from 'react';
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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://<project-ref>.supabase.co';
const EDGE_FUNCTION_VERSION = '1.0.0';
const MAX_CLAIMS = 500;

const TokenClaimModal = ({ visible, onClose, onTokenClaim }) => {
  const [claimCount, setClaimCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const checkServiceHealth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const response = await fetch(`${SUPABASE_URL}/functions/v1/airdrop-wallet/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'x-client-version': EDGE_FUNCTION_VERSION,
        },
      });
      const health = await response.json();
      return health.status === 'ok';
    } catch (err) {
      console.error('[TokenClaimModal] Health check failed:', err);
      return false;
    }
  };

  useEffect(() => {
    const fetchClaimCount = async () => {
      try {
        const { count, error } = await supabase
          .from('airdrop_transactions')
          .select('id', { count: 'exact' });
        if (error) throw new Error(`Supabase error: ${error.message}`);
        setClaimCount(count || 0);
      } catch (err) {
        console.error('[TokenClaimModal] Error loading claim count:', err.message);
        setErrorMessage('Failed to load airdrop status. Please try again.');
      }
    };

    if (visible) {
      fetchClaimCount();
      setErrorMessage(null);
      setRetryCount(0);
    }
  }, [visible]);

  const handleClaim = async () => {
    if (isLoading || claimCount >= MAX_CLAIMS) return;
    setIsLoading(true);
    setErrorMessage(null);

    let attempts = retryCount;
    while (attempts < MAX_RETRIES) {
      try {
        const isHealthy = await checkServiceHealth();
        if (!isHealthy) throw new Error('Airdrop service unavailable');

        const signature = await onTokenClaim();
        Alert.alert('Success', `Airdrop claimed!\nTransaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
        setClaimCount(prev => prev + 1);
        setRetryCount(0);
        onClose();
        return;
      } catch (err) {
        console.error(`[TokenClaimModal] Attempt ${attempts + 1}/${MAX_RETRIES} failed:`, err);
        if (
          err.message.includes('already claimed') ||
          err.message.includes('User not found') ||
          err.message.includes('Airdrop limit') ||
          err.message.includes('Invalid or expired token')
        ) {
          setErrorMessage(err.message);
          break;
        }

        attempts++;
        setRetryCount(attempts);
        if (attempts < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempts - 1);
          setErrorMessage(`Server error (attempt ${attempts}/${MAX_RETRIES}). Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          setErrorMessage('The airdrop service is currently unavailable. Please try again later.');
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
              <Text style={styles.message}>
                {claimCount >= MAX_CLAIMS
                  ? "Sorry, the faucet has been emptied out!"
                  : "Claim your 1 million Sempai Tokens"}
              </Text>
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
              <TouchableOpacity
                style={[
                  styles.claimButton,
                  (isLoading || claimCount >= MAX_CLAIMS) && styles.claimButtonDisabled,
                ]}
                onPress={handleClaim}
                disabled={isLoading || claimCount >= MAX_CLAIMS}
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
                    claimCount >= MAX_CLAIMS && styles.claimButtonTextDisabled,
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