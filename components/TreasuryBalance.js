import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { AMETHYST_MINT_ADDRESS, SMP_MINT_ADDRESS, RPC_URL } from '../constants';

const TREASURY_WALLET = 'HSxUYwGM3NFzDmeEJ6o4bhyn8knmQmq7PLUZ6nZs4F58';

const TreasuryBalance = () => {
  const [amethystBalance, setAmethystBalance] = useState(null);
  const [smpBalance, setSmpBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const connection = new Connection(RPC_URL);
        const treasuryPublicKey = new PublicKey(TREASURY_WALLET);
        const amethystMintPublicKey = new PublicKey(AMETHYST_MINT_ADDRESS);
        const smpMintPublicKey = new PublicKey(SMP_MINT_ADDRESS);

        // Fetch Amethyst balance
        const amethystATA = await getAssociatedTokenAddress(amethystMintPublicKey, treasuryPublicKey);
        const amethystAccountInfo = await connection.getAccountInfo(amethystATA);
        
        let amethAmount = 0;
        if (amethystAccountInfo) {
          const amethystTokenAccount = await getAccount(connection, amethystATA);
          const tokenAmount = amethystTokenAccount.amount.toString();
          const tokenAmountFormatted = (BigInt(tokenAmount) / BigInt(10 ** 0)).toString();
          amethAmount = (parseInt(tokenAmountFormatted) / 1000000).toFixed(6);
        }
        setAmethystBalance(amethAmount);

        // Fetch SMP balance
        const smpATA = await getAssociatedTokenAddress(smpMintPublicKey, treasuryPublicKey);
        const smpAccountInfo = await connection.getAccountInfo(smpATA);
        
        let smpAmount = 0;
        if (smpAccountInfo) {
          const smpTokenAccount = await getAccount(connection, smpATA);
          const tokenAmount = smpTokenAccount.amount.toString();
          const tokenAmountFormatted = (BigInt(tokenAmount) / BigInt(10 ** 6)).toString();
          smpAmount = (parseInt(tokenAmountFormatted) / 1000000).toFixed(6);
        }
        setSmpBalance(smpAmount);

      } catch (error) {
        if (error.message && error.message.includes('429')) {
          console.log('Treasury balance rate limited, keeping last balance');
          setLoading(false);
          return;
        }
        console.error('Error fetching balances:', error);
        setAmethystBalance(0);
        setSmpBalance(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#E67E22" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Treasury</Text>
      
      {/* Amethyst Balance */}
      <View style={styles.balanceRow}>
        <Image 
          source={require('../assets/images/amethyst-logo.jpeg')} 
          style={styles.tokenLogo}
        />
        <View style={styles.balanceInfo}>
          <Text style={styles.tokenName}>Amethyst</Text>
          <Text style={styles.balanceAmount}>
            {Number(amethystBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </Text>
        </View>
      </View>

      {/* SMP Balance */}
      <View style={[styles.balanceRow, styles.balanceRowBorder]}>
        <Image 
          source={require('../assets/images/smp-logo.jpeg')} 
          style={styles.tokenLogo}
        />
        <View style={styles.balanceInfo}>
          <Text style={styles.tokenName}>SMP</Text>
          <Text style={styles.balanceAmount}>
            {Number(smpBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(8, 8, 14, 0.5)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    maxWidth: 420,
    margin: 24,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.12)',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.15,
    marginBottom: 12,
    color: 'rgba(243, 99, 22, 0.7)',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceRowBorder: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 0,
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(163, 89, 255, 0.4)',
  },
  balanceInfo: {
    flex: 1,
  },
  tokenName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
});

export default TreasuryBalance;
