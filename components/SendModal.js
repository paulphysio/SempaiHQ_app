import React, { useState, useEffect, useContext, useMemo } from 'react';
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
import { GelModal, GelInput, GelInset, GelRow } from './gel/GelKit';
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
import { logMoneyEvent } from '../services/moneyFeed';
import { useTheme } from '../context/ThemeContext';

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
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getSendModalStyles(colors), [isDark]);
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

      logMoneyEvent({
        event_type: 'token_send',
        direction: 'out',
        asset: selectedToken,
        amount: parseFloat(amount) || null,
        wallet: activeWalletAddress,
        counterparty: recipientAddress,
        title: `Send ${amount} ${selectedToken}`,
        tx_sig: signature,
        meta: { to: recipientAddress },
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

  const fmtBal = balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  return (
    <>
      <GelModal
        visible={isOpen && !showTokenModal && !showPasswordModal}
        onClose={onClose}
        variant="sheet"
        icon="paper-plane"
        title="Send tokens"
        scroll
        actions={[{ label: 'Send', icon: 'paper-plane', loading, onPress: handleSend }]}
      >
        <Text style={[styles.label, { marginTop: 16, marginLeft: 4 }]}>Token</Text>
        <TouchableOpacity style={styles.selectedToken} onPress={() => setShowTokenModal(true)} accessibilityRole="button" accessibilityLabel={`Token ${TOKEN_MINTS[selectedToken].symbol}, change`}>
          <Image source={TOKEN_MINTS[selectedToken].logo} style={styles.tokenLogo} />
          <Text style={styles.tokenName}>{TOKEN_MINTS[selectedToken].symbol}</Text>
          <Icon name="chevron-down" size={14} color={colors.textMuted} style={styles.dropdownArrow} />
        </TouchableOpacity>
        <GelInset>
          <GelRow label="Available" value={`${fmtBal} ${selectedToken}`} strong />
        </GelInset>
        <GelInput label="To (wallet address)" value={recipientAddress} onChangeText={setRecipientAddress} placeholder="Paste the Solana address" autoCapitalize="none" autoCorrect={false} />
        <GelInput label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
      </GelModal>

      {/* choose token */}
      <GelModal visible={isOpen && showTokenModal} onClose={() => setShowTokenModal(false)} variant="sheet" title="Choose a token">
        <View style={{ marginTop: 8 }}>
          {Object.keys(TOKEN_MINTS).map((token) => {
            const on = token === selectedToken;
            return (
              <TouchableOpacity
                key={token}
                style={[styles.tokenItem, on && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}
                onPress={() => { setSelectedToken(token); setShowTokenModal(false); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Image source={TOKEN_MINTS[token].logo} style={styles.tokenLogo} />
                <Text style={styles.tokenName}>{TOKEN_MINTS[token].symbol}</Text>
                {on ? <Icon name="check" size={14} color={colors.accent} style={{ marginLeft: 'auto' }} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </GelModal>

      {/* wallet password */}
      <GelModal
        visible={isOpen && showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        variant="sheet"
        icon="lock"
        title="Confirm it's you"
        subtitle="Enter your wallet password to send."
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setShowPasswordModal(false) },
          { label: 'Confirm', icon: 'check', onPress: handlePasswordSubmit, disabled: !password },
        ]}
      >
        <GelInput label="Password" placeholder="Your wallet password" secureTextEntry value={password} onChangeText={setPassword} autoFocus onSubmitEditing={handlePasswordSubmit} />
      </GelModal>
    </>
  );
};

export const getSendModalStyles = (c) => StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    width: '100%',
  },
  modalContainer: {
    backgroundColor: c.bgCard,
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
    
    color: c.textPrimary,
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
    color: c.textMuted,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    color: c.textPrimary,
    padding: 14,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.18)',
  },
  selectedToken: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bgCard,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: c.borderAccent,
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  tokenName: {
    color: c.textPrimary,
    fontSize: 16,
    fontWeight: '700',
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
    
    color: c.textPrimary,
  },
  errorText: {
    color: c.danger,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  successText: {
    color: c.success,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: c.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: c.textMuted,
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    
  },
  tokenList: {
    maxHeight: 300,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgCard,
  },
  submitButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    
  },
});

export default SendModal;
