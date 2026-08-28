import React, { useState, useRef, useEffect, Fragment, useContext } from 'react';
import { View, TouchableOpacity, Text, Dimensions, Animated, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getGlobalBottomNavStyles } from '../styles/GlobalBottomNavStyles';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';

const { width } = Dimensions.get('window');

const GlobalBottomNav = ({ onMenuToggle, menuOpen, unreadCount = 0, announcementCount = 0 }) => {
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = walletContext?.isWalletConnected || !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();
  const { isDark, colors } = useTheme();
  const themedStyles = getGlobalBottomNavStyles(isDark);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Animation refs
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const menuPulseAnim = useRef(new Animated.Value(0)).current;
  const notifPulseAnim = useRef(new Animated.Value(0)).current;
  const announcePulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial entrance animation
    Animated.parallel([
      Animated.timing(fadeInAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animations for buttons with badges (more subtle)
    if (unreadCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(notifPulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(notifPulseAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }

    if (announcementCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(announcePulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(announcePulseAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }

    // Menu button pulse (very subtle)
    Animated.loop(
      Animated.sequence([
        Animated.timing(menuPulseAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(menuPulseAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, [unreadCount, announcementCount]);

  const handleNotifications = () => {
    setShowNotifications(true);
    fetchNotifications();
  };

  const handleAnnouncements = () => {
    setShowAnnouncements(true);
    fetchAnnouncements();
  };

  const handleNavigation = (screenName) => {
    setIsNavigating(true);
    navigation.navigate(screenName);
    setTimeout(() => setIsNavigating(false), 500);
  };

  const fetchNotifications = async () => {
    if (!isWalletConnected || !activeWalletAddress) return;
    
    setLoadingNotifications(true);
    try {
      // First get the user ID from wallet address
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

      // Fetch notifications for this user
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

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const { data: announcementData, error: announcementError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (announcementError) {
        console.error('Error fetching announcements:', announcementError);
        setAnnouncements([]);
        return;
      }

      setAnnouncements(announcementData || []);
    } catch (error) {
      console.error('Error in fetchAnnouncements:', error);
      setAnnouncements([]);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  return (
    <Fragment>
      <Animated.View 
        style={[
          themedStyles.bottomNavbar,
          {
            opacity: fadeInAnim,
            transform: [{ translateY: slideUpAnim }],
          }
        ]}
      >
        <LinearGradient
          colors={isDark ? ['rgba(17, 18, 24, 0.95)', 'rgba(11, 11, 20, 0.98)'] : ['rgba(255, 255, 255, 0.95)', 'rgba(248, 248, 232, 0.98)']}
          style={themedStyles.gradientOverlay}
        />
        <View style={themedStyles.glowEffect} />
        <View style={themedStyles.navContent}>
          <Animated.View
            style={{
              transform: [{
                scale: menuPulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.04],
                })
              }],
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: menuPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.3] }),
              shadowRadius: menuPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 4] }),
            }}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              style={themedStyles.bottomNavButton}
              onPress={onMenuToggle}
              accessible={true}
              accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
              disabled={isNavigating}
            >
              <LinearGradient
                colors={menuOpen ? [colors.accent, colors.accentDeep] : [colors.accentSoft, colors.accentGlow]}
                style={themedStyles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isNavigating ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <FontAwesome5 
                    name={menuOpen ? 'times' : 'bars'} 
                    size={width < 480 ? 20 : 22} 
                    color={menuOpen ? '#fff' : colors.accent}
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={{
              transform: [{
                scale: unreadCount > 0 ? notifPulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.06],
                }) : 1,
              }],
              shadowColor: unreadCount > 0 ? colors.accent : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: unreadCount > 0 ? notifPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }) : 0,
              shadowRadius: unreadCount > 0 ? notifPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 5] }) : 0,
            }}
          >
            <View style={themedStyles.notificationWrapper}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={themedStyles.bottomNavButton}
                onPress={handleNotifications}
                accessible={true}
                accessibilityLabel="View notifications"
              >
                <LinearGradient
                  colors={unreadCount > 0 ? [colors.accent, colors.accentDeep] : [colors.accentSoft, colors.accentGlow]}
                  style={themedStyles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <FontAwesome5 
                    name="envelope" 
                    size={width < 480 ? 20 : 22} 
                    color={unreadCount > 0 ? '#fff' : colors.accent}
                  />
                  {unreadCount > 0 && (
                    <Animated.View 
                      style={[
                        themedStyles.notificationBadge,
                        {
                          transform: [{
                            scale: notifPulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.1],
                            })
                          }]
                        }
                      ]}
                    >
                      <Text style={themedStyles.badgeText}>{unreadCount}</Text>
                    </Animated.View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View
            style={{
              transform: [{
                scale: announcementCount > 0 ? announcePulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.06],
                }) : 1,
              }],
              shadowColor: announcementCount > 0 ? colors.accentDeep : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: announcementCount > 0 ? announcePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }) : 0,
              shadowRadius: announcementCount > 0 ? announcePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 5] }) : 0,
            }}
          >
            <View style={themedStyles.announcementToggleWrapper}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={themedStyles.bottomNavButton}
                onPress={handleAnnouncements}
                accessible={true}
                accessibilityLabel="View announcements"
              >
                <LinearGradient
                  colors={announcementCount > 0 ? [colors.accentDeep, colors.accent] : [colors.accentSoft, colors.accentGlow]}
                  style={themedStyles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <FontAwesome5 
                    name="bell" 
                    size={width < 480 ? 20 : 22} 
                    color={announcementCount > 0 ? '#fff' : colors.accentDeep}
                  />
                  {announcementCount > 0 && (
                    <Animated.View 
                      style={[
                        themedStyles.announcementBadge,
                        {
                          transform: [{
                            scale: announcePulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.1],
                            })
                          }]
                        }
                      ]}
                    >
                      <Text style={themedStyles.badgeText}>{announcementCount}</Text>
                    </Animated.View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <FontAwesome5 name="times" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
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

      {/* Announcements Modal */}
      <Modal
        visible={showAnnouncements}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAnnouncements(false)}
      >
        <View style={themedStyles.modalOverlay}>
          <View style={themedStyles.modalContent}>
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>Announcements</Text>
              <TouchableOpacity onPress={() => setShowAnnouncements(false)}>
                <FontAwesome5 name="times" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={themedStyles.modalBody}>
              {loadingAnnouncements ? (
                <Text style={themedStyles.modalText}>Loading announcements...</Text>
              ) : announcements.length === 0 ? (
                <Text style={themedStyles.modalText}>No announcements found.</Text>
              ) : (
                announcements.map((announcement) => (
                  <View key={announcement.id} style={themedStyles.notificationItem}>
                    <Text style={themedStyles.announcementTitle}>{announcement.title}</Text>
                    <Text style={themedStyles.notificationMessage}>{announcement.message}</Text>
                    {announcement.release_date && (
                      <Text style={themedStyles.notificationDate}>
                        Release: {new Date(announcement.release_date).toLocaleDateString()}
                      </Text>
                    )}
                    <Text style={themedStyles.notificationDate}>
                      Created: {new Date(announcement.created_at).toLocaleDateString()}
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
