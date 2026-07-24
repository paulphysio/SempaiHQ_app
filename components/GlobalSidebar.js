import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Alert, Clipboard, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useGoogleAuth } from './GoogleAuthProvider';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import GlobalSidebarStyles from '../styles/GlobalSidebarStyles';

const GlobalSidebar = ({ isVisible, onClose }) => {
  const navigation = useNavigation();
  const { session } = useGoogleAuth();
  const walletContext = useContext(EmbeddedWalletContext);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  const wallet = walletContext?.wallet;
  const disconnectWallet = walletContext?.disconnectWallet;
  const setShowModal = walletContext?.setShowModal;
  const isLoading = walletContext?.isLoading;

  // Pulse animation for wallet button
  React.useEffect(() => {
    if (wallet) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [wallet]);

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : 280,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  const navGroups = [
    {
      title: wallet ? wallet.publicKey.toString().slice(0, 6) + '...' + wallet.publicKey.toString().slice(-4) : 'Connect',
      icon: 'wallet',
      isWallet: true,
      items: wallet ? [
        { name: 'Copy Address', action: 'copyAddress', icon: 'copy' },
        { name: 'Disconnect', action: 'disconnect', icon: 'sign-out-alt' },
      ] : [
        { name: 'Connect Wallet', action: 'connect', icon: 'plug' },
      ],
    },
    {
      title: 'Main',
      icon: 'home',
      items: [
        { name: 'Home', screen: 'Home', icon: 'home' },
        { name: 'Crazy Corner', screen: 'Feed', icon: 'newspaper' },
        { name: 'Profile', screen: 'Profile', icon: 'user' },
      ],
    },
    {
      title: 'Content',
      icon: 'book',
      items: [
        { name: 'Novel Dashboard', screen: 'NovelDashboard', icon: 'book-open' },
        { name: 'Manga Dashboard', screen: 'MangaDashboard', icon: 'images' },
        { name: 'Novels', screen: 'NovelsPage', icon: 'book' },
        { name: 'Manga', screen: 'MangaPage', icon: 'images' },
      ],
    },
    {
      title: 'Nexus',
      icon: 'wallet',
      items: [
        { name: 'Swap', screen: 'Swap', icon: 'exchange-alt' },
        { name: 'Ramp', screen: 'Ramp', icon: 'credit-card' },
        { name: 'Import Wallet', screen: 'WalletImport', icon: 'wallet' },
        { name: 'Mint', screen: 'Mint', icon: 'coins' },
        { name: 'Marketplace', screen: 'Marketplace', icon: 'shopping-cart' },
        { name: 'Wallet Migration', screen: 'WalletMigration', icon: 'exchange-alt' },
      ],
    },
    {
      title: 'Community',
      icon: 'users',
      items: [
        { name: 'Chat', screen: 'Chat', icon: 'comments' },
        { name: 'Leaderboard', screen: 'Leaderboard', icon: 'trophy' },
        { name: 'Kaito Leaderboard', screen: 'KaitoLeaderboard', icon: 'crown' },
      ],
    },
    {
      title: 'Admin',
      icon: 'cog',
      items: [
        { name: 'Admin', screen: 'Admin', icon: 'user-shield' },
        { name: 'Announcements', screen: 'Announcements', icon: 'bullhorn' },
      ],
    },
    {
      title: 'Info',
      icon: 'info-circle',
      items: [
        { name: 'Support', screen: 'Support', icon: 'life-ring' },
        { name: 'Terms', screen: 'Terms', icon: 'file-contract' },
        { name: 'Privacy Policy', screen: 'PrivacyPolicy', icon: 'shield-alt' },
      ],
    },
    {
      title: 'Other',
      icon: 'ellipsis-h',
      items: [
        { name: 'Apply', screen: 'Apply', icon: 'user-plus' },
        { name: 'Download', screen: 'Download', icon: 'download' },
        { name: 'Add Gif', screen: 'AddGif', icon: 'image' },
      ],
    },
  ];

  const toggleDropdown = (index) => {
    setActiveDropdown(activeDropdown === index ? null : index);
  };

  const handleWalletAction = (action) => {
    if (action === 'connect') {
      if (setShowModal) setShowModal(true);
    } else if (action === 'copyAddress' && wallet) {
      Clipboard.setString(wallet.publicKey.toString());
      Alert.alert('Copied', 'Wallet address copied to clipboard');
    } else if (action === 'disconnect') {
      if (disconnectWallet) disconnectWallet();
    }
    setActiveDropdown(null);
  };

  const navigateToScreen = (screenName) => {
    // Map display names to actual screen names
    const screenMap = {
      'Crazy Corner': 'Feed',
      'Nexus': 'Wallet',
    };
    const actualScreenName = screenMap[screenName] || screenName;
    setIsNavigating(true);
    navigation.navigate(actualScreenName);
    setActiveDropdown(null);
    onClose();
    setTimeout(() => setIsNavigating(false), 500);
  };

  return (
    <>
      {isVisible && (
        <TouchableOpacity
          style={GlobalSidebarStyles.overlay}
          onPress={onClose}
          activeOpacity={0.7}
          accessible={true}
          accessibilityLabel="Close menu"
        />
      )}
      <Animated.View style={[GlobalSidebarStyles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <View style={GlobalSidebarStyles.sidebarContent}>
          
          {/* Navigation Links */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={GlobalSidebarStyles.navLinksContainer}
          >
            {navGroups.map((group, groupIndex) => (
              <View key={groupIndex} style={GlobalSidebarStyles.navGroup}>
                <Animated.View style={{ transform: [{ scale: group.isWallet && wallet ? pulseAnim : 1 }] }}>
                  <TouchableOpacity
                    style={[GlobalSidebarStyles.navGroupButton, group.isWallet && wallet && GlobalSidebarStyles.walletButtonConnected]}
                    onPress={() => toggleDropdown(groupIndex)}
                    activeOpacity={0.7}
                    disabled={group.isWallet && isLoading}
                  >
                    <FontAwesome5 name={group.icon} size={16} color={group.isWallet && wallet ? '#4CAF50' : '#FF5733'} style={GlobalSidebarStyles.navIcon} />
                    <Text style={[GlobalSidebarStyles.navGroupText, group.isWallet && wallet && GlobalSidebarStyles.walletConnectedText]}>{group.title}</Text>
                    <FontAwesome5 
                      name={activeDropdown === groupIndex ? 'chevron-up' : 'chevron-down'} 
                      size={12} 
                      color={group.isWallet && wallet ? '#4CAF50' : '#FF5733'} 
                      style={GlobalSidebarStyles.dropdownIcon} 
                    />
                  </TouchableOpacity>
                </Animated.View>
                
                {activeDropdown === groupIndex && (
                  <View style={GlobalSidebarStyles.dropdown}>
                    {group.items.map((item, itemIndex) => (
                      <TouchableOpacity
                        key={`${groupIndex}-${item.name}-${itemIndex}`}
                        style={GlobalSidebarStyles.dropdownItem}
                        onPress={() => group.isWallet ? handleWalletAction(item.action) : navigateToScreen(item.screen)}
                        activeOpacity={0.7}
                        disabled={isNavigating || isLoading}
                      >
                        {isNavigating && !group.isWallet ? (
                          <ActivityIndicator size="small" color="#FF5733" style={GlobalSidebarStyles.navIcon} />
                        ) : (
                          <FontAwesome5 name={item.icon} size={14} color="#FF5733" style={GlobalSidebarStyles.navIcon} />
                        )}
                        <Text style={GlobalSidebarStyles.dropdownItemText}>
                          {isNavigating && !group.isWallet ? 'Loading...' : item.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            <View style={{ height: 10 }} />
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
};

export default GlobalSidebar;
