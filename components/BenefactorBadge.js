import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const BenefactorBadge = ({ level = 'bronze', size = 'small', showLabel = false }) => {
  const getBadgeConfig = (level) => {
    const normalizedLevel = (level || 'bronze').toLowerCase();
    switch (normalizedLevel) {
      case 'platinum':
        return {
          icon: 'crown',
          color: '#e5e4e2',
          gradientColors: ['#1a1a1a', '#2d2d2d'],
          borderColor: '#e5e4e2',
          label: 'Platinum Benefactor',
        };
      case 'gold':
        return {
          icon: 'gem',
          color: '#ffd700',
          gradientColors: ['#ffed4e', '#ffa500'],
          borderColor: '#ffd700',
          label: 'Gold Benefactor',
        };
      case 'silver':
        return {
          icon: 'star',
          color: '#c0c0c0',
          gradientColors: ['#e8e8e8', '#b8b8b8'],
          borderColor: '#c0c0c0',
          label: 'Silver Benefactor',
        };
      case 'bronze':
      default:
        return {
          icon: 'medal',
          color: '#cd7f32',
          gradientColors: ['#d4a574', '#8b4513'],
          borderColor: '#cd7f32',
          label: 'Bronze Benefactor',
        };
    }
  };

  const getSizeStyle = (size) => {
    switch (size) {
      case 'tiny':
        return { width: 20, height: 20, iconSize: 10 };
      case 'small':
        return { width: 32, height: 32, iconSize: 16 };
      case 'medium':
        return { width: 48, height: 48, iconSize: 24 };
      case 'large':
        return { width: 64, height: 64, iconSize: 32 };
      default:
        return { width: 32, height: 32, iconSize: 16 };
    }
  };

  const config = getBadgeConfig(level);
  const sizeStyle = getSizeStyle(size);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={config.gradientColors}
        style={[
          styles.badge,
          {
            width: sizeStyle.width,
            height: sizeStyle.height,
            borderColor: config.borderColor,
          },
        ]}
      >
        <FontAwesome5
          name={config.icon}
          size={sizeStyle.iconSize}
          color={config.color}
        />
      </LinearGradient>
      {showLabel && (
        <Text style={[styles.label, { color: config.color }]}>
          {config.label}
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
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Yoruka',
  },
});

export default BenefactorBadge;
