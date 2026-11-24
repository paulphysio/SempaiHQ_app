import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, RefreshControl, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useBazaarTheme } from '../styles/BazaarStyles';
import {
  BAZAAR_LEND_PRICE_SMP,
  bazaarConnection,
  bookPriceInBaseUnits,
  callBazaarFunction,
  createBazaarLendTransaction,
  createBazaarPaymentTransaction,
  fetchBazaarCopies,
  fetchSolPriceUsd,
  recordPurchase,
} from '../utils/bazaar';
import { toast } from '../components/Toast';
import { myId, getBookPosition, positionLabel } from '../services/bookProgress';
import ScreenSkeleton from '../components/ScreenSkeleton';
import { EmptyState } from '../components/ui';
import { useTheme } from '../context/ThemeContext';
import { DetailHero, ActionButton, makeDetailStyles, formatCount } from '../components/detail/DetailKit';
import { Card } from '../components/page/PageKit';
import { space } from '../theme/tokens';
import { GelModal, GelInput } from '../components/gel/GelKit';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

const BazaarBookScreen = () => {
  const { colors: BAZAAR_COLORS, styles } = useBazaarTheme();
  const { colors, isDark } = useTheme();
  const kit = React.useMemo(() => makeDetailStyles(colors, isDark), [colors, isDark]);
  const cardTitle = { fontFamily: 'Yoruka', fontSize: 19, color: colors.textPrimary, marginBottom: 6 };
  const cardNote = { fontSize: 14, lineHeight: 21, color: colors.textSecondary };
  const currencyRow = { flexDirection: 'row', gap: 8, marginTop: space.md };
  const currencyChip = { flex: 1, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' };
  const currencyText = { fontSize: 13, fontWeight: '700' };
  const navigation = useNavigation();
  const route = useRoute();
  const bookId = route.params?.bookId || route.params?.id; // app links pass bookId, web addresses (/bazaar/:id) pass id
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

  // Limited edition: { max, taken, left } (null until known)
  const [copies, setCopies] = useState(null);

  // Where you stopped in this book (refreshed when you come back from reading).
  const [readPos, setReadPos] = useState(null);
  useEffect(() => {
    const load = async () => {
      const me = await myId();
      setReadPos(me ? await getBookPosition(me, bookId).catch(() => null) : null);
    };
    load();
    return navigation.addListener('focus', load);
  }, [navigation, bookId]);

  const [refundModal, setRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundSending, setRefundSending] = useState(false);

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
      fetchBazaarCopies([bookData.id]).then((c) => setCopies(c[bookData.id] || null));

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
      if (!silent) toast.success(`Unlocked — ${`Thanks for supporting ${book?.author_name || 'the author'}!`}`);
      await loadBook();
      return true;
    }
    setPendingRecord(payload);
    toast.info(`Payment sent, not recorded yet — ${`${result.data?.error || 'The server could not confirm your payment yet.'}\n\nYour money is safe. Tap "Retry recording" on this page. If it keeps failing, contact support with this signature:\n${payload.signature}`}`);
    return false;
  };

  const handlePay = async (accessType = 'purchase') => {
    if (!isWalletConnected || !activePublicKey || !signAndSendTransaction) {
      toast.error('Wallet required — Please connect your wallet to make a purchase.');
      return;
    }
    // Fail BEFORE any money moves: the server only records purchases for a known account.
    if (!user) {
      toast.error('Account not found — We could not find an account for this wallet. Sign in again and retry.');
      return;
    }
    if (accessType === 'purchase' && !authorWallet) {
      toast.error('This book has no author wallet configured.');
      return;
    }
    if (accessType === 'purchase' && currency === 'SOL' && !solPrice) {
      toast.info('Pricing unavailable — Could not fetch SOL price. Try USDC instead.');
      return;
    }

    setPaying(true);
    // Limited edition: check a copy is still free right before any money moves.
    const fresh = (await fetchBazaarCopies([book.id]))[book.id];
    if (fresh) setCopies(fresh);
    if (fresh && fresh.left <= 0) {
      setPaying(false);
      toast.info(`Sold out — all ${fresh.max} copies of this book are taken.`);
      return;
    }
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
      toast.error(`Payment failed — ${err.message || 'Something went wrong.'}`);
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

  // Reading happens on its own full-screen page (no app bars over the book).
  const handleRead = () => {
    if (!book) return;
    navigation.navigate('BazaarReader', {
      bookId: book.id,
      title: book.title,
      fileType: book.file_type === 'pdf' ? 'pdf' : 'epub',
      fileName: book.file_name || null,
      purchaseId: purchase?.id || null,
      userId: user?.id || null,
      walletAddress: activePublicKey?.toString() || null,
    });
  };

  const handleRefund = async () => {
    if (!purchase) return;
    setRefundSending(true);
    try {
      const result = await callBazaarFunction('request-bazaar-refund', {
        purchaseId: purchase.id,
        reason: refundReason.trim() || undefined,
      });
      if (!result.ok || result.data?.error) {
        toast.error(`Refund request failed — ${result.data?.error || 'Try again later.'}`);
      } else {
        toast.info('Request sent — Your refund request is pending review.');
        setRefundModal(false);
        setRefundReason('');
        await loadBook();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRefundSending(false);
    }
  };

  if (loading && !book) {
    return <ScreenSkeleton variant="detail" label="Loading book" />;
  }

  if (error || !book) {
    return (
      <View style={[kit.page, kit.center]}>
        <EmptyState
          icon="book-dead"
          title="Book not found"
          subtitle={error || 'This book may have been removed from the Bazaar.'}
          action="Back to Bazaar"
          onAction={() => navigation.navigate('Bazaar')}
        />
      </View>
    );
  }

  const fileType = String(book.file_type || '').toUpperCase();
  const soldOut = !!copies && copies.left <= 0;
  const copiesLabel = copies ? (soldOut ? 'Sold out' : `${copies.left} of ${copies.max} left`) : null;
  const resumable = readPos && readPos.pct > 0.5 && readPos.pct < 99.5;
  const readAction = {
    icon: 'book-open',
    label: resumable ? `Continue · ${positionLabel(readPos)}` : 'Read book',
    onPress: handleRead,
  };
  let primary;
  let secondary;
  if (isAuthor) {
    primary = readAction;
    secondary = { icon: 'chart-line', label: 'Dashboard', onPress: () => navigation.navigate('BazaarDashboard') };
  } else if (hasAccess) {
    primary = readAction;
    if (purchase?.status === 'completed') {
      secondary = { icon: 'undo', label: 'Request refund', onPress: () => setRefundModal(true) };
    }
  } else if (soldOut && (book.sale_enabled || book.lending_enabled)) {
    primary = { icon: 'ban', label: `Sold out · all ${copies.max} copies taken`, disabled: true };
  } else if (book.sale_enabled) {
    primary = {
      icon: paying ? 'spinner' : 'lock-open',
      label: paying ? 'Paying…' : 'Pay $' + priceUsd.toFixed(2) + ' & unlock',
      onPress: paying ? undefined : () => handlePay('purchase'),
      disabled: paying,
    };
    if (book.lending_enabled) {
      secondary = {
        icon: 'key',
        label: 'Borrow · ' + formatCount(lendPrice) + ' SMP',
        onPress: paying ? undefined : () => handlePay('lend'),
        disabled: paying,
      };
    }
  } else if (book.lending_enabled) {
    primary = {
      icon: paying ? 'spinner' : 'key',
      label: paying ? 'Paying…' : 'Borrow · ' + formatCount(lendPrice) + ' SMP',
      onPress: paying ? undefined : () => handlePay('lend'),
      disabled: paying,
    };
  }

  return (
    <View style={kit.page}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomNavClearance + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        <DetailHero
          image={book.cover_url}
          title={book.title}
          author={{ name: book.author_name || 'Unknown author' }}
          chips={[
            fileType ? { label: fileType, icon: 'file-alt' } : null,
            book.sale_enabled ? { label: '$' + priceUsd.toFixed(2), icon: 'tag', color: colors.accent } : null,
            book.lending_enabled ? { label: 'Lend ' + formatCount(lendPrice), icon: 'key', color: colors.gold } : null,
            copiesLabel ? { label: copiesLabel, icon: soldOut ? 'ban' : 'layer-group', color: soldOut ? colors.danger : colors.textSecondary } : null,
          ]}
          primary={primary}
          secondary={secondary}
          synopsis={book.description}
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
          styles={kit}
          colors={colors}
          isDark={isDark}
        >
          <Card style={{ marginTop: space.lg }} tint>
            {pendingRecord ? (
              <View style={{ marginBottom: space.md }}>
                <Text style={cardTitle}>Payment sent — finishing up</Text>
                <Text style={cardNote}>Your payment is on-chain but not recorded yet. Your money is safe; tap retry.</Text>
                <View style={kit.actions}>
                  <ActionButton
                    lit
                    icon={retrying ? 'spinner' : 'redo'}
                    label={retrying ? 'Retrying…' : 'Retry recording'}
                    onPress={retrying ? undefined : handleRetryRecording}
                    styles={kit}
                    colors={colors}
                    isDark={isDark}
                  />
                </View>
              </View>
            ) : null}

            {isAuthor ? (
              <>
                <Text style={cardTitle}>Your book</Text>
                <Text style={cardNote}>You earn {sharePct}% of every sale. Manage sales and refunds from your Bazaar dashboard.</Text>
              </>
            ) : hasAccess ? (
              <>
                <Text style={cardTitle}>Unlocked</Text>
                <Text style={cardNote}>
                  You own this book — enjoy the read.
                  {purchase?.status === 'refund_pending' ? ' A refund request is pending review.' : ''}
                </Text>
              </>
            ) : book.sale_enabled || book.lending_enabled ? (
              <>
                <Text style={cardTitle}>{book.sale_enabled ? 'How payment works' : 'How borrowing works'}</Text>
                {book.sale_enabled ? (
                  <>
                    <Text style={cardNote}>
                      Limited edition{copies ? ` — only ${copies.max} copies, ${soldOut ? 'all taken' : `${copies.left} left`}` : ''}.
                      {' '}One-time payment. {sharePct}% goes directly to the author; the rest supports the platform.
                    </Text>
                    <View style={currencyRow}>
                      {['USDC', 'SOL'].map((c) => {
                        const on = currency === c;
                        return (
                          <Pressable
                            key={c}
                            onPress={() => setCurrency(c)}
                            style={[currencyChip, { borderColor: on ? colors.accent : colors.borderStrong, backgroundColor: on ? colors.accentSoft : 'transparent' }]}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                          >
                            <Text style={[currencyText, { color: on ? colors.accent : colors.textSecondary }]}>
                              {c === 'USDC' ? '$' + priceUsd.toFixed(2) + ' USDC' : solAmount ? '~' + solAmount.toFixed(4) + ' SOL' : 'SOL'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
                {book.lending_enabled ? (
                  <Text style={[cardNote, { marginTop: space.sm }]}>
                    Borrowing costs {lendPrice.toLocaleString()} SMP once, for permanent access.
                  </Text>
                ) : null}
                {!isWalletConnected ? (
                  <Text style={[cardNote, { color: colors.warning, marginTop: space.sm }]}>Connect your wallet to buy or borrow.</Text>
                ) : null}
              </>
            ) : (
              <Text style={cardNote}>This book is not currently available.</Text>
            )}
          </Card>
        </DetailHero>
      </ScrollView>

      <GelModal
        visible={refundModal}
        onClose={() => !refundSending && setRefundModal(false)}
        dismissable={!refundSending}
        variant="sheet"
        icon="undo"
        title="Request a refund"
        subtitle="Tell us why. Refunds are reviewed by a person."
        actions={[
          { label: 'Cancel', variant: 'secondary', disabled: refundSending, onPress: () => setRefundModal(false) },
          { label: 'Send request', icon: 'paper-plane', loading: refundSending, onPress: handleRefund },
        ]}
      >
        <GelInput multiline placeholder="Reason (optional)" value={refundReason} onChangeText={setRefundReason} />
      </GelModal>
    </View>
  );
};

export default BazaarBookScreen;
