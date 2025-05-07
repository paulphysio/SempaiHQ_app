import 'react-native-get-random-values';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import {
  Platform
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { EmbeddedWalletProvider } from './components/ConnectButton';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
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
import MangaChapterScreen from './screens/MangaChapterScreen ';

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
  const navigationRef = useNavigationContainerRef();
  const notificationListener = useRef();
  const responseListener = useRef();
  const [walletAddress, setWalletAddress] = useState(null);

  useEffect(() => {
    const loadWalletAddress = async () => {
      const key = await AsyncStorage.getItem('walletAddress');
      if (key) setWalletAddress(key);
    };
    loadWalletAddress();
  }, []);

  useEffect(() => {
    const requestPermissions = async () => {
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
          console.warn('Notification permissions not granted');
          return;
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };

    requestPermissions();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
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

    if (walletAddress) {
      const subscription = supabase
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
            const { message, type, chat_id, novel_id, novel_title, sender_wallet_address } = payload.new;
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
              title = 'Novel Announcement';
              data.novelId = novel_id;
            }

            await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data,
              },
              trigger: null,
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [navigationRef, walletAddress]);

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

  return (
    <SafeAreaProvider>
      <EmbeddedWalletProvider>
        <SystemUiContext.Provider value={{ isSystemUiVisible, setIsSystemUiVisible }}>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
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
      </EmbeddedWalletProvider>
    </SafeAreaProvider>
  );
};

export default App;