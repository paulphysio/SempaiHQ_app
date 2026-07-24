import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../styles/KaitoAdventureStyles';

const Navbar = ({ menuOpen, toggleMenu, onNavigate }) => (
  <View style={navbarStyles.container}>
    {/* Top amber accent line */}
    <View style={navbarStyles.accentLine} />

    <View style={navbarStyles.content}>
      <TouchableOpacity
        style={navbarStyles.brand}
        onPress={() => onNavigate && onNavigate('Home')}
      >
        <Icon name="torii-gate" size={28} color={KA_COLORS.orangePrimary} />
        <Text style={navbarStyles.brandText}>Kaito's Adventure</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={toggleMenu} style={navbarStyles.menuButton}>
        <Icon name={menuOpen ? 'times' : 'bars'} size={20} color={KA_COLORS.textSecondary} />
      </TouchableOpacity>

      <View style={[navbarStyles.navLinks, menuOpen ? navbarStyles.navLinksOpen : navbarStyles.navLinksClosed]}>
        {[
          { screen: 'Home', icon: 'home', label: 'Home' },
          { screen: 'Profile', icon: 'user', label: 'Profile' },
          { screen: 'Game', icon: 'gamepad', label: 'Game', active: true },
        ].map((link) => (
          <TouchableOpacity
            key={link.screen}
            style={[
              navbarStyles.navLink,
              link.active ? navbarStyles.navLinkActive : null,
            ]}
            onPress={() => onNavigate && onNavigate(link.screen)}
          >
            <Icon name={link.icon} size={14} color={link.active ? KA_COLORS.orangeBright : KA_COLORS.textSecondary} />
            <Text style={[navbarStyles.navLinkText, link.active ? navbarStyles.navLinkTextActive : navbarStyles.navLinkTextInactive]}>
              {link.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </View>
);

const navbarStyles = StyleSheet.create({
  container: {
    backgroundColor: KA_COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 6,
  },
  accentLine: {
    height: 2,
    backgroundColor: 'linear-gradient(90deg, transparent, #cc5500, #c9a84c, #cc5500, transparent)',
    opacity: 0.5,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    color: KA_COLORS.ivory,
    
    fontSize: 16,
    letterSpacing: 2,
  },
  menuButton: {
    padding: 8,
  },
  navLinks: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  navLinksOpen: {
    display: 'flex',
  },
  navLinksClosed: {
    display: 'none',
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navLinkActive: {
    borderColor: 'rgba(204, 85, 0, 0.3)',
    backgroundColor: 'rgba(204, 85, 0, 0.08)',
  },
  navLinkText: {
    fontSize: 13,
    letterSpacing: 1,
  },
  navLinkTextActive: {
    color: KA_COLORS.orangeBright,
  },
  navLinkTextInactive: {
    color: KA_COLORS.textSecondary,
  },
});

export default Navbar;
