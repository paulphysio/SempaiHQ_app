import React, { useState, useRef, useEffect, Fragment, useContext } from 'react';
import {
  View,
  Pressable,
  Text,
  Dimensions,
  Animated,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getGlobalBottomNavStyles, NAV } from '../styles/GlobalBottomNavStyles';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';

const { width } = Dimensions.get('window');
const ICON_SIZE = width < 480 ? 19 : 21;

// ---------------------------------------------------------------------------
// NavButton — gel-like button: squishes on press, glossy highlight, soft glow
// ---------------------------------------------------------------------------
const NavButton = ({
  icon,
  label,
  active = false,
  onPress,
  disabled,
  loading,
  badge = 0,
  pulse, // optional Animated.Value (0 -> 1) driving the glow
  styles,
  colors,
  isDark,
}) => {
  const press = useRef(new Animated.Value(0)).current;

  const squish = (to) =>
    Animated.spring(press, {
      toValue: to,
      useNativeDriver: true,
      speed: 28,
      bounciness: 14,
    }).start();

  const scaleX = press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const scaleY = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] });

  const glowOpacity = pulse
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: [active ? 0.35 : 0.0, active ? 0.6 : 0.28] })
    : active
    ? 0.5
    : 0;

  const lit = active || badge > 0;
  const iconColor = lit ? '#fff' : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => squish(1)}
      onPressOut={() => squish(0)}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      hitSlop={6}
    >
      <View style={styles.buttonWrap}>
        <Animated.View pointerEvents="none" style={[styles.buttonGlow, { opacity: glowOpacity }]} />

        <Animated.View
          style={[styles.button, { transform: [{ scaleX }, { scaleY }] }]}
        >
          <LinearGradient
            colors={
              lit
                ? [colors.accentBright || colors.accent, colors.accentDeep]
                : [colors.accentSoft, colors.accentGlow]
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.buttonFill}
          >
            {loading ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <FontAwesome5 name={icon} size={ICON_SIZE} color={iconColor} />
            )}
          </LinearGradient>

          {/* Specular gloss — the "wet" look */}
          <LinearGradient
            pointerEvents="none"
            colors={[
              isDark ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.55)',
              'rgba(255,255,255,0)',
            ]}
            style={styles.buttonGloss}
          />

          <View
            pointerEvents="none"
            style={[
              styles.buttonRim,
              {
                borderColor: lit
                  ? 'rgba(255,255,255,0.35)'
                  : isDark
                  ? 'rgba(255,255,255,0.10)'
                  : 'rgba(59,130,246,0.18)',
              },
            ]}
          />
        </Animated.View>

        {badge > 0 && (
          <Animated.View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
};

// ---------------------------------------------------------------------------

const GlobalBottomNav = ({ onMenuToggle, menuOpen, unreadCount = 0 }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Active route name. Works outside a navigator (this component is a sibling
  // of the navigator, so useNavigationState would throw).
  const [currentRoute, setCurrentRoute] = useState();
  useEffect(() => {
    const getActiveName = (state) => {
      let s = state;
      while (s?.routes?.[s.index]?.state) s = s.routes[s.index].state;
      return s?.routes?.[s.index]?.name;
    };
    setCurrentRoute(getActiveName(navigation.getState?.()));
    const unsubscribe = navigation.addListener('state', (e) => {
      setCurrentRoute(getActiveName(e?.data?.state));
    });
    return unsubscribe;
  }, [navigation]);

  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = walletContext?.isWalletConnected || !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();
  const { isDark, colors } = useTheme();
  const themedStyles = getGlobalBottomNavStyles(isDark);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Animation refs
  const enterAnim = useRef(new Animated.Value(0)).current;
  const menuPulseAnim = useRef(new Animated.Value(0)).current;
  const notifPulseAnim = useRef(new Animated.Value(0)).current;

  // Entrance: one springy rise
  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 10,
      bounciness: 10,
    }).start();
  }, []);

  // Menu pulse (very subtle)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(menuPulseAnim, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(menuPulseAnim, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Notification pulse — only while there is something unread
  useEffect(() => {
    if (unreadCount <= 0) {
      notifPulseAnim.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(notifPulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(notifPulseAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [unreadCount]);

  const navTimer = useRef(null);
  useEffect(() => () => clearTimeout(navTimer.current), []);

  const handleNotifications = () => {
    setShowNotifications(true);
    fetchNotifications();
  };

  const handleNavigation = (screenName) => {
    setIsNavigating(true);
    navigation.navigate(screenName);
    navTimer.current = setTimeout(() => setIsNavigating(false), 500);
  };

  const fetchNotifications = async () => {
    if (!isWalletConnected || !activeWalletAddress) return;

    setLoadingNotifications(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', activeWalletAddress)
        .single();

      if (userError || !userData) {
        console.error('Error fetching user:', userError);
        setNotifications([]);
        return;
      }

      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (notifError) {
        console.error('Error fetching notifications:', notifError);
        setNotifications([]);
        return;
      }

      setNotifications(notifData || []);
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const bottomOffset = Math.max(insets.bottom, 8) + NAV.bottomGap;

  return (
    <Fragment>
      <Animated.View
        pointerEvents="box-none"
        style={[
          themedStyles.navWrapper,
          {
            bottom: bottomOffset,
            opacity: enterAnim,
            transform: [
              {
                translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
              },
              {
                scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
              },
            ],
          },
        ]}
      >
        <View style={themedStyles.navShadow}>
          <View style={themedStyles.navGlass}>
            {/* 1. Frosted backdrop */}
            <BlurView
              intensity={Platform.OS === 'ios' ? 55 : 80}
              tint={isDark ? 'dark' : 'light'}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            {/* 2. Tint keeps the Kaito base colour and a readable fallback on Android */}
            <View pointerEvents="none" style={themedStyles.glassTint} />
            <View pointerEvents="none" style={themedStyles.accentWash} />
            {/* 3. Top-down sheen */}
            <LinearGradient
              pointerEvents="none"
              colors={[
                isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.60)',
                'rgba(255,255,255,0.02)',
                'rgba(255,255,255,0)',
              ]}
              locations={[0, 0.5, 1]}
              style={themedStyles.glassSheen}
            />
            {/* 4. Light catching the top edge */}
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0)',
                isDark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,1)',
                'rgba(255,255,255,0)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={themedStyles.glassSpecular}
            />
            {/* 5. Rim */}
            <View pointerEvents="none" style={themedStyles.glassRim} />

            <View style={themedStyles.navContent}>
              <NavButton
                icon={menuOpen ? 'times' : 'bars'}
                label={menuOpen ? 'Close menu' : 'Open menu'}
                active={!!menuOpen}
                onPress={onMenuToggle}
                disabled={isNavigating}
                loading={isNavigating}
                pulse={menuPulseAnim}
                styles={themedStyles}
                colors={colors}
                isDark={isDark}
              />

              <NavButton
                icon="envelope"
                label="View notifications"
                active={showNotifications}
                onPress={handleNotifications}
                badge={unreadCount}
                pulse={unreadCount > 0 ? notifPulseAnim : undefined}
                styles={themedStyles}
                colors={colors}
                isDark={isDark}
              />

              <NavButton
                icon="exchange-alt"
                label="Swap tokens"
                active={currentRoute === 'Swap'}
                onPress={() => handleNavigation('Swap')}
                disabled={isNavigating}
                styles={themedStyles}
                colors={colors}
                isDark={isDark}
              />

              <NavButton
                icon="trophy"
                label="View leaderboard"
                active={currentRoute === 'Leaderboard'}
                onPress={() => handleNavigation('Leaderboard')}
                disabled={isNavigating}
                styles={themedStyles}
                colors={colors}
                isDark={isDark}
              />
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Notifications Modal */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={themedStyles.modalOverlay}>
          <View style={themedStyles.modalContent}>
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>Notifications</Text>
              <Pressable
                style={themedStyles.modalClose}
                onPress={() => setShowNotifications(false)}
                accessibilityRole="button"
                accessibilityLabel="Close notifications"
              >
                <FontAwesome5 name="times" size={16} color={colors.accent} />
              </Pressable>
            </View>
            <ScrollView style={themedStyles.modalBody}>
              {loadingNotifications ? (
                <Text style={themedStyles.modalText}>Loading notifications...</Text>
              ) : !isWalletConnected ? (
                <Text style={themedStyles.modalText}>Connect your wallet to view notifications.</Text>
              ) : notifications.length === 0 ? (
                <Text style={themedStyles.modalText}>No notifications found.</Text>
              ) : (
                notifications.map((notif) => (
                  <View key={notif.id} style={themedStyles.notificationItem}>
                    <Text style={themedStyles.notificationType}>{notif.type}</Text>
                    <Text style={themedStyles.notificationMessage}>{notif.message}</Text>
                    <Text style={themedStyles.notificationDate}>
                      {new Date(notif.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Fragment>
  );
};

export default GlobalBottomNav;