import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useGoogleAuth } from './GoogleAuthProvider';
import ConnectButton from './ConnectButtonEnhanced';
import GlobalSidebarStyles from '../styles/GlobalSidebarStyles';

const GlobalSidebar = ({ isVisible, onClose }) => {
  const navigation = useNavigation();
  const { session } = useGoogleAuth();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : 280,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  const navGroups = [
    {
      title: 'Main',
      icon: 'home',
      items: [
        { name: 'Home', screen: 'Home', icon: 'home' },
        { name: 'Feed', screen: 'Feed', icon: 'newspaper' },
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
      title: 'Wallet',
      icon: 'wallet',
      items: [
        { name: 'Wallet', screen: 'Wallet', icon: 'wallet' },
        { name: 'Swap', screen: 'Swap', icon: 'exchange-alt' },
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

  const navigateToScreen = (screenName) => {
    navigation.navigate(screenName);
    setActiveDropdown(null);
    onClose();
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
          {/* Profile Section at Top */}
          <View style={GlobalSidebarStyles.sidebarProfileSection}>
            <View style={GlobalSidebarStyles.sidebarButtons}>
              <ConnectButton />
              {session && <ConnectButton email={session?.user?.email} userId={session?.user?.id} />}
            </View>
          </View>
          
          <View style={GlobalSidebarStyles.sidebarDivider} />
          
          {/* Navigation Links */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={GlobalSidebarStyles.navLinksContainer}
          >
            {navGroups.map((group, groupIndex) => (
              <View key={groupIndex} style={GlobalSidebarStyles.navGroup}>
                <TouchableOpacity
                  style={GlobalSidebarStyles.navGroupButton}
                  onPress={() => toggleDropdown(groupIndex)}
                  activeOpacity={0.7}
                >
                  <FontAwesome5 name={group.icon} size={16} color="#FF5733" style={GlobalSidebarStyles.navIcon} />
                  <Text style={GlobalSidebarStyles.navGroupText}>{group.title}</Text>
                  <FontAwesome5 
                    name={activeDropdown === groupIndex ? 'chevron-up' : 'chevron-down'} 
                    size={12} 
                    color="#FF5733" 
                    style={GlobalSidebarStyles.dropdownIcon} 
                  />
                </TouchableOpacity>
                
                {activeDropdown === groupIndex && (
                  <View style={GlobalSidebarStyles.dropdown}>
                    {group.items.map((item, itemIndex) => (
                      <TouchableOpacity
                        key={itemIndex}
                        style={GlobalSidebarStyles.dropdownItem}
                        onPress={() => navigateToScreen(item.screen)}
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name={item.icon} size={14} color="#FF5733" style={GlobalSidebarStyles.navIcon} />
                        <Text style={GlobalSidebarStyles.dropdownItemText}>{item.name}</Text>
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
