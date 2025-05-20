import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/WalletPanelStyles';

const WalletPanel = ({
  isWalletConnected,
  balance,
  weeklyPoints,
  pendingWithdrawal,
  withdrawAmount,
  setWithdrawAmount,
  isWithdrawing,
  handleWithdraw,
  checkBalance,
  errorMessage,
  timeLeft,
}) => {
  const [isOpen, setIsOpen] = useState(false); // Start collapsed
  const panelAnim = useRef(new Animated.Value(0)).current; // 0: hidden, 1: visible
  const buttonAnim = useRef(new Animated.Value(1)).current; // 1: visible, 0: hidden
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Debug props and state
  useEffect(() => {
    console.log('WalletPanel props and state:', {
      isWalletConnected,
      balance,
      weeklyPoints,
      pendingWithdrawal,
      timeLeft,
      isOpen,
    });
  }, [isWalletConnected, balance, weeklyPoints, pendingWithdrawal, timeLeft, isOpen]);

  // Pulse animation for floating button
  useEffect(() => {
    if (!isOpen) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isOpen]);

  const togglePanel = () => {
    Animated.parallel([
      Animated.timing(panelAnim, {
        toValue: isOpen ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setIsOpen(!isOpen);
    console.log('Toggling panel, new isOpen:', !isOpen);
  };

  if (!isWalletConnected) {
    console.log('Rendering placeholder due to isWalletConnected:', isWalletConnected);
    return (
      <Animated.View
        style={[
          styles.placeholderContainer,
          {
            opacity: buttonAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={togglePanel}>
          <LinearGradient
            colors={['#F36316', '#D94A00']}
            style={styles.placeholderButton}
          >
            <FontAwesome5 name="plug" size={20} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <>
      {/* Floating Wallet Icon - Visible when collapsed */}
      <Animated.View
        style={[
          styles.floatingButtonContainer,
          {
            opacity: buttonAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={togglePanel} accessible={true} accessibilityLabel="Open wallet panel">
          <LinearGradient
            colors={['#F36316', '#D94A00']}
            style={styles.floatingButtonGradient}
          >
            <FontAwesome5 name="wallet" size={20} color="#FFF" />
            <Text style={styles.floatingButtonText}>{Math.floor(balance).toLocaleString()} SMP</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Wallet Panel - Visible when open */}
      <Animated.View
        style={[
          styles.panelContainer,
          {
            transform: [
              {
                translateY: panelAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [400, 0], // Slide up from bottom
                }),
              },
            ],
            opacity: panelAnim,
          },
        ]}
      >
        <LinearGradient
          colors={['#1A1A1A', '#2A1A0A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.panelGradient}
        >
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={togglePanel}
            accessible={true}
            accessibilityLabel="Collapse wallet panel"
          >
            <LinearGradient
              colors={['#F36316', '#D94A00']}
              style={styles.closeButtonGradient}
            >
              <FontAwesome5 name="chevron-down" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Panel Content */}
          <View style={styles.panelContent}>
            <View style={styles.infoSection}>
              <View style={styles.infoItem}>
                <FontAwesome5 name="gem" size={16} color="#F36316" />
                <Text style={styles.infoLabel}>Balance</Text>
                <Text style={styles.infoValue}>{balance.toLocaleString()} SMP</Text>
              </View>
              <View style={styles.infoItem}>
                <FontAwesome5 name="star" size={16} color="#F36316" />
                <Text style={styles.infoLabel}>Points</Text>
                <Text style={styles.infoValue}>{weeklyPoints.toLocaleString()}</Text>
              </View>
              {pendingWithdrawal > 0 && (
                <View style={styles.infoItem}>
                  <FontAwesome5 name="hourglass-half" size={16} color="#F36316" />
                  <Text style={styles.infoLabel}>Pending</Text>
                  <Text style={styles.infoValue}>
                    {pendingWithdrawal.toLocaleString()} SMP
                  </Text>
                </View>
              )}
              <View style={styles.infoItem}>
                <FontAwesome5 name="clock" size={16} color="#F36316" />
                <Text style={styles.infoLabel}>Next Reset</Text>
                <Text style={styles.infoValue}>{timeLeft || 'Paused'}</Text>
              </View>
            </View>

            <View style={styles.actionSection}>
              <TextInput
                style={styles.input}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="Enter SMP amount"
                placeholderTextColor="#888"
                keyboardType="numeric"
              />
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, isWithdrawing && styles.buttonDisabled]}
                  onPress={handleWithdraw}
                  disabled={isWithdrawing}
                >
                  <LinearGradient
                    colors={isWithdrawing ? ['#333', '#333'] : ['#F36316', '#D94A00']}
                    style={styles.buttonGradient}
                  >
                    {isWithdrawing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.buttonText}>Withdraw</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={checkBalance}
                  disabled={isWithdrawing}
                >
                  <LinearGradient
                    colors={['#F36316', '#D94A00']}
                    style={styles.buttonGradient}
                  >
                    <FontAwesome5 name="sync-alt" size={16} color="#FFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </>
  );
};

export default WalletPanel;