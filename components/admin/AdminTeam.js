// Admin overview extras: who the admins are, active HQ Passes, and the monthly lending rewards.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, Pressable, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { GelGlass } from '../gel/GelKit';
import { readerAction } from '../../services/readerActions';
import { toast } from '../Toast';

const short = (w) => (w ? `${w.slice(0, 4)}…${w.slice(-4)}` : '—');
const STATUS = { paid: '#22c55e', pending: '#f59e0b', failed: '#ef4444', skipped: '#8a8aa0' };

export default function AdminTeam() {
  const { colors, isDark } = useTheme();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    const res = await readerAction('admin_list_admins');
    if (res?.ok === false) setErr(res.error || 'Could not load the team');
    else { setData(res); setErr(null); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const line = isDark ? 'rgba(255,255,255,0.07)' : `rgba(${colors.accentRgb},0.10)`;
  const head = (icon, title, right) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 }}>
      <FontAwesome5 name={icon} size={14} color={colors.accent} />
      <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: '800', fontSize: 15 }}>{title}</Text>
      {right}
    </View>
  );

  if (err) return <Text style={{ color: colors.danger, marginTop: 16 }}>{err}</Text>;
  if (!data) return <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />;

  return (
    <View style={{ marginTop: 18, gap: 14 }}>
      <GelGlass radius={24} glow={false}>
        {head('user-shield', `Admins · ${data.count}`, (
          <Pressable onPress={load} hitSlop={8} accessibilityRole="button" accessibilityLabel="Refresh"><FontAwesome5 name="redo" size={12} color={colors.textMuted} /></Pressable>
        ))}
        {data.admins.map((a, i) => (
          <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: line }}>
            {a.image ? <Image source={{ uri: a.image }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : (
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `rgba(${colors.accentRgb},0.15)`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.accent, fontWeight: '900' }}>{(a.name || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>{a.name || 'No name'}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{a.email || 'No email'} · {short(a.wallet_address)}</Text>
            </View>
            {a.wallet_address ? (
              <Pressable onPress={async () => { try { await Clipboard.setStringAsync(a.wallet_address); toast.success('Wallet copied'); } catch {} }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Copy wallet">
                <FontAwesome5 name="copy" size={13} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <View style={{ height: 6 }} />
      </GelGlass>

      <GelGlass radius={24} glow={false}>
        {head('ticket-alt', 'HQ Access Passes', <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 18 }}>{data.activePasses}</Text>)}
        <Text style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 14, paddingBottom: 14 }}>Active right now ($1 / 30 days).</Text>
      </GelGlass>

      <GelGlass radius={24} glow={false}>
        {head('award', 'Lending rewards (top 3 books, 30%)')}
        {data.lendingRewards.length ? data.lendingRewards.map((r, i) => (
          <Pressable
            key={`${r.period}-${r.rank}`}
            disabled={!r.tx_signature}
            onPress={() => r.tx_signature && Linking.openURL(`https://solscan.io/tx/${r.tx_signature}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: line }}
          >
            <Text style={{ color: colors.textMuted, fontWeight: '800', width: 70, fontSize: 12 }}>{r.period} #{r.rank}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>{r.bazaar_books?.title || 'Book'}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{r.borrows} borrows · {Number(r.amount_smp).toLocaleString()} SMP{r.error ? ` · ${r.error}` : ''}</Text>
            </View>
            <Text style={{ color: STATUS[r.status] || colors.textMuted, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>{r.status}</Text>
          </Pressable>
        )) : <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: 14, paddingBottom: 14 }}>The first payout runs on the 1st of next month.</Text>}
        <View style={{ height: 6 }} />
      </GelGlass>
    </View>
  );
}
