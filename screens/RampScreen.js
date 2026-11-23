// Ramp: Buy (MoonPay → USDC or SOL, every fee shown first) and Cash out (USDC → Jupiter Send link →
// claim in Jupiter Mobile → withdraw to bank there).
import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Share, Platform, Linking, KeyboardAvoidingView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';
import GelOrb from '../components/nav/GelOrb';
import { GelGlass, GelButton, GelChips, GelInset, GelRow, GelInput } from '../components/gel/GelKit';
import { GelGate, GelPageHeader } from '../components/gel/GelGate';
import { gelAlert } from '../components/gel/GelAlert';
import { logMoneyEvent } from '../services/moneyFeed';
import { BUY_ASSETS, BUY_METHODS, getBuyQuote, buyUrl, moonpayMode } from '../services/moonpay';
import {
  CASHOUT_MIN,
  CASHOUT_MAX,
  JUPITER_MOBILE_URL,
  getBalances,
  getSolUsd,
  previewCashout,
  createCashout,
  cancelCashout,
  loadLinks,
  linkStatus,
  forgetLink,
} from '../services/cashout';

const BUY_AMOUNTS = [25, 50, 100, 250];
const usd = (n) => (n == null || !Number.isFinite(n) ? '—' : `$${n.toFixed(2)}`);
const num = (n, d = 4) => (n == null || !Number.isFinite(n) ? '—' : `${Number(n.toFixed(d))}`);
const parseAmount = (t) => {
  const n = Number(String(t).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Note({ icon = 'info-circle', tone = 'info', children }) {
  const { colors } = useTheme();
  const c = tone === 'warn' ? colors.warning : colors.accent;
  const bg = tone === 'warn' ? 'rgba(245,158,11,0.10)' : `rgba(${colors.accentRgb},0.08)`;
  const bd = tone === 'warn' ? 'rgba(245,158,11,0.35)' : `rgba(${colors.accentRgb},0.25)`;
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12, padding: 12, borderRadius: 18, backgroundColor: bg, borderWidth: 1, borderColor: bd }}>
      <Icon name={icon} size={14} color={c} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: tone === 'warn' ? colors.warning : colors.textSecondary, fontSize: 13, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

function Steps({ items }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 10 }}>
      {items.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 8 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{i + 1}</Text>
          </View>
          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------------------------------- Buy
function BuyTab({ address }) {
  const { colors } = useTheme();
  const [asset, setAsset] = useState('usdc_sol');
  const [method, setMethod] = useState('credit_debit_card');
  const [amountText, setAmountText] = useState('100');
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [mode, setMode] = useState(null);
  const amount = parseAmount(amountText);
  const debounced = useDebounced(amount, 500);
  const symbol = BUY_ASSETS.find((a) => a.value === asset)?.symbol;

  useEffect(() => {
    moonpayMode(address).then(setMode);
  }, [address]);

  useEffect(() => {
    if (!debounced) { setQuote(null); setQuoteErr(''); return undefined; }
    let dead = false;
    setLoading(true);
    getBuyQuote({ walletAddress: address, asset, usd: debounced, method })
      .then((q) => { if (!dead) { setQuote(q); setQuoteErr(''); } })
      .catch((e) => { if (!dead) { setQuote(null); setQuoteErr(e.message); } })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [address, asset, method, debounced]);

  const belowMin = quote && quote.min && amount < quote.min;
  const aboveMax = quote && quote.max && amount > quote.max;
  const fresh = quote && !loading && debounced === amount;

  const go = async () => {
    if (!amount || belowMin || aboveMax) return;
    setOpening(true);
    try {
      const url = await buyUrl({ walletAddress: address, asset, usd: amount, method });
      if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
      else await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'close' });
    } catch (e) {
      toast.error(`Could not open MoonPay — ${e.message}`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <GelGlass radius={28} glow={false} padding={18}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>You buy</Text>
        <GelChips options={BUY_ASSETS} value={asset} onChange={setAsset} style={{ marginTop: 8 }} />
        <GelInput
          label="You spend (USD, before fees)"
          value={amountText}
          onChangeText={(t) => setAmountText(t.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="100"
          error={belowMin ? `MoonPay's minimum is $${quote.min}.` : aboveMax ? `MoonPay's maximum is $${quote.max}.` : quoteErr || undefined}
        />
        <GelChips options={BUY_AMOUNTS.map((n) => ({ value: String(n), label: `$${n}` }))} value={amountText} onChange={setAmountText} style={{ marginTop: 10 }} />
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginLeft: 4, marginTop: 16 }}>Pay with</Text>
        <GelChips options={BUY_METHODS} value={method} onChange={setMethod} style={{ marginTop: 8 }} />

        <GelInset style={{ marginTop: 16, opacity: fresh ? 1 : 0.55 }}>
          <GelRow label="You spend" value={usd(amount)} />
          <GelRow label="MoonPay fee" value={quote ? usd(quote.fee) : '—'} />
          <GelRow label="Network fee" value={quote ? usd(quote.networkFee) : '—'} />
          <GelRow label="Total charged" value={quote ? usd(amount + quote.fee + quote.networkFee) : '—'} strong />
          <GelRow label={`Price per ${symbol}`} value={quote ? usd(quote.price) : '—'} />
          <GelRow label="You get (about)" value={quote ? `${num(quote.receive, asset === 'sol' ? 4 : 2)} ${symbol}` : '—'} strong />
        </GelInset>
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8, marginHorizontal: 4 }}>
          Live quote from MoonPay. Its price per coin includes a small spread, and the final amount is confirmed on MoonPay's page.
        </Text>

        <GelButton
          label={`Continue to MoonPay`}
          icon="credit-card"
          loading={opening}
          disabled={!amount || !!belowMin || !!aboveMax || !!quoteErr}
          onPress={go}
          style={{ marginTop: 16 }}
        />
      </GelGlass>
      {mode === 'test' ? (
        <Note tone="warn" icon="flask">
          MoonPay is in test mode, so purchases are simulated and no real money moves. Switch to the live MoonPay key to take real payments.
        </Note>
      ) : null}
      <Note>
        The {symbol} goes straight to your Sempai wallet ({address.slice(0, 4)}…{address.slice(-4)}). The first time, MoonPay asks you to verify your identity.
      </Note>
    </>
  );
}

