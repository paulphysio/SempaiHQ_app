import 'react-native-get-random-values';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { Platform, Alert, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { EmbeddedWalletProvider } from './components/ConnectButton';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import * as Network from 'expo-network';
import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './services/supabaseClient';
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
import { GoogleAuthProvider } from './components/GoogleAuthProvider';
import GoogleSignInTest from './components/GoogleSignInTest';
import SignIn from './components/SignIn';
import { AuthProvider, useAuth } from './context/AuthContext';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createStackNavigator();

// Create a context for system UI visibility
const SystemUiContext = createContext();

export const useSystemUi = () => useContext(SystemUiContext);

// AppContent component uses the Auth context
const AppContent = () => {
  const { user, isLoading, skipSignIn } = useAuth();
  const [isSystemUiVisible, setIsSystemUiVisible] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true); // Always show welcome screen initially
  const [walletAddress, setWalletAddress] = useState(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const navigationRef = useNavigationContainerRef();
  const notificationListener = useRef();
  const responseListener = useRef();
  const subscriptionRef = useRef(null);
  const retryCountRef = useRef(0);

  // All the useEffects from the original App component
  // Load AnimeAce font with improved error handling
  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Promise.race([
          Font.loadAsync({
            AnimeAce: require('./assets/fonts/animeace.ttf'),
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Font load timeout')), 10000)),
        ]);
        setFontsLoaded(true);
        console.log('AnimeAce font loaded successfully');
      } catch (error) {
        console.error('Error loading AnimeAce font:', error.message);
        Alert.alert(
          'Font Error',
          'Failed to load AnimeAce font. Using system font as fallback.',
          [{ text: 'OK' }]
        );
        setFontsLoaded(true); // Proceed with fallback
      }
    };
    loadFonts();
  }, []);

  // Always set the welcome screen to show
  useEffect(() => {
    // Always show welcome screen initially
    console.log('Welcome screen will be shown');
  }, []);
  
  // Make sure navigation bar is hidden for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const initializeNavigationBar = async () => {
        try {
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBackgroundColorAsync('transparent');
        } catch (error) {
          console.error('NavigationBar initialization error:', error);
        }
      };
      initializeNavigationBar();

      return () => {
        const cleanupNavigationBar = async () => {
          try {
            await NavigationBar.setVisibilityAsync('visible');
            await NavigationBar.setBackgroundColorAsync('#000000');
          } catch (error) {
            console.error('NavigationBar cleanup error:', error);
          }
        };
        cleanupNavigationBar();
      };
    }
  }, []);

  // Skip functionality is now handled directly in the component
  
  // Wait for fonts to load
  if (!fontsLoaded) {
    return null;
  }

  // Always show welcome screen first
  if (showWelcome) {
    return <WelcomeScreen onComplete={() => setShowWelcome(false)} />;
  }
  
  // After welcome screen, show sign-in screen only if not authenticated
  if (!user) {
    return (
      <SystemUiContext.Provider value={{ isSystemUiVisible, setIsSystemUiVisible }}>
        <SignIn onSkip={() => {
          // When user skips, update the auth context to bypass sign-in
          skipSignIn();
          // Force a re-render to take the user to the main app
          console.log('User skipped sign-in, proceeding to main app');
        }} />
      </SystemUiContext.Provider>
    );
  }
  
  // If user is authenticated or has skipped, show the main app
  return (
    <SystemUiContext.Provider value={{ isSystemUiVisible, setIsSystemUiVisible }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="GoogleSignIn" component={GoogleSignInTest} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Novel" component={NovelDetailScreen} />
          <Stack.Screen name="Manga" component={MangaPageScreen} />
          <Stack.Screen name="Novels" component={NovelsPageScreen} />
          <Stack.Screen name="Swap" component={SwapScreen} />
          <Stack.Screen name="StatPage" component={StatPageScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="KaitoAdventure" component={KaitoAdventureScreen} />
          <Stack.Screen name="DAOGovernance" component={DAOGovernanceScreen} />
          <Stack.Screen name="KeepItSimple" component={KeepItSimpleScreen} />
          <Stack.Screen name="WalletImport" component={WalletImportScreen} />
          <Stack.Screen name="Apply" component={ApplyScreen} />
          <Stack.Screen name="Chapter" component={ChapterScreen} />
          <Stack.Screen name="MangaChapter" component={MangaChapterScreen} />
          <Stack.Screen name="NovelSummary" component={NovelSummaryScreen} />
          <Stack.Screen name="NovelDashboard" component={NovelDashboardScreen} />
          <Stack.Screen name="MangaDashboard" component={MangaDashboardScreen} />
          <Stack.Screen name="MangaDetail" component={MangaDetailScreen} />
          <Stack.Screen name="CreatorsProfile" component={CreatorsProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar
        hidden={!isSystemUiVisible}
        backgroundColor={isSystemUiVisible ? '#000000' : 'transparent'}
        translucent={!isSystemUiVisible}
      />
    </SystemUiContext.Provider>
  );
};

// Main App component that provides all the contexts
const MainApp = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <EmbeddedWalletProvider>
          <GoogleAuthProvider>
            <AppContent />
          </GoogleAuthProvider>
        </EmbeddedWalletProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default MainApp;