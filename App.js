import './utils/fontScale';
import 'react-native-get-random-values';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { NavigationContainer, useNavigationContainerRef, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Platform, View, Text, StyleSheet, Easing, Pressable } from 'react-native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { EmbeddedWalletProvider } from './components/ConnectButtonEnhanced';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import { getActiveChat } from './services/activeChat';
import { getOpenBook } from './services/bookShelf';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Orientation from 'react-native-orientation-locker';
import { supabase } from './services/supabaseClient';
import { NavigationProvider, useNavigationHandler } from './context/NavigationContext';
import { NotificationEmitter } from './services/NotificationEmitter';
import HomeScreen from './screens/HomeScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import SignIn from './components/SignIn';
import { GoogleAuthProvider } from './components/GoogleAuthProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SystemUiContext } from './context/SystemUiContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import GlobalNavbar from './components/GlobalNavbar';
import GlobalBottomNav from './components/GlobalBottomNav';
import GlobalSidebar from './components/GlobalSidebar';

// Web: page addresses (old website links keep working). Phones don't use this.
const WEB_LINKS = Platform.OS === 'web' ? require('./web/linking') : null;
// Phones: shared links (app.sempaihq.com/novel/…, sempaihq://…) open the same screens as on the web.
// Android hands https links to the app once the APK has the intent filters (app.config.js) and
// app.sempaihq.com/.well-known/assetlinks.json verifies it.
const NATIVE_LINKING = Platform.OS === 'web' ? null : {
  prefixes: ['https://app.sempaihq.com', 'https://www.sempaihq.com', 'https://sempaihq.com', 'sempaihq://'],
  config: require('./web/linking').linking.config,
};
const WEB_DEEP_LINK_AT_START = !!(WEB_LINKS && WEB_LINKS.hasDeepLink());
import { ToastHost, toast } from './components/Toast';
import { GelAlertHost } from './components/gel/GelAlert';
import OfflineBanner from './components/OfflineBanner';
import { withScreenBoundary } from './components/ScreenBoundary';
import WalletSecurityGate from './components/wallet/WalletSecurityGate';

// Every screen gets its own crash guard (see components/ScreenBoundary).
const GuardedHome = withScreenBoundary(HomeScreen, 'Home');
const GuardedSignIn = withScreenBoundary(SignIn, 'SignIn');

// Full-screen experiences: no floating tab bar over the content.
const IMMERSIVE_ROUTES = new Set(['KaitoAdventure', 'Kaiji', 'Chapter', 'MangaChapter', 'Reader', 'BazaarReader', 'Chat', 'Browser']);
// Book readers bring their own slim bar; the app header would eat reading space.
const NO_NAVBAR_ROUTES = new Set(['Kaiji', 'Chapter', 'Reader', 'BazaarReader', 'Feed', 'Chat', 'Browser']);

