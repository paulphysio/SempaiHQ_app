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
import { NotificationEmitter } from '../services/NotificationEmitter';

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

const GlobalBottomNav = ({ onMenuToggle, menuOpen }) => {
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

  const [showMessages, setShowMessages] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [combinedMessages, setCombinedMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Fetch messages on mount if wallet is connected
  useEffect(() => {
    if (isWalletConnected && activeWalletAddress) {
      fetchMessages();
    }
  }, [isWalletConnected, activeWalletAddress]);

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

  // Listen for notification events to refresh unread count
  useEffect(() => {
    const listener = NotificationEmitter.addListener('notificationReceived', () => {
      console.log('[GlobalBottomNav] Notification received, refreshing unread count');
      fetchMessages();
    });
    return () => listener.remove();
  }, [isWalletConnected, activeWalletAddress]);

  const navTimer = useRef(null);
  useEffect(() => () => clearTimeout(navTimer.current), []);

  const handleNotifications = async () => {
    setShowMessages(true);
    await fetchMessages();
    
    // Mark all notifications as read
    if (isWalletConnected && activeWalletAddress) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', activeWalletAddress)
          .single();
        
        if (userData) {
          // notifications.is_read is the real column; announcements have no
          // per-user read state (they already fan out into notifications rows).
          const { error: markError } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userData.id)
            .or('is_read.is.null,is_read.eq.false');
          if (markError) console.warn('[GlobalBottomNav] mark-read failed:', markError.message);

          // Refresh to update unread count
          setUnreadCount(0);
        }
      } catch (error) {
        console.error('[GlobalBottomNav] Error marking as read:', error);
      }
    }
  };

  const handleNavigation = (screenName) => {
    setIsNavigating(true);
    navigation.navigate(screenName);
    navTimer.current = setTimeout(() => setIsNavigating(false), 500);
  };

  const fetchMessages = async () => {
    if (!isWalletConnected || !activeWalletAddress) {
      console.log('[GlobalBottomNav] fetchMessages: Wallet not connected');
      return;
    }

    console.log('[GlobalBottomNav] fetchMessages: Starting...');
    setLoadingMessages(true);
    try {
      console.log('[GlobalBottomNav] Fetching user data for wallet:', activeWalletAddress);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, isWriter, isArtist')
        .eq('wallet_address', activeWalletAddress)
        .single();

      if (userError || !userData) {
        console.error('[GlobalBottomNav] Error fetching user:', userError);
        setNotifications([]);
        setAnnouncements([]);
        return;
      }

      console.log('[GlobalBottomNav] User data fetched:', userData.id);
      console.log('[GlobalBottomNav] Fetching notifications for user:', userData.id);
      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (notifError) {
        console.error('[GlobalBottomNav] Error fetching notifications:', notifError);
      } else {
        console.log('[GlobalBottomNav] Fetched', notifData?.length || 0, 'notifications');
      }

      console.log('[GlobalBottomNav] Fetching announcements...');
      const { data: announcementData, error: announcementError } = await supabase
        .from('announcements')
        .select(`
          id, title, message, created_at, release_date, audience,
          users!user_id(id, wallet_address)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (announcementError) {
        console.error('[GlobalBottomNav] Error fetching announcements:', announcementError);
      } else {
        console.log('[GlobalBottomNav] Fetched', announcementData?.length || 0, 'announcements');
      }

      const filteredAnnouncements = (announcementData || []).filter(ann =>
        ann.audience === 'creators' ? userData.isWriter || userData.isArtist : true
      );

      console.log('[GlobalBottomNav] Filtered announcements:', filteredAnnouncements.length);
      setNotifications(notifData || []);
      setAnnouncements(filteredAnnouncements);
      
      // Combine and sort by date
      const combined = [
        ...(notifData || []).map(n => ({ ...n, type: 'notification' })),
        ...(filteredAnnouncements || []).map(a => ({ ...a, type: 'announcement' }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setCombinedMessages(combined);
      
      // Unread = notifications with is_read false/null, counted across ALL rows
      // (the list above is limited to 20 for the modal). Announcements are NOT
      // counted: they have no per-user read column and already generate
      // notification rows when sent.
      const { count: unreadCountResult } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userData.id)
        .or('is_read.is.null,is_read.eq.false');
      setUnreadCount(unreadCountResult ?? (notifData || []).filter(n => !n.is_read).length);
    } catch (error) {
      console.error('[GlobalBottomNav] Error in fetchMessages:', error);
      setNotifications([]);
      setAnnouncements([]);
    } finally {
      setLoadingMessages(false);
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
                label="View messages"
                active={showMessages}
                onPress={handleNotifications}
                badge={unreadCount}
                pulse={unreadCount > 0 ? notifPulseAnim : undefined}
                styles={themedStyles}
                colors={colors}
                isDark={isDark}
              />

              <NavButton
                icon="inbox"
                label="Inbox"
                active={currentRoute === 'Inbox'}
                onPress={() => handleNavigation('Inbox')}
                disabled={isNavigating}
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

      {/* Messages Modal (combines notifications and announcements) */}
      <Modal
        visible={showMessages}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMessages(false)}
      >
        <View style={themedStyles.modalOverlay}>
          <View style={themedStyles.modalContent}>
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>Messages</Text>
              <Pressable
                style={themedStyles.modalClose}
                onPress={() => setShowMessages(false)}
                accessibilityRole="button"
                accessibilityLabel="Close messages"
              >
                <FontAwesome5 name="times" size={16} color={colors.accent} />
              </Pressable>
            </View>
            <ScrollView style={themedStyles.modalBody}>
              {loadingMessages ? (
                <Text style={themedStyles.modalText}>Loading messages...</Text>
              ) : !isWalletConnected ? (
                <Text style={themedStyles.modalText}>Connect your wallet to view messages.</Text>
              ) : combinedMessages.length === 0 ? (
                <Text style={themedStyles.modalText}>No messages found.</Text>
              ) : (
                <>
                  {combinedMessages.map((msg) => (
                    <View key={`${msg.type}-${msg.id}`} style={themedStyles.notificationItem}>
                      <Text style={themedStyles.notificationType}>
                        {msg.type === 'announcement' ? 'Announcement' : 'Notification'}
                      </Text>
                      {msg.type === 'announcement' && (
                        <Text style={themedStyles.notificationTitle}>{msg.title}</Text>
                      )}
                      <Text style={themedStyles.notificationMessage}>
                        {msg.type === 'announcement' ? msg.message : msg.message}
                      </Text>
                      <Text style={themedStyles.notificationDate}>
                        {new Date(msg.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Fragment>
  );
};

export default GlobalBottomNav;