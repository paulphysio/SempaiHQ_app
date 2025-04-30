// ./screens/SwapScreen.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount, getAccount } from '@solana/spl-token';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Modal from 'react-native-modal';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import { AMETHYST_MINT_ADDRESS, SMP_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../constants';
import { styles } from '../styles/SwapStyles';

const connection = new Connection(RPC_URL, 'confirmed');

// Define allowed tokens
const TOKEN_MINTS = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  JUP: new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'),
  AMETHYST: AMETHYST_MINT_ADDRESS,
  SMP: SMP_MINT_ADDRESS,
};

const SwapScreen = () => {
  const navigation = useNavigation();
  const { wallet, signAndSendTransaction } = useContext(EmbeddedWalletContext);
  const isWalletConnected = !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();
  const [amount, setAmount] = useState('');
  const [coinFrom, setCoinFrom] = useState('AMETHYST');
  const [coinTo, setCoinTo] = useState('SMP');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');

  // Debug wallet state
  useEffect(() => {
    console.log('Wallet state:', {
      publicKey: wallet?.publicKey?.toString(),
      hasSignAndSendTransaction: !!signAndSendTransaction,
      walletObject: wallet,
    });
  }, [wallet, signAndSendTransaction]);

  const checkBalance = useCallback(async () => {
    if (!activeWalletAddress) {
      setBalance(0);
      return;
    }

    try {
      const mintAddress = TOKEN_MINTS[coinFrom];
      let balance = 0;

      if (coinFrom === 'SOL') {
        const solBalance = await connection.getBalance(new PublicKey(activeWalletAddress));
        balance = solBalance / 1_000_000_000; // 9 decimals
      } else {
        const ataAddress = getAssociatedTokenAddressSync(mintAddress, new PublicKey(activeWalletAddress));
        const ataInfo = await connection.getAccountInfo(ataAddress);
        if (ataInfo) {
          const ata = unpackAccount(ataAddress, ataInfo);
          balance = Number(ata.amount) / 10 ** SMP_DECIMALS; // Use SMP_DECIMALS (6)
        }
      }
      setBalance(balance);
      console.log(`Balance for ${coinFrom}: ${balance}`);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setError('Failed to fetch balance. Please try again.');
      setTimeout(() => setError(null), 5000);
      setBalance(0);
    }
  }, [activeWalletAddress, coinFrom]);

  const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'API request failed');
        }
        return await response.json();
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);
        if (attempt === retries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  };

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (!isWalletConnected) {
      setError('Please connect your wallet to swap.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (coinFrom === coinTo) {
      setError('Please select different tokens to swap.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (parseFloat(amount) > balance) {
      setError(`Insufficient ${coinFrom} balance: ${balance.toFixed(2)} available.`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      setError('Please enter your wallet password.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    setLoading(true);
    setError(null);
    setShowPasswordModal(false);

    try {
      // Check on-chain balance
      if (coinFrom === 'SOL') {
        const solBalance = await connection.getBalance(new PublicKey(activeWalletAddress));
        const requiredSol = parseFloat(amount) * 1_000_000_000 + 5000; // Amount + fee
        if (solBalance < requiredSol) {
          throw new Error(
            `Insufficient SOL balance: ${(solBalance / 1_000_000_000).toFixed(4)} SOL available, need ${(requiredSol / 1_000_000_000).toFixed(4)} SOL`
          );
        }
      } else {
        const sourceATA = getAssociatedTokenAddressSync(TOKEN_MINTS[coinFrom], new PublicKey(activeWalletAddress));
        const accountInfo = await connection.getAccountInfo(sourceATA);
        const tokenBalance = accountInfo ? Number((await getAccount(connection, sourceATA)).amount) / 10 ** SMP_DECIMALS : 0;
        if (tokenBalance < parseFloat(amount)) {
          throw new Error(`Insufficient ${coinFrom} balance: ${tokenBalance.toFixed(2)} available, need ${amount}`);
        }
      }

      const inputMint = TOKEN_MINTS[coinFrom].toString();
      const outputMint = TOKEN_MINTS[coinTo].toString();
      console.log('Swap Request:', {
        userAddress: activeWalletAddress,
        amount: parseFloat(amount),
        inputMint,
        outputMint,
        coinFrom,
        coinTo,
      });

      const response = await fetchWithRetry(
        'https://sempaihq.xyz/api/swap',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'SempaiHQ-Mobile/1.0',
          },
          body: JSON.stringify({
            userAddress: activeWalletAddress,
            amount: parseFloat(amount),
            inputMint,
            outputMint,
          }),
        },
        3,
        1000
      );

      console.log('Full API Response:', JSON.stringify(response, null, 2));
      const { transaction, error: apiError, message } = response;

      if (apiError) {
        throw new Error(`${apiError}: ${message}`);
      }

      if (!transaction) {
        throw new Error('No transaction data received from API.');
      }

      const swapTransactionBuf = Buffer.from(transaction, 'base64');
      const swapTransaction = VersionedTransaction.deserialize(swapTransactionBuf);

      const signature = await signAndSendTransaction(swapTransaction, password);
      console.log('Transaction Signature:', signature);

      const latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature,
      });

      setSuccessMessage(`Swap successful! Signature: ${signature}`);
      setTimeout(() => setSuccessMessage(''), 5000);
      await checkBalance();
      setAmount('');
    } catch (error) {
      console.error('Error swapping coins:', error);
      let userMessage = 'Swap failed. Please try again.';
      if (error.message.includes('Could not find any route')) {
        userMessage = `No trading route available for this token pair (${coinFrom} to ${coinTo}). Try a different pair or amount.`;
      } else if (error.message.includes('Invalid password') || error.message.includes('Failed to decode secret key')) {
        userMessage = 'Invalid wallet password. Please try again.';
      } else if (error.message.includes('insufficient balance')) {
        userMessage = `Insufficient ${coinFrom} balance for the swap.`;
      } else {
        userMessage = `Swap failed: ${error.message}`;
      }
      setError(userMessage);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  useEffect(() => {
    if (isWalletConnected) {
      checkBalance();
    } else {
      setBalance(0);
    }
  }, [isWalletConnected, activeWalletAddress, coinFrom, checkBalance]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Home')}>
          <Icon name="home" size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Coin Swap</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Menu')}>
          <Icon name="bars" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {(successMessage || error) && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={[styles.messageContainer, error ? styles.errorMessage : styles.successMessage]}
        >
          <Text style={styles.messageText}>{successMessage || error}</Text>
        </Animated.View>
      )}

      {/* Password Modal */}
      <Modal isVisible={showPasswordModal} onBackdropPress={() => setShowPasswordModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowPasswordModal(false)}
          >
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Enter Wallet Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handlePasswordSubmit}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowPasswordModal(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Main Content */}
      <View style={styles.main}>
        <View style={styles.swapCard}>
          {!isWalletConnected ? (
            <View style={styles.connectPrompt}>
              <Icon name="wallet" size={48} color="#E67E22" style={styles.walletIcon} />
              <Text style={styles.connectPromptText}>Please connect your wallet to initiate a swap.</Text>
              <TouchableOpacity
                style={styles.connectButton}
                onPress={() => navigation.navigate('ConnectWallet')}
              >
                <Text style={styles.connectButtonText}>Connect Wallet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.swapForm}>
              <Text style={styles.formTitle}>Swap Interface</Text>
              <View style={styles.balanceDisplay}>
                <Icon name="gem" size={16} color="#E67E22" />
                <Text style={styles.balanceText}>
                  Balance: {balance.toFixed(2)} {coinFrom}
                </Text>
                <TouchableOpacity onPress={checkBalance} style={styles.refreshButton}>
                  <Icon name="sync-alt" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                  placeholderTextColor="#888"
                  accessibilityLabel="Swap amount input"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>From</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={coinFrom}
                    onValueChange={(value) => setCoinFrom(value)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="SOL" value="SOL" />
                    <Picker.Item label="JUP" value="JUP" />
                    <Picker.Item label="Amethyst" value="AMETHYST" />
                    <Picker.Item label="SMP" value="SMP" />
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>To</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={coinTo}
                    onValueChange={(value) => setCoinTo(value)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="SOL" value="SOL" />
                    <Picker.Item label="JUP" value="JUP" />
                    <Picker.Item label="Amethyst" value="AMETHYST" />
                    <Picker.Item label="SMP" value="SMP" />
                  </Picker>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.swapButton, loading ? styles.disabledButton : null]}
                onPress={handleSwap}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Icon name="exchange-alt" size={16} color="#ffffff" style={styles.buttonIcon} />
                    <Text style={styles.swapButtonText}>Initiate Swap</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 Sempai HQ. All rights reserved.</Text>
      </View>
    </SafeAreaView>
  );
};

export default SwapScreen;