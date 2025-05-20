import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Text, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/LoadingStyles';

const { width } = Dimensions.get('window');

const LoadingPage = ({ text = 'Welcome to SempaiHQ...' }) => {
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const glowOpacityAnim = useRef(new Animated.Value(0)).current; // Dedicated for shadowOpacity
  const glowRadiusAnim = useRef(new Animated.Value(0)).current; // Dedicated for shadowRadius
  const glowPulseAnim = useRef(new Animated.Value(0.5)).current;
  const barAnim = useRef(new Animated.Value(-100)).current;
  const textAnim = useRef(new Animated.Value(0.7)).current;
  const particleAnims = useRef(
    Array.from({ length: 20 }).map(() => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(1),
    }))
  ).current;

  // Loading delay
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setLoading(false));
    }, 3000); // 3-second delay

    return () => clearTimeout(timer);
  }, [fadeAnim]);

  // Pulse field animation
  useEffect(() => {
    Animated.loop(
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
    ).start();
  }, [pulseAnim]);

  // Logo spin animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  // Logo glow animation (non-native for shadow properties)
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(glowOpacityAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(glowRadiusAnim, {
          toValue: 30,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(glowOpacityAnim, {
          toValue: 0.8,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(glowRadiusAnim, {
          toValue: 15,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [glowOpacityAnim, glowRadiusAnim]);

  // Glow pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulseAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulseAnim, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowPulseAnim]);

  // Loading bar animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(barAnim, {
        toValue: 100,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [barAnim]);

  // Text flicker animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(textAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(textAnim, {
          toValue: 0.7,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [textAnim]);

  // Particle animations
  useEffect(() => {
    particleAnims.forEach((anim, index) => {
      const angle = (index * 18 * Math.PI) / 180;
      const duration = index % 2 === 0 ? 5000 : 3000;
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: duration * 0.1,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateX, {
              toValue: 100 * Math.cos(angle),
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateY, {
              toValue: 100 * Math.sin(angle),
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 0.5,
              duration: duration,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: duration * 0.1,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [particleAnims]);

  if (!loading) return null;

  return (
    <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
      <View style={styles.energyField}>
        <View style={styles.logoWrapper}>
          <Animated.Image
            source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
            style={[
              styles.logo,
              {
                transform: [
                  {
                    rotate: spinAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
                shadowOpacity: glowOpacityAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
                shadowRadius: glowRadiusAnim,
              },
            ]}
            defaultSource={{ uri: 'https://via.placeholder.com/100' }}
          />
          <Animated.View
            style={[
              styles.logoGlow,
              {
                opacity: glowPulseAnim,
                transform: [{ scale: glowPulseAnim.interpolate({ inputRange: [0.5, 0.8], outputRange: [1, 1.2] }) }],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(243, 99, 22, 0.4)', 'transparent']}
              style={styles.gradientGlow}
            />
          </Animated.View>
        </View>
        <Animated.View style={[styles.particleSwarm, { transform: [{ scale: pulseAnim }] }]}>
          {particleAnims.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  opacity: anim.opacity,
                  transform: [
                    { translateX: anim.translateX },
                    { translateY: anim.translateY },
                    { scale: anim.scale },
                  ],
                },
              ]}
            />
          ))}
        </Animated.View>
      </View>
      <View style={styles.loadingBarWrapper}>
        <Animated.View
          style={[
            styles.loadingBar,
            {
              transform: [
                {
                  translateX: barAnim.interpolate({
                    inputRange: [-100, 100],
                    outputRange: ['-100%', '100%'],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
      <Animated.Text
        style={[
          styles.loadingText,
          {
            opacity: textAnim,
            textShadowColor: textAnim.interpolate({
              inputRange: [0.7, 1],
              outputRange: ['rgba(243, 99, 22, 0.5)', 'rgba(243, 99, 22, 1)'],
            }),
            textShadowRadius: textAnim.interpolate({
              inputRange: [0.7, 1],
              outputRange: [5, 15],
            }),
          },
        ]}
      >
        {text}
      </Animated.Text>
    </Animated.View>
  );
};

export default LoadingPage;