// Keep the native splash up until fonts + auth are ready, instead of flashing
// a blank screen while the app boots.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Every screen except the first-paint ones is required on first visit. Loading
// all ~50 screens (plus the Solana / PDF / game code they pull in) up front
// was the bulk of JS startup time.
const LAZY_SCREENS = [
  ['EditProfile', () => require('./screens/EditProfileScreen').default],
  ['NovelDetail', () => require('./screens/NovelDetailScreen').default],
  ['MangaDetail', () => require('./screens/MangaDetailScreen').default],
  ['NovelsPage', () => require('./screens/NovelsPageScreen').default],
  ['Swap', () => require('./screens/SwapScreen').default],
  ['Stats', () => require('./screens/StatPageScreen').default],
  ['Chat', () => require('./screens/ChatScreen').default],
  ['KaitoAdventure', () => require('./screens/KaitoAdventureScreen').default],
  ['DAOGovernance', () => require('./screens/DAOGovernanceScreen').default],
  ['KeepItSimple', () => require('./screens/KeepItSimpleScreen').default],
  ['Apply', () => require('./screens/ApplyScreen').default],
  ['Chapter', () => require('./screens/ChapterScreen').default],
  ['NovelSummary', () => require('./screens/NovelSummaryScreen').default],
  ['NovelDashboard', () => require('./screens/NovelDashboardScreen').default],
  ['MangaDashboard', () => require('./screens/MangaDashboardScreen').default],
  ['CreatorDashboard', () => require('./screens/CreatorDashboardScreen').default],
  ['MangaPage', () => require('./screens/MangaPageScreen').default],
  ['CreatorsProfile', () => require('./screens/CreatorsProfileScreen').default],
  ['MangaChapter', () => require('./screens/MangaChapterScreen').default],
  ['Wallet', () => require('./screens/WalletScreen').default],
  ['Feed', () => require('./screens/FeedScreen').default],
  ['Crazy Corner', () => require('./screens/FeedScreen').default],
  ['FeedScreen', () => require('./screens/FeedScreen').default],
  ['Ramp', () => require('./screens/RampScreen').default],
  ['NotificationSettings', () => require('./screens/NotificationSettingsScreen').default],
  ['Browser', () => require('./screens/BrowserScreen').default],
  ['Marketplace', () => require('./screens/MarketplaceScreen').default],
  ['WalletImport', () => require('./screens/WalletImportScreen').default],
  ['Mint', () => require('./screens/MintScreen').default],
  ['Leaderboard', () => require('./screens/LeaderboardScreen').default],
  ['Admin', () => require('./screens/AdminScreen').default],
  ['Announcements', () => require('./screens/AnnouncementsScreen').default],
  ['PrivacyPolicy', () => require('./screens/PrivacyPolicyScreen').default],
  ['Terms', () => require('./screens/TermsScreen').default],
  ['Support', () => require('./screens/SupportScreen').default],
  ['Profile', () => require('./screens/ProfileScreen').default],
  ['Download', () => require('./screens/DownloadScreen').default],
  ['KaitoLeaderboard', () => require('./screens/KaitoLeaderboardScreen').default],
  ['AddGif', () => require('./screens/AddGifScreen').default],
  ['Badges', () => require('./screens/BadgesScreen').default],
  ['Kaiji', () => require('./screens/KaijiScreen').default],
  ['Inbox', () => require('./screens/InboxScreen').default],
  ['Reader', () => require('./screens/ReaderScreen').default],
  ['Bazaar', () => require('./screens/BazaarScreen').default],
  ['BazaarBook', () => require('./screens/BazaarBookScreen').default],
  ['BazaarReader', () => require('./screens/BazaarReaderScreen').default],
  ['UploadBook', () => require('./screens/UploadBookScreen').default],
  ['BazaarDashboard', () => require('./screens/BazaarDashboardScreen').default],
];

// Short, decelerating slide. The default Android transition (~350ms+) made
// every tap feel like it was waiting on something.
const FAST_TRANSITION = {
  animation: 'timing',
  config: { duration: 230, easing: Easing.bezier(0.2, 0, 0, 1) },
};

// Pushes that arrive while the app is open still show the system banner,
// play the sound and land in the status bar.
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    // Stay quiet about the chat you're already looking at.
    const d = n?.request?.content?.data || {};
    const open = getActiveChat();
    const quiet = !!open && ((d.type === 'dm' && d.userId === open) || (d.type === 'community' && open === 'group'));
    return {
      shouldShowAlert: !quiet,
      shouldShowBanner: !quiet,
      shouldShowList: !quiet,
      shouldPlaySound: !quiet,
      shouldSetBadge: false,
    };
  },
});

const Stack = createStackNavigator();

