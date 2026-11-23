import React, { useState, useEffect, useContext, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Clipboard, StyleSheet, Image } from 'react-native';
import { GelModal, GelInset } from './gel/GelKit';
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
import { useTheme } from '../context/ThemeContext';
import { toast } from './Toast';

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
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getBalanceModalStyles(colors), [isDark]);
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
    toast.success('Address copied to clipboard');
  };

  const formatBalance = (balance) => {
    return balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  if (!isOpen) return null;

  return (
    <GelModal
      visible={isOpen}
      onClose={onClose}
      variant="sheet"
      icon="wallet"
      title="Your portfolio"
      subtitle={activeWalletAddress ? `${activeWalletAddress.slice(0, 6)}…${activeWalletAddress.slice(-4)}` : undefined}
      scroll
      actions={[{ label: 'Copy address to receive', icon: 'copy', variant: 'secondary', onPress: () => copyToClipboard(activeWalletAddress) }]}
    >
      <GelInset>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Loading balances…</Text>
          </View>
        ) : (
          Object.entries(balances).map(([symbol, data], i) => (
            <View key={symbol} style={[styles.balanceRow, i === 0 && { borderTopWidth: 0 }]}>
              <View style={styles.balanceLeft}>
                <Image source={data.logo} style={styles.tokenLogo} />
                <Text style={styles.tokenSymbol}>{data.symbol}</Text>
              </View>
              <Text style={styles.balanceAmount}>{formatBalance(data.balance)}</Text>
            </View>
          ))
        )}
      </GelInset>
    </GelModal>
  );
};

export const getBalanceModalStyles = (c) => StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: c.bgCard,
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
    
    color: c.textPrimary,
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
    color: c.textMuted,
    marginTop: 12,
  },
  balanceRow: {
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
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
    color: c.textPrimary,
    fontWeight: '700',
    fontSize: 15,
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
    color: c.textPrimary,
    fontWeight: '800',
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
    color: '#fff',
    
    fontSize: 14,
  },
});

export default BalanceModal;
