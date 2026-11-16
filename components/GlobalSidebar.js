import React, { useState, useContext, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Image,
  Animated,
  BackHandler,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useGoogleAuth } from './GoogleAuthProvider';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { supabase } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { getGlobalSidebarStyles, SIDEBAR_WIDTH } from '../styles/GlobalSidebarStyles';
import { goToTopLevel, getActiveRouteName } from '../utils/navigation';
import { LOGO } from '../theme/tokens';
import { toast } from './Toast';
import GelOrb from './nav/GelOrb';
import { haptics } from '../utils/haptics';

// Old architecture: Android needs LayoutAnimation switched on explicitly.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EXPAND = LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

/** Accordion groups — the owner's original grouping, names and order. */
const GROUPS = [
  {
    title: 'Main',
    icon: 'home',
    items: [
      { name: 'Home', screen: 'Home', icon: 'home' },
      { name: 'Crazy Corner', screen: 'Feed', icon: 'newspaper' },
      { name: 'Profile', screen: 'Profile', icon: 'user' },
    ],
  },
  {
    title: 'Content',
    icon: 'book',
    items: [
      { name: 'Novel Dashboard', screen: 'NovelDashboard', icon: 'book-open' },
      { name: 'Manga Dashboard', screen: 'MangaDashboard', icon: 'images' },
      { name: 'Hoard', screen: 'NovelsPage', icon: 'book' },
      { name: 'Manga Hoard', screen: 'MangaPage', icon: 'images' },
    ],
  },
  {
    title: 'Nexus',
    icon: 'wallet',
    items: [
      { name: 'Swap', screen: 'Swap', icon: 'exchange-alt' },
      { name: 'Ramp', screen: 'Ramp', icon: 'credit-card' },
      { name: 'Import Wallet', screen: 'WalletImport', icon: 'wallet' },
      { name: 'Mint', screen: 'Mint', icon: 'coins' },
    ],
  },
  {
    title: 'Community',
    icon: 'users',
    items: [
      { name: 'Chat', screen: 'Chat', icon: 'comments' },
      { name: 'Badges', screen: 'Badges', icon: 'award' },
      { name: 'Leaderboard', screen: 'Leaderboard', icon: 'trophy' },
      { name: 'Kaiji', screen: 'Kaiji', icon: 'language' },
      { name: 'Inbox', screen: 'Inbox', icon: 'envelope' },
    ],
  },
  {
    title: 'Admin',
    icon: 'cog',
    superuserOnly: true,
    items: [
      { name: 'Admin', screen: 'Admin', icon: 'user-shield' },
      { name: 'Announcements', screen: 'Announcements', icon: 'bullhorn' },
    ],
  },
  {
    title: 'Info',
    icon: 'info-circle',
    items: [
      { name: 'Support', screen: 'Support', icon: 'life-ring' },
      { name: 'Terms', screen: 'Terms', icon: 'file-contract' },
      { name: 'Privacy Policy', screen: 'PrivacyPolicy', icon: 'shield-alt' },
    ],
  },
  {
    title: 'Bazaar',
    icon: 'store',
    items: [
      { name: 'Bazaar', screen: 'Bazaar', icon: 'book' },
      { name: 'Upload Book', screen: 'UploadBook', icon: 'cloud-upload-alt' },
      { name: 'My Bazaar', screen: 'BazaarDashboard', icon: 'chart-line' },
      { name: 'Reader', screen: 'Reader', icon: 'book-reader' },
    ],
  },
  {
    title: 'Other',
    icon: 'ellipsis-h',
    items: [
      { name: 'Apply', screen: 'Apply', icon: 'user-plus' },
      { name: 'Download', screen: 'Download', icon: 'download' },
      { name: 'Add Gif', screen: 'AddGif', icon: 'image' },
    ],
  },
];

const groupOf = (route) => GROUPS.find((g) => g.items.some((i) => i.screen === route))?.title;

/** Small glossy chip (wallet actions). */
const GelChip = ({ icon, label, onPress, lit, disabled, styles, colors, isDark }) => (
  <Pressable
    onPress={(e) => { haptics.tap(); onPress?.(e); }}
    disabled={disabled}
    style={({ pressed }) => [styles.chip, lit && { borderColor: 'rgba(255,255,255,0.35)' }, pressed && { transform: [{ scale: 0.96 }] }]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <LinearGradient
      colors={lit ? [colors.accentHi, colors.accent, colors.accentDeep] : isDark ? ['rgba(255,255,255,0.10)', colors.bgCardAlt] : ['#FFFFFF', colors.bgCardAlt]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.chipFill}
    >
      <FontAwesome5 name={icon} size={12} color={lit ? '#FFFFFF' : colors.accent} solid />
      <Text style={[styles.chipText, lit && { color: '#FFFFFF' }]}>{label}</Text>
    </LinearGradient>
    <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} style={styles.chipGloss} />
  </Pressable>
);

