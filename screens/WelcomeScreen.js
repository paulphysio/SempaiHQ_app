import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styles } from '../styles/WelcomeStyles';
import { useNavigation } from '../context/NavigationContext';

const WelcomeScreen = () => {
  const { handleWelcomeComplete } = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Run animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Complete after 3 seconds
    const timer = setTimeout(async () => {
      try {
        await AsyncStorage.setItem('hasSeenWelcome', 'true');
        handleWelcomeComplete();
      } catch (error) {
        console.error('Error saving welcome state:', error);
        handleWelcomeComplete();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, slideAnim, handleWelcomeComplete]);

  return (
    <LinearGradient
      colors={['#0D1B2A', '#1B263B']}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
          },
        ]}
      >
        <Image
          source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
          style={styles.logo}
          defaultSource={{ uri: 'https://via.placeholder.com/100' }}
        />
        <Text style={styles.title}>Welcome to Sempai HQ!</Text>
        <Text style={styles.subtitle}>
          Your haven for anime, manga, and web novels.
        </Text>
      </Animated.View>
    </LinearGradient>
  );
};

export default WelcomeScreen;