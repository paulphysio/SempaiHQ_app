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

// Supabase project URL
const SUPABASE_URL = 'https://xqeimsncmnqsiowftdmz.supabase.co';
const EDGE_FUNCTION_VERSION = '1.0.0';
const MAX_CLAIMS = 500;

const TokenClaimModal = ({ visible, onClose, userId }) => {
  const [claimCount, setClaimCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [serviceStatus, setServiceStatus] = useState(null);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  // Check if the airdrop service is available
  const checkServiceHealth = async (session) => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/airdrop-wallet/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'x-client-version': EDGE_FUNCTION_VERSION,
        },
      });

      if (response.ok) {
        const health = await response.json();
        console.log('[TokenClaimModal] Service health check:', health);
        return health.status === 'ok';
      }
      return false;
    } catch (err) {
      console.error('[TokenClaimModal] Health check failed:', err);
      return false;
    }
  };

  useEffect(() => {
    const fetchClaimCount = async () => {
      try {
        const { count, error } = await supabase
          .from('user_activity')
          .select('user_id', { count: 'exact' })
          .eq('has_claimed_airdrop', true);
        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }
        console.log('[TokenClaimModal] Claim count:', count);
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
      setServiceStatus(null);
    }
  }, [visible]);

  const onTokenClaim = async () => {
    try {
      // Check authentication state
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('[TokenClaimModal] Initial session:', session, 'Session Error:', sessionError);
      
      if (sessionError || !session?.access_token) {
        const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
        console.log('[TokenClaimModal] Refreshed session:', refreshedSession, 'Refresh Error:', refreshError);
        if (refreshError || !refreshedSession?.session?.access_token) {
          throw new Error('User not authenticated');
        }
        session = refreshedSession.session;
      }

      // Check service health before proceeding
      const isHealthy = await checkServiceHealth(session);
      if (!isHealthy) {
        setServiceStatus('unavailable');
        throw new Error('The airdrop service is currently unavailable. Please try again later.');
      }
      setServiceStatus('available');

      // Verify userId matches authenticated user
      const { data: user, error: userError } = await supabase.auth.getUser();
      console.log('[TokenClaimModal] Authenticated user:', user, 'User Error:', userError);
      
      if (userError || !user?.user?.id) {
        throw new Error('Failed to fetch authenticated user');
      }
      if (userId && userId !== user.user.id) {
        throw new Error('Provided user ID does not match authenticated user');
      }

      // First check if user has already claimed
      const { data: existingClaim, error: claimError } = await supabase
        .from('user_activity')
        .select('has_claimed_airdrop')
        .eq('user_id', userId || user.user.id)
        .single();
        
      if (claimError && claimError.code !== 'PGRST116') {
        throw new Error('Failed to check claim status');
      }
      
      if (existingClaim?.has_claimed_airdrop) {
        throw new Error('You have already claimed the airdrop');
      }

      // Call the airdrop function
      const requestBody = { 
        user_id: userId || user.user.id,
        encryption_version: 'aes-256-cbc',
        client_version: EDGE_FUNCTION_VERSION
      };
      console.log('[TokenClaimModal] Request body:', requestBody);

      let controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/airdrop-wallet`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'x-client-info': 'TokenClaimModal/1.0',
            'x-client-version': EDGE_FUNCTION_VERSION,
            'Accept': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Log response details for debugging
        console.log('[TokenClaimModal] Response status:', response.status);
        console.log('[TokenClaimModal] Response headers:', Object.fromEntries(response.headers.entries()));

        let result;
        const contentType = response.headers.get('content-type');
        const responseText = await response.text();
        console.log('[TokenClaimModal] Response text:', responseText);

        try {
          result = JSON.parse(responseText);
        } catch (e) {
          console.error('[TokenClaimModal] JSON parse error:', e);
          
          // Check for early drop or timeout
          if (responseText.includes('EarlyDrop') || e.name === 'AbortError') {
            throw new Error('The request took too long to process. This might mean high network latency or server load. Please try again.');
          }
          
          if (response.status === 500) {
            const serverVersion = response.headers.get('x-server-version');
            if (serverVersion && serverVersion !== EDGE_FUNCTION_VERSION) {
              throw new Error(`Version mismatch. Please refresh the page and try again. (Client: ${EDGE_FUNCTION_VERSION}, Server: ${serverVersion})`);
            }
            throw new Error('Server error: The airdrop service is temporarily unavailable. Please try again in a few minutes.');
          } else {
            throw new Error(`Invalid response from server: ${responseText}`);
          }
        }

        if (!response.ok) {
          if (response.status === 408 || response.status === 504) {
            throw new Error('The request timed out. Please try again.');
          }
          throw new Error(result.error || `Server error: ${response.status}`);
        }

        if (result.confirmationError) {
          throw new Error(`Transaction failed: ${result.confirmationError}`);
        }

        if (!result.signature) {
          throw new Error('No transaction signature returned');
        }

        return result.signature;
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new Error('The request took too long to complete. Please try again.');
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      console.error('[TokenClaimModal] Claim error:', err);
      throw err;
    }
  };

  const handleClaim = async () => {
    if (isLoading || claimCount >= MAX_CLAIMS) return;

    setIsLoading(true);
    setErrorMessage(null);

    let attempts = retryCount;
    const maxAttempts = MAX_RETRIES;
    const baseDelay = RETRY_DELAY;

    while (attempts < maxAttempts) {
      try {
        const signature = await onTokenClaim();
        
        // Update user_activity to mark the claim
        const { error: updateError } = await supabase
          .from('user_activity')
          .upsert(
            { 
              user_id: userId, 
              has_claimed_airdrop: true,
              last_claim_timestamp: new Date().toISOString()
            }, 
            { onConflict: 'user_id' }
          );

        if (updateError) {
          console.warn('[TokenClaimModal] Failed to update claim status:', updateError.message);
        }

        Alert.alert(
          'Success', 
          `Airdrop claimed!\nTransaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`
        );
        
        setClaimCount(prev => prev + 1);
        setRetryCount(0);
        setServiceStatus(null);
        onClose();
        return;
      } catch (err) {
        console.error(`[TokenClaimModal] Attempt ${attempts + 1}/${maxAttempts} failed:`, err);
        
        // Handle specific errors
        if (
          err.message.includes('already claimed') ||
          err.message.includes('User not found') ||
          err.message.includes('Airdrop limit') ||
          err.message.includes('Invalid JWT') ||
          err.message.includes('User not authenticated') ||
          err.message.includes('Provided user ID') ||
          err.message.includes('Failed to fetch authenticated user') ||
          err.message.includes('Version mismatch')
        ) {
          setErrorMessage(err.message);
          break; // Don't retry these errors
        }

        // For server errors, use exponential backoff
        attempts++;
        setRetryCount(attempts);
        
        if (attempts < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempts - 1); // Exponential backoff
          setErrorMessage(`Server error (attempt ${attempts}/${maxAttempts}). Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        setErrorMessage(
          err.message.includes('took too long') || err.message.includes('timed out')
            ? 'The server is experiencing high load. Please try again in a few minutes.'
            : err.message.includes('Server error')
              ? err.message
              : 'The airdrop service is currently unavailable. Please try again later.'
        );
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
                  ? "Sorry, the faucet has been emptied out! Please fund your wallet and buy some SMP to read and participate in the read to earn economy!"
                  : "Hi, please claim your 1 million Sempai Tokens"}
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

              {serviceStatus === 'unavailable' && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Service Status: Unavailable</Text>
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
                    (claimCount >= MAX_CLAIMS) && styles.claimButtonTextDisabled,
                  ]}>
                    Claim Tokens
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
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
