import React, { useContext } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { EmbeddedWalletContext } from '../ConnectButtonEnhanced';
import GelOrb from '../nav/GelOrb';
import { GelGlass, GelButton } from './GelKit';

/*
 * GelGate — the one "you need a wallet / an account for this" screen, used
 * by every page that requires one. Big lit orb, title, one line, and a glossy
 * button that opens sign-in / the wallet sheet.
 *
 * GelPageHeader — the glass pill header with a back orb (sub-pages).
 */
export function GelGate({ icon = 'wallet', title, subtitle, action, onAction, back = true, headerTitle }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const wallet = useContext(EmbeddedWalletContext);
  const { user } = useAuth() || {};
  const guest = !user || user.isGuest;
  const label = action || (guest ? 'Sign in' : 'Connect wallet');
  const open = onAction || (() => wallet?.setShowModal?.(true));
  return (
    <View style={[s.page, { backgroundColor: colors.bg }]}>
      {back && navigation.canGoBack() ? <GelPageHeader title={headerTitle || ''} /> : null}
      <View style={s.center}>
        <View pointerEvents="none">
          <GelOrb icon={icon} size={76} lit breathe />
        </View>
        <Text style={[s.title, { color: colors.textPrimary }]}>{guest ? (title && /sign in/i.test(title) ? title : 'Sign in to continue') : (title || 'Connect your wallet')}</Text>
        {subtitle ? <Text style={[s.sub, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        <GelButton label={label} icon={guest ? 'user' : 'wallet'} onPress={open} style={{ marginTop: 22, alignSelf: 'stretch' }} />
      </View>
    </View>
  );
}

export function GelPageHeader({ title, subtitle, right, onBack }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const back = onBack || (() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')));
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
      <GelGlass radius={30} glow={false}>
        <View style={s.headRow}>
          <GelOrb icon="arrow-left" size={36} onPress={back} label="Back" breathe={false} />
          <View style={{ flex: 1, minWidth: 0 }}>
            {title ? <Text style={[s.headTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text> : null}
            {subtitle ? <Text style={[s.headSub, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      </GelGlass>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 110, maxWidth: 460, width: '100%', alignSelf: 'center' },
  title: { fontFamily: 'Yoruka', fontSize: 26, textAlign: 'center', marginTop: 20 },
  sub: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 6 },
  headTitle: { fontFamily: 'Yoruka', fontSize: 20 },
  headSub: { fontSize: 12, marginTop: 1 },
});
