import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Clipboard, ActivityIndicator, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useGoogleAuth } from './GoogleAuthProvider';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import {
  getGlobalSidebarStyles,
  SIDEBAR_ACCENT,
  SIDEBAR_CONNECTED,
} from '../styles/GlobalSidebarStyles';

const GlobalSidebar = ({ isVisible, onClose }) => {
  const navigation = useNavigation();
  const { session } = useGoogleAuth();
  const walletContext = useContext(EmbeddedWalletContext);
  const { isDark } = useTheme();
  const styles = getGlobalSidebarStyles(isDark);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const wallet = walletContext?.wallet;
  const disconnectWallet = walletContext?.disconnectWallet;
  const setShowModal = walletContext?.setShowModal;
  const isLoading = walletContext?.isLoading;

  const navGroups = [
    {
      title: wallet ? `${wallet.publicKey.toString().slice(0, 6)}...${wallet.publicKey.toString().slice(-4)}` : 'Connect',
      icon: 'wallet',
      isWallet: true,
      items: wallet
        ? [
            { name: 'Copy Address', action: 'copyAddress', icon: 'copy' },
            { name: 'Disconnect', action: 'disconnect', icon: 'sign-out-alt' },
          ]
        : [{ name: 'Connect Wallet', action: 'connect', icon: 'plug' }],
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
        { name: 'Hoard', screen: 'NovelsPage', icon: 'book' },
        { name: 'Manga Hoard', screen: 'MangaPage', icon: 'images' },
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
      ],
    },
    {
      title: 'Community',
      icon: 'users',
      items: [
        { name: 'Chat', screen: 'Chat', icon: 'comments' },
        { name: 'Badges', screen: 'Badges', icon: 'award' },
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
    const screenMap = { 'Crazy Corner': 'Feed', Nexus: 'Wallet' };
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
          style={styles.overlay}
          onPress={onClose}
          activeOpacity={0.7}
          accessible
          accessibilityLabel="Close menu"
        />
      )}
      <View style={[styles.sidebar, { transform: [{ translateX: isVisible ? 0 : 320 }] }]}>
        <View style={styles.sidebarContent}>
          <View style={styles.sidebarHeader}>
            <Image
              source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
              style={styles.sidebarLogo}
            />
            <Text style={styles.sidebarTitle}>Sempai HQ</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close menu">
              <FontAwesome5 name="times" size={13} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.navLinksContainer}>
            {navGroups.map((group, groupIndex) => (
              <View key={groupIndex} style={styles.navGroup}>
                <TouchableOpacity
                  style={[
                    styles.navGroupButton,
                    group.isWallet && wallet ? styles.walletButtonConnected : null,
                  ]}
                  onPress={() => toggleDropdown(groupIndex)}
                  activeOpacity={0.7}
                  disabled={group.isWallet && isLoading}
                >
                  <FontAwesome5
                    name={group.icon}
                    size={15}
                    color={group.isWallet && wallet ? SIDEBAR_CONNECTED(isDark) : SIDEBAR_ACCENT(isDark)}
                    style={styles.navIcon}
                  />
                  <Text
                    style={[
                      styles.navGroupText,
                      group.isWallet && wallet ? styles.walletConnectedText : null,
                    ]}
                  >
                    {group.title}
                  </Text>
                  <FontAwesome5
                    name={activeDropdown === groupIndex ? 'chevron-up' : 'chevron-down'}
                    size={11}
                    color={group.isWallet && wallet ? SIDEBAR_CONNECTED(isDark) : SIDEBAR_ACCENT(isDark)}
                    style={styles.dropdownIcon}
                  />
                </TouchableOpacity>

                {activeDropdown === groupIndex && (
                  <View style={styles.dropdown}>
                    {group.items.map((item, itemIndex) => (
                      <TouchableOpacity
                        key={`${groupIndex}-${item.name}-${itemIndex}`}
                        style={styles.dropdownItem}
                        onPress={() => (group.isWallet ? handleWalletAction(item.action) : navigateToScreen(item.screen))}
                        activeOpacity={0.7}
                        disabled={isNavigating || isLoading}
                      >
                        {isNavigating && !group.isWallet ? (
                          <ActivityIndicator size="small" color={SIDEBAR_ACCENT(isDark)} />
                        ) : (
                          <FontAwesome5 name={item.icon} size={13} color={SIDEBAR_ACCENT(isDark)} />
                        )}
                        <Text style={styles.dropdownItemText}>
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
      </View>
    </>
  );
};

export default GlobalSidebar;