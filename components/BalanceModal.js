import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Clipboard,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import Modal from 'react-native-modal';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {
  AMETHYST_MINT_ADDRESS,
  SMP_MINT_ADDRESS,
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
  RPC_URL,
} from '../constants';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';

const connection = new Connection(RPC_URL);

const TOKEN_MINTS = {
  SOL: {
    mint: new PublicKey('So11111111111111111111111111111111111111112'),
    decimals: 9,
    symbol: 'SOL',
    logo: require('../assets/images/sol-logo.png'),
  },
  JUP: {
    mint: new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'),
    decimals: 6,
    symbol: 'JUP',
    logo: require('../assets/images/jup-logo.png'),
  },
  AMETHYST: {
    mint: AMETHYST_MINT_ADDRESS,
    decimals: 6,
    symbol: 'AMETHYST',
    logo: require('../assets/images/amethyst-logo.jpeg'),
  },
  SMP: {
    mint: SMP_MINT_ADDRESS,
    decimals: 6,
    symbol: 'SMP',
    logo: require('../assets/images/smp-logo.jpeg'),
  },
  SKR: {
    mint: SKR_MINT_ADDRESS,
    decimals: 6,
    symbol: 'SKR',
    logo: require('../assets/images/skr-logo.png'),
  },
  USDC: {
    mint: USDC_MINT_ADDRESS,
    decimals: 6,
    symbol: 'USDC',
    logo: require('../assets/images/usdc-logo.png'),
  },
};

const BalanceModal = ({ isOpen, onClose, activeWalletAddress }) => {
  const { wallet: embeddedWallet } = useContext(EmbeddedWalletContext);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && activeWalletAddress) {
      fetchAllBalances();
    }
  }, [isOpen, activeWalletAddress]);

  const fetchAllBalances = async () => {
    setLoading(true);
    const newBalances = {};

    try {
      for (const [symbol, token] of Object.entries(TOKEN_MINTS)) {
        let balance = 0;

        if (symbol === 'SOL') {
          const solBalance = await connection.getBalance(new PublicKey(activeWalletAddress));
          balance = solBalance / 1_000_000_000;
        } else {
          const ataAddress = getAssociatedTokenAddressSync(token.mint, new PublicKey(activeWalletAddress));
          const ataInfo = await connection.getAccountInfo(ataAddress);
          if (ataInfo) {
            const ata = unpackAccount(ataAddress, ataInfo);
            balance = Number(ata.amount) / Math.pow(10, token.decimals);
          }
        }

        newBalances[symbol] = {
          balance,
          symbol: token.symbol,
          mint: token.mint.toString(),
          logo: token.logo,
        };
      }

      setBalances(newBalances);
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  const formatBalance = (balance) => {
    return balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  if (!isOpen) return null;

  return (
    <Modal isVisible={isOpen} onBackdropPress={onClose} style={styles.modal}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Icon name="times" size={22} color="#ffffff" />
        </TouchableOpacity>

        <Text style={styles.modalTitle}>Your Portfolio</Text>

        {/* Wallet Address */}
        <View style={styles.walletAddressContainer}>
          <View>
            <Text style={styles.walletAddressLabel}>Wallet Address</Text>
            <Text style={styles.walletAddressText}>
              {activeWalletAddress?.slice(0, 6)}...{activeWalletAddress?.slice(-4)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => copyToClipboard(activeWalletAddress)}
          >
            <Icon name="copy" size={14} color="#E67E22" />
          </TouchableOpacity>
        </View>

        {/* Token Balances */}
        <View style={styles.balancesSection}>
          <Text style={styles.sectionTitle}>Token Balances</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#E67E22" />
              <Text style={styles.loadingText}>Loading balances...</Text>
            </View>
          ) : (
            Object.entries(balances).map(([symbol, data]) => (
              <View key={symbol} style={styles.balanceRow}>
                <View style={styles.balanceLeft}>
                  <Image source={data.logo} style={styles.tokenLogo} />
                  <View>
                    <Text style={styles.tokenSymbol}>{data.symbol}</Text>
                    <Text style={styles.tokenMint}>
                      {data.mint.slice(0, 8)}...{data.mint.slice(-8)}
                    </Text>
                  </View>
                </View>
                <View style={styles.balanceRight}>
                  <Text style={styles.balanceAmount}>{formatBalance(data.balance)}</Text>
                  <Text style={styles.balanceSymbol}>{data.symbol}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.sendButton}>
            <Icon name="paper-plane" size={13} color="#ffffff" />
            <Text style={styles.actionButtonText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.receiveButton}
            onPress={() => copyToClipboard(activeWalletAddress)}
          >
            <Icon name="copy" size={13} color="#ffffff" />
            <Text style={styles.actionButtonText}>Receive</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 440,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.18)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    
    color: '#ffffff',
    marginBottom: 24,
  },
  walletAddressContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.1)',
  },
  walletAddressLabel: {
    fontSize: 11,
    
    textTransform: 'uppercase',
    letterSpacing: 0.12,
    color: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 4,
  },
  walletAddressText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  copyButton: {
    backgroundColor: 'rgba(243, 99, 22, 0.08)',
    borderRadius: 8,
    padding: 8,
  },
  balancesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    
    textTransform: 'uppercase',
    letterSpacing: 0.12,
    marginBottom: 12,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.35)',
    marginTop: 12,
  },
  balanceRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tokenSymbol: {
    color: '#ffffff',
    
    fontSize: 14,
  },
  tokenMint: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: 'rgba(255, 255, 255, 0.25)',
    marginTop: 2,
  },
  balanceRight: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    color: '#ffffff',
    
    fontSize: 16,
  },
  balanceSymbol: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  sendButton: {
    flex: 1,
    backgroundColor: 'rgba(243, 99, 22, 0.85)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  receiveButton: {
    flex: 1,
    backgroundColor: 'rgba(76, 175, 80, 0.7)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    
    fontSize: 14,
  },
});

export default BalanceModal;