// Text colour/scale defaults live in utils/fontScale.js (theme-aware).

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <View style={shellStyles.errorWrap}>
          <Text style={shellStyles.errorTitle}>Something went wrong</Text>
          <Text style={shellStyles.errorBody} numberOfLines={4}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={this.reset}
            style={({ pressed }) => [shellStyles.errorBtn, pressed && shellStyles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={shellStyles.errorBtnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const shellStyles = StyleSheet.create({
  root: { flex: 1 },
  pressed: { opacity: 0.8 },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0B14', padding: 32 },
  errorTitle: { color: '#FFFFFF', fontSize: 20, marginBottom: 10, textAlign: 'center' },
  errorBody: { color: '#C9C9D1', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  errorBtn: { backgroundColor: '#F36316', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999 },
  errorBtnText: { color: '#FFFFFF', fontSize: 15 },
});

const MainApp = () => {
  const [isSystemUiVisible, setIsSystemUiVisible] = useState(false);
  const [isStatusBarHidden, setIsStatusBarHidden] = useState(true); // State for StatusBar visibility

  // Lock to portrait by default for all screens
  useEffect(() => {
    Orientation.lockToPortrait();
  }, []);

  return (
    <SafeAreaProvider>
      <SystemUiContext.Provider value={{ isSystemUiVisible, setIsSystemUiVisible }}>
        <ThemeProvider>
          <AuthProvider>
            <GoogleAuthProvider>
              <EmbeddedWalletProvider>
                <NavigationProvider>
                  <ErrorBoundary>
                    <AppContent setIsStatusBarHidden={setIsStatusBarHidden} />
                    <WalletSecurityGate />
                  </ErrorBoundary>
                </NavigationProvider>
              </EmbeddedWalletProvider>
            </GoogleAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </SystemUiContext.Provider>
      <StatusBar style="light" hidden={isStatusBarHidden} />
    </SafeAreaProvider>
  );
};

const AppContent = ({ setIsStatusBarHidden }) => {
  const { user, isLoading, skipSignIn } = useAuth();
  const { isDark, colors } = useTheme();
  // null = not decided yet (still reading the first-launch flag)
  const [showWelcome, setShowWelcome] = useState(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [authBooted, setAuthBooted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const navigationRef = useNavigationContainerRef();

  useNavigationHandler(() => {
    setShowWelcome(false);
  });

  // Latch: once auth has resolved the first time, later isLoading flips must
  // never unmount the navigator again (that reset the user back to Home).
  useEffect(() => {
    if (!isLoading) setAuthBooted(true);
  }, [isLoading]);

  // The animated intro is a first-launch moment only. Returning users go
  // straight to their content instead of sitting through ~3.4s on every open.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem('hasSeenWelcome')
      .then((seen) => { if (alive) setShowWelcome(seen !== 'true' && !WEB_DEEP_LINK_AT_START); })
      .catch(() => { if (alive) setShowWelcome(false); });
    return () => { alive = false; };
  }, []);

  const syncRoute = useCallback(() => {
    setCurrentRoute(navigationRef.getCurrentRoute()?.name ?? null);
  }, [navigationRef]);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Promise.race([
          Font.loadAsync({
            Yoruka: require('./assets/fonts/Yoruka-1j9rL.ttf'),
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Font load timeout')), 10000)),
        ]);
      } catch (error) {
        // Fall back to the system font silently — a blocking alert about a
        // font is noise the user can do nothing about.
        console.warn('Yoruka font failed to load, using system font:', error.message);
      } finally {
        setFontsLoaded(true);
      }
    };
    loadFonts();
  }, []);

  const ready = fontsLoaded && authBooted && showWelcome !== null;

  // Reopen the e-book that was open when the app was closed (like a dedicated e-reader).
  // Only on a normal launch: not when opened from a notification or a link, and only once.
  const reopenedBook = useRef(false);
  useEffect(() => {
    if (reopenedBook.current || !ready || !user || showWelcome || WEB_DEEP_LINK_AT_START) return;
    reopenedBook.current = true;
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync().catch(() => null);
        const fromPush = last?.notification?.date && Date.now() - last.notification.date < 15000;
        if (fromPush) return;
        const book = await getOpenBook();
        if (!book || Date.now() - (book.at || 0) > 30 * 86400000) return;
        const go = () => {
          if (!navigationRef.isReady()) return false;
          const { at, ...params } = book;
          navigationRef.navigate('BazaarReader', params);
          return true;
        };
        if (!go()) setTimeout(go, 600);
      } catch { /* just start normally */ }
    })();
  }, [ready, user, showWelcome, navigationRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Web: someone opening a shared link (e.g. /novel/123) goes straight to it as
  // a guest — no intro, no sign-in wall. Signing in stays one tap away.
  const [pendingWebPath, setPendingWebPath] = useState(() =>
    WEB_DEEP_LINK_AT_START ? WEB_LINKS.initialWebPath : null);
  useEffect(() => {
    if (!WEB_LINKS || !pendingWebPath || !authBooted || user) return;
    setShowWelcome(false);
    AsyncStorage.setItem('hasSeenWelcome', 'true').catch(() => {});
    skipSignIn?.();
  }, [pendingWebPath, authBooted, user, skipSignIn]);
  useEffect(() => {
    if (!WEB_LINKS || !pendingWebPath || !user || showWelcome) return;
    const t = setTimeout(() => {
      if (!navigationRef.isReady()) return;
      const state = WEB_LINKS.stateForPath(pendingWebPath);
      if (state) navigationRef.resetRoot(state);
      setPendingWebPath(null);
    }, 0);
    return () => clearTimeout(t);
  }, [pendingWebPath, user, showWelcome, navigationRef]);
  useEffect(() => {
    if (ready) global.__SEMPAI_APP_READY = true;
  }, [ready]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.textPrimary },
    };
  }, [isDark, colors]);

  const screenOptions = useMemo(() => ({
    headerShown: false,
    cardStyle: { backgroundColor: colors.bg },
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
    transitionSpec: { open: FAST_TRANSITION, close: FAST_TRANSITION },
    cardOverlayEnabled: false,
    cardShadowEnabled: false,
    // Screens underneath the focused one stop re-rendering while hidden.
    freezeOnBlur: true,
  }), [colors.bg]);

  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // ── Push notifications ─────────────────────────────────────────────────
  // 1) Android channel: MAX importance = heads-up banner + sound + vibration
  //    + status-bar icon. ("reading-updates" is what the server targets; the
  //    "default" channel is set up the same way as a fallback.)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const channel = {
      importance: Notifications.AndroidImportance.MAX,
      sound: 'notification_sound.mp3',
      vibrationPattern: [0, 250, 150, 250],
      enableVibrate: true,
      lightColor: '#F36316',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    };
    Notifications.setNotificationChannelAsync('reading-updates', {
      ...channel,
      name: 'Reading updates',
      description: 'New chapters, new titles and announcements from creators you read',
    }).catch((e) => console.warn('[App] channel setup:', e?.message));
    Notifications.setNotificationChannelAsync('default', { ...channel, name: 'General' })
      .catch((e) => console.warn('[App] default channel setup:', e?.message));
  }, []);

  // 2) Register this device's push token for whoever is signed in — runs on
  //    sign-in too (it used to run only at launch, so signing in later meant
  //    never receiving pushes), and again if the device token rotates.
  useEffect(() => {
    // Web: no push yet (would also pop a browser permission prompt on open).
    if (Platform.OS === 'web' || !user || user.isGuest) return undefined;
    let alive = true;
    let waitSub = null;
    const register = async () => {
      try {
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
        if (status !== 'granted' || !alive) return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!token || !alive) return;

        // Saving needs a live sign-in. On launch the session may still be
        // refreshing — then save as soon as Supabase reports it signed in.
        const save = async (session) => {
          const { error } = await supabase.from('users').update({ push_token: token }).eq('id', session.user.id);
          if (error) console.warn('[App] saving push token:', error.message);
        };
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) return save(session);
        const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
          if (!alive || !s?.user || (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED')) return;
          sub?.subscription?.unsubscribe();
          save(s);
        });
        waitSub = sub;
      } catch (e) {
        console.warn('[App] push registration:', e?.message || e);
      }
    };
    register();
    const tokenSub = Notifications.addPushTokenListener(() => register());
    return () => {
      alive = false;
      waitSub?.subscription?.unsubscribe();
      tokenSub.remove();
    };
  }, [user?.id]);

  // 3) Foreground arrivals refresh the unread badge (the system shows the
  //    banner itself — see setNotificationHandler), and tapping a
  //    notification opens what it is about — including when it launched the app.
  useEffect(() => {
    const openFromNotification = (response) => {
      const data = response?.notification?.request?.content?.data || {};
      const go = () => {
        if (!navigationRef.isReady()) return false;
        try {
          if (data.type === 'kaiji_challenge' && data.challengeId) navigationRef.navigate('Kaiji', { challengeId: data.challengeId });
          else if (data.type === 'kaiji_tourney' && data.tourneyId) navigationRef.navigate('Kaiji', { tourneyId: data.tourneyId });
          else if (data.type === 'kaiji') navigationRef.navigate('Kaiji');
          else if (data.type === 'dm' && data.userId) navigationRef.navigate('Chat', { userId: data.userId });
          else if (data.type === 'community') navigationRef.navigate('Chat', { chatId: 'group' });
          else if (data.type === 'feed_post' && data.postId) navigationRef.navigate('Feed', { postId: data.postId });
          else if (data.type === 'profile' && data.userId) navigationRef.navigate('Profile', { userId: data.userId });
          else if (data.type === 'bazaar_book' && data.bookId) navigationRef.navigate('BazaarBook', { bookId: data.bookId });
          else if (data.mangaId) navigationRef.navigate('MangaDetail', { id: data.mangaId });
          else if (data.novelId) navigationRef.navigate('NovelDetail', { id: data.novelId });
          else return true;
          return true;
        } catch (e) {
          console.warn('[App] open from notification:', e?.message);
          return true;
        }
      };
      // The navigator may still be mounting on a cold start.
      if (!go()) {
        let tries = 0;
        const t = setInterval(() => {
          tries += 1;
          if (go() || tries > 20) clearInterval(t);
        }, 250);
      }
    };

    Notifications.getLastNotificationResponseAsync()
      .then((r) => { if (r) openFromNotification(r); })
      .catch(() => {});
    const responseSub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    const receivedSub = Notifications.addNotificationReceivedListener(() => NotificationEmitter.emit());
    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, [navigationRef]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const initializeSystemUi = async () => {
        try {
          await NavigationBar.setBehaviorAsync('overlay-swipe');
          await NavigationBar.setVisibilityAsync('hidden');
          setIsStatusBarHidden(true); // Hide StatusBar
        } catch (error) {
          console.error('System UI initialization error:', error);
        }
      };
      initializeSystemUi();

      return () => {
        const cleanupSystemUi = async () => {
          try {
            await NavigationBar.setVisibilityAsync('visible');
            try {
              await NavigationBar.setBehaviorAsync('inset-touch'); // 'overlay' is not a valid behavior
            } catch (behaviorError) {
              console.warn('System UI behavior cleanup warning:', behaviorError);
            }
            setIsStatusBarHidden(false); // Show StatusBar
          } catch (error) {
            console.error('System UI cleanup error:', error);
          }
        };
        cleanupSystemUi();
      };
    }
  }, [setIsStatusBarHidden]);

  if (!ready) {
    return null; // the native splash is still covering the screen
  }

  // Global chrome belongs to the signed-in app only — not the intro or sign-in.
  const inApp = !showWelcome && !!user;
  // The chapter reader has its own bar; the app header would just eat reading space.
  const showNavbar = inApp && !NO_NAVBAR_ROUTES.has(currentRoute);
  // Readers are immersive: the tab bar would sit over the page being read.
  const showBottomNav = inApp && !IMMERSIVE_ROUTES.has(currentRoute);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={syncRoute}
      onStateChange={syncRoute}
      linking={WEB_LINKS ? WEB_LINKS.linking : NATIVE_LINKING}
      documentTitle={{ formatter: (options, route) => (route?.name && route.name !== 'Home' ? `${options?.title || route.name} · SempaiHQ` : 'SempaiHQ — Read, earn, own') }}
    >
      <View style={[shellStyles.root, { backgroundColor: colors.bg }]}>
        {showNavbar && <GlobalNavbar />}
        <Stack.Navigator screenOptions={screenOptions}>
          {showWelcome ? (
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
          ) : !user ? (
            <Stack.Screen name="SignIn" component={GuardedSignIn} />
          ) : (
            <>
              <Stack.Screen name="Home" component={GuardedHome} />
              {LAZY_SCREENS.map(([name, getComponent]) => (
                <Stack.Screen key={name} name={name} getComponent={() => withScreenBoundary(getComponent(), name)} />
              ))}
            </>
          )}
        </Stack.Navigator>
        {showBottomNav && (
          <GlobalBottomNav onMenuToggle={toggleSidebar} menuOpen={sidebarOpen} />
        )}
        {inApp && <GlobalSidebar isVisible={sidebarOpen} onClose={closeSidebar} />}
        {inApp ? (
          <OfflineBanner
            topOffset={showNavbar ? 64 : 10}
            onOpenSaved={() => navigationRef.isReady() && navigationRef.navigate('Home')}
          />
        ) : null}
        <ToastHost />
        <GelAlertHost />
      </View>
    </NavigationContainer>
  );
};

export default MainApp;
