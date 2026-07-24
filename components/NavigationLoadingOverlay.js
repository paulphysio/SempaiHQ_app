import React from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const NavigationLoadingOverlay = ({ visible }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(10, 10, 24, 0.8)', 'rgba(10, 10, 24, 0.95)']}
          style={styles.gradient}
        />
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#FF5733" />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});

export default NavigationLoadingOverlay;