// -------------------------------------------------------------------------------------- Cash out
function CodeCard({ link, onCancel, cancelling }) {
  const { colors } = useTheme();
  const [status, setStatus] = useState(link.cancelledSig ? 'gone' : 'checking');
  const [shown, setShown] = useState(false);

  const check = useCallback(async () => {
    if (!link.sig && Date.now() - link.createdAt < 120_000) return setStatus('sending');
    setStatus(await linkStatus(link.code));
  }, [link]);

  useEffect(() => { if (!link.cancelledSig) check(); }, [check, link.cancelledSig]);

  const expired = Date.now() > link.expiresAt;
  const label =
    status === 'waiting' ? `Waiting · expires ${new Date(link.expiresAt).toLocaleDateString()}` :
    status === 'gone' ? (link.cancelledSig ? 'Cancelled — USDC returned' : expired ? 'Expired — USDC returned' : 'Claimed') :
    status === 'sending' ? 'Sending…' :
    status === 'unknown' ? 'Could not check' : 'Checking…';
  const tint = status === 'waiting' ? colors.accent : status === 'gone' ? colors.success : colors.textMuted;

  const copy = async () => {
    try { await Clipboard.setStringAsync(link.code); toast.success('Claim code copied'); } catch { /* ignore */ }
  };

  return (
    <GelInset style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>{link.amount} USDC</Text>
        <Text style={{ color: tint, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      </View>
      {status === 'waiting' || status === 'sending' || status === 'unknown' ? (
        <>
          <Pressable onPress={() => setShown((s) => !s)} accessibilityRole="button" accessibilityLabel={shown ? 'Hide claim code' : 'Show claim code'}>
            <Text selectable style={{ color: colors.textPrimary, fontSize: 22, letterSpacing: 2, fontWeight: '800', marginTop: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
              {shown ? link.code : '••••••••••••'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{shown ? 'Tap to hide' : 'Tap to show the claim code'}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <GelButton small variant="secondary" icon="copy" label="Copy code" onPress={copy} style={{ flex: 1 }} />
            {status === 'waiting' ? (
              <GelButton small variant="ghost" icon="undo" label="Cancel" loading={cancelling} onPress={() => onCancel(link)} style={{ flex: 1 }} />
            ) : (
              <GelButton small variant="ghost" icon="sync" label="Check" onPress={check} style={{ flex: 1 }} />
            )}
          </View>
        </>
      ) : status === 'gone' ? (
        <Pressable onPress={() => forgetLink(link.code).then(() => onCancel(null))} accessibilityRole="button">
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>Remove from this list</Text>
        </Pressable>
      ) : null}
    </GelInset>
  );
}

function CashOutTab({ address, signTransactionOnly }) {
  const { colors } = useTheme();
  const [amountText, setAmountText] = useState('');
  const [bal, setBal] = useState(null);
  const [solUsd, setSolUsd] = useState(null);
  const [feeSol, setFeeSol] = useState(null);
  const [feeErr, setFeeErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [links, setLinks] = useState([]);
  const [made, setMade] = useState(null);
  const amount = parseAmount(amountText);
  const debounced = useDebounced(amount, 600);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const refresh = useCallback(async () => {
    const [b, p, l] = await Promise.all([getBalances(address), getSolUsd(), loadLinks()]);
    if (!alive.current) return;
    setBal(b);
    setSolUsd(p);
    setLinks(l.filter((x) => x.owner === address));
  }, [address]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    if (!debounced || debounced < CASHOUT_MIN) { setFeeSol(null); setFeeErr(''); return undefined; }
    let dead = false;
    previewCashout(address, debounced)
      .then(({ feeSol: f }) => { if (!dead) { setFeeSol(f); setFeeErr(''); } })
      .catch((e) => { if (!dead) { setFeeSol(null); setFeeErr(e.message); } });
    return () => { dead = true; };
  }, [address, debounced]);

  const tooSmall = amount > 0 && amount < CASHOUT_MIN;
  const tooBig = amount > CASHOUT_MAX;
  const noUsdc = bal && amount > bal.usdc;
  const noSol = bal && feeSol != null && bal.sol < feeSol + 0.0005;
  const amountError = tooSmall
    ? `The minimum is ${CASHOUT_MIN} USDC.`
    : tooBig
    ? `The maximum per link is ${CASHOUT_MAX} USDC.`
    : noUsdc
    ? `You have ${num(bal.usdc, 2)} USDC.`
    : undefined;
  const canSend = amount >= CASHOUT_MIN && !tooBig && !noUsdc && !noSol && feeSol != null && !busy;

  const send = () => {
    gelAlert(
      `Cash out ${amount} USDC?`,
      `This puts ${amount} USDC into a Jupiter link with a claim code. Anyone with the code can claim it, so keep it private. If it isn't claimed in time, it comes back to your wallet.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Create link',
          onPress: async () => {
            setBusy(true);
            try {
              const link = await createCashout({ owner: address, amount, signTransactionOnly });
              logMoneyEvent({
                event_type: 'cashout_link',
                direction: 'out',
                asset: 'USDC',
                amount,
                wallet: address,
                counterparty: 'Jupiter Send',
                title: `Cash out ${amount} USDC (Jupiter link)`,
                tx_sig: link.sig,
                meta: { expiresAt: link.expiresAt },
              });
              setMade(link);
              setAmountText('');
              toast.success('Cash-out link ready — claim it in Jupiter Mobile.');
            } catch (e) {
              toast.error(e.message || 'Could not create the link.');
            } finally {
              setBusy(false);
              refresh();
            }
          },
        },
      ],
    );
  };

  const cancel = (link) => {
    if (!link) return refresh();
    gelAlert('Cancel this link?', `${link.amount} USDC goes back to your wallet and the claim code stops working.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel link',
        style: 'destructive',
        onPress: async () => {
          setCancelling(link.code);
          try {
            await cancelCashout({ owner: address, code: link.code, signTransactionOnly });
            toast.success('Cancelled — the USDC is back in your wallet.');
            if (made?.code === link.code) setMade(null);
          } catch (e) {
            toast.error(e.message || 'Could not cancel the link.');
          } finally {
            setCancelling(null);
            refresh();
          }
        },
      },
    ]);
  };

  const share = async () => {
    try {
      await Share.share({ message: `Jupiter claim code: ${made.code} (${made.amount} USDC). Open Jupiter Mobile → Deposit → Receive funds → Claim Code.` });
    } catch { /* ignore */ }
  };

  return (
    <>
      {made ? (
        <GelGlass radius={28} glow padding={18} style={{ marginBottom: 14 }}>
          <View style={{ alignItems: 'center' }}>
            <View pointerEvents="none"><GelOrb icon="check" size={52} lit breathe={false} /></View>
            <Text style={{ fontFamily: 'Yoruka', fontSize: 24, color: colors.textPrimary, marginTop: 10 }}>Link ready</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>{made.amount} USDC is waiting for you in Jupiter</Text>
            <Text selectable style={{ color: colors.accent, fontSize: 28, letterSpacing: 3, fontWeight: '900', marginTop: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{made.code}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Your claim code — keep it private</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <GelButton small variant="secondary" icon="copy" label="Copy code" onPress={async () => { try { await Clipboard.setStringAsync(made.code); toast.success('Claim code copied'); } catch {} }} style={{ flex: 1 }} />
            <GelButton small variant="secondary" icon="share-alt" label="Share" onPress={share} style={{ flex: 1 }} />
          </View>
          <Steps
            items={[
              'Open Jupiter Mobile (install it and create a wallet if you’re new).',
              'Tap Deposit → Receive funds → Claim Code, and paste the code.',
              'Withdraw the USDC to your bank in Jupiter. Jupiter shows its own cash-out fee and the countries it supports.',
            ]}
          />
          <GelButton label="Open Jupiter Mobile" icon="external-link-alt" onPress={() => Linking.openURL(JUPITER_MOBILE_URL)} style={{ marginTop: 16 }} />
          <Pressable onPress={() => setMade(null)} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 12 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Done</Text>
          </Pressable>
        </GelGlass>
      ) : null}

      <GelGlass radius={28} glow={false} padding={18}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>USDC only</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {bal ? `${num(bal.usdc, 2)} USDC · ${num(bal.sol, 4)} SOL` : 'Loading balance…'}
          </Text>
        </View>
        <GelInput
          label="Amount to cash out (USDC)"
          value={amountText}
          onChangeText={(t) => setAmountText(t.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={`${CASHOUT_MIN}–${CASHOUT_MAX}`}
          error={amountError || feeErr || undefined}
        />
        {bal && bal.usdc >= CASHOUT_MIN ? (
          <Pressable onPress={() => setAmountText(String(Math.min(CASHOUT_MAX, Math.floor(bal.usdc * 100) / 100)))} accessibilityRole="button" style={{ alignSelf: 'flex-end', marginTop: 6, marginRight: 4 }}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800' }}>Use max</Text>
          </Pressable>
        ) : null}

        <GelInset style={{ marginTop: 14 }}>
          <GelRow label="You send" value={amount ? `${amount} USDC` : '—'} />
          <GelRow label="Jupiter Send fee" value="Free" />
          <GelRow label="Network + account cost" value={feeSol != null ? `${num(feeSol, 5)} SOL${solUsd ? ` (${usd(feeSol * solUsd)})` : ''}` : '—'} />
          <GelRow label="Arrives in Jupiter" value={amount ? `${amount} USDC` : '—'} strong />
          <GelRow label="Bank withdrawal" value="Shown in Jupiter" />
        </GelInset>
        {noSol ? <Note tone="warn" icon="gas-pump">You need about {num(feeSol + 0.0005, 4)} SOL for the network cost. You have {num(bal.sol, 4)} SOL.</Note> : null}

        <GelButton label={busy ? 'Creating link…' : 'Create cash-out link'} icon="university" loading={busy} disabled={!canSend} onPress={send} style={{ marginTop: 16 }} />
      </GelGlass>

      <Note icon="shield-alt">
        Jupiter holds the USDC until you claim it with your code in Jupiter Mobile, then you withdraw to your bank there. Unclaimed links return to your wallet when they expire, and you can cancel one any time before it’s claimed. {Platform.OS === 'web' ? 'On the web, claim codes are kept only while this tab is open, so copy yours.' : 'Your claim codes are saved only on this phone.'}
      </Note>

      {links.length ? (
        <View style={{ marginTop: 18 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginLeft: 4 }}>Your cash-out links</Text>
          {links.map((l) => (
            <CodeCard key={l.code} link={l} onCancel={cancel} cancelling={cancelling === l.code} />
          ))}
        </View>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------- screen
const RampScreen = ({ route }) => {
  const { colors } = useTheme();
  const { wallet, isWalletConnected, signTransactionOnly } = useContext(EmbeddedWalletContext) || {};
  const address = wallet?.publicKey?.toString();
  const [tab, setTab] = useState(route?.params?.tab === 'cashout' ? 'cashout' : 'buy');

  if (!isWalletConnected || !address) {
    return <GelGate icon="credit-card" headerTitle="Ramp" subtitle="Connect your wallet to buy crypto or cash out USDC." />;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <GelPageHeader title="Ramp" subtitle={tab === 'buy' ? 'Buy USDC or SOL with MoonPay' : 'Cash out USDC with Jupiter'} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <GelChips
          options={[{ value: 'buy', label: 'Buy' }, { value: 'cashout', label: 'Cash out' }]}
          value={tab}
          onChange={setTab}
          style={{ marginTop: 0, marginBottom: 14 }}
        />
        {tab === 'buy' ? <BuyTab address={address} /> : <CashOutTab address={address} signTransactionOnly={signTransactionOnly} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RampScreen;
