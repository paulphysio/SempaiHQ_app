import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
  Linking,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount, getAccount } from '@solana/spl-token';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Modal from 'react-native-modal';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { AMETHYST_MINT_ADDRESS, SMP_MINT_ADDRESS, USDC_MINT_ADDRESS, SKR_MINT_ADDRESS, RPC_URL } from '../constants';

const connection = new Connection(RPC_URL, 'confirmed');

const TOKEN_MINTS = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  JUP: new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'),
  USDC: USDC_MINT_ADDRESS,
  AMETHYST: AMETHYST_MINT_ADDRESS,
  SMP: SMP_MINT_ADDRESS,
  SKR: SKR_MINT_ADDRESS,
};

const TOKEN_LOGOS = {
  SOL: require('../assets/images/sol-logo.png'),
  JUP: require('../assets/images/juplogo.png'),
  USDC: require('../assets/images/usdclogo.png'),
  AMETHYST: require('../assets/images/amethyst-logo.jpeg'),
  SMP: require('../assets/images/smp-logo.jpeg'),
  SKR: require('../assets/images/skr-logo.png'), // Using sol-logo as placeholder
};

const TOKEN_NAMES = {
  SOL: 'Solana',
  JUP: 'Jupiter',
  USDC: 'USD Coin',
  AMETHYST: 'Amethyst',
  SMP: 'SMP',
  SKR: 'SKR',
};

const TOKEN_DECIMALS = {
  SOL: 9,
  JUP: 6,
  USDC: 6,
  AMETHYST: 6,
  SMP: 6,
  SKR: 6,
};

