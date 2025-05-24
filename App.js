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

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createStackNavigator();

const SystemUiContext = createContext();

export const useSystemUi = () => useContext(SystemUiContext);

const App = () => {
  const [isSystemUiVisible, setIsSystemUiVisible] = useState(false);
  const [showWelcome, setShowWelcome] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const navigationRef = useNavigationContainerRef();
  const notificationListener = useRef();
  const responseListener = useRef();
  const subscriptionRef = useRef(null);
  const retryCountRef = useRef(0);

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

  // Check if welcome screen should be shown and prompt for notifications
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem('hasSeenWelcome');
        setShowWelcome(hasSeenWelcome !== 'true');
        if (hasSeenWelcome !== 'true') {
          Alert.alert(
            'Enable Notifications',
            'Would you like to receive notifications for new novels, chapters, and messages?',
            [
              {
                text: 'Not Now',
                style: 'cancel',
                onPress: () => console.log('User declined notifications'),
              },
              {
                text: 'Allow',
                onPress: async () => {
                  await requestNotificationPermissions();
                },
              },
            ],
            { cancelable: false }
          );
        } else {
          await requestNotificationPermissions();
        }
      } catch (error) {
        console.error('Error checking welcome state:', error);
        setShowWelcome(false);
      }
    };
    checkFirstLaunch();
  }, []);

  // Load wallet address
  useEffect(() => {
    const loadWalletAddress = async () => {
      try {
        const key = await AsyncStorage.getItem('walletAddress');
        if (key) {
          setWalletAddress(key);
          console.log('Wallet address loaded successfully:', key);
        } else {
          console.warn('No wallet address found in AsyncStorage');
        }
      } catch (error) {
        console.error('Error loading wallet address:', error);
      }
    };
    loadWalletAddress();
  }, []);

  // Request notification permissions and set up default sound
  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      let finalStatus = status;
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowSound: true,
            allowBadge: false,
          },
        });
        finalStatus = newStatus;
      }
      if (finalStatus !== 'granted') {
        console.warn('Notification permissions not granted:', finalStatus);
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device settings to receive updates.',
          [{ text: 'OK' }]
        );
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: true,
        });
        console.log('Android notification channel set with default sound');
      }
      console.log('Notification permission status:', finalStatus);
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  // Function to schedule a notification with default sound
  const scheduleNotification = async ({ message, type, chat_id, novel_id, novel_title, sender_wallet_address, created_at }) => {
    try {
      let title = '';
      let body = message;
      let data = { type };

      if (type === 'private_message') {
        title = 'New Private Message';
        data.chat_id = chat_id;
        data.recipient_wallet_address = walletAddress;
      } else if (type === 'group_reply') {
        title = 'Group Chat Reply';
        data.chat_id = chat_id;
      } else if (type === 'new_novel') {
        title = 'New Novel Published';
        data.novelId = novel_id;
      } else if (type === 'new_chapter') {
        title = `New Chapter for ${novel_title || 'Novel'}`;
        data.novelId = novel_id;
      } else if (type === 'announcement') {
        title = 'New Announcement';
        data.novelId = novel_id;
      }

      const notificationContent = {
        title,
        body,
        data,
        sound: Platform.OS === 'ios' ? 'default' : true,
      };

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null,
      });
      if (created_at) {
        await AsyncStorage.setItem('lastNotificationTime', created_at);
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  // Function to fetch and display missed notifications
  const fetchMissedNotifications = async () => {
    if (!walletAddress) {
      console.log('No walletAddress, skipping missed notifications check');
      return;
    }

    try {
      const lastNotificationTime = await AsyncStorage.getItem('lastNotificationTime');
      const query = supabase
        .from('notifications')
        .select('*')
        .eq('recipient_wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (lastNotificationTime) {
        query.gt('created_at', lastNotificationTime);
      }

      const { data: notifications, error } = await query;

      if (error) {
        console.error('Error fetching missed notifications:', error);
        return;
      }

      if (notifications && notifications.length > 0) {
        for (const notification of notifications) {
          await scheduleNotification(notification);
        }
      } else {
        console.log('No missed notifications found');
      }
    } catch (error) {
      console.error('Error in fetchMissedNotifications:', error);
    }
  };

  // Set up Supabase real-time subscription, notification listeners, and network monitoring
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const { novelId, mangaId, type, chat_id, recipient_wallet_address } = response.notification.request.content.data || {};
      if (novelId && ['new_novel', 'new_chapter', 'announcement'].includes(type)) {
        navigationRef.current?.navigate('Novel', { id: novelId });
      } else if (mangaId && ['new_manga', 'new_chapter', 'announcement'].includes(type)) {
        navigationRef.current?.navigate('Manga', { id: mangaId });
      } else if (['private_message', 'group_reply'].includes(type) && chat_id) {
        const chatId = type === 'private_message' ? recipient_wallet_address : 'group';
        navigationRef.current?.navigate('Chapter', { chatId, messageId: chat_id });
      }
    });

    const setupSubscription = () => {
      if (!walletAddress) return;

      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }

      subscriptionRef.current = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_wallet_address=eq.${walletAddress}`,
          },
          async (payload) => {
            const { message, type, chat_id, novel_id, novel_title, sender_wallet_address, created_at } = payload.new;
            await scheduleNotification({ message, type, chat_id, novel_id, novel_title, sender_wallet_address, created_at });
          }
        )
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            retryCountRef.current = 0;
            fetchMissedNotifications();
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            const maxRetries = 5;
            if (retryCountRef.current < maxRetries) {
              const delay = 5000 * Math.pow(2, retryCountRef.current);
              setTimeout(() => {
                retryCountRef.current++;
                setupSubscription();
              }, delay);
            }
          }
        });
    };

    setupSubscription();

    let isConnected = true;
    const checkNetwork = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const wasConnected = isConnected;
        isConnected = networkState.isConnected && networkState.isInternetReachable;
        if (isConnected && !wasConnected) {
          fetchMissedNotifications();
          setupSubscription();
        }
      } catch (error) {
        console.error('Error checking network state:', error);
      }
    };

    const networkInterval = setInterval(checkNetwork, 10000);
    fetchMissedNotifications();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      clearInterval(networkInterval);
    };
  }, [walletAddress, navigationRef]);

  // Handle Android navigation bar visibility
  useEffect(() => {
    if (Platform.OS === 'android') {
      const updateNavigationBar = async () => {
        try {
          await NavigationBar.setVisibilityAsync(isSystemUiVisible ? 'visible' : 'hidden');
          await NavigationBar.setBackgroundColorAsync(isSystemUiVisible ? '#000000' : 'transparent');
        } catch (error) {
          console.error('NavigationBar error:', error);
        }
      };
      updateNavigationBar();
    }
  }, [isSystemUiVisible]);

  // Initialize Android navigation bar
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

  // Wait for fonts and welcome state to load
  if (!fontsLoaded || showWelcome === null) {
    return null;
  }

  if (showWelcome) {
    return <WelcomeScreen onComplete={() => setShowWelcome(false)} />;
  }

  return (
    <SafeAreaProvider>
      <EmbeddedWalletProvider>
        <GoogleAuthProvider>
        <SystemUiContext.Provider value={{ isSystemUiVisible, setIsSystemUiVisible }}>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
              initialRouteName="Home"
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="Home" component={HomeScreen} />
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
        </GoogleAuthProvider>
      </EmbeddedWalletProvider>
    </SafeAreaProvider>
  );
};

export default App;