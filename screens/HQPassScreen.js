// HQ Access Pass: $1 for 30 days. Borrow Bazaar books (5 a week, 7-day loans) and enter Kaiji
// tournaments (Friday–Sunday). Pay in SOL, USDC or SMP at the live price.
import React, { useCallback, useContext, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { GelGlass, GelButton, GelChips, GelInset, GelRow } from '../components/gel/GelKit';
import { GelGate, GelPageHeader } from '../components/gel/GelGate';
import { gelAlert } from '../components/gel/GelAlert';
import { toast } from '../components/Toast';
import { getPassStatus, passQuotes, buyPass, HQ_PASS_USD, HQ_PASS_DAYS } from '../services/hqPass';

const PERKS = [
  { icon: 'book-reader', title: 'Borrow Bazaar books', desc: 'Up to 5 books a week — each borrow is a 7-day loan.' },
  { icon: 'chess-knight', title: 'Kaiji tournaments', desc: 'Enter the weekend knockout (Friday–Sunday) for SKR prizes.' },
  { icon: 'fire', title: 'Feeds the ecosystem', desc: 'Lending fees burn SMP and reward the most-borrowed authors every month.' },
];
const fmt = (n, cur) => (n == null ? '…' : cur === 'SOL' ? n.toFixed(4) : cur === 'USDC' ? n.toFixed(2) : Math.ceil(n).toLocaleString());
const dateOf = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function HQPassScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const { wallet, isWalletConnected, signAndSendTransaction } = useContext(EmbeddedWalletContext) || {};
  const address = wallet?.publicKey?.toString();
  const [status, setStatus] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [currency, setCurrency] = useState('USDC');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setStatus(await getPassStatus()); } catch (e) { setStatus({ error: e.message }); }
    passQuotes().then(setQuotes).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isWalletConnected || !address) {
    return <GelGate icon="ticket-alt" headerTitle="HQ Access Pass" subtitle="Connect your wallet to get the HQ Access Pass." />;
  }

  const active = !!status?.active;
  const amount = quotes[currency];

  const buy = () => {
    if (amount == null) return toast.error('Getting the live price — try again in a second.');
    gelAlert(
      active ? 'Add 30 days to your pass?' : 'Get the HQ Access Pass?',
      `Pay ${fmt(amount, currency)} ${currency} (about $${HQ_PASS_USD}). ${active ? `Your pass will run until ${dateOf(new Date(new Date(status.expiresAt).getTime() + HQ_PASS_DAYS * 86400000))}.` : `It's active for ${HQ_PASS_DAYS} days.`}`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Pay',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await buyPass({ wallet: address, currency, amount, signAndSendTransaction });
              toast.success(`HQ Pass active until ${dateOf(res.expiresAt)} 🎟️`);
              await load();
            } catch (e) {
              if (e?.message !== 'Password entry cancelled') toast.error(e.message || 'Could not get the pass');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GelPageHeader title="HQ Access Pass" subtitle={`$${HQ_PASS_USD} · ${HQ_PASS_DAYS} days`} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 130 }}>
        {/* the pass */}
        <View style={{ borderRadius: 30, overflow: 'hidden', shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 12 }}>
          <LinearGradient colors={active ? ['#ff9a55', '#f36316', '#7c2d12'] : isDark ? ['#2a2b38', '#15161f'] : ['#e7ecf7', '#cdd6ea']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22, minHeight: 190 }}>
            <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image source={require('../assets/icon.png')} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: active ? '#fff' : colors.textPrimary, fontWeight: '900', fontSize: 13, letterSpacing: 3 }}>SEMPAI HQ</Text>
                <Text style={{ color: active ? '#fff' : colors.textPrimary, fontFamily: 'Yoruka', fontSize: 26 }}>Access Pass</Text>
              </View>
              <Icon name="ticket-alt" size={26} color={active ? '#fff' : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }} />
            {status == null ? (
              <ActivityIndicator color={active ? '#fff' : colors.accent} style={{ alignSelf: 'flex-start', marginTop: 34 }} />
            ) : (
              <View style={{ marginTop: 30 }}>
                <Text style={{ color: active ? 'rgba(255,255,255,0.85)' : colors.textMuted, fontWeight: '800', fontSize: 12, letterSpacing: 1.5 }}>{active ? 'ACTIVE UNTIL' : 'NOT ACTIVE'}</Text>
                <Text style={{ color: active ? '#fff' : colors.textPrimary, fontWeight: '900', fontSize: 22, marginTop: 2 }}>
                  {active ? dateOf(status.expiresAt) : `$${HQ_PASS_USD} for ${HQ_PASS_DAYS} days`}
                </Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {active ? (
          <GelInset style={{ marginTop: 14 }}>
            <GelRow label="Borrows this week" value={`${status.borrowsThisWeek} of ${status.borrowLimit}`} strong />
            <GelRow label="Loan length" value="7 days per book" />
          </GelInset>
        ) : null}

        {/* what you get */}
        <GelGlass radius={28} glow={false} padding={6} style={{ marginTop: 16 }}>
          {PERKS.map((p, i) => (
            <View key={p.title} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : `rgba(${colors.accentRgb},0.10)` }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `rgba(${colors.accentRgb},0.12)` }}>
                <Icon name={p.icon} size={17} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15 }}>{p.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{p.desc}</Text>
              </View>
            </View>
          ))}
        </GelGlass>

        {/* pay */}
        <GelGlass radius={28} glow={false} padding={18} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13, marginLeft: 4 }}>Pay with</Text>
          <GelChips options={['USDC', 'SOL', 'SMP']} value={currency} onChange={setCurrency} style={{ marginTop: 8 }} />
          <GelInset style={{ marginTop: 14 }}>
            <GelRow label="Price" value={`$${HQ_PASS_USD.toFixed(2)}`} />
            <GelRow label="You pay" value={`${fmt(amount, currency)} ${currency}`} strong />
            <GelRow label="Lasts" value={active ? `+${HQ_PASS_DAYS} days on your current pass` : `${HQ_PASS_DAYS} days`} />
          </GelInset>
          <GelButton label={active ? 'Renew · add 30 days' : 'Get the HQ Pass'} icon="ticket-alt" loading={busy} disabled={amount == null} onPress={buy} style={{ marginTop: 16 }} />
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 10, textAlign: 'center' }}>
            Live price · paid to the Sempai HQ platform wallet and checked on-chain.
          </Text>
        </GelGlass>

        <GelButton label="Browse the Bazaar" icon="store" variant="secondary" onPress={() => navigation.navigate('Bazaar')} style={{ marginTop: 14 }} />
      </ScrollView>
    </View>
  );
}
