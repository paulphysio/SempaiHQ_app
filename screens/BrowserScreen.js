// Sempai HQ's own browser: browse anything without leaving the app, with the built-in wallet
// available to Solana sites (it shows up as "Sempai HQ" in their wallet list).
//
// Safety rules:
//  · The page never sees keys — only the public address and signatures it was approved for.
//  · The site's identity is taken from the browser's own address bar (not from the page).
//  · sempaihq.com sites connect automatically; any other site must be approved once, and every
//    signature is approved one by one, with a simulation of what the transaction does to your SOL.
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform, Linking, Share, Keyboard, ActivityIndicator, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as Clipboard from 'expo-clipboard';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import GelOrb from '../components/nav/GelOrb';
import { GelGlass, GelModal, GelInset, GelRow, GelOption } from '../components/gel/GelKit';
import { toast } from '../components/Toast';
import { RPC_URL } from '../constants';
import { WALLET_BRIDGE } from '../components/browser/walletBridge';

const HOME = 'sempai://home';
const SITES_KEY = 'browser_connected_sites_v1';
const connection = new Connection(RPC_URL, 'confirmed');

const SHORTCUTS = [
  { name: 'Sempai HQ', url: 'https://www.sempaihq.com', icon: 'https://www.sempaihq.com/images/logo.jpg' },
  { name: 'Jupiter', url: 'https://jup.ag' },
  { name: 'Solscan', url: 'https://solscan.io' },
  { name: 'Magic Eden', url: 'https://magiceden.io' },
  { name: 'Tensor', url: 'https://www.tensor.trade' },
  { name: 'Raydium', url: 'https://raydium.io' },
  { name: 'DexScreener', url: 'https://dexscreener.com/solana' },
  { name: 'Birdeye', url: 'https://birdeye.so' },
  { name: 'X', url: 'https://x.com' },
  { name: 'YouTube', url: 'https://m.youtube.com' },
  { name: 'Wikipedia', url: 'https://en.m.wikipedia.org' },
  { name: 'Google', url: 'https://www.google.com' },
];

const originOf = (u) => {
  try { const x = new URL(u); return `${x.protocol}//${x.host}`; } catch { return ''; }
};
const hostOf = (u) => {
  try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; }
};
const isTrusted = (origin) => /^https:\/\/([a-z0-9-]+\.)*sempaihq\.com$/i.test(origin);
const favicon = (u) => `https://www.google.com/s2/favicons?sz=128&domain=${hostOf(u)}`;

/** Turn what was typed into a URL: a web address, or a search. */
function toUrl(text) {
  const t = String(text || '').trim();
  if (!t) return HOME;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(t) && !/\s/.test(t)) return `https://${t}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(t)}`;
}

