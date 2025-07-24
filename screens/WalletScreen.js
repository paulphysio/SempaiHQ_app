// ./screens/WalletScreen.js
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
import { Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddressSync, unpackAccount, getAccount, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Modal from 'react-native-modal';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import { USDC_MINT_ADDRESS, SMP_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../constants';
import { styles } from '../styles/SwapStyles';

const connection = new Connection(RPC_URL, 'confirmed');

// Define allowed tokens
const TOKEN_MINTS = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  USDC: USDC_MINT_ADDRESS,
  SMP: SMP_MINT_ADDRESS,
};

const WalletScreen = () => {
  const navigation = useNavigation();
  const { wallet, signAndSendTransaction } = useContext(EmbeddedWalletContext);
  const isWalletConnected = !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedToken, setSelectedToken] = useState('SOL');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');

  // Debug wallet state
  useEffect(() => {
    console.log('[WalletScreen] Wallet state:', {
      publicKey: wallet?.publicKey?.toString(),
      hasSignAndSendTransaction: !!signAndSendTransaction,
      walletObject: wallet,
    });
  }, [wallet, signAndSendTransaction]);

  // Fetch balance for selected token
  const checkBalance = useCallback(async () => {
    if (!activeWalletAddress) {
      setBalance(0);
      return;
    }

    try {
      const mintAddress = TOKEN_MINTS[selectedToken];
      let balance = 0;

      if (selectedToken === 'SOL') {
        const solBalance = await connection.getBalance(new PublicKey(activeWalletAddress));
        balance = solBalance / LAMPORTS_PER_SOL; // 9 decimals
      } else {
        const ataAddress = getAssociatedTokenAddressSync(mintAddress, new PublicKey(activeWalletAddress));
        const ataInfo = await connection.getAccountInfo(ataAddress);
        if (ataInfo) {
          const ata = unpackAccount(ataAddress, ataInfo);
          balance = Number(ata.amount) / 10 ** (selectedToken === 'USDC' ? 6 : SMP_DECIMALS); // USDC: 6 decimals, SMP: 6 decimals
        }
      }
      setBalance(balance);
      console.log(`[WalletScreen] Balance for ${selectedToken}: ${balance}`);
    } catch (error) {
      console.error('[WalletScreen] Error fetching balance:', error);
      setError('Failed to fetch balance. Please try again.');
      setTimeout(() => setError(null), 5000);
      setBalance(0);
    }
  }, [activeWalletAddress, selectedToken]);

  // Validate and initiate transfer
  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (!isWalletConnected) {
      setError('Cannot find wallet. Please connect wallet and try again.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (!recipientAddress) {
      setError('Please enter a recipient wallet address.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(recipientAddress);
    } catch (e) {
      setError('Invalid recipient address.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (recipientPubkey.toString() === activeWalletAddress) {
      setError('Cannot send tokens to your wallet.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (parseFloat(amount) > balance) {
      setError(`Insufficient ${selectedToken} balance: ${balance.toFixed(0)} available.`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    setShowPasswordModal(true);
  };

  // Submit transfer with password
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
      const senderPubkey = new PublicKey(activeWalletAddress);
      const recipientPubkey = new PublicKey(recipientAddress);
      const amountBigInt = BigInt(Math.round(parseFloat(amount) * 10 ** (selectedToken === 'SOL' ? 9 : 6))); // SOL: 9 decimals, USDC/SMP: 6 decimals
      const transaction = new Transaction();

      // Check SOL balance for fees and ATA creation
      const solBalance = await connection.getBalance(senderPubkey);
      const minSolForFees = selectedToken === 'SOL' ? Number(amountBigInt) + 5000 : 5000; // Amount + fee
      const minSolForATA = selectedToken !== 'SOL' ? 2_031_960 : 0; // ~0.1 SOL for ATA creation
      if (solBalance < minSolForFees + minSolForATA) {
        throw new Error(`Insufficient SOL: ${(solBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL available, need ${((minSolForFees + minSolForATA) / LAMPORTS_PER_SOL).toFixed(6)} SOL for fees${selectedToken !== 'SOL' ? ' and account creation' : ''}`);
      }

      // Validate recipient account
      const recipientInfo = await connection.getAccountInfo(recipientPubkey);
      if (!recipientInfo) {
        console.log("No account info found for the recipient address")
        throw new Error('Recipient address does not exist on-chain.');
      }
      if (recipientInfo.owner.toString() !== SystemProgram.programId.toString()) {
        throw new Error('Recipient address is not a valid wallet (it may be a program or token account).');
      }

      if (selectedToken === 'SOL') {
        if (solBalance < Number(amountBigInt) + 5000) {
          throw new Error(`Insufficient balance: ${(solBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL available, need ${((Number(amountBigInt) + 5000) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        }
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: senderPubkey,
            toPubkey: recipientPubkey,
            lamports: amountBigInt,
          })
        );
      } else {
        const mintAddress = TOKEN_MINTS[selectedToken];
        const sourceATA = getAssociatedTokenAddressSync(mintAddress, senderPubkey);
        let destinationATA;

        // Verify sender ATA
        const sourceATAInfo = await connection.getAccountInfo(sourceATA);
        if (!sourceATAInfo) {
          throw new Error(`Sender's ${selectedToken} token account not found. Please ensure you have a valid ${selectedToken} account.`);
        }

        // Check sender's token balance
        try {
          const sourceAccount = await getAccount(connection, sourceATA);
          const tokenBalance = Number(sourceAccount.amount) / 10 ** (selectedToken === 'USDC' ? 6 : SMP_DECIMALS);
          if (tokenBalance < parseFloat(amount)) {
            throw new Error(`Insufficient ${selectedToken} balance: ${tokenBalance.toFixed(2)} available, need ${amount}`);
          }
        } catch (error) {
          console.error('[WalletScreen] Sender ATA check failed:', JSON.stringify(error, null, 2));
          throw new Error(`Failed to verify ${selectedToken} account: ${error.message || 'Unknown error'}`);
        }

        // Check and create recipient ATA
        destinationATA = getAssociatedTokenAddressSync(mintAddress, recipientPubkey);
        let destinationATAInfo = await connection.getAccountInfo(destinationATA);
        if (!destinationATAInfo) {
          console.log(`[WalletScreen] Recipient ATA does not exist: ${destinationATA.toString()}. Creating...`);
          // Create ATA in a separate transaction
          const ataTransaction = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              senderPubkey, // Payer
              destinationATA,
              recipientPubkey,
              mintAddress
            )
          );
          ataTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          ataTransaction.feePayer = senderPubkey;

          const ataVersionedTransaction = new VersionedTransaction(ataTransaction.compileMessage());
          const ataSignature = await signAndSendTransaction(ataVersionedTransaction, password);
          console.log('[WalletScreen] ATA Creation Signature:', ataSignature);

          // Confirm ATA creation
          const ataBlockHash = await connection.getLatestBlockhash();
          await connection.confirmTransaction({
            blockhash: ataBlockHash.blockhash,
            lastValidBlockHeight: ataBlockHash.lastValidBlockHeight,
            signature: ataSignature,
          });

          // Verify ATA creation
          destinationATAInfo = await connection.getAccountInfo(destinationATA);
          if (!destinationATAInfo) {
            throw new Error('Failed to create recipient’s ${selectedToken} account.');
          }
          console.log(`[WalletScreen] Recipient ATA created: ${destinationATA.toString()}`);
        } else {
          console.log(`[WalletScreen] Recipient ATA exists: ${destinationATA.toString()}`);
        }

        transaction.add(
          createTransferInstruction(
            sourceATA,
            destinationATA,
            senderPubkey,
            amountBigInt
          )
        );
      }

      // Add recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderPubkey;

      // Convert to VersionedTransaction
      const versionedTransaction = new VersionedTransaction(transaction.compileMessage());

      // Sign and send
      const signature = await signAndSendTransaction(versionedTransaction, password);
      console.log('[WalletScreen] Transaction Signature:', signature);

      // Confirm transaction
      const latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature,
      });

      setSuccessMessage(`Transfer successful! Signature: ${signature}`);
      setTimeout(() => setSuccessMessage(''), 5000);
      await checkBalance();
      setAmount('');
      setRecipientAddress('');
    } catch (error) {
      console.error('[WalletScreen] Error sending tokens:', JSON.stringify(error, null, 2));
      let userMessage = 'Transfer failed. Please try again.';
      if (error.message.includes('Invalid password') || error.message.includes('Failed to decode secret key')) {
        userMessage = 'Invalid wallet password. Please try again.';
      } else if (error.message.includes('insufficient balance') || error.message.includes('Insufficient SOL')) {
        userMessage = error.message;
      } else if (error.message.includes('Invalid public key') || error.message.includes('Invalid recipient address') || error.message.includes('Recipient address does not exist') || error.message.includes('Recipient address is not a valid wallet')) {
        userMessage = error.message;
      } else if (error.message.includes('TokenAccountNotFoundError') || error.message.includes('token account not found')) {
        userMessage = `Failed to find or create ${selectedToken} account for recipient. Ensure you have enough SOL (~0.002 SOL) for account creation.`;
      } else {
        userMessage = `Transfer failed: ${error.message || 'Unknown error'}`;
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
  }, [isWalletConnected, activeWalletAddress, selectedToken, checkBalance]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Home')}>
          <Icon name="home" size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
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
              <Text style={styles.connectPromptText}>Please connect your wallet to send tokens.</Text>
              <TouchableOpacity
                style={styles.connectButton}
                onPress={() => navigation.navigate('ConnectWallet')}
              >
                <Text style={styles.connectButtonText}>Connect Wallet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.swapForm}>
              <Text style={styles.formTitle}>Send Tokens</Text>
              <View style={styles.balanceDisplay}>
                <Icon name="gem" size={16} color="#E67E22" />
                <Text style={styles.balanceText}>
                  Balance: {balance.toFixed(4)} {selectedToken}
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
                  accessibilityLabel="Transfer amount input"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recipient Address</Text>
                <TextInput
                  style={styles.input}
                  value={recipientAddress}
                  onChangeText={setRecipientAddress}
                  placeholder="Enter Solana address"
                  placeholderTextColor="#888"
                  accessibilityLabel="Recipient address input"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Token</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedToken}
                    onValueChange={(value) => setSelectedToken(value)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="SOL" value="SOL" />
                    <Picker.Item label="USDC" value="USDC" />
                    <Picker.Item label="SMP" value="SMP" />
                  </Picker>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.swapButton, loading ? styles.disabledButton : null]}
                onPress={handleTransfer}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Icon name="paper-plane" size={16} color="#ffffff" style={styles.buttonIcon} />
                    <Text style={styles.swapButtonText}>Send Tokens</Text>
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

export default WalletScreen;