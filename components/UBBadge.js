import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Text, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const UBBadge = ({ type = 'writer', size = 'medium', showLabel = false, onPress }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [glowAnim] = useState(new Animated.Value(0.3));

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
        return { width: 20, height: 20, labelFontSize: 10, shadowRadius: 4 };
      case 'small':
        return { width: 32, height: 32, labelFontSize: 12, shadowRadius: 6 };
      case 'medium':
        return { width: 48, height: 48, labelFontSize: 14, shadowRadius: 8 };
      case 'large':
        return { width: 64, height: 64, labelFontSize: 16, shadowRadius: 10 };
      default:
        return { width: 32, height: 32, labelFontSize: 12, shadowRadius: 6 };
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

  const getBadgeColor = (badgeType) => {
    switch (badgeType.toLowerCase()) {
      case 'artist':
        return '#FF6B35'; // Orange for artist
      case 'writer':
      default:
        return '#D94F04'; // Dark orange for writer
    }
  };

  const getBadgeDescription = (badgeType) => {
    switch (badgeType.toLowerCase()) {
      case 'artist':
        return 'Awarded to exceptional artists who create stunning visual content for the Sempai HQ community.';
      case 'writer':
      default:
        return 'Awarded to talented writers who contribute engaging stories and content to the Sempai HQ community.';
    }
  };

  const sizeStyle = getSizeStyle(size);
  const badgeImage = getBadgeImage(type);
  const badgeLabel = getBadgeLabel(type);
  const badgeColor = getBadgeColor(type);

  // Pulse animation
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [pulseAnim]);

  // Glow animation
  useEffect(() => {
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    glowAnimation.start();

    return () => glowAnimation.stop();
  }, [glowAnim]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      setModalVisible(true);
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.container} 
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Animated.View
            style={[
              styles.glowEffect,
              {
                opacity: glowAnim,
                backgroundColor: badgeColor,
                width: sizeStyle.width + 20,
                height: sizeStyle.height + 20,
                borderRadius: (sizeStyle.width + 20) / 2,
              },
            ]}
          />
          <Image
            source={badgeImage}
            style={[
              styles.badge,
              {
                width: sizeStyle.width,
                height: sizeStyle.height,
                shadowColor: badgeColor,
                shadowRadius: sizeStyle.shadowRadius,
              },
            ]}
            resizeMode="contain"
          />
        </Animated.View>
        {showLabel && (
          <Text style={[styles.label, { fontSize: sizeStyle.labelFontSize, color: badgeColor }]}>
            {badgeLabel}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Image
                source={badgeImage}
                style={styles.modalBadge}
                resizeMode="contain"
              />
            </Animated.View>
            
            <Text style={[styles.modalTitle, { color: badgeColor }]}>{badgeLabel}</Text>
            <Text style={styles.modalDescription}>{getBadgeDescription(type)}</Text>
            
            <View style={styles.modalStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>RARE</Text>
                <Text style={styles.statLabel}>Rarity</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>100%</Text>
                <Text style={styles.statLabel}>Authentic</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>∞</Text>
                <Text style={styles.statLabel}>Value</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: badgeColor }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  glowEffect: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 50,
  },
  badge: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    elevation: 8,
  },
  label: {
    
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: width * 0.85,
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    
  },
  modalBadge: {
    width: 120,
    height: 120,
    marginBottom: 20,
    shadowColor: '#D94F04',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 24,
    
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalDescription: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#D94F04',
    fontSize: 18,
    
    marginBottom: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
  },
  modalButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    
    letterSpacing: 1,
  },
});

export default UBBadge;