async function loadSites() {
  try { return JSON.parse((await AsyncStorage.getItem(SITES_KEY)) || '[]'); } catch { return []; }
}
async function saveSites(list) {
  try { await AsyncStorage.setItem(SITES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

/** What a transaction does to this wallet's SOL, by simulating it (best effort). */
async function simulate(tx, owner) {
  try {
    const before = await connection.getBalance(new PublicKey(owner));
    const sim = await connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      accounts: { encoding: 'base64', addresses: [owner] },
    });
    if (sim.value.err) return { error: 'The network says this transaction would fail.' };
    const after = sim.value.accounts?.[0]?.lamports;
    return after == null ? {} : { solChange: (after - before) / 1e9 };
  } catch {
    return {};
  }
}

export default function BrowserScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { wallet, isWalletConnected, signTransactionOnly, signAndSendTransaction, signMessageOnly } = useContext(EmbeddedWalletContext) || {};
  const address = wallet?.publicKey?.toString() || null;

  const web = useRef(null);
  const [url, setUrl] = useState(route.params?.url ? toUrl(route.params.url) : HOME);
  const [current, setCurrent] = useState(url); // what the page is actually on
  const [title, setTitle] = useState('');
  const [typed, setTyped] = useState('');
  const [editing, setEditing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [canBack, setCanBack] = useState(false);
  const [canFwd, setCanFwd] = useState(false);
  const [sites, setSites] = useState([]);
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState(null); // pending approval { kind, origin, ..., resolve }
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadSites().then(setSites); }, []);
  useEffect(() => {
    if (route.params?.url) {
      const u = toUrl(route.params.url);
      setUrl(u);
      setCurrent(u);
      navigation.setParams({ url: undefined });
    }
  }, [route.params?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const origin = originOf(current);
  const isHome = url === HOME;
  const secure = current.startsWith('https://');
  const connected = !!origin && (isTrusted(origin) || sites.includes(origin));

  const go = useCallback((text) => {
    Keyboard.dismiss();
    setEditing(false);
    const u = toUrl(text);
    setUrl(u);
    setCurrent(u);
  }, []);

  const reply = useCallback((id, ok, data) => {
    const js = `window.__sempaiReply && window.__sempaiReply(${Number(id)}, ${ok ? 'true' : 'false'}, ${JSON.stringify(data ?? null)}); true;`;
    web.current?.injectJavaScript(js);
  }, []);

  /** Show an approval sheet and wait for the user's answer. */
  const approve = (req) => new Promise((resolve) => setAsk({ ...req, resolve }));

  const onMessage = useCallback(async (e) => {
    let msg;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (!msg || msg.__sempai !== 1 || typeof msg.id !== 'number') return;
    const { id, method, params = {} } = msg;
    // Identity comes from the browser, never from the page.
    const site = originOf(e.nativeEvent.url || current);
    if (!site.startsWith('https://')) return reply(id, false, 'Wallet is only available on secure (https) sites.');
    if (!isWalletConnected || !address) return reply(id, false, 'No wallet in Sempai HQ yet. Create or import one first.');
    const isConnected = isTrusted(site) || (await loadSites()).includes(site);

    try {
      if (method === 'connect') {
        if (isConnected) return reply(id, true, { address });
        if (params.silent) return reply(id, false, 'Not connected');
        const ok = await approve({ kind: 'connect', origin: site });
        if (!ok) return reply(id, false, 'User rejected the request.');
        const list = Array.from(new Set([...(await loadSites()), site]));
        await saveSites(list);
        setSites(list);
        return reply(id, true, { address });
      }
      if (method === 'disconnect') {
        const list = (await loadSites()).filter((s) => s !== site);
        await saveSites(list);
        setSites(list);
        return reply(id, true, null);
      }
      if (!isConnected) return reply(id, false, 'Connect this site to Sempai HQ first.');

      if (method === 'signTransaction' || method === 'signAndSendTransaction') {
        const tx = VersionedTransaction.deserialize(Buffer.from(String(params.tx || ''), 'base64'));
        const programs = Array.from(new Set(tx.message.compiledInstructions.map((ix) => tx.message.staticAccountKeys[ix.programIdIndex]?.toBase58()).filter(Boolean)));
        setAsk({ kind: method, origin: site, programs, simulating: true });
        const sim = await simulate(tx, address);
        const ok = await approve({ kind: method, origin: site, programs, sim });
        if (!ok) return reply(id, false, 'User rejected the request.');
        setBusy(true);
        if (method === 'signTransaction') {
          const signed = await signTransactionOnly(tx); // password / biometrics
          return reply(id, true, { tx: signed });
        }
        const signature = await signAndSendTransaction(tx);
        return reply(id, true, { signature });
      }

      if (method === 'signMessage') {
        const bytes = Buffer.from(String(params.msg || ''), 'base64');
        let text = bytes.toString('utf8');
        if (/[\u0000-\u0008\u000E-\u001F]/.test(text)) text = `0x${bytes.toString('hex').slice(0, 200)}${bytes.length > 100 ? '…' : ''}`;
        const ok = await approve({ kind: 'signMessage', origin: site, text });
        if (!ok) return reply(id, false, 'User rejected the request.');
        setBusy(true);
        const signature = await signMessageOnly(new Uint8Array(bytes));
        return reply(id, true, { signature });
      }

      return reply(id, false, `Unsupported request: ${method}`);
    } catch (err) {
      const m = err?.message === 'Password entry cancelled' ? 'User rejected the request.' : err?.message || 'Request failed';
      return reply(id, false, m);
    } finally {
      setBusy(false);
      setAsk(null);
    }
  }, [current, isWalletConnected, address, reply, signTransactionOnly, signAndSendTransaction, signMessageOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (ok) => {
    const a = ask;
    if (!a?.resolve) return;
    setAsk({ ...a, resolve: null, answered: true });
    a.resolve(ok);
  };

  const disconnectSite = async (site) => {
    const list = (await loadSites()).filter((s) => s !== site);
    await saveSites(list);
    setSites(list);
    toast.success(`Disconnected ${hostOf(site)}`);
    if (site === origin) web.current?.reload();
  };

  const onShouldStart = useCallback((req) => {
    const u = req.url || '';
    if (/^(https?|about|data|blob):/i.test(u)) return true;
    if (/^javascript:/i.test(u)) return false;
    // mailto:, tel:, intent:, app links → hand to the phone
    Linking.openURL(u).catch(() => toast.info('No app can open that link'));
    return false;
  }, []);

  // ---------------------------------------------------------------- web build: no embedded browsing
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StartPage colors={colors} isDark={isDark} onGo={(u) => window.open(toUrl(u), '_blank', 'noopener')} note="On the web, sites open in a new tab. The full in-app browser with your wallet is in the Sempai HQ phone app." insetsTop={insets.top} />
      </View>
    );
  }

  const shown = editing ? typed : isHome ? '' : current;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* address bar */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 10, paddingBottom: 6 }}>
        <GelGlass radius={28} glow={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6 }}>
            <GelOrb icon="times" size={36} onPress={() => navigation.goBack()} label="Close browser" breathe={false} iconSize={13} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 19, paddingHorizontal: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : `rgba(${colors.accentRgb},0.15)` }}>
              {!editing && !isHome ? (
                <Text style={{ fontSize: 11, marginRight: 6, color: secure ? colors.success : colors.warning }}>{secure ? '🔒' : '⚠️'}</Text>
              ) : null}
              <TextInput
                value={editing ? typed : hostOf(shown) || ''}
                onChangeText={setTyped}
                onFocus={() => { setEditing(true); setTyped(isHome ? '' : current); }}
                onBlur={() => setEditing(false)}
                onSubmitEditing={() => go(typed)}
                placeholder="Search or type an address"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                selectTextOnFocus
                style={{ flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600', paddingVertical: 0 }}
                accessibilityLabel="Address"
              />
              {connected && !isHome ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginLeft: 6 }} accessibilityLabel="Wallet connected to this site" /> : null}
            </View>
            <GelOrb icon={loading ? 'times' : 'redo'} size={36} onPress={() => (loading ? web.current?.stopLoading() : isHome ? null : web.current?.reload())} label={loading ? 'Stop' : 'Reload'} breathe={false} iconSize={12} />
          </View>
          {loading && progress < 1 ? (
            <View style={{ position: 'absolute', left: 18, right: 18, bottom: 2, height: 2, borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(8, progress * 100)}%`, height: 2, backgroundColor: colors.accent }} />
            </View>
          ) : null}
        </GelGlass>
      </View>

      {/* page */}
      <View style={{ flex: 1 }}>
        {isHome ? (
          <StartPage colors={colors} isDark={isDark} onGo={go} />
        ) : (
          <WebView
            ref={web}
            source={{ uri: url }}
            injectedJavaScriptBeforeContentLoaded={WALLET_BRIDGE}
            injectedJavaScriptForMainFrameOnly
            injectedJavaScriptBeforeContentLoadedForMainFrameOnly
            onMessage={onMessage}
            onShouldStartLoadWithRequest={onShouldStart}
            onNavigationStateChange={(s) => {
              setCurrent(s.url);
              setTitle(s.title || '');
              setCanBack(s.canGoBack);
              setCanFwd(s.canGoForward);
            }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            allowsInlineMediaPlayback
            pullToRefreshEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            originWhitelist={['https://*', 'http://*']}
            style={{ flex: 1, backgroundColor: colors.bg }}
          />
        )}
      </View>

      {/* toolbar */}
      <View style={{ paddingHorizontal: 14, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 6 }}>
        <GelGlass radius={30} glow={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 6 }}>
            <GelOrb icon="chevron-left" size={40} onPress={() => (canBack ? web.current?.goBack() : !isHome && go(''))} label="Back" breathe={false} iconSize={14} />
            <GelOrb icon="chevron-right" size={40} onPress={() => canFwd && web.current?.goForward()} label="Forward" breathe={false} iconSize={14} />
            <GelOrb icon="home" size={46} lit onPress={() => go('')} label="Start page" breathe={false} iconSize={16} />
            <GelOrb icon="wallet" size={40} onPress={() => navigation.navigate('Wallet')} label="Wallet" breathe={false} iconSize={14} />
            <GelOrb icon="ellipsis-h" size={40} onPress={() => setMenu(true)} label="More" breathe={false} iconSize={14} />
          </View>
        </GelGlass>
      </View>

      {/* menu */}
      <GelModal visible={menu} onClose={() => setMenu(false)} variant="sheet" title={isHome ? 'Browser' : hostOf(current)} subtitle={isHome ? 'Sempai HQ browser' : title}>
        <View style={{ marginTop: 6 }}>
          {!isHome ? <GelOption icon="link" title="Copy link" onPress={async () => { try { await Clipboard.setStringAsync(current); toast.success('Link copied'); } catch {} setMenu(false); }} /> : null}
          {!isHome ? <GelOption icon="share-alt" title="Share" onPress={() => { setMenu(false); Share.share({ message: current, url: current }).catch(() => {}); }} /> : null}
          {!isHome ? <GelOption icon="external-link-alt" title="Open in phone browser" onPress={() => { setMenu(false); Linking.openURL(current).catch(() => {}); }} /> : null}
          {!isHome && connected && !isTrusted(origin) ? <GelOption icon="unlink" tone="#E5484D" title="Disconnect this site" description="It will need your approval again" onPress={() => { setMenu(false); disconnectSite(origin); }} /> : null}
          {sites.length ? (
            <>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 14, marginBottom: 4, marginLeft: 4 }}>CONNECTED SITES</Text>
              {sites.map((s) => (
                <GelOption key={s} icon="globe" title={hostOf(s)} description="Tap to disconnect" onPress={() => disconnectSite(s)} />
              ))}
            </>
          ) : null}
        </View>
      </GelModal>

      {/* approvals */}
      <GelModal
        visible={!!ask}
        onClose={() => answer(false)}
        dismissable={!busy}
        variant="sheet"
        icon={ask?.kind === 'connect' ? 'plug' : ask?.kind === 'signMessage' ? 'signature' : 'file-signature'}
        title={ask?.kind === 'connect' ? 'Connect your wallet?' : ask?.kind === 'signMessage' ? 'Sign a message?' : ask?.kind === 'signAndSendTransaction' ? 'Approve transaction?' : 'Sign transaction?'}
        subtitle={ask ? hostOf(ask.origin) : ''}
        actions={ask?.answered || busy ? [] : [
          { label: 'Reject', variant: 'secondary', onPress: () => answer(false) },
          { label: ask?.kind === 'connect' ? 'Connect' : 'Approve', icon: 'check', disabled: !!ask?.simulating || !ask?.resolve, onPress: () => answer(true) },
        ]}
      >
        {ask ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <Image source={{ uri: favicon(ask.origin) }} style={{ width: 28, height: 28, borderRadius: 8 }} />
              <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: '800' }} numberOfLines={1}>{ask.origin.replace('https://', '')}</Text>
              {isTrusted(ask.origin) ? <Text style={{ color: colors.success, fontWeight: '800', fontSize: 12 }}>Sempai HQ</Text> : null}
            </View>
            {ask.kind === 'connect' ? (
              <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 12 }}>
                This site will see your wallet address and can ask you to approve transactions. It can never move funds without your approval.
              </Text>
            ) : null}
            {ask.kind === 'signMessage' ? (
              <GelInset style={{ marginTop: 12 }}>
                <ScrollView style={{ maxHeight: 180 }}><Text selectable style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 19 }}>{ask.text}</Text></ScrollView>
              </GelInset>
            ) : null}
            {ask.kind === 'signTransaction' || ask.kind === 'signAndSendTransaction' ? (
              <GelInset style={{ marginTop: 12 }}>
                {ask.simulating ? (
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 6 }}><ActivityIndicator size="small" color={colors.accent} /><Text style={{ color: colors.textMuted }}>Checking what this does…</Text></View>
                ) : (
                  <>
                    <GelRow label="Your SOL" value={ask.sim?.error ? 'Would fail' : ask.sim?.solChange != null ? `${ask.sim.solChange >= 0 ? '+' : ''}${ask.sim.solChange.toFixed(6)} SOL` : 'Unknown'} strong />
                    <GelRow label="Programs" value={`${ask.programs?.length || 0}`} />
                    {ask.kind === 'signAndSendTransaction' ? <GelRow label="Sent by" value="Sempai HQ, after you approve" /> : null}
                  </>
                )}
              </GelInset>
            ) : null}
            {ask.kind !== 'connect' && !isTrusted(ask.origin) ? (
              <Text style={{ color: colors.warning, fontSize: 12.5, lineHeight: 18, marginTop: 10 }}>Only approve if you trust this site and expected this request.</Text>
            ) : null}
            {busy ? <View style={{ alignItems: 'center', paddingVertical: 14 }}><ActivityIndicator color={colors.accent} /></View> : null}
          </View>
        ) : null}
      </GelModal>
    </View>
  );
}

/** The start page: search + shortcuts. */
function StartPage({ colors, isDark, onGo, note, insetsTop = 0 }) {
  const [q, setQ] = useState('');
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 18 + insetsTop, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginTop: 18, marginBottom: 22 }}>
        <View pointerEvents="none"><GelOrb icon="globe" size={64} lit breathe={false} /></View>
        <Text style={{ fontFamily: 'Yoruka', fontSize: 28, color: colors.textPrimary, marginTop: 12 }}>Sempai Browser</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4, textAlign: 'center' }}>Browse anything. Your wallet comes with you.</Text>
      </View>
      <GelGlass radius={26} glow={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 52 }}>
          <Text style={{ color: colors.textMuted }}>🔍</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => q.trim() && onGo(q)}
            placeholder="Search the web or type an address"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            style={{ flex: 1, color: colors.textPrimary, fontSize: 15 }}
          />
        </View>
      </GelGlass>
      {note ? <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 12, textAlign: 'center' }}>{note}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 22, marginHorizontal: -6 }}>
        {SHORTCUTS.map((s) => (
          <Pressable key={s.name} onPress={() => onGo(s.url)} style={{ width: '25%', alignItems: 'center', paddingHorizontal: 6, marginBottom: 18 }} accessibilityRole="button" accessibilityLabel={s.name}>
            <View style={{ width: 58, height: 58, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : `rgba(${colors.accentRgb},0.12)` }}>
              <Image source={{ uri: s.icon || favicon(s.url) }} style={{ width: s.icon ? 58 : 30, height: s.icon ? 58 : 30, borderRadius: s.icon ? 20 : 6 }} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 7 }} numberOfLines={1}>{s.name}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
