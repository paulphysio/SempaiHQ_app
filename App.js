// App.js
import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { Platform, Alert, View, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { EmbeddedWalletProvider } from './components/ConnectButton';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import * as Font from 'expo-font';
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
import WalletScreen from './screens/WalletScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createStackNavigator();

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

  return (
    <SafeAreaProvider>
      <SystemUiContext.Provider value={{ isSystemUiVisible, setIsSystemUiVisible }}>
        <AuthProvider>
          <GoogleAuthProvider>
            <EmbeddedWalletProvider>
              <NavigationProvider>
                <ErrorBoundary>
                  <AppContent />
                </ErrorBoundary>
              </NavigationProvider>
            </EmbeddedWalletProvider>
          </GoogleAuthProvider>
        </AuthProvider>
      </SystemUiContext.Provider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
};

const AppContent = () => {
  const { user, isLoading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const navigationRef = useNavigationContainerRef();

  useNavigationHandler(() => {
    setShowWelcome(false);
  });

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
        setFontsLoaded(true);
      }
    };
    loadFonts();
  }, []);

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

  if (!fontsLoaded || isLoading) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#0A0A18' },
        }}
      >
        {showWelcome ? (
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        ) : !user ? (
          <Stack.Screen name="SignIn" component={SignIn} />
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
            <Stack.Screen name="WalletImport" component={WalletImportScreen} />
            <Stack.Screen name="Apply" component={ApplyScreen} />
            <Stack.Screen name="Chapter" component={ChapterScreen} />
            <Stack.Screen name="NovelSummary" component={NovelSummaryScreen} />
            <Stack.Screen name="NovelDashboard" component={NovelDashboardScreen} />
            <Stack.Screen name="MangaDashboard" component={MangaDashboardScreen} />
            <Stack.Screen name="MangaPage" component={MangaPageScreen} />
            <Stack.Screen name="CreatorsProfile" component={CreatorsProfileScreen} />
            <Stack.Screen name="MangaChapter" component={MangaChapterScreen} />
            <Stack.Screen name="Wallet" component={WalletScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default MainApp;