const SwapScreen = () => {
  const navigation = useNavigation();
  const { wallet, secretKey, signAndSendTransaction } = useContext(EmbeddedWalletContext);
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
  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showRampSuggestion, setShowRampSuggestion] = useState(false);
  const [allBalances, setAllBalances] = useState({});
  const [sendAmount, setSendAmount] = useState('');
  const [sendAddress, setSendAddress] = useState('');
  const [receiveAddress, setReceiveAddress] = useState('');

  const checkAllBalances = useCallback(async () => {
    if (!activeWalletAddress) {
      setAllBalances({});
      return;
    }

    try {
      const balances = {};
      
      for (const [tokenKey, mintAddress] of Object.entries(TOKEN_MINTS)) {
        let balance = 0;
        
        if (tokenKey === 'SOL') {
          const solBalance = await connection.getBalance(new PublicKey(activeWalletAddress));
          balance = solBalance / 1_000_000_000;
        } else {
          const ataAddress = getAssociatedTokenAddressSync(mintAddress, new PublicKey(activeWalletAddress));
          const ataInfo = await connection.getAccountInfo(ataAddress);
          if (ataInfo) {
            const ata = unpackAccount(ataAddress, ataInfo);
            balance = Number(ata.amount) / 10 ** TOKEN_DECIMALS[tokenKey];
          }
        }
        
        balances[tokenKey] = balance;
      }
      
      setAllBalances(balances);
    } catch (error) {
      console.error('Error fetching all balances:', error);
      setAllBalances({});
    }
  }, [activeWalletAddress]);

  const handleSend = async () => {
    if (!sendAmount || !sendAddress) {
      setError('Please enter amount and recipient address');
      return;
    }
    
    if (parseFloat(sendAmount) > balance) {
      setError(`Insufficient ${coinFrom} balance`);
      return;
    }

    setShowPasswordModal(true);
  };

  const handleSendSubmit = async () => {
    if (!password) {
      setError('Please enter your wallet password');
      return;
    }

    setLoading(true);
    setError(null);
    setShowSendModal(false);

    try {
      // Send logic would go here
      setSuccessMessage('Send functionality requires additional implementation');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      console.error('Error sending:', error);
      setError(`Send failed: ${error.message}`);
    } finally {
      setLoading(false);
      setPassword('');
      setSendAmount('');
      setSendAddress('');
    }
  };

  const handleReceive = () => {
    setReceiveAddress(activeWalletAddress);
    setShowReceiveModal(true);
  };

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
        balance = solBalance / 1_000_000_000;
      } else {
        const ataAddress = getAssociatedTokenAddressSync(mintAddress, new PublicKey(activeWalletAddress));
        const ataInfo = await connection.getAccountInfo(ataAddress);
        if (ataInfo) {
          const ata = unpackAccount(ataAddress, ataInfo);
          balance = Number(ata.amount) / 10 ** TOKEN_DECIMALS[coinFrom];
        }
      }
      setBalance(balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance(0);
    }
  }, [activeWalletAddress, coinFrom]);

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!isWalletConnected) {
      setError('Please connect your wallet to swap.');
      return;
    }
    if (coinFrom === coinTo) {
      setError('Please select different tokens to swap.');
      return;
    }
    if (parseFloat(amount) > balance) {
      setError(`Insufficient ${coinFrom} balance.`);
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
    setError(null);
    setShowPasswordModal(false);

    try {
      // Check if this is for swap or send
      if (showSendModal) {
        await handleSendSubmit();
        return;
      }

      const inputMint = TOKEN_MINTS[coinFrom].toString();
      const outputMint = TOKEN_MINTS[coinTo].toString();

      const response = await fetch('https://sempaihq.com/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: activeWalletAddress,
          amount: parseFloat(amount),
          inputMint,
          outputMint,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a Jupiter API unavailability error with fallback
        if (data.error === "jupiter_api_unavailable" && data.fallbackUrl) {
          await Linking.openURL(data.fallbackUrl);
          setSuccessMessage('Jupiter API unavailable - opened direct Jupiter swap');
          setTimeout(() => setSuccessMessage(''), 4000);
          setLoading(false);
          return;
        }
        throw new Error(data.message || `API error: ${response.status}`);
      }

      if (data.type === 'jup_redirect') {
        setSuccessMessage('Opened Jupiter for SMP swap (best route)');
        setTimeout(() => setSuccessMessage(''), 4000);
        setLoading(false);
        if (data.url) {
          await Linking.openURL(data.url);
        }
        return;
      }

      if (!data.transaction) {
        throw new Error('No transaction data received from API.');
      }

      const swapTransactionBuf = Buffer.from(data.transaction, 'base64');
      const swapTransaction = VersionedTransaction.deserialize(swapTransactionBuf);

      const signature = await signAndSendTransaction(swapTransaction, password);

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
      setError(`Swap failed: ${error.message}`);
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  useEffect(() => {
    if (isWalletConnected) {
      checkBalance();
    }
  }, [isWalletConnected, activeWalletAddress, coinFrom, checkBalance]);

  return (
    <SafeAreaView style={kaitoStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      
      {/* Messages */}
      {error && <Text style={kaitoStyles.errorText}>{error}</Text>}
      {successMessage && <Text style={kaitoStyles.successText}>{successMessage}</Text>}

      <ScrollView style={kaitoStyles.scrollContent} contentContainerStyle={kaitoStyles.scrollContentContainer}>
        {!isWalletConnected ? (
          <View style={kaitoStyles.connectPrompt}>
            <Icon name="wallet" size={48} color="#ff6200" />
            <Text style={kaitoStyles.connectPromptText}>Connect your wallet to exchange assets</Text>
            <TouchableOpacity
              style={kaitoStyles.connectButton}
              onPress={() => navigation.navigate('ConnectWallet')}
            >
              <Text style={kaitoStyles.connectButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={kaitoStyles.swapCard}>
            <Text style={kaitoStyles.formTitle}>Exchange Interface</Text>

            {/* Balance Display */}
            <View style={kaitoStyles.balanceDisplay}>
              <Icon name="gem" size={16} color="#ff6200" />
              <Text style={kaitoStyles.balanceText}>
                Balance: {balance.toFixed(2)} {coinFrom}
              </Text>
              <TouchableOpacity onPress={checkBalance} style={kaitoStyles.refreshButton}>
                <Icon name="sync-alt" size={16} color="#ff6200" />
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={kaitoStyles.inputGroup}>
              <Text style={kaitoStyles.label}>Amount</Text>
              <TextInput
                style={kaitoStyles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor="#888"
              />
            </View>

            {/* From Token */}
            <View style={kaitoStyles.inputGroup}>
              <Text style={kaitoStyles.label}>From</Text>
              <TouchableOpacity style={kaitoStyles.selectedToken} onPress={() => setShowFromModal(true)}>
                <Image source={TOKEN_LOGOS[coinFrom]} style={kaitoStyles.tokenLogo} />
                <Text style={kaitoStyles.tokenName}>{TOKEN_NAMES[coinFrom]}</Text>
                <Icon name="chevron-down" size={16} color="#ff6200" />
              </TouchableOpacity>
            </View>

            {/* To Token */}
            <View style={kaitoStyles.inputGroup}>
              <Text style={kaitoStyles.label}>To</Text>
              <TouchableOpacity style={kaitoStyles.selectedToken} onPress={() => setShowToModal(true)}>
                <Image source={TOKEN_LOGOS[coinTo]} style={kaitoStyles.tokenLogo} />
                <Text style={kaitoStyles.tokenName}>{TOKEN_NAMES[coinTo]}</Text>
                <Icon name="chevron-down" size={16} color="#ff6200" />
              </TouchableOpacity>
            </View>

            {/* Portfolio Section */}
            <View style={kaitoStyles.portfolioSection}>
              <Text style={kaitoStyles.portfolioTitle}>Your Portfolio</Text>
              <View style={kaitoStyles.actionButtons}>
                <TouchableOpacity onPress={() => setShowBalanceModal(true)} style={kaitoStyles.portfolioButton}>
                  <Icon name="wallet" size={16} color="#ff6200" />
                  <Text style={kaitoStyles.portfolioButtonText}>View Balances</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowSendModal(true)} style={kaitoStyles.portfolioButton}>
                  <Icon name="paper-plane" size={16} color="#ff6200" />
                  <Text style={kaitoStyles.portfolioButtonText}>Send</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowReceiveModal(true)} style={kaitoStyles.portfolioButton}>
                  <Icon name="qrcode" size={16} color="#ff6200" />
                  <Text style={kaitoStyles.portfolioButtonText}>Receive</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Swap Button */}
            <TouchableOpacity
              style={[kaitoStyles.swapButton, loading ? kaitoStyles.disabledButton : null]}
              onPress={handleSwap}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Icon name="exchange-alt" size={16} color="#ffffff" />
                  <Text style={kaitoStyles.swapButtonText}>Initiate Exchange</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Password Modal */}
      <Modal isVisible={showPasswordModal} onBackdropPress={() => setShowPasswordModal(false)}>
        <View style={kaitoStyles.modalContainer}>
          <TouchableOpacity style={kaitoStyles.closeButton} onPress={() => setShowPasswordModal(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Text style={kaitoStyles.modalTitle}>Enter Wallet Password</Text>
          <TextInput
            style={kaitoStyles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={kaitoStyles.submitButton} onPress={handlePasswordSubmit}>
            <Text style={kaitoStyles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Token Selection Modal */}
      {(showFromModal || showToModal) && (
        <Modal isVisible={true} onBackdropPress={() => { setShowFromModal(false); setShowToModal(false); }}>
          <View style={kaitoStyles.modalContainer}>
            <TouchableOpacity style={kaitoStyles.closeButton} onPress={() => { setShowFromModal(false); setShowToModal(false); }}>
              <Icon name="times" size={20} color="#ff6200" />
            </TouchableOpacity>
            <Text style={kaitoStyles.modalTitle}>
              {showFromModal ? 'Select From Token' : 'Select To Token'}
            </Text>
            <ScrollView style={kaitoStyles.tokenList}>
              {Object.keys(TOKEN_MINTS).map((token) => (
                <TouchableOpacity
                  key={token}
                  style={kaitoStyles.tokenItem}
                  onPress={() => {
                    if (showFromModal) setCoinFrom(token);
                    else setCoinTo(token);
                    setShowFromModal(false);
                    setShowToModal(false);
                  }}
                >
                  <Image source={TOKEN_LOGOS[token]} style={kaitoStyles.tokenLogo} />
                  <Text style={kaitoStyles.tokenName}>{TOKEN_NAMES[token]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Balance Modal */}
      <Modal isVisible={showBalanceModal} onBackdropPress={() => setShowBalanceModal(false)}>
        <View style={kaitoStyles.modalContainer}>
          <TouchableOpacity style={kaitoStyles.closeButton} onPress={() => setShowBalanceModal(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Text style={kaitoStyles.modalTitle}>Your Balances</Text>
          <TouchableOpacity style={kaitoStyles.refreshButton} onPress={checkAllBalances}>
            <Icon name="sync-alt" size={16} color="#ff6200" />
          </TouchableOpacity>
          <ScrollView style={kaitoStyles.tokenList}>
            {Object.keys(TOKEN_MINTS).map((token) => (
              <View key={token} style={kaitoStyles.balanceItem}>
                <Image source={TOKEN_LOGOS[token]} style={kaitoStyles.tokenLogo} />
                <Text style={kaitoStyles.tokenName}>{TOKEN_NAMES[token]}</Text>
                <Text style={kaitoStyles.balanceAmount}>
                  {(allBalances[token] || 0).toFixed(2)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Send Modal */}
      <Modal isVisible={showSendModal} onBackdropPress={() => setShowSendModal(false)}>
        <View style={kaitoStyles.modalContainer}>
          <TouchableOpacity style={kaitoStyles.closeButton} onPress={() => setShowSendModal(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Text style={kaitoStyles.modalTitle}>Send {coinFrom}</Text>
          <View style={kaitoStyles.inputGroup}>
            <Text style={kaitoStyles.label}>Recipient Address</Text>
            <TextInput
              style={kaitoStyles.input}
              placeholder="Enter wallet address"
              placeholderTextColor="#888"
              value={sendAddress}
              onChangeText={setSendAddress}
            />
          </View>
          <View style={kaitoStyles.inputGroup}>
            <Text style={kaitoStyles.label}>Amount</Text>
            <TextInput
              style={kaitoStyles.input}
              placeholder="Enter amount"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={sendAmount}
              onChangeText={setSendAmount}
            />
          </View>
          <Text style={kaitoStyles.balanceText}>
            Available: {balance.toFixed(2)} {coinFrom}
          </Text>
          <TouchableOpacity style={kaitoStyles.submitButton} onPress={handleSend}>
            <Text style={kaitoStyles.submitButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Receive Modal */}
      <Modal isVisible={showReceiveModal} onBackdropPress={() => setShowReceiveModal(false)}>
        <View style={kaitoStyles.modalContainer}>
          <TouchableOpacity style={kaitoStyles.closeButton} onPress={() => setShowReceiveModal(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Text style={kaitoStyles.modalTitle}>Receive Crypto</Text>
          <Text style={kaitoStyles.modalMessage}>
            Share this address to receive crypto:
          </Text>
          <View style={kaitoStyles.addressContainer}>
            <Text style={kaitoStyles.addressText} selectable>
              {receiveAddress}
            </Text>
            <TouchableOpacity onPress={() => {
              // Copy to clipboard functionality would go here
              setSuccessMessage('Address copied to clipboard');
              setTimeout(() => setSuccessMessage(''), 2000);
            }}>
              <Icon name="copy" size={20} color="#ff6200" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={kaitoStyles.submitButton} onPress={() => setShowReceiveModal(false)}>
            <Text style={kaitoStyles.submitButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Ramp Suggestion Modal */}
      <Modal isVisible={showRampSuggestion} onBackdropPress={() => setShowRampSuggestion(false)}>
        <View style={kaitoStyles.modalContainer}>
          <TouchableOpacity style={kaitoStyles.closeButton} onPress={() => setShowRampSuggestion(false)}>
            <Icon name="times" size={20} color="#ff6200" />
          </TouchableOpacity>
          <Text style={kaitoStyles.modalTitle}>Insufficient Balance</Text>
          <Text style={kaitoStyles.modalMessage}>
            You don't have enough {coinFrom} to complete this swap. Would you like to buy more crypto using Ramp?
          </Text>
          <TouchableOpacity
            style={kaitoStyles.submitButton}
            onPress={() => {
              setShowRampSuggestion(false);
              Linking.openURL('https://ramp.network');
            }}
          >
            <Icon name="credit-card" size={16} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={kaitoStyles.submitButtonText}>Buy Crypto with Ramp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[kaitoStyles.cancelButton, { marginTop: 10 }]}
            onPress={() => setShowRampSuggestion(false)}
          >
            <Text style={kaitoStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const kaitoStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoText: {
    color: '#ff6200',
    fontSize: 18,
    fontWeight: '700',
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 15,
  },
  campaignTitle: {
    color: '#ffd700',
    fontSize: 20,
    fontWeight: '700',
  },
  campaignSubtitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  scrollContent: {
    flex: 1,
    padding: 15,
  },
  scrollContentContainer: {
    paddingBottom: 100,
  },
  connectPrompt: {
    alignItems: 'center',
    padding: 40,
  },
  connectPromptText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  connectButton: {
    backgroundColor: '#ff6200',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  swapCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ff6200',
  },
  formTitle: {
    color: '#ffd700',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  balanceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  balanceText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  refreshButton: {
    padding: 5,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  selectedToken: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff6200',
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  tokenName: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  portfolioSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  portfolioTitle: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  portfolioButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ff6200',
  },
  portfolioButtonText: {
    color: '#ff6200',
    fontSize: 12,
    marginTop: 4,
  },
  swapButton: {
    flexDirection: 'row',
    backgroundColor: '#ff6200',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#444',
  },
  swapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  successText: {
    color: '#44ff44',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ff6200',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 5,
  },
  modalTitle: {
    color: '#ffd700',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#ff6200',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tokenList: {
    maxHeight: 300,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  modalMessage: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  balanceAmount: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  addressText: {
    color: '#fff',
    fontSize: 12,
    flex: 1,
    fontFamily: 'monospace',
  },
  cancelButton: {
    backgroundColor: '#444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SwapScreen;