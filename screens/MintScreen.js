// Mint: create NFTs and tokens on Solana. Minting is switched off for now, so this page explains what's
// coming instead of showing a form that can't submit.
import React, { useContext } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { GelGlass, GelButton, GelOption } from '../components/gel/GelKit';
import { GelGate, GelPageHeader } from '../components/gel/GelGate';
import GelOrb from '../components/nav/GelOrb';

const KINDS = [
  {
    icon: 'image',
    title: 'Mint an NFT',
    lines: ['Turn a cover, a panel or fan art into a one-of-one collectible', 'Name, description and image — stored permanently', 'Sell it in the SempaiHQ Marketplace'],
  },
  {
    icon: 'coins',
    title: 'Create a token',
    lines: ['Launch a token for your series or community', 'Pick the name, symbol and supply', 'Use it for rewards, perks or access'],
  },
];

export default function MintScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const { isWalletConnected } = useContext(EmbeddedWalletContext);

  if (!isWalletConnected) {
    return <GelGate icon="gem" headerTitle="Mint" title="Connect your wallet" subtitle="Connect a wallet to mint collectibles." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GelPageHeader title="Mint" subtitle="NFTs and tokens on Solana" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 130 }}>
        <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 16 }}>
          <View pointerEvents="none"><GelOrb icon="gem" size={64} lit breathe={false} /></View>
          <Text style={{ fontFamily: 'Yoruka', fontSize: 28, color: colors.textPrimary, marginTop: 12 }}>Create digital assets</Text>
          <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : `rgba(${colors.accentRgb},0.10)` }}>
            <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 12, letterSpacing: 1 }}>COMING SOON</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 340 }}>
            Minting is switched off while we finish it. Here's what you'll be able to make.
          </Text>
        </View>

        {KINDS.map((k) => (
          <GelGlass key={k.title} radius={28} glow={false} padding={18} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View pointerEvents="none"><GelOrb icon={k.icon} size={46} lit breathe={false} /></View>
              <Text style={{ fontFamily: 'Yoruka', fontSize: 22, color: colors.textPrimary, flex: 1 }}>{k.title}</Text>
            </View>
            {k.lines.map((l) => (
              <View key={l} style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, marginTop: 7 }} />
                <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{l}</Text>
              </View>
            ))}
            <GelButton label="Coming soon" variant="secondary" disabled onPress={() => {}} style={{ marginTop: 16 }} />
          </GelGlass>
        ))}

        <GelOption icon="store" title="Browse the Marketplace" description="See collectibles listed for sale" onPress={() => navigation.navigate('Marketplace')} />
      </ScrollView>
    </View>
  );
}
