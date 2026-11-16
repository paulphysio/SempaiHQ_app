import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, Image, Animated, Easing, Platform, StyleSheet, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useGoogleAuth } from './GoogleAuthProvider';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { getGlobalNavbarStyles } from '../styles/GlobalNavbarStyles';
import { goToTopLevel } from '../utils/navigation';
import { LOGO } from '../theme/tokens';
import { toast } from './Toast';
import GelOrb from './nav/GelOrb';
import { haptics } from '../utils/haptics';

/** Glossy gel pill — same material as the orbs, stretched. */
const GelPill = ({ lit, tint, onPress, disabled, label, children, styles, colors, isDark }) => {
  const press = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 36, bounciness: 10 }).start();
  const fill = lit
    ? [colors.accentHi, colors.accent, colors.accentDeep]
    : isDark
    ? ['rgba(255,255,255,0.10)', colors.bgCardAlt, colors.bgCard]
    : ['#FFFFFF', colors.bgCardAlt, colors.bgElevated];
  return (
    <Pressable
      onPress={(e) => { haptics.tap(); onPress?.(e); }}
      onPressIn={() => to(0.94)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.pill, { shadowColor: lit ? colors.accent : tint || '#000', transform: [{ scale: press }] }]}>
        <LinearGradient colors={fill} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.pillFill}>
          {children}
        </LinearGradient>
        <LinearGradient
          pointerEvents="none"
          colors={[isDark || lit ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
          style={styles.pillGloss}
        />
        <View
          pointerEvents="none"
          style={[styles.pillRim, { borderColor: lit ? 'rgba(255,255,255,0.4)' : tint ? `${tint}66` : colors.borderStrong }]}
        />
      </Animated.View>
    </Pressable>
  );
};

