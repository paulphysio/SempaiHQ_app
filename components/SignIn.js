import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator, FlatList, Animated, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGoogleAuth } from './GoogleAuthProvider';
import { useSystemUi } from '../context/SystemUiContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import TokenClaimModal from './TokenClaimModal';
import GoogleSignInButton from './GoogleSignInButton';
import { useTheme } from '../context/ThemeContext';
import { toast } from './Toast';
import GelOrb from './nav/GelOrb';
import { BrandBackdrop, BrandMark, SCREEN_W } from './brand/Brand';
import { radius, space } from '../theme/tokens';
import { haptics } from '../utils/haptics';

/*
 * First-timer screen (shown after the intro to anyone not signed in).
 * Brand mark → three swipeable "what you get" slides → Google / guest.
 */
const SLIDES = [
  {
    icon: 'book-open',
    title: 'Stories that pay you back',
    body: 'Read novels and manga from independent creators — and earn SMP for every chapter you finish.',
  },
  {
    icon: 'gem',
    title: 'Own what you love',
    body: 'Unlock chapters, collect creator badges and support writers directly on Solana.',
  },
  {
    icon: 'cloud-download-alt',
    title: 'Read anywhere',
    body: 'Save novels offline and pick up exactly where you left off, on any device.',
  },
];

const CARD_W = SCREEN_W - space.lg * 2;

const SignIn = ({ onSkip }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loading: googleLoading, session } = useGoogleAuth();
  const { signIn: appSignIn, skipSignIn, user, isAuthenticated } = useAuth();
  const { setIsSystemUiVisible } = useSystemUi();
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [slide, setSlide] = useState(0);
  const [skipping, setSkipping] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 6 }).start();
  }, [enter]);

  useEffect(() => {
    if (session?.user && !user) appSignIn(session.user);
  }, [session, user, appSignIn]);

  useEffect(() => {
    setIsSystemUiVisible(false);
    return () => setIsSystemUiVisible(true);
  }, [setIsSystemUiVisible]);

  const handleSuccessfulSignIn = useCallback(async () => {
    try {
      const { data: userHistory } = await supabase
        .from('user_activity')
        .select('first_login')
        .eq('user_id', user?.id)
        .single();

      if (!userHistory?.first_login) {
        setShowTokenModal(true);
        await supabase.from('user_activity').upsert({ user_id: user.id, first_login: new Date().toISOString() });
      } else {
        navigation.replace('Home');
      }
    } catch (error) {
      console.error('Error checking user history:', error);
      navigation.replace('Home');
    }
  }, [user, navigation]);

  useEffect(() => {
    if (isAuthenticated && user) handleSuccessfulSignIn();
  }, [isAuthenticated, user, handleSuccessfulSignIn]);

  const handleSkip = async () => {
    haptics.tap();
    setSkipping(true);
    try {
      await skipSignIn();
      onSkip?.();
    } catch (error) {
      console.error('Error skipping sign in:', error);
      toast.error('Could not continue as a guest. Please try again.');
      setSkipping(false);
    }
  };

  const busy = googleLoading || skipping || isAuthenticated;
  const rise = (from) => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
  });

  return (
    <BrandBackdrop>
      <View style={[styles.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
        <Animated.View style={[styles.top, rise(-12)]}>
          <BrandMark size={96} />
        </Animated.View>

        {/* what you get */}
        <Animated.View style={rise(18)}>
          <FlatList
            data={SLIDES}
            keyExtractor={(s) => s.title}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_W, paddingHorizontal: space.lg }}>
                <View style={[styles.card, { width: CARD_W, backgroundColor: colors.bgCard, borderColor: colors.borderStrong }]}>
                  <LinearGradient
                    colors={[`rgba(${colors.accentRgb},${isDark ? 0.18 : 0.10})`, 'rgba(0,0,0,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View pointerEvents="none">
                    <GelOrb icon={item.icon} size={52} lit breathe={false} />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{item.body}</Text>
                </View>
              </View>
            )}
          />
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {SLIDES.map((s, i) => (
              <View
                key={s.title}
                style={[styles.dot, { backgroundColor: colors.borderStrong }, i === slide && { width: 18, backgroundColor: colors.accent }]}
              />
            ))}
          </View>
        </Animated.View>

        {/* actions */}
        <Animated.View style={[styles.actions, rise(24)]}>
          {isAuthenticated ? (
            <View style={styles.signingIn}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.signingText, { color: colors.textSecondary }]}>Signing you in…</Text>
            </View>
          ) : (
            <>
              <GoogleSignInButton />
              <Pressable
                onPress={handleSkip}
                disabled={busy}
                style={({ pressed }) => [styles.guest, { borderColor: colors.borderStrong }, pressed && { opacity: 0.7 }, busy && { opacity: 0.5 }]}
                accessibilityRole="button"
                accessibilityLabel="Explore as a guest"
              >
                {skipping ? (
                  <ActivityIndicator color={colors.textPrimary} size="small" />
                ) : (
                  <Text style={[styles.guestText, { color: colors.textPrimary }]}>Explore as a guest</Text>
                )}
              </Pressable>
            </>
          )}
          <Text style={[styles.terms, { color: colors.textMuted }]}>
            By continuing you agree to our{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }} onPress={() => Linking.openURL('https://www.sempaihq.com/terms')}>
              Terms
            </Text>{' '}
            and{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }} onPress={() => Linking.openURL('https://www.sempaihq.com/privacy-policy')}>
              Privacy Policy
            </Text>
            .
          </Text>
        </Animated.View>
      </View>

      <TokenClaimModal visible={showTokenModal} onClose={() => setShowTokenModal(false)} />
    </BrandBackdrop>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  top: { alignItems: 'center' },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: space.xl,
    overflow: 'hidden',
    minHeight: 200,
  },
  cardTitle: { fontFamily: 'Yoruka', fontSize: 24, lineHeight: 29, marginTop: space.md },
  cardBody: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.md },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actions: { paddingHorizontal: space.lg, gap: space.md },
  guest: { height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  guestText: { fontSize: 16, fontWeight: '700' },
  signingIn: { height: 116, alignItems: 'center', justifyContent: 'center', gap: 10 },
  signingText: { fontSize: 15, fontWeight: '600' },
  terms: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});

export default SignIn;
