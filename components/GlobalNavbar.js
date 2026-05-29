import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useGoogleAuth } from './GoogleAuthProvider';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import GlobalNavbarStyles from '../styles/GlobalNavbarStyles';

const { width, height } = Dimensions.get('window');

const GlobalNavbar = () => {
  const navigation = useNavigation();
  const { session, signIn, signOut } = useGoogleAuth();
  const walletContext = React.useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  
  // Animation refs
  const headerPulse = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const slideDownAnim = useRef(new Animated.Value(-50)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial entrance animation
    Animated.parallel([
      Animated.timing(fadeInAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideDownAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation for wallet button
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(headerPulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const toggleWalletMenu = () => {
    setShowWalletMenu(!showWalletMenu);
  };

  const copyWalletAddress = () => {
    if (wallet?.publicKey) {
      // Copy logic here
    }
  };

  return (
    <Animated.View 
      style={[
        GlobalNavbarStyles.header,
        {
          opacity: fadeInAnim,
          transform: [{ translateY: slideDownAnim }],
        }
      ]}
    >
      <LinearGradient
        colors={['rgba(17, 18, 24, 0.95)', 'rgba(11, 11, 20, 0.98)']}
        style={GlobalNavbarStyles.gradientOverlay}
      />
      <Animated.View 
        style={[
          GlobalNavbarStyles.glowEffect,
          {
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.6],
            }),
          }
        ]}
      />
      <View style={GlobalNavbarStyles.headerContent}>
        <TouchableOpacity 
          style={GlobalNavbarStyles.brand}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Home')}
        >
          <Animated.View style={{
            transform: [{
              scale: headerPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.05],
              })
            }]
          }}>
            <Image
              source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
              style={GlobalNavbarStyles.brandLogo}
              defaultSource={{ uri: 'https://via.placeholder.com/28x28' }}
            />
          </Animated.View>
          <Text style={GlobalNavbarStyles.brandText}>SempaiHQ</Text>
        </TouchableOpacity>
        <View style={GlobalNavbarStyles.headerAuthRow}>
          {!session ? (
            <Animated.View
              style={{
                transform: [{
                  scale: fadeInAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  })
                }]
              }}
            >
              <TouchableOpacity
                onPress={signIn}
                activeOpacity={0.85}
                style={GlobalNavbarStyles.headerSignInBtn}
                accessible
                accessibilityLabel="Sign in with Google"
              >
                <LinearGradient
                  colors={['#FF5733', '#F36316']}
                  style={GlobalNavbarStyles.signInGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Image
                    source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/512px-Google_%22G%22_Logo.svg.png' }}
                    style={GlobalNavbarStyles.headerSignInIcon}
                  />
                  <Text style={GlobalNavbarStyles.headerSignInText}>Sign in</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              <Animated.View style={{ 
                transform: [{ scale: headerPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }],
                shadowColor: '#FF5733',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: headerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }),
                shadowRadius: headerPulse.interpolate({ inputRange: [0, 1], outputRange: [4, 8] }),
              }}>
                <TouchableOpacity
                  onPress={toggleWalletMenu}
                  activeOpacity={0.85}
                  style={GlobalNavbarStyles.headerWalletBtn}
                  accessible
                  accessibilityLabel="Wallet menu"
                >
                  <LinearGradient
                    colors={['rgba(243, 99, 22, 0.3)', 'rgba(255, 87, 51, 0.2)']}
                    style={GlobalNavbarStyles.walletGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <FontAwesome5 name="wallet" size={14} color="#fff" />
                    <Text style={GlobalNavbarStyles.headerWalletText}>
                      {wallet?.publicKey ? `${wallet.publicKey.toString().slice(0,3)}...${wallet.publicKey.toString().slice(-3)}` : 'Wallet'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity
                onPress={signOut}
                activeOpacity={0.85}
                style={GlobalNavbarStyles.signOutBtn}
                accessible
                accessibilityLabel="Sign out"
              >
                <FontAwesome5 name="sign-out-alt" size={14} color="#FF5733" />
                <Text style={GlobalNavbarStyles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

export default GlobalNavbar;
