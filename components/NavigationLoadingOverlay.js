import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const NavigationLoadingOverlay = ({ visible }) => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getNavLoadingStyles(colors), [isDark]);
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
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    </Modal>
  );
};

export const getNavLoadingStyles = (c) => StyleSheet.create({
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
