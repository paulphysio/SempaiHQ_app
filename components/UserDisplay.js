import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import BenefactorBadge from './BenefactorBadge';

const UserDisplay = ({ 
  userId, 
  username, 
  userImage, 
  size = 'small', 
  showBadge = true, 
  showLabel = false,
  badgeSize = 'small',
  style = {},
  onPress = null 
}) => {
  const getSizeStyle = (size) => {
    switch (size) {
      case 'tiny':
        return { avatarSize: 24, fontSize: 12 };
      case 'small':
        return { avatarSize: 32, fontSize: 14 };
      case 'medium':
        return { avatarSize: 48, fontSize: 16 };
      case 'large':
        return { avatarSize: 64, fontSize: 18 };
      default:
        return { avatarSize: 32, fontSize: 14 };
    }
  };

  const sizeStyle = getSizeStyle(size);

  return (
    <TouchableOpacity 
      style={[styles.container, style, onPress && styles.clickable]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* User Avatar */}
      {userImage ? (
        <Image 
          source={{ uri: userImage }} 
          style={[styles.avatar, { width: sizeStyle.avatarSize, height: sizeStyle.avatarSize }]}
        />
      ) : (
        <View style={[styles.avatarPlaceholder, { width: sizeStyle.avatarSize, height: sizeStyle.avatarSize }]}>
          <Text style={[styles.avatarPlaceholderText, { fontSize: sizeStyle.avatarSize / 2 }]}>
            {username?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
      )}
      
      {/* Username */}
      <Text style={[styles.username, { fontSize: sizeStyle.fontSize }]}>
        {username || 'Anonymous'}
      </Text>
      
      {/* Benefactor Badge */}
      {showBadge && (
        <BenefactorBadge 
          level="bronze" 
          size={badgeSize}
          showLabel={showLabel}
        />
      )}
    </TouchableOpacity>
  );
};

// Inline version for tight spaces (like chat messages)
export const InlineUserDisplay = ({ 
  userId, 
  username, 
  showBadge = true,
  onPress = null 
}) => {
  return (
    <TouchableOpacity 
      style={[styles.inlineContainer, onPress && styles.clickable]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.inlineUsername}>
        {username || 'Anonymous'}
      </Text>
      
      {showBadge && (
        <BenefactorBadge 
          level="bronze" 
          size="tiny"
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clickable: {
    opacity: 1,
  },
  avatar: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  avatarPlaceholder: {
    borderRadius: 20,
    backgroundColor: 'rgba(155, 89, 182, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  avatarPlaceholderText: {
    color: '#9B59B6',
    fontWeight: 'bold',
    fontFamily: 'AnimeAce',
  },
  username: {
    color: '#FFF',
    fontWeight: '600',
    fontFamily: 'AnimeAce',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineUsername: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'AnimeAce',
  },
});

export default UserDisplay;