const GlobalNavbar = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { session, signIn } = useGoogleAuth();
  const walletContext = React.useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const address = wallet?.publicKey?.toString();
  const disconnectWallet = walletContext?.disconnectWallet;
  const setShowModal = walletContext?.setShowModal;
  const walletBusy = walletContext?.isLoading;
  const { isDark, toggleTheme, colors } = useTheme();
  const styles = useMemo(() => getGlobalNavbarStyles(colors, isDark), [colors, isDark]);
  const [menuOpen, setMenuOpen] = useState(false);

  // One entrance, then the bar stays still: the life is in the glow, not motion.
  const enter = useRef(new Animated.Value(0)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);
  useEffect(() => {
    Animated.spring(menuAnim, { toValue: menuOpen ? 1 : 0, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
  }, [menuOpen, menuAnim]);

  const goHome = useCallback(() => goToTopLevel(navigation, 'Home'), [navigation]);
  const onWallet = () => {
    if (!wallet) {
      setShowModal?.(true);
      return;
    }
    haptics.open();
    setMenuOpen((v) => !v);
  };
  const copy = async () => {
    setMenuOpen(false);
    if (!address) return;
    await Clipboard.setStringAsync(address);
    toast.success('Wallet address copied');
  };
  const openWallet = () => {
    setMenuOpen(false);
    goToTopLevel(navigation, 'Wallet');
  };
  const disconnect = () => {
    setMenuOpen(false);
    disconnectWallet?.();
  };

  const short = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : '';
  const sealColors = ['rgba(0,0,0,0)', colors.accent, colors.gold, 'rgba(0,0,0,0)'];
  const topInset = Platform.OS === 'ios' ? insets.top : 0;

  return (
    <Animated.View
      style={[
        styles.header,
        {
          paddingTop: topInset,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
        },
      ]}
    >
      {/* surface: depth gradient + ember glow behind the brand + gold wash right */}
      <LinearGradient colors={[colors.bgElevated, colors.bg]} style={styles.surface} />
      <LinearGradient
        colors={[`rgba(${colors.accentRgb},${isDark ? 0.22 : 0.12})`, 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.6, y: 0.5 }}
        style={styles.surface}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', `rgba(${colors.goldRgb},${isDark ? 0.08 : 0.06})`]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.surface}
      />
      {/* seal line: the bar's lit bottom edge */}
      <LinearGradient
        colors={[`rgba(${colors.accentRgb},0)`, `rgba(${colors.accentRgb},${isDark ? 0.16 : 0.08})`]}
        style={styles.sealGlow}
        pointerEvents="none"
      />
      <LinearGradient colors={sealColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sealLine} pointerEvents="none" />

      <View style={styles.row}>
        <Pressable
          onPress={goHome}
          style={styles.brand}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sempai HQ, go to home"
        >
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
          <View>
            <Text style={styles.wordmark} numberOfLines={1}>Sempai HQ</Text>
            <Text style={styles.eyebrow}>READ · EARN · OWN</Text>
          </View>
        </Pressable>

        <View style={styles.actions}>
          <GelOrb
            icon={isDark ? 'sun' : 'moon'}
            size={36}
            tone={isDark ? colors.gold : undefined}
            onPress={toggleTheme}
            label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            breathe={false}
          />

          {!session ? (
            <GelPill lit onPress={signIn} label="Sign in with Google" styles={styles} colors={colors} isDark={isDark}>
              <FontAwesome5 name="google" size={13} color="#FFFFFF" brand />
              <Text style={[styles.pillText, { color: '#FFFFFF' }]}>Sign in</Text>
            </GelPill>
          ) : wallet ? (
            <GelPill
              onPress={onWallet}
              disabled={walletBusy}
              tint={colors.success}
              label={`Wallet ${short}, open wallet menu`}
              styles={styles}
              colors={colors}
              isDark={isDark}
            >
              <View style={[styles.statusDot, { backgroundColor: colors.success, shadowColor: colors.success }]} />
              <Text style={[styles.pillText, { color: colors.textPrimary }]}>{short}</Text>
              <FontAwesome5 name={menuOpen ? 'chevron-up' : 'chevron-down'} size={10} color={colors.textMuted} />
            </GelPill>
          ) : (
            <GelPill lit onPress={onWallet} disabled={walletBusy} label="Connect wallet" styles={styles} colors={colors} isDark={isDark}>
              <FontAwesome5 name="wallet" size={13} color="#FFFFFF" solid />
              <Text style={[styles.pillText, { color: '#FFFFFF' }]}>Connect</Text>
            </GelPill>
          )}
        </View>
      </View>

      {/* In a Modal: Android doesn't deliver touches outside a parent's bounds,
          and the backdrop gives tap-anywhere-to-close for free. */}
      <Modal
        visible={!!wallet && menuOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityLabel="Close wallet menu" />
        <Animated.View
          style={[
            styles.dropdown,
            {
              top: topInset + 56,
              opacity: menuAnim,
              transform: [
                { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                { scale: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            },
          ]}
        >
          <LinearGradient colors={[colors.bgCardAlt, colors.bgElevated]} style={StyleSheet.absoluteFill} />
          <View style={styles.dropdownHead}>
            <Text style={styles.dropdownLabel}>CONNECTED WALLET</Text>
            <Text style={styles.dropdownAddress}>{address ? `${address.slice(0, 8)}…${address.slice(-6)}` : ''}</Text>
          </View>
          {[
            { icon: 'copy', label: 'Copy address', onPress: copy },
            { icon: 'wallet', label: 'Open wallet', onPress: openWallet },
            { icon: 'unlink', label: 'Disconnect', onPress: disconnect, danger: true },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              style={({ pressed }) => [styles.dropdownItem, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={[styles.dropdownIcon, item.danger && { backgroundColor: `${colors.danger}22` }]}>
                <FontAwesome5 name={item.icon} size={12} color={item.danger ? colors.danger : colors.accent} solid />
              </View>
              <Text style={[styles.dropdownText, item.danger && { color: colors.danger }]}>{item.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </Modal>
    </Animated.View>
  );
};

export default React.memo(GlobalNavbar);
