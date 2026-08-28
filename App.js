import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { NavigationContainer, useNavigationContainerRef, useRoute } from '@react-navigation/native';
import { Platform, Alert, View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { EmbeddedWalletProvider } from './components/ConnectButtonEnhanced';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import * as Font from 'expo-font';
import Orientation from 'react-native-orientation-locker';
import { supabase } from './services/supabaseClient';
import { NavigationProvider, useNavigationHandler } from './context/NavigationContext';
import HomeScreen from './screens/HomeScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import NovelDetailScreen from './screens/NovelDetailScreen';
import MangaDetailScreen from './screens/MangaDetailScreen';
import NovelsPageScreen from './screens/NovelsPageScreen';
import SwapScreen from './screens/SwapScreen';
import StatPageScreen from './screens/StatPageScreen';
import ChatScreen from './screens/ChatScreen';
import KaitoAdventureScreen from './screens/KaitoAdventureScreen';
import DAOGovernanceScreen from './screens/DAOGovernanceScreen';
import KeepItSimpleScreen from './screens/KeepItSimpleScreen';
import WalletImportScreen from './screens/WalletImportScreen';
import ApplyScreen from './screens/ApplyScreen';
import ChapterScreen from './screens/ChapterScreen';
import NovelSummaryScreen from './screens/NovelSummaryScreen';
import NovelDashboardScreen from './screens/NovelDashboardScreen';
import MangaDashboardScreen from './screens/MangaDashboardScreen';
import MangaPageScreen from './screens/MangaPageScreen';
import CreatorsProfileScreen from './screens/CreatorsProfileScreen';
import MangaChapterScreen from './screens/MangaChapterScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import SignIn from './components/SignIn';
import { GoogleAuthProvider } from './components/GoogleAuthProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SystemUiContext } from './context/SystemUiContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import WalletScreen from './screens/WalletScreen';
import GlobalNavbar from './components/GlobalNavbar';
import GlobalBottomNav from './components/GlobalBottomNav';
import GlobalSidebar from './components/GlobalSidebar';
import NavigationLoadingOverlay from './components/NavigationLoadingOverlay';
import FeedScreen from './screens/FeedScreen';
import RampScreen from './screens/RampScreen';
import MarketplaceScreen from './screens/MarketplaceScreen';
import WalletMigrationScreen from './screens/WalletMigrationScreen';
import MintScreen from './screens/MintScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import AdminScreen from './screens/AdminScreen';
import AnnouncementsScreen from './screens/AnnouncementsScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import TermsScreen from './screens/TermsScreen';
import SupportScreen from './screens/SupportScreen';
import ProfileScreen from './screens/ProfileScreen';
import DownloadScreen from './screens/DownloadScreen';
import KaitoLeaderboardScreen from './screens/KaitoLeaderboardScreen';
import AddGifScreen from './screens/AddGifScreen';
import BadgesScreen from './screens/BadgesScreen';
import CreatorDashboardScreen from './screens/CreatorDashboardScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createStackNavigator();

// Create global text styles
const globalTextStyles = StyleSheet.create({
  default: {
    fontFamily: 'Yoruka',
    color: '#FFFFFF',
  },
  title: {
    fontFamily: 'Yoruka',
    fontSize: 24,
    color: '#FFFFFF',
  },
  subtitle: {
    fontFamily: 'Yoruka',
    fontSize: 18,
    color: '#CCCCCC',
  }
});

// Apply to all Text components
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = globalTextStyles.default;

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A18' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18 }}>
            Something went wrong: {this.state.error?.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

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
  const { user, isLoading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationRef = useNavigationContainerRef();

  useNavigationHandler(() => {
    setShowWelcome(false);
  });

  // Track current route to hide bottom nav on KaitoAdventure
  useEffect(() => {
    const unsubscribe = navigationRef?.addListener('state', (e) => {
      const route = e.data.state?.routes[e.data.state.index];
      setCurrentRoute(route?.name);
      setIsNavigating(false);
    });
    return unsubscribe;
  }, [navigationRef]);

  // Add navigation listener for loading state
  useEffect(() => {
    const unsubscribe = navigationRef?.addListener('beforeRemove', () => {
      setIsNavigating(true);
    });
    return unsubscribe;
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
        setFontsLoaded(true);
        console.log('Yoruka font loaded successfully');
      } catch (error) {
        console.error('Error loading Yoruka font:', error.message);
        Alert.alert(
          'Font Error',
          'Failed to load Yoruka font. Using system font as fallback.',
          [{ text: 'OK' }]
        );
        setFontsLoaded(true); // Proceed even if font fails
      }
    };
    loadFonts();
  }, []);

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
              await NavigationBar.setBehaviorAsync('overlay');
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

  if (!fontsLoaded || isLoading) {
    return null; // Render nothing until fonts and auth are loaded
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <View style={{ flex: 1, backgroundColor: '#0A0A18' }}>
        <GlobalNavbar />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#0A0A18' },
          }}
        >
        {showWelcome ? (
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{
              cardStyle: {
                backgroundColor: '#0A0A18',
              },
            }}
          />
        ) : !user ? (
          <Stack.Screen
            name="SignIn"
            component={SignIn}
            options={{
              cardStyle: {
                backgroundColor: '#0A0A18',
              },
            }}
          />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="NovelDetail" component={NovelDetailScreen} />
            <Stack.Screen name="MangaDetail" component={MangaDetailScreen} />
            <Stack.Screen name="NovelsPage" component={NovelsPageScreen} />
            <Stack.Screen name="Swap" component={SwapScreen} />
            <Stack.Screen name="Stats" component={StatPageScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="KaitoAdventure" component={KaitoAdventureScreen} />
            <Stack.Screen name="DAOGovernance" component={DAOGovernanceScreen} />
            <Stack.Screen name="KeepItSimple" component={KeepItSimpleScreen} />
            <Stack.Screen name="Apply" component={ApplyScreen} />
            <Stack.Screen name="Chapter" component={ChapterScreen} />
            <Stack.Screen name="NovelSummary" component={NovelSummaryScreen} />
            <Stack.Screen name="NovelDashboard" component={NovelDashboardScreen} />
            <Stack.Screen name="MangaDashboard" component={MangaDashboardScreen} />
            <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} />
            <Stack.Screen name="MangaPage" component={MangaPageScreen} />
            <Stack.Screen name="CreatorsProfile" component={CreatorsProfileScreen} />
            <Stack.Screen name="MangaChapter" component={MangaChapterScreen} />
            <Stack.Screen name="Wallet" component={WalletScreen} />
            <Stack.Screen name="Feed" component={FeedScreen} />
            <Stack.Screen name="Crazy Corner" component={FeedScreen} />
            <Stack.Screen name="FeedScreen" component={FeedScreen} />
            <Stack.Screen name="Ramp" component={RampScreen} />
            <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
            <Stack.Screen name="WalletMigration" component={WalletMigrationScreen} />
            <Stack.Screen name="WalletImport" component={WalletImportScreen} />
            <Stack.Screen name="Mint" component={MintScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
            <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Download" component={DownloadScreen} />
            <Stack.Screen name="KaitoLeaderboard" component={KaitoLeaderboardScreen} />
            <Stack.Screen name="AddGif" component={AddGifScreen} />
            <Stack.Screen name="Badges" component={BadgesScreen} />
          </>
        )}
      </Stack.Navigator>
        {currentRoute !== 'KaitoAdventure' && (
          <GlobalBottomNav 
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            menuOpen={sidebarOpen}
          />
        )}
        <GlobalSidebar 
          isVisible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <NavigationLoadingOverlay visible={isNavigating} />
      </View>
    </NavigationContainer>
  );
};

export default MainApp;
