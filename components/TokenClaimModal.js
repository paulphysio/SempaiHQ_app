// components/TokenClaimModal.js
import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

const TokenClaimModal = ({ visible, onClose }) => {
  const [claimCount, setClaimCount] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const { user } = useAuth();
  const MAX_CLAIMS = 500;
  const isClaimDisabled = claimCount >= MAX_CLAIMS;

  const handleClaim = useCallback(async () => {
    if (isClaimDisabled || !user) return;

    try {
      setClaiming(true);

      const { data, error } = await supabase
        .from('user_activity')
        .upsert(
          {
            user_id: user.id,
            tokens_claimed: claimCount + 1,
            last_claim_timestamp: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('tokens_claimed')
        .single();

      if (error) throw error;

      setClaimCount(data.tokens_claimed);

      Alert.alert(
        'Success!',
        'You have claimed 1 million Sempai Tokens. They will be transferred to your wallet shortly.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Error claiming tokens:', error);
      Alert.alert('Error', 'Failed to claim tokens. Please try again later.');
    } finally {
      setClaiming(false);
    }
  }, [isClaimDisabled, user, claimCount, onClose]);

  useEffect(() => {
    if (visible && user) {
      const loadClaimCount = async () => {
        try {
          const { data, error } = await supabase
            .from('user_activity')
            .select('tokens_claimed')
            .eq('user_id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') throw error;
          if (data) {
            setClaimCount(data.tokens_claimed || 0);
          }
        } catch (error) {
          console.error('Error loading claim count:', error);
        }
      };

      loadClaimCount();
    }
  }, [visible, user]);

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
          style={styles.modalContainer}
        >
          <View style={styles.ornateBorder}>
            <View style={styles.contentContainer}>
              <Text style={styles.title}>Token Faucet</Text>
              <Text style={styles.message}>
                {isClaimDisabled
                  ? "Sorry, the faucet has been emptied out! Please fund your wallet and buy some SMP to read and participate in the read to earn economy!"
                  : "Hi, please claim your 1 million Sempai Tokens"}
              </Text>
              
              <View style={styles.counterContainer}>
                <Text style={styles.counterText}>
                  Claims: {claimCount}/{MAX_CLAIMS}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.claimButton,
                  (isClaimDisabled || claiming) && styles.claimButtonDisabled,
                ]}
                onPress={handleClaim}
                disabled={isClaimDisabled || claiming}
              >
                {claiming ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[
                    styles.claimButtonText,
                    isClaimDisabled && styles.claimButtonTextDisabled,
                  ]}>
                    Claim Tokens
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                disabled={claiming}
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
    borderRadius: 20,
    padding: 3,
  },
  ornateBorder: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 2,
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
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    marginBottom: 20,
    lineHeight: 22,
  },
  counterContainer: {
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  counterText: {
    fontSize: 16,
    color: '#FF8C00',
    fontWeight: 'bold',
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
    minWidth: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  claimButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
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