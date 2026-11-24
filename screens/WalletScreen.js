// ./screens/NexusScreen.js
import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddressSync, unpackAccount, getAccount, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { GelModal, GelInput, GelGlass, GelButton, GelChips, GelOption } from '../components/gel/GelKit';
import GelOrb from '../components/nav/GelOrb';
import KeyboardSafe from '../components/KeyboardSafe';
import * as Clipboard from 'expo-clipboard';
import { toast } from '../components/Toast';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { USDC_MINT_ADDRESS, SMP_MINT_ADDRESS, SKR_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../constants';
import { getSwapStyles } from '../styles/SwapStyles';
import { logMoneyEvent } from '../services/moneyFeed';
import { useTheme } from '../context/ThemeContext';
import { GelGate, GelPageHeader } from '../components/gel/GelGate';

const connection = new Connection(RPC_URL, 'confirmed');

// Define allowed tokens
const TOKEN_MINTS = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  USDC: USDC_MINT_ADDRESS,
  SMP: SMP_MINT_ADDRESS,
  SKR: SKR_MINT_ADDRESS,
};

const NexusScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getSwapStyles(colors), [isDark]);
  const navigation = useNavigation();
  const { wallet, signAndSendTransaction, setShowModal } = useContext(EmbeddedWalletContext);
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
  useEffect(() => { if (error) toast.error(error); }, [error]);
  useEffect(() => { if (successMessage) toast.success(successMessage); }, [successMessage]);

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

  if (!isWalletConnected) {
    return <GelGate icon="wallet" headerTitle="Wallet" subtitle="Connect a wallet to see your balances and send tokens." />;
  }

  const short = activeWalletAddress ? `${activeWalletAddress.slice(0, 4)}…${activeWalletAddress.slice(-4)}` : '';
  const copyAddress = async () => {
    try { await Clipboard.setStringAsync(activeWalletAddress); toast.success('Address copied'); } catch { /* ignore */ }
  };
  const fmtBal = (n) => (selectedToken === 'SOL' ? n.toFixed(4) : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));

  return (
    <KeyboardSafe style={{ flex: 1, backgroundColor: colors.bg }}>
      <GelPageHeader title="Wallet" subtitle="Your balances, send and receive" />

      {/* Password */}
      <GelModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        variant="sheet"
        icon="lock"
        title="Confirm it's you"
        subtitle="Enter your wallet password to continue."
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setShowPasswordModal(false) },
          { label: 'Confirm', icon: 'check', disabled: !password, onPress: handlePasswordSubmit },
        ]}
      >
        <GelInput label="Password" placeholder="Your wallet password" secureTextEntry value={password} onChangeText={setPassword} autoFocus onSubmitEditing={handlePasswordSubmit} />
      </GelModal>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        {/* balance */}
        <GelGlass radius={30} glow padding={20}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>Balance</Text>
            <Pressable onPress={copyAddress} accessibilityRole="button" accessibilityLabel="Copy wallet address"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : `rgba(${colors.accentRgb},0.08)` }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{short}</Text>
              <Icon name="copy" size={11} color={colors.accent} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
            <Text style={{ fontFamily: 'Yoruka', color: colors.textPrimary, fontSize: 38 }} numberOfLines={1} adjustsFontSizeToFit>{fmtBal(balance)}</Text>
            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '900', marginBottom: 8 }}>{selectedToken}</Text>
            <View style={{ flex: 1 }} />
            <GelOrb icon="sync-alt" size={36} onPress={checkBalance} label="Refresh balance" breathe={false} iconSize={13} />
          </View>
          <GelChips options={Object.keys(TOKEN_MINTS)} value={selectedToken} onChange={setSelectedToken} style={{ marginTop: 14 }} />
        </GelGlass>

        {/* send */}
        <GelGlass radius={28} glow={false} padding={18} style={{ marginTop: 14 }}>
          <Text style={{ fontFamily: 'Yoruka', color: colors.textPrimary, fontSize: 22 }}>Send {selectedToken}</Text>
          <GelInput
            label="Amount"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.,]/g, '').replace(',', '.'))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            accessibilityLabel="Transfer amount"
          />
          {balance > 0 ? (
            <Pressable onPress={() => setAmount(String(selectedToken === 'SOL' ? Math.max(0, Math.floor((balance - 0.002) * 1e4) / 1e4) : balance))}
              accessibilityRole="button" style={{ alignSelf: 'flex-end', marginTop: 6, marginRight: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>Use max</Text>
            </Pressable>
          ) : null}
          <GelInput
            label="Recipient address"
            value={recipientAddress}
            onChangeText={(t) => setRecipientAddress(t.trim())}
            placeholder="Solana address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Recipient address"
          />
          <GelButton label={`Send ${selectedToken}`} icon="paper-plane" loading={loading} disabled={!amount || !recipientAddress} onPress={handleTransfer} style={{ marginTop: 18 }} />
          {selectedToken === 'SOL' ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 10, marginHorizontal: 4 }}>Keep a little SOL (about 0.002) for network fees.</Text>
          ) : null}
        </GelGlass>

        {/* more */}
        <View style={{ marginTop: 14 }}>
          <GelOption icon="credit-card" title="Buy crypto" description="USDC or SOL with a card, fees shown first" onPress={() => navigation.navigate('Ramp')} />
          <GelOption icon="university" title="Cash out USDC" description="To your bank through Jupiter" onPress={() => navigation.navigate('Ramp', { tab: 'cashout' })} />
          <GelOption icon="exchange-alt" title="Swap tokens" description="Trade between SOL, USDC, SMP and more" onPress={() => navigation.navigate('Swap')} />
        </View>
      </ScrollView>
    </KeyboardSafe>
  );
};

export default NexusScreen;