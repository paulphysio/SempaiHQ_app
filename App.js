// App.js
import 'react-native-get-random-values';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { EmbeddedWalletProvider } from './components/ConnectButton';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import HomeScreen from './screens/HomeScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import NovelDetailScreen from './screens/NovelDetailScreen';
import MangaDetailScreen from './screens/MangaDetailScreen';
import WritersProfileScreen from './screens/WritersProfileScreen';
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

const Stack = createStackNavigator();

const SystemUiContext = createContext();

export const useSystemUi = () => useContext(SystemUiContext);

const App = () => {
  const [isSystemUiVisible, setIsSystemUiVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setVisibilityAsync(isSystemUiVisible ? 'visible' : 'hidden');
        NavigationBar.setBackgroundColorAsync(isSystemUiVisible ? '#000000' : 'transparent');
      } catch (error) {
        console.error('NavigationBar error:', error);
      }
    }
  }, [isSystemUiVisible]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setVisibilityAsync('hidden');
        NavigationBar.setBackgroundColorAsync('transparent');
      } catch (error) {
        console.error('NavigationBar initialization error:', error);
      }
    }
    return () => {
      if (Platform.OS === 'android') {
        try {
          NavigationBar.setVisibilityAsync('visible');
          NavigationBar.setBackgroundColorAsync('#000000');
        } catch (error) {
          console.error('NavigationBar cleanup error:', error);
        }
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <EmbeddedWalletProvider>
        <SystemUiContext.Provider value={{ isSystemUiVisible, setIsSystemUiVisible }}>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Home"
              screenOptions={{ headerShown: false }}
            >
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="Novel" component={NovelDetailScreen} />
              <Stack.Screen name="Manga" component={MangaDetailScreen} />
              <Stack.Screen name="WritersProfile" component={WritersProfileScreen} />
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