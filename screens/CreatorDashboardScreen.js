import React, { useContext } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import GelOrb from '../components/nav/GelOrb';
import { GelGlass, GelOption } from '../components/gel/GelKit';
import { GelGate, GelPageHeader } from '../components/gel/GelGate';

/*
 * Creator hub (/creator-dashboard). The old one-page editor here saved to
 * columns that don't exist and could never work; the real tools are the
 * Writer's Studio, the Artist Studio and the Bazaar dashboard — this page
 * points to them.
 */
export default function CreatorDashboardScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const wallet = useContext(EmbeddedWalletContext);
  if (!wallet?.wallet?.publicKey) {
    return <GelGate icon="pen-fancy" headerTitle="Creator hub" subtitle="Connect a wallet to manage your work and earnings." />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <GelPageHeader title="Creator hub" subtitle="Everything you publish, in one place" />
        <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 16 }}>
          <View pointerEvents="none"><GelOrb icon="pen-fancy" size={60} lit breathe={false} /></View>
          <Text style={{ fontFamily: 'Yoruka', fontSize: 28, color: colors.textPrimary, marginTop: 12 }}>What are you making?</Text>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <GelGlass radius={28} glow={false} padding={12}>
            <GelOption
              icon="feather-alt"
              title="Writer's Studio"
              description="Write and publish novels and chapters. Drafts save on your phone, even offline."
              onPress={() => navigation.navigate('NovelDashboard')}
            />
            <GelOption
              icon="palette"
              tone="#8E44D6"
              title="Artist Studio"
              description="Upload manga and webcomic chapters, covers and pages."
              onPress={() => navigation.navigate('MangaDashboard')}
            />
            <GelOption
              icon="store"
              tone="#22A06B"
              title="Bazaar dashboard"
              description="Your books for sale, readers, earnings and refunds."
              onPress={() => navigation.navigate('BazaarDashboard')}
            />
            <GelOption
              icon="bullhorn"
              tone={colors.gold}
              title="Announcements"
              description="Tell your readers what's coming."
              onPress={() => navigation.navigate('Announcements')}
            />
          </GelGlass>
        </View>
      </ScrollView>
    </View>
  );
}
