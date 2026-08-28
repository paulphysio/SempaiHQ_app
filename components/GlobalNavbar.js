import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Alert, Clipboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useGoogleAuth } from './GoogleAuthProvider';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { getGlobalNavbarStyles } from '../styles/GlobalNavbarStyles';

const GlobalNavbar = () => {
  const navigation = useNavigation();
  const { session, signIn, signOut } = useGoogleAuth();
  const walletContext = React.useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const disconnectWallet = walletContext?.disconnectWallet;
  const setShowModal = walletContext?.setShowModal;
  const isLoading = walletContext?.isLoading;
  const { isDark, toggleTheme, colors } = useTheme();
  const styles = getGlobalNavbarStyles(colors, isDark);
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  // Animation refs
  const headerPulse = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const slideDownAnim = useRef(new Animated.Value(-50)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeInAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideDownAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(headerPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(headerPulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Header surface + wallet-pill gradients follow the active theme, same
  // pairing as --nav-bg-1/--nav-bg-2 and the orange/blue accent swap in
  // Navbar.module.css.
  const surfaceGradient = isDark
    ? ['rgba(17, 18, 24, 0.95)', 'rgba(11, 11, 20, 0.98)']
    : ['rgba(253, 251, 212, 0.95)', 'rgba(245, 240, 208, 0.98)'];

  const accentGradient = [colors.accent, colors.accentDeep];

  const walletGradientColors = wallet
    ? ['rgba(76, 175, 80, 0.3)', 'rgba(76, 175, 80, 0.2)']
    : [colors.accentSoft, colors.accentSoft];

  const toggleWalletMenu = () => {
    if (!wallet && setShowModal) {
      setShowModal(true);
    } else {
      setShowWalletMenu(!showWalletMenu);
    }
  };

  const copyWalletAddress = () => {
    if (wallet?.publicKey) {
      Clipboard.setString(wallet.publicKey.toString());
      Alert.alert('Copied', 'Wallet address copied to clipboard');
      setShowWalletMenu(false);
    }
  };

  const handleDisconnect = () => {
    if (disconnectWallet) {
      disconnectWallet();
    }
    setShowWalletMenu(false);
  };

  return (
    <Animated.View
      style={[
        styles.header,
        { opacity: fadeInAnim, transform: [{ translateY: slideDownAnim }] },
      ]}
    >
      <LinearGradient colors={surfaceGradient} style={styles.gradientOverlay} />
      <Animated.View
        style={[
          styles.glowEffect,
          { opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }) },
        ]}
      />
      <View style={styles.headerContent}>
        <TouchableOpacity
          style={styles.brand}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Home')}
        >
          <Animated.View
            style={{
              transform: [
                {
                  scale: headerPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }),
                },
              ],
            }}
          >
            <Image
              source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
              style={styles.brandLogo}
              defaultSource={{ uri: 'https://via.placeholder.com/28x28' }}
            />
          </Animated.View>
          <Text style={styles.brandText}>SempaiHQ</Text>
        </TouchableOpacity>

        {/* Theme Toggle Button - always visible beside brand */}
        <TouchableOpacity
          onPress={toggleTheme}
          activeOpacity={0.85}
          style={styles.themeToggleBtn}
          accessible
          accessibilityLabel="Toggle theme"
          accessibilityHint="Switch between light and dark mode"
        >
          <FontAwesome5 name={isDark ? 'sun' : 'moon'} size={13} color={isDark ? colors.gold : colors.accent} />
        </TouchableOpacity>

        <View style={styles.headerAuthRow}>
          {!session ? (
            <Animated.View
              style={{
                transform: [
                  { scale: fadeInAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                ],
              }}
            >
              <TouchableOpacity
                onPress={signIn}
                activeOpacity={0.85}
                style={styles.headerSignInBtn}
                accessible
                accessibilityLabel="Sign in with Google"
              >
                <LinearGradient
                  colors={accentGradient}
                  style={styles.signInGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Image
                    source={{
                      uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/512px-Google_%22G%22_Logo.svg.png',
                    }}
                    style={styles.headerSignInIcon}
                  />
                  <Text style={styles.headerSignInText}>Sign in</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              <Animated.View
                style={{
                  transform: [
                    { scale: headerPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
                  ],
                  shadowColor: colors.accent,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: headerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }),
                  shadowRadius: headerPulse.interpolate({ inputRange: [0, 1], outputRange: [4, 8] }),
                }}
              >
                <TouchableOpacity
                  onPress={toggleWalletMenu}
                  activeOpacity={0.85}
                  style={styles.headerWalletBtn}
                  accessible
                  accessibilityLabel="Wallet menu"
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={walletGradientColors}
                    style={styles.walletGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <FontAwesome5 name="wallet" size={11} color={wallet ? '#4CAF50' : colors.textPrimary} />
                    <Text style={[styles.headerWalletText, { color: wallet ? '#4CAF50' : colors.textPrimary }]}>
                      {wallet
                        ? `${wallet.publicKey.toString().slice(0, 4)}...${wallet.publicKey.toString().slice(-4)}`
                        : 'Connect'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {showWalletMenu && wallet && (
                <View style={styles.walletDropdown}>
                  <TouchableOpacity onPress={copyWalletAddress} style={styles.walletDropdownItem}>
                    <FontAwesome5 name="copy" size={12} color={colors.accent} />
                    <Text style={styles.walletDropdownText}>Copy Address</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDisconnect} style={styles.walletDropdownItem}>
                    <FontAwesome5 name="sign-out-alt" size={12} color={colors.accent} />
                    <Text style={styles.walletDropdownText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                onPress={signOut}
                activeOpacity={0.85}
                style={styles.signOutBtn}
                accessible
                accessibilityLabel="Sign out"
              >
                <FontAwesome5 name="sign-out-alt" size={12} color={colors.accent} />
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

export default GlobalNavbar;