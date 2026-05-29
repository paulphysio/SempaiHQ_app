import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { isWalletInstalled, connectExternalWallet, getSupportedWallets } from '../services/externalWalletService';
import { styles } from '../styles/ExternalWalletSelectorStyles';

const WALLET_COLORS = {
  phantom: ['#AB9FF2', '#8B5CF6'],
  solflare: ['#FF6B6B', '#EE5A5A'],
  backpack: ['#4ECDC4', '#44A08D']
};

const WALLET_ICONS = {
  phantom: 'ghost',
  solflare: 'sun',
  backpack: 'backpack'
};

const ExternalWalletSelector = ({ visible, onClose, onConnect }) => {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);

  useEffect(() => {
    if (visible) {
      loadWallets();
    }
  }, [visible]);

  const loadWallets = async () => {
    try {
      setLoading(true);
      const supportedWallets = getSupportedWallets();
      
      // Check which wallets are installed
      const walletStatus = await Promise.all(
        supportedWallets.map(async (wallet) => ({
          ...wallet,
          installed: await isWalletInstalled(wallet.name)
        }))
      );
      
      setWallets(walletStatus);
    } catch (error) {
      console.error('[ExternalWalletSelector] Error loading wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (walletName) => {
    try {
      setConnecting(walletName);
      const result = await connectExternalWallet(walletName, 'https://sempaihq.com');
      
      if (result.success) {
        if (onConnect) {
          onConnect(walletName);
        }
        onClose();
      }
    } catch (error) {
      console.error('[ExternalWalletSelector] Error connecting wallet:', error);
    } finally {
      setConnecting(null);
    }
  };

  const renderWallet = (wallet) => {
    const colors = WALLET_COLORS[wallet.name] || ['#8B8B8B', '#6B6B6B'];
    const icon = WALLET_ICONS[wallet.name] || 'wallet';

    return (
      <TouchableOpacity
        key={wallet.name}
        style={styles.walletCard}
        onPress={() => handleConnect(wallet.name)}
        disabled={!wallet.installed || connecting}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletIcon}
        >
          <FontAwesome5 name={icon} size={28} color="#FFFFFF" />
        </LinearGradient>
        
        <View style={styles.walletInfo}>
          <Text style={styles.walletName}>{wallet.displayName}</Text>
          <Text style={[
            styles.walletStatus,
            wallet.installed ? styles.installed : styles.notInstalled
          ]}>
            {wallet.installed ? 'Installed' : 'Not Installed'}
          </Text>
        </View>

        {connecting === wallet.name ? (
          <ActivityIndicator size="small" color="#4A90E2" />
        ) : (
          <FontAwesome5 
            name={wallet.installed ? 'plug' : 'download'} 
            size={20} 
            color={wallet.installed ? '#4CAF50' : '#CCCCCC'} 
          />
        )}
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome5 name="times" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.title}>Connect Wallet</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Select a wallet to connect. Make sure you have the wallet app installed.
            </Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={styles.loadingText}>Checking wallets...</Text>
              </View>
            ) : (
              <View style={styles.walletList}>
                {wallets.map(renderWallet)}
              </View>
            )}

            <View style={styles.infoBox}>
              <FontAwesome5 name="info-circle" size={16} color="#4A90E2" />
              <Text style={styles.infoText}>
                External wallets provide enhanced security and allow you to use your existing wallet across multiple platforms.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ExternalWalletSelector;
