import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import Pdf from 'react-native-pdf';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import EPUBReader from '../components/EPUBReader';
import { createBazaarReadTracker } from '../services/bazaarReadTracker';
import { useBazaarTheme } from '../styles/BazaarStyles';
import {
  BAZAAR_LEND_PRICE_SMP,
  bazaarConnection,
  bookPriceInBaseUnits,
  callBazaarFunction,
  createBazaarLendTransaction,
  createBazaarPaymentTransaction,
  fetchSolPriceUsd,
  getBookFileUrl,
  recordPurchase,
} from '../utils/bazaar';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

const BazaarBookScreen = () => {
  const { colors: BAZAAR_COLORS, styles } = useBazaarTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { bookId } = route.params || {};
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey;
  const signAndSendTransaction = walletContext?.signAndSendTransaction;
  const insets = useSafeAreaInsets();
  // Clear the floating GlobalBottomNav (68px) so pay/read buttons stay tappable.
  const bottomNavClearance = Math.max(insets.bottom, 8) + 12 + 68 + 8;

  const [book, setBook] = useState(null);
  const [authorWallet, setAuthorWallet] = useState(null);
  const [user, setUser] = useState(null);
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [currency, setCurrency] = useState('USDC');
  const [solPrice, setSolPrice] = useState(null);
  const [paying, setPaying] = useState(false);
  // Set when money was sent but the server hasn't recorded it yet.
  const [pendingRecord, setPendingRecord] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const [reading, setReading] = useState(false);
  const [localFile, setLocalFile] = useState(null); // { uri, name, type }
  const [downloading, setDownloading] = useState(false);

  const [refundModal, setRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundSending, setRefundSending] = useState(false);

  // PDF/EPUB read tracking for refund review (pages visited + seconds spent).
  const readTrackerRef = useRef(null);

  const loadBook = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);

      const { data: bookData, error: bookError } = await supabase
        .from('bazaar_books')
        .select('*')
        .eq('id', bookId)
        .maybeSingle();
      if (bookError) throw bookError;
      if (!bookData) throw new Error('Book not found');
      setBook(bookData);

      const { data: authorData } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', bookData.author_id)
        .maybeSingle();
      setAuthorWallet(authorData?.wallet_address || null);

      if (activePublicKey) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, name, wallet_address')
          .eq('wallet_address', activePublicKey.toString())
          .maybeSingle();
        setUser(userData || null);

        const { data: purchases } = await supabase
          .from('bazaar_purchases')
          .select('id, status, created_at')
          .eq('book_id', bookId)
          .or(`buyer_id.eq.${userData?.id || ZERO_UUID},buyer_wallet.eq.${activePublicKey.toString()}`)
          .order('created_at', { ascending: false })
          .limit(1);
        setPurchase(purchases?.[0] || null);
      } else {
        setUser(null);
        setPurchase(null);
      }
    } catch (err) {
      console.error('[BazaarBook] Load error:', err.message);
      setError(err.message || 'Failed to load book');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [bookId, activePublicKey]);

  useEffect(() => {
    loadBook(true);
  }, [loadBook]);

  // Pull-to-refresh: silent reload — keeps the book page visible.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBook(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSolPriceUsd().then((p) => p && setSolPrice(p));
  }, []);

  const isAuthor = !!(user && book && user.id === book.author_id);
  const hasAccess = !!purchase && purchase.status !== 'refunded';
  const canRead = isAuthor || hasAccess;

  const priceUsd = Number(book?.price_usd ?? 1);
  const sharePct = Number(book?.author_share_pct ?? 70);
  const lendPrice = Number(book?.lend_price_smp || BAZAAR_LEND_PRICE_SMP);
  const solAmount = solPrice ? priceUsd / solPrice : null;

  const finishRecording = async (payload, { silent = false } = {}) => {
    const result = await recordPurchase(payload);
    if (result.ok && result.data?.success) {
      setPendingRecord(null);
      if (!silent) Alert.alert('Unlocked', `Thanks for supporting ${book?.author_name || 'the author'}!`);
      await loadBook();
      return true;
    }
    setPendingRecord(payload);
    Alert.alert(
      'Payment sent, not recorded yet',
      `${result.data?.error || 'The server could not confirm your payment yet.'}\n\nYour money is safe. Tap "Retry recording" on this page. If it keeps failing, contact support with this signature:\n${payload.signature}`
    );
    return false;
  };

  const handlePay = async (accessType = 'purchase') => {
    if (!isWalletConnected || !activePublicKey || !signAndSendTransaction) {
      Alert.alert('Wallet required', 'Please connect your wallet to make a purchase.');
      return;
    }
    // Fail BEFORE any money moves: the server only records purchases for a known account.
    if (!user) {
      Alert.alert('Account not found', 'We could not find an account for this wallet. Sign in again and retry.');
      return;
    }
    if (accessType === 'purchase' && !authorWallet) {
      Alert.alert('Error', 'This book has no author wallet configured.');
      return;
    }
    if (accessType === 'purchase' && currency === 'SOL' && !solPrice) {
      Alert.alert('Pricing unavailable', 'Could not fetch SOL price. Try USDC instead.');
      return;
    }

    setPaying(true);
    let signature = null;
    const payCurrency = accessType === 'lend' ? 'SMP' : currency;
    try {
      const paymentAmount = bookPriceInBaseUnits(payCurrency, solPrice, book);

      const { tx } =
        accessType === 'lend'
          ? await createBazaarLendTransaction({ book, paymentAmount, userPublicKey: activePublicKey })
          : await createBazaarPaymentTransaction({
              book,
              currency,
              paymentAmount,
              userPublicKey: activePublicKey,
              authorPublicKey: new PublicKey(authorWallet),
            });

      const { blockhash, lastValidBlockHeight } = await bazaarConnection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = activePublicKey;

      signature = await signAndSendTransaction(tx);

      let confirmation;
      let retries = 0;
      while (retries < 3) {
        try {
          confirmation = await bazaarConnection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
          break;
        } catch (e) {
          retries++;
          if (retries >= 3) break; // fall through: the server re-checks on-chain anyway
          await new Promise((r) => setTimeout(r, 1000 * retries));
        }
      }
      if (confirmation?.value?.err) throw new Error('Transaction failed on-chain.');
    } catch (err) {
      console.error('[BazaarBook] Payment error:', err.message);
      setPaying(false);
      Alert.alert('Payment failed', err.message || 'Something went wrong.');
      return;
    }

    // From here the payment was sent. Never show "failed"; recording is retryable.
    await finishRecording({
      bookId,
      currency: payCurrency,
      accessType,
      signature,
      walletAddress: activePublicKey.toString(),
    });
    setPaying(false);
  };

  const handleRetryRecording = async () => {
    if (!pendingRecord) return;
    setRetrying(true);
    await finishRecording(pendingRecord);
    setRetrying(false);
  };

  const handleRead = async () => {
    if (!book) return;
    setDownloading(true);
    try {
      // Private bucket: ask the server for a short-lived signed URL, then cache locally.
      const url = await getBookFileUrl(book.id);
      const ext = book.file_type === 'pdf' ? 'pdf' : 'epub';
      const localUri = `${FileSystem.cacheDirectory}bazaar-${book.id}-${Date.now()}.${ext}`;
      const dl = await FileSystem.downloadAsync(url, localUri);
      if (dl.status !== 200) throw new Error('Download failed. Check your connection.');
      setLocalFile({ uri: dl.uri, name: book.file_name || `${book.title}.${ext}`, type: book.file_type });
      readTrackerRef.current?.close();
      readTrackerRef.current = createBazaarReadTracker({
        purchaseId: purchase?.id || null,
        bookId: book.id,
        userId: user?.id || null,
        walletAddress: activePublicKey?.toString() || null,
        fileType: book.file_type,
      });
      setReading(true);
    } catch (err) {
      console.error('[BazaarBook] open error:', err.message);
      Alert.alert('Error', err.message || 'Failed to open the book.');
    } finally {
      setDownloading(false);
    }
  };

  const closeReader = () => {
    readTrackerRef.current?.close();
    readTrackerRef.current = null;
    if (localFile?.uri) FileSystem.deleteAsync(localFile.uri, { idempotent: true }).catch(() => {});
    setReading(false);
    setLocalFile(null);
  };

  // Safety net: flush the tracker if the screen unmounts while reading.
  useEffect(() => () => readTrackerRef.current?.close(), []);

  const handleRefund = async () => {
    if (!purchase) return;
    setRefundSending(true);
    try {
      const result = await callBazaarFunction('request-bazaar-refund', {
        purchaseId: purchase.id,
        reason: refundReason.trim() || undefined,
      });
      if (!result.ok || result.data?.error) {
        Alert.alert('Refund request failed', result.data?.error || 'Try again later.');
      } else {
        Alert.alert('Request sent', 'Your refund request is pending review.');
        setRefundModal(false);
        setRefundReason('');
        await loadBook();
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefundSending(false);
    }
  };

  // ---------- Reader mode ----------
  if (reading && book && localFile) {
    // Pad the reader so its bottom controls clear the floating GlobalBottomNav.
    if (localFile.type === 'epub') {
      return (
        <View style={{ flex: 1, paddingBottom: bottomNavClearance }}>
          <EPUBReader
            file={localFile}
            onBack={closeReader}
            onProgress={({ index, total }) => readTrackerRef.current?.recordPage(index + 1, total)}
          />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: BAZAAR_COLORS.bg, paddingBottom: bottomNavClearance }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={closeReader}>
            <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <Pdf
          source={{ uri: localFile.uri }}
          style={{ flex: 1, backgroundColor: '#fff' }}
          trustAllCerts={false}
          onLoadComplete={(numPages) => readTrackerRef.current?.recordPage(1, numPages)}
          onPageChanged={(page) => readTrackerRef.current?.recordPage(page)}
        />
      </View>
    );
  }

  const Header = ({ title }) => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading && !book) {
    return (
      <View style={styles.container}>
        <Header title="Book" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BAZAAR_COLORS.accent} />
        </View>
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={styles.container}>
        <Header title="Book" />
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={BAZAAR_COLORS.danger} />
          <Text style={styles.errorText}>{error || 'Book not found'}</Text>
        </View>
      </View>
    );
  }

  const readButton = (
    <TouchableOpacity style={styles.primaryButton} onPress={handleRead} disabled={downloading}>
      {downloading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Ionicons name="book-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Read Book</Text>
        </>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header title="Book" />

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={{ paddingBottom: bottomNavClearance }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BAZAAR_COLORS.accent} colors={[BAZAAR_COLORS.accent]} />
        }
      >
        {book.cover_url ? (
          <Image source={{ uri: book.cover_url }} style={styles.detailCover} resizeMode="cover" />
        ) : (
          <View style={[styles.detailCover, { justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="book" size={64} color={BAZAAR_COLORS.textMuted} />
          </View>
        )}

        <View style={styles.detailBody}>
          <Text style={styles.detailTitle}>{book.title}</Text>
          <Text style={styles.detailAuthor}>by {book.author_name || 'Unknown author'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{book.file_type.toUpperCase()}</Text>
            </View>
            {book.sale_enabled && (
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>${priceUsd.toFixed(2)} BUY</Text>
              </View>
            )}
            {book.lending_enabled && (
              <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
                <Text style={[styles.typeText, { color: BAZAAR_COLORS.gold }]}>LEND {lendPrice.toLocaleString()} SMP</Text>
              </View>
            )}
          </View>
          {!!book.description && <Text style={styles.detailDescription}>{book.description}</Text>}
        </View>

        <View style={styles.payCard}>
          {pendingRecord && (
            <>
              <Text style={styles.payTitle}>Payment sent, finishing up</Text>
              <Text style={styles.splitNote}>
                Your payment is on-chain but we haven't recorded it yet. Your money is safe. Tap retry.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, retrying && { opacity: 0.6 }]}
                onPress={handleRetryRecording}
                disabled={retrying}
              >
                {retrying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Retry recording</Text>}
              </TouchableOpacity>
              <View style={{ height: 16 }} />
            </>
          )}

          {isAuthor ? (
            <>
              <Text style={styles.payTitle}>Your book</Text>
              <Text style={styles.splitNote}>
                You earn {sharePct}% of every sale. Manage sales and refunds from your Bazaar dashboard.
              </Text>
              {readButton}
              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('BazaarDashboard')}>
                <Ionicons name="stats-chart-outline" size={18} color={BAZAAR_COLORS.textPrimary} />
                <Text style={styles.secondaryButtonText}>Open Dashboard</Text>
              </TouchableOpacity>
            </>
          ) : hasAccess ? (
            <>
              <Text style={styles.payTitle}>Unlocked</Text>
              <Text style={styles.splitNote}>
                You own this book. Enjoy the read.
                {purchase?.status === 'refund_pending' ? '\nA refund request is pending review.' : ''}
              </Text>
              {readButton}
              {purchase?.status === 'completed' && (
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setRefundModal(true)}>
                  <Ionicons name="return-up-back-outline" size={18} color={BAZAAR_COLORS.textPrimary} />
                  <Text style={styles.secondaryButtonText}>Request Refund</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {book.sale_enabled && (
                <>
                  <Text style={styles.payTitle}>Buy — ${priceUsd.toFixed(2)}</Text>
                  <Text style={styles.splitNote}>
                    One-time payment. {sharePct}% goes directly to the author, the rest supports the platform. Pay with USDC or SOL.
                  </Text>

                  <View style={styles.currencyRow}>
                    {['USDC', 'SOL'].map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.currencyOption, currency === c && styles.currencyOptionActive]}
                        onPress={() => setCurrency(c)}
                      >
                        <Text style={[styles.currencyOptionText, currency === c && styles.currencyOptionActiveText]}>
                          {c === 'USDC' ? `$${priceUsd.toFixed(2)} USDC` : solAmount ? `~${solAmount.toFixed(4)} SOL` : 'SOL'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, paying && { opacity: 0.6 }]}
                    onPress={() => handlePay('purchase')}
                    disabled={paying}
                  >
                    {paying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="lock-open-outline" size={18} color="#fff" />
                        <Text style={styles.primaryButtonText}>Pay & Unlock</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {book.lending_enabled && (
                <>
                  <Text style={[styles.payTitle, book.sale_enabled && { marginTop: 20 }]}>
                    Borrow — {lendPrice.toLocaleString()} SMP
                  </Text>
                  <Text style={styles.splitNote}>
                    One-time SMP payment for permanent access. The full amount goes to the platform.
                  </Text>
                  <TouchableOpacity
                    style={[styles.secondaryButton, paying && { opacity: 0.6 }]}
                    onPress={() => handlePay('lend')}
                    disabled={paying}
                  >
                    {paying ? (
                      <ActivityIndicator color={BAZAAR_COLORS.textPrimary} />
                    ) : (
                      <>
                        <Ionicons name="key-outline" size={18} color={BAZAAR_COLORS.textPrimary} />
                        <Text style={styles.secondaryButtonText}>Pay {lendPrice.toLocaleString()} SMP & Borrow</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {!book.sale_enabled && !book.lending_enabled && (
                <Text style={styles.splitNote}>This book is not currently available.</Text>
              )}
              {!isWalletConnected && <Text style={[styles.splitNote, { marginTop: 10 }]}>Connect your wallet to purchase.</Text>}
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={refundModal} transparent animationType="fade" onRequestClose={() => setRefundModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.payCard, { margin: 0 }]}>
            <Text style={styles.payTitle}>Request a refund</Text>
            <Text style={styles.splitNote}>Tell us why you'd like a refund. Requests are reviewed manually.</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Reason (optional)"
              placeholderTextColor={BAZAAR_COLORS.textMuted}
              multiline
              value={refundReason}
              onChangeText={setRefundReason}
            />
            <TouchableOpacity
              style={[styles.primaryButton, refundSending && { opacity: 0.6 }]}
              onPress={handleRefund}
              disabled={refundSending}
            >
              {refundSending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit Request</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setRefundModal(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default BazaarBookScreen;
