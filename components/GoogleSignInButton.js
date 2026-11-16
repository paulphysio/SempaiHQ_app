import React, { useRef } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useGoogleAuth } from './GoogleAuthProvider';
import { haptics } from '../utils/haptics';

/**
 * "Continue with Google" — a glossy white gel pill. Always dark text on white,
 * so it reads in both themes (the old one put theme text on a white fill,
 * which was white-on-white in dark mode).
 *
 * props: size 'lg' | 'md' (default 'lg'), full (default true), label, style
 */
const GoogleSignInButton = ({ size = 'lg', full = true, label, style }) => {
  const { signIn, signOut, session, loading } = useGoogleAuth();
  const press = useRef(new Animated.Value(1)).current;
  const h = size === 'md' ? 44 : 52;

  const handlePress = async () => {
    haptics.tap();
    try {
      if (session) await signOut();
      else await signIn();
    } catch (error) {
      console.error('Google sign in/out error:', error.message);
    }
  };

  const to = (v) => Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 36, bounciness: 8 }).start();
  const text = label || (session ? 'Sign out' : 'Continue with Google');

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ busy: !!loading }}
      style={[{ alignSelf: full ? 'stretch' : 'center' }, style]}
    >
      <Animated.View style={[styles.shadow, { height: h, borderRadius: h / 2, transform: [{ scale: press }] }]}>
        <View style={[styles.clip, { borderRadius: h / 2 }]}>
          <LinearGradient colors={['#FFFFFF', '#F2F2F6']} style={[styles.fill, { paddingHorizontal: h / 2 }]}>
            {loading ? (
              <ActivityIndicator color="#4285F4" size="small" />
            ) : (
              <>
                <View style={styles.badge}>
                  <FontAwesome5 name="google" size={15} color="#4285F4" brand />
                </View>
                <Text style={[styles.text, size === 'md' && { fontSize: 14 }]} numberOfLines={1}>{text}</Text>
              </>
            )}
          </LinearGradient>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
            style={[styles.gloss, { height: h * 0.45, borderRadius: h / 2 }]}
          />
          <View pointerEvents="none" style={[styles.rim, { borderRadius: h / 2 }]} />
        </View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    backgroundColor: '#FFFFFF',
  },
  clip: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(66,133,244,0.10)' },
  text: { color: '#1F1F24', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  gloss: { position: 'absolute', top: 1, left: 14, right: 14 },
  rim: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
});

export default GoogleSignInButton;
