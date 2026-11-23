import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Animated, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { getGlobalBottomNavStyles, NAV } from '../styles/GlobalBottomNavStyles';
import { goToTopLevel, getActiveRouteName } from '../utils/navigation';
import { useMessagesInbox, MessagesSheet } from './MessagesButton';
import GelOrb from './nav/GelOrb';
import { haptics } from '../utils/haptics';

/** Total vertical space the floating bar occupies (for screens that pad for it). */
export const BOTTOM_NAV_CLEARANCE = NAV.height + NAV.bottomGap + 8;

const SLOTS = ['menu', 'messages', 'inbox', 'swap', 'leaderboard'];
const ROUTE_SLOT = { Chat: 2, Inbox: 2, Swap: 3, Leaderboard: 4 };
const LAMP_W = 34;

const GlobalBottomNav = ({ onMenuToggle, menuOpen }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getGlobalBottomNavStyles(isDark), [isDark]);
  const inbox = useMessagesInbox();

  // Sibling of the navigator: follow the active route via container events.
  const [currentRoute, setCurrentRoute] = useState();
  useEffect(() => {
    setCurrentRoute(getActiveRouteName(navigation.getState?.()));
    return navigation.addListener('state', (e) => setCurrentRoute(getActiveRouteName(e?.data?.state)));
  }, [navigation]);

  // Which orb owns the light right now (-1 = none, e.g. on Home).
  const activeSlot = menuOpen ? 0 : inbox.open ? 1 : ROUTE_SLOT[currentRoute] ?? -1;

  // ---- entrance ---------------------------------------------------------
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }).start();
  }, [enter]);

  // ---- gliding lamp -----------------------------------------------------
  const [slotW, setSlotW] = useState(0);
  const lampX = useRef(new Animated.Value(0)).current;
  const lampOn = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (!slotW) return;
    const show = activeSlot >= 0;
    Animated.timing(lampOn, { toValue: show ? 1 : 0, duration: 220, useNativeDriver: true }).start();
    if (!show) return;
    const x = activeSlot * slotW + slotW / 2;
    if (!placed.current) {
      lampX.setValue(x); // first placement: no slide in from the edge
      placed.current = true;
    } else {
      Animated.spring(lampX, { toValue: x, useNativeDriver: true, speed: 14, bounciness: 7 }).start();
    }
  }, [activeSlot, slotW, lampX, lampOn]);

  const onContentLayout = (e) => setSlotW(e.nativeEvent.layout.width / SLOTS.length);

  // ---- actions ----------------------------------------------------------
  const goInbox = useCallback(() => goToTopLevel(navigation, 'Chat'), [navigation]);
  const goSwap = useCallback(() => goToTopLevel(navigation, 'Swap'), [navigation]);
  const goLeaderboard = useCallback(() => goToTopLevel(navigation, 'Leaderboard'), [navigation]);
  const toggleMenu = useCallback(() => {
    haptics.open();
    onMenuToggle?.();
  }, [onMenuToggle]);

  const bottomOffset = Math.max(insets.bottom, 8) + NAV.bottomGap;
  const lampTranslate = Animated.subtract(lampX, LAMP_W / 2);
  const poolTranslate = Animated.subtract(lampX, 45);

  return (
    <>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.navWrapper,
          {
            bottom: bottomOffset,
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        <View style={styles.navShadow}>
          <View style={styles.navGlass}>
            {/* 1 · frosted backdrop (real-time blur is iOS-only: on Android
                it re-renders everything behind the bar every scroll frame) */}
            {Platform.OS === 'ios' && (
              <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            )}
            {/* 2 · tint + brand wash */}
            <View pointerEvents="none" style={styles.glassTint} />
            <LinearGradient
              pointerEvents="none"
              colors={[`rgba(${colors.accentRgb},0.16)`, 'rgba(0,0,0,0)', `rgba(${colors.goldRgb},0.10)`]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            {/* 3 · glow pool under the active orb */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lampPool,
                { opacity: lampOn, transform: [{ translateX: poolTranslate }] },
              ]}
            >
              <LinearGradient
                colors={[`rgba(${colors.accentRgb},0.42)`, `rgba(${colors.accentRgb},0)`]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            {/* 4 · top-down sheen */}
            <LinearGradient
              pointerEvents="none"
              colors={[isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']}
              locations={[0, 0.5, 1]}
              style={styles.glassSheen}
            />
            {/* 5 · light catching the top edge */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0)', isDark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.glassSpecular}
            />
            {/* 6 · the gliding lamp on the top edge */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lamp,
                {
                  backgroundColor: colors.accentHi,
                  shadowColor: colors.accent,
                  opacity: lampOn,
                  transform: [{ translateX: lampTranslate }],
                },
              ]}
            />
            {/* 7 · rim */}
            <View pointerEvents="none" style={styles.glassRim} />

            <View style={styles.navContent} onLayout={onContentLayout}>
              <View style={styles.slot}>
                <GelOrb
                  icon={menuOpen ? 'times' : 'bars'}
                  size={NAV.buttonSize}
                  lit={!!menuOpen}
                  onPress={toggleMenu}
                  label={menuOpen ? 'Close menu' : 'Open menu'}
                />
              </View>
              <View style={styles.slot}>
                <GelOrb
                  icon="envelope"
                  size={NAV.buttonSize}
                  lit={inbox.open || inbox.unreadCount > 0}
                  badge={inbox.unreadCount}
                  onPress={inbox.openSheet}
                  label={inbox.unreadCount > 0 ? `Messages, ${inbox.unreadCount} unread` : 'Messages'}
                />
              </View>
              <View style={styles.slot}>
                <GelOrb icon="comments" size={NAV.buttonSize} lit={currentRoute === 'Chat' || currentRoute === 'Inbox'} onPress={goInbox} label="Chats" />
              </View>
              <View style={styles.slot}>
                <GelOrb icon="exchange-alt" size={NAV.buttonSize} lit={currentRoute === 'Swap'} onPress={goSwap} label="Swap tokens" />
              </View>
              <View style={styles.slot}>
                <GelOrb icon="trophy" size={NAV.buttonSize} lit={currentRoute === 'Leaderboard'} onPress={goLeaderboard} label="Leaderboard" />
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      <MessagesSheet {...inbox} onClose={inbox.closeSheet} />
    </>
  );
};

export default React.memo(GlobalBottomNav);
