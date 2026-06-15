import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';

const UBBadge = ({ type = 'writer', size = 'medium', showLabel = false }) => {
  const getBadgeImage = (badgeType) => {
    switch (badgeType.toLowerCase()) {
      case 'artist':
        return require('../assets/artist-badge.png');
      case 'writer':
      default:
        return require('../assets/writer-badge.png');
    }
  };

  const getSizeStyle = (badgeSize) => {
    switch (badgeSize) {
      case 'tiny':
        return { width: 20, height: 20, labelFontSize: 10 };
      case 'small':
        return { width: 32, height: 32, labelFontSize: 12 };
      case 'medium':
        return { width: 48, height: 48, labelFontSize: 14 };
      case 'large':
        return { width: 64, height: 64, labelFontSize: 16 };
      default:
        return { width: 32, height: 32, labelFontSize: 12 };
    }
  };

  const getBadgeLabel = (badgeType) => {
    switch (badgeType.toLowerCase()) {
      case 'artist':
        return 'Artist Badge';
      case 'writer':
      default:
        return 'Writer Badge';
    }
  };

  const sizeStyle = getSizeStyle(size);
  const badgeImage = getBadgeImage(type);
  const badgeLabel = getBadgeLabel(type);

  return (
    <View style={styles.container}>
      <Image
        source={badgeImage}
        style={[
          styles.badge,
          {
            width: sizeStyle.width,
            height: sizeStyle.height,
          },
        ]}
        resizeMode="contain"
      />
      {showLabel && (
        <Text style={[styles.label, { fontSize: sizeStyle.labelFontSize }]}>
          {badgeLabel}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  label: {
    color: '#D94F04',
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default UBBadge;
