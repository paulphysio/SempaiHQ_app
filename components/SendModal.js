import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import Modal from 'react-native-modal';
import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
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

const SendModal = ({ isOpen, onClose, activeWalletAddress }) => {
  const { wallet: embeddedWallet, signAndSendTransaction } = useContext(EmbeddedWalletContext);
  const [selectedToken, setSelectedToken] = useState('SOL');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (isOpen && activeWalletAddress) {
      fetchBalance();
    }
  }, [isOpen, activeWalletAddress, selectedToken]);

  const fetchBalance = async () => {
    try {
      const token = TOKEN_MINTS[selectedToken];
      let balance = 0;

      if (selectedToken === 'SOL') {
        const solBalance = await connection.getBalance(new PublicKey(activeWalletAddress));
        balance = solBalance / 1_000_000_000;
      } else {
        const ataAddress = getAssociatedTokenAddressSync(token.mint, new PublicKey(activeWalletAddress));
        const ataInfo = await connection.getAccountInfo(ataAddress);
        if (ataInfo) {
          const ata = await getAccount(connection, ataAddress);
          balance = Number(ata.amount) / Math.pow(10, token.decimals);
        }
      }

      setBalance(balance);
      setError('');
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance(0);
      setError(error.message || 'Failed to fetch balance');
    }
  };

  const checkAtaExists = async (mint, owner) => {
    try {
      const ata = getAssociatedTokenAddressSync(mint, owner);
      await getAccount(connection, ata);
      return true;
    } catch (e) {
      if (e.name === 'TokenAccountNotFoundError') {
        return false;
      }
      throw e;
    }
  };

  const handleSend = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!recipientAddress) {
      setError('Please enter a recipient address.');
      return;
    }
    if (parseFloat(amount) > balance) {
      setError('Insufficient balance.');
      return;
    }

    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      setError('Please enter your wallet password.');
      return;
    }

    setLoading(true);
    setError('');
    setShowPasswordModal(false);

    try {
      const token = TOKEN_MINTS[selectedToken];
      const rawAmount = Math.floor(parseFloat(amount) * Math.pow(10, token.decimals));
      const recipient = new PublicKey(recipientAddress);
      const sender = new PublicKey(activeWalletAddress);

      let transaction;

      if (selectedToken === 'SOL') {
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: sender,
            toPubkey: recipient,
            lamports: rawAmount,
          })
        );
      } else {
        const senderATA = getAssociatedTokenAddressSync(token.mint, sender);
        const recipientATA = getAssociatedTokenAddressSync(token.mint, recipient);

        const instructions = [];

        // Check and Create Sender ATA
        const senderAtaExists = await checkAtaExists(token.mint, sender);
        if (!senderAtaExists) {
          instructions.push(
            createAssociatedTokenAccountInstruction(sender, senderATA, sender, token.mint)
          );
        }

        // Check if recipient needs ATA
        const recipientAtaExists = await checkAtaExists(token.mint, recipient);
        if (!recipientAtaExists) {
          instructions.push(
            createAssociatedTokenAccountInstruction(sender, recipientATA, recipient, token.mint)
          );
        }

        // Add the transfer instruction
        instructions.push(
          createTransferInstruction(senderATA, recipientATA, sender, rawAmount)
        );

        transaction = new Transaction().add(...instructions);
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = sender;

      const signature = await signAndSendTransaction(transaction, password);

      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature,
      });

      setSuccessMessage(`Tokens sent successfully! Signature: ${signature}`);
      setAmount('');
      setRecipientAddress('');
      setTimeout(() => setSuccessMessage(''), 5000);
      fetchBalance();
    } catch (error) {
      console.error('Error sending tokens:', error);
      setError(`Failed to send tokens: ${error.message}`);
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isVisible={isOpen} onBackdropPress={onClose} style={styles.modal}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="times" size={22} color="#ffffff" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>Send Tokens</Text>

          {/* Token Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Token</Text>
            <TouchableOpacity style={styles.selectedToken} onPress={() => setShowTokenModal(true)}>
              <Image source={TOKEN_MINTS[selectedToken].logo} style={styles.tokenLogo} />
              <Text style={styles.tokenName}>{TOKEN_MINTS[selectedToken].symbol}</Text>
              <Icon name="chevron-down" size={16} color="#ffffff" style={styles.dropdownArrow} />
            </TouchableOpacity>
          </View>

          {/* Balance Display */}
          <View style={styles.balanceDisplay}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>
              {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {selectedToken}
            </Text>
          </View>

          {/* Recipient Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Recipient Address</Text>
            <TextInput
              style={styles.input}
              value={recipientAddress}
              onChangeText={setRecipientAddress}
              placeholder="Enter recipient address"
              placeholderTextColor="#888"
              autoCapitalize="none"
            />
          </View>

          {/* Amount */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor="#888"
            />
          </View>

          {/* Error/Success Messages */}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {successMessage && <Text style={styles.successText}>{successMessage}</Text>}

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendButton, loading ? styles.disabledButton : null]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Icon name="paper-plane" size={16} color="#ffffff" style={styles.buttonIcon} />
                <Text style={styles.sendButtonText}>Send</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Token Selection Modal */}
      <Modal isVisible={showTokenModal} onBackdropPress={() => setShowTokenModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowTokenModal(false)}>
            <Icon name="times" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Select Token</Text>
          <ScrollView style={styles.tokenList}>
            {Object.keys(TOKEN_MINTS).map((token) => (
              <TouchableOpacity
                key={token}
                style={styles.tokenItem}
                onPress={() => {
                  setSelectedToken(token);
                  setShowTokenModal(false);
                }}
              >
                <Image source={TOKEN_MINTS[token].logo} style={styles.tokenLogo} />
                <Text style={styles.tokenName}>{TOKEN_MINTS[token].symbol}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Password Modal */}
      <Modal isVisible={showPasswordModal} onBackdropPress={() => setShowPasswordModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowPasswordModal(false)}>
            <Icon name="times" size={22} color="#ffffff" />
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
          <TouchableOpacity style={styles.submitButton} onPress={handlePasswordSubmit}>
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    width: '100%',
  },
  modalContainer: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 440,
    alignSelf: 'center',
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    
    textTransform: 'uppercase',
    letterSpacing: 0.12,
    marginBottom: 8,
    color: 'rgba(255, 255, 255, 0.35)',
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    color: '#ffffff',
    padding: 14,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.18)',
  },
  selectedToken: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.18)',
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  tokenName: {
    color: '#ffffff',
    fontSize: 14,
    
  },
  dropdownArrow: {
    marginLeft: 'auto',
  },
  balanceDisplay: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.08)',
  },
  balanceLabel: {
    fontSize: 11,
    
    textTransform: 'uppercase',
    letterSpacing: 0.12,
    marginBottom: 4,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  balanceAmount: {
    fontSize: 18,
    
    color: '#ffffff',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    color: '#28A745',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#E67E22',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#888',
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    
  },
  tokenList: {
    maxHeight: 300,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  submitButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    
  },
});

export default SendModal;