const Chevron = ({ open, color }) => {
  const rot = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(rot, { toValue: open ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, rot]);
  return (
    <Animated.View style={{ transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
      <FontAwesome5 name="chevron-down" size={12} color={color} />
    </Animated.View>
  );
};

const Group = React.memo(({ group, open, onToggle, currentRoute, onNavigate, styles, colors }) => {
  const holdsActive = group.items.some((i) => i.screen === currentRoute);
  return (
    <View style={styles.group}>
      <Pressable
        onPress={() => onToggle(group.title)}
        style={({ pressed }) => [styles.groupHeader, (open || pressed) && styles.groupHeaderOpen]}
        accessibilityRole="button"
        accessibilityLabel={`${group.title}, ${group.items.length} items`}
        accessibilityState={{ expanded: open }}
      >
        <View pointerEvents="none">
          <GelOrb icon={group.icon} size={36} lit={open || holdsActive} breathe={false} />
        </View>
        <Text style={styles.groupTitle}>{group.title}</Text>
        <View style={styles.countChip}>
          <Text style={styles.countText}>{group.items.length}</Text>
        </View>
        <Chevron open={open} color={open ? colors.accent : colors.textMuted} />
      </Pressable>

      {open ? (
        <View style={styles.items}>
          <LinearGradient
            colors={[colors.accent, colors.gold, `rgba(${colors.goldRgb},0)`]}
            style={styles.rail}
          />
          {group.items.map((item) => {
            const active = item.screen === currentRoute;
            return (
              <Pressable
                key={item.screen}
                onPress={() => onNavigate(item.screen)}
                style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && !active && styles.itemPressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={styles.itemIcon}>
                  <FontAwesome5 name={item.icon} size={14} color={active ? colors.accent : colors.textMuted} solid />
                </View>
                <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>{item.name}</Text>
                {active ? <View style={styles.activeDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});
Group.displayName = 'Group';

const GlobalSidebar = ({ isVisible, onClose }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useGoogleAuth();
  const walletContext = useContext(EmbeddedWalletContext);
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getGlobalSidebarStyles(isDark), [isDark]);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [currentRoute, setCurrentRoute] = useState();
  const [openGroups, setOpenGroups] = useState(() => new Set(['Main']));

  const wallet = walletContext?.wallet;
  const address = wallet?.publicKey?.toString();
  const disconnectWallet = walletContext?.disconnectWallet;
  const setShowModal = walletContext?.setShowModal;
  const walletBusy = walletContext?.isLoading;

  useEffect(() => {
    let alive = true;
    if (!address) { setIsSuperuser(false); return undefined; }
    supabase
      .from('users')
      .select('"isSuperuser"')
      .eq('wallet_address', address)
      .maybeSingle()
      .then(({ data }) => { if (alive) setIsSuperuser(!!data?.isSuperuser); })
      .catch(() => { if (alive) setIsSuperuser(false); });
    return () => { alive = false; };
  }, [address]);

  useEffect(() => {
    setCurrentRoute(getActiveRouteName(navigation.getState?.()));
    return navigation.addListener('state', (e) => setCurrentRoute(getActiveRouteName(e?.data?.state)));
  }, [navigation]);

  // Opening the menu reveals the group you're currently in.
  useEffect(() => {
    if (!isVisible) return;
    const g = groupOf(currentRoute);
    if (g) setOpenGroups((prev) => (prev.has(g) ? prev : new Set([...prev, g])));
  }, [isVisible, currentRoute]);

  // Slide + scrim on the native thread; contents cascade in.
  const openAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(openAnim, {
      toValue: isVisible ? 1 : 0,
      useNativeDriver: true,
      speed: isVisible ? 16 : 24,
      bounciness: isVisible ? 5 : 0,
    }).start();
  }, [isVisible, openAnim]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [isVisible, onClose]);

  const groups = useMemo(() => GROUPS.filter((g) => !g.superuserOnly || isSuperuser), [isSuperuser]);

  const toggleGroup = useCallback((title) => {
    LayoutAnimation.configureNext(EXPAND);
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  const navigate = useCallback((screen) => {
    haptics.tap();
    onClose();
    goToTopLevel(navigation, screen);
  }, [navigation, onClose]);

  const connect = () => { setShowModal?.(true); onClose(); };
  const copyAddress = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    toast.success('Wallet address copied');
  };
  const disconnect = () => {
    Alert.alert('Disconnect wallet?', 'You can reconnect at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => disconnectWallet?.() },
    ]);
  };
  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to read and earn.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { onClose(); signOut?.(); } },
    ]);
  };

  const slide = openAnim.interpolate({ inputRange: [0, 1], outputRange: [SIDEBAR_WIDTH + 40, 0] });
  const cascade = (i) => ({
    opacity: openAnim.interpolate({ inputRange: [0, 0.5 + i * 0.1, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateX: openAnim.interpolate({ inputRange: [0, 1], outputRange: [30 + i * 12, 0] }) }],
  });
  const version = Constants.expoConfig?.version;

  return (
    <>
      <Animated.View style={[styles.overlay, { opacity: openAnim }]} pointerEvents={isVisible ? 'auto' : 'none'}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
      </Animated.View>

      {/* separate view carries the glow shadow (the panel itself clips) */}
      <Animated.View pointerEvents="none" style={[styles.shadowCaster, { opacity: openAnim, transform: [{ translateX: slide }] }]} />

      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: slide }] }]}
        pointerEvents={isVisible ? 'auto' : 'none'}
        accessibilityViewIsModal={isVisible}
        accessibilityElementsHidden={!isVisible}
        importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      >
        {/* panel surface */}
        <LinearGradient colors={[colors.bgElevated, colors.bg]} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[`rgba(${colors.accentRgb},${isDark ? 0.22 : 0.12})`, 'rgba(0,0,0,0)']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.6, y: 0.35 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[`rgba(${colors.accentRgb},${isDark ? 0.12 : 0.06})`, 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.edgeGlow}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', colors.accent, colors.gold, 'rgba(0,0,0,0)']}
          style={styles.edgeLight}
        />

        <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 14 }]}>
          {/* hero */}
          <Animated.View style={[styles.hero, cascade(0)]}>
            <View style={styles.heroTop}>
              <LinearGradient
                colors={[colors.accentHi, colors.gold, colors.accentDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoRing}
              >
                <View style={styles.logoInner}>
                  <Image source={LOGO} style={styles.logo} />
                </View>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Sempai HQ</Text>
                <Text style={styles.eyebrow}>READ · EARN · OWN</Text>
              </View>
              <GelOrb icon="times" size={36} onPress={onClose} label="Close menu" breathe={false} />
            </View>

            <View style={styles.walletCard}>
              <LinearGradient
                colors={[`rgba(${colors.accentRgb},${isDark ? 0.2 : 0.1})`, `rgba(${colors.goldRgb},${isDark ? 0.05 : 0.04})`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.walletRow}>
                <View
                  style={[
                    styles.walletDot,
                    { backgroundColor: address ? colors.success : colors.textFaint, shadowColor: address ? colors.success : 'transparent' },
                  ]}
                />
                <Text style={styles.walletLabel}>{address ? 'WALLET CONNECTED' : 'NO WALLET CONNECTED'}</Text>
              </View>
              {address ? (
                <>
                  <Text style={styles.walletAddress}>{`${address.slice(0, 6)}…${address.slice(-4)}`}</Text>
                  <View style={styles.walletActions}>
                    <GelChip icon="copy" label="Copy" onPress={copyAddress} styles={styles} colors={colors} isDark={isDark} />
                    <GelChip icon="unlink" label="Disconnect" onPress={disconnect} disabled={walletBusy} styles={styles} colors={colors} isDark={isDark} />
                  </View>
                </>
              ) : (
                <View style={styles.walletActions}>
                  <GelChip lit icon="plug" label="Connect wallet" onPress={connect} disabled={walletBusy} styles={styles} colors={colors} isDark={isDark} />
                </View>
              )}
            </View>
          </Animated.View>

          {/* groups */}
          <Animated.View style={[{ flex: 1 }, cascade(1)]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              {groups.map((group) => (
                <Group
                  key={group.title}
                  group={group}
                  open={openGroups.has(group.title)}
                  onToggle={toggleGroup}
                  currentRoute={currentRoute}
                  onNavigate={navigate}
                  styles={styles}
                  colors={colors}
                />
              ))}
            </ScrollView>
          </Animated.View>

          {/* footer */}
          <Animated.View style={[styles.footer, cascade(2)]}>
            {session ? (
              <Pressable onPress={confirmSignOut} style={styles.signOut} accessibilityRole="button" hitSlop={6}>
                <FontAwesome5 name="sign-out-alt" size={15} color={colors.danger} />
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            ) : (
              <View />
            )}
            {version ? <Text style={styles.version}>v{version}</Text> : null}
          </Animated.View>
        </View>
      </Animated.View>
    </>
  );
};

export default React.memo(GlobalSidebar);
