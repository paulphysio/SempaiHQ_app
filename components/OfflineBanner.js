import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useOnline } from '../hooks/useOnline';

/**
 * App-wide connection pill. Slides in when the device goes offline (with a
 * shortcut to saved stories), shows a brief "Back online" when it returns.
 */
const OfflineBanner = ({ onOpenSaved, topOffset = 0 }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const anim = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState(null); // 'offline' | 'back' | null
  const wasOffline = useRef(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (online === false) {
      wasOffline.current = true;
      setMode('offline');
    } else if (online === true && wasOffline.current) {
      wasOffline.current = false;
      setMode('back');
      hideTimer.current = setTimeout(() => setMode(null), 2200);
    }
    return () => clearTimeout(hideTimer.current);
  }, [online]);

  useEffect(() => {
    Animated.spring(anim, { toValue: mode ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
  }, [mode, anim]);

  const offline = mode === 'offline';
  const tint = offline ? colors.warning : colors.success;

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: (Platform.OS === 'ios' ? insets.top : 0) + topOffset }]}>
      <Animated.View
        pointerEvents={mode ? 'auto' : 'none'}
        style={{
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }}
      >
        <Pressable
          onPress={offline ? onOpenSaved : undefined}
          style={[styles.pill, { backgroundColor: colors.bgCardAlt, borderColor: `${tint}88` }]}
          accessibilityRole={offline ? 'button' : 'text'}
          accessibilityLiveRegion="polite"
          accessibilityLabel={offline ? "You're offline. Tap to read your saved stories" : 'Back online'}
        >
          <FontAwesome5 name={offline ? 'wifi' : 'check-circle'} size={11} color={tint} solid />
          <Text style={[styles.text, { color: colors.textPrimary }]}>
            {offline ? "You're offline" : 'Back online'}
          </Text>
          {offline ? (
            <>
              <View style={[styles.sep, { backgroundColor: colors.border }]} />
              <Text style={[styles.link, { color: tint }]}>Saved stories</Text>
            </>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 2000, elevation: 2000 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: { fontSize: 13, fontWeight: '700' },
  sep: { width: 1, height: 14 },
  link: { fontSize: 13, fontWeight: '800' },
});

export default React.memo(OfflineBanner);
