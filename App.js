import 'react-native-get-random-values';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { EmbeddedWalletProvider } from './components/ConnectButton';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
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
  const navigationRef = useNavigationContainerRef(); // Use navigation ref for programmatic navigation
  const notificationListener = useRef();
  const responseListener = useRef();

  // Request notification permissions and set up listeners
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

    // Handle foreground notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Handle notification interactions (e.g., tapping)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      const { novelId, mangaId, type } = response.notification.request.content.data || {};
      if (novelId && (type === 'new_novel' || type === 'new_chapter' || type === 'announcement')) {
        navigationRef.current?.navigate('Novel', { novelId });
      } else if (mangaId && (type === 'new_manga' || type === 'new_chapter' || type === 'announcement')) {
        navigationRef.current?.navigate('Manga', { mangaId });
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [navigationRef]);

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

  // Initialize and cleanup Android navigation bar
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
    }

    return () => {
      if (Platform.OS === 'android') {
        const cleanupNavigationBar = async () => {
          try {
            await NavigationBar.setVisibilityAsync('visible');
            await NavigationBar.setBackgroundColorAsync('#000000');
          } catch (error) {
            console.error('NavigationBar cleanup error:', error);
          }
        };
        cleanupNavigationBar();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <EmbeddedWalletProvider>
        <SystemUiContext.Provider value={{ isSystemUiVisible, setIsSystemUiVisible }}>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
              initialRouteName="Home"
              screenOptions={{ headerShown: false }}
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