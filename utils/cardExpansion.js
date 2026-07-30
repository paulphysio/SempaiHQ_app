import { useRef, useState, useCallback } from 'react';
import { Animated, Easing, Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// "Expo-out" bezier — fast departure, long unhurried settle at the end.
// This specific curve shape is what gives premium product motion (Linear,
// Vercel, etc.) its "considered" feel instead of the linear/ease-in-out
// curves most RN apps default to. Closing uses the mirrored "expo-in" so
// the collapse feels like it's being pulled back rather than just reversed.
const OPEN_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const CLOSE_EASE = Easing.bezier(0.7, 0, 0.84, 0);

const OPEN_DURATION = 620;
const CLOSE_DURATION = 420;

// Where the expanded panel lives on screen — near-fullscreen but with a
// visible margin so the backdrop reads as a distinct "behind" layer.
export const EXPANDED_RECT = {
  x: SCREEN_W * 0.05,
  y: SCREEN_H * 0.085,
  width: SCREEN_W * 0.9,
  height: SCREEN_H * 0.76,
};

export function useCardExpansion() {
  const [expandedCard, setExpandedCard] = useState(null); // { item, type, origin }
  const progress = useRef(new Animated.Value(0)).current; // 0 = collapsed, 1 = expanded
  const kenBurns = useRef(new Animated.Value(0)).current; // slow ambient zoom once expanded
  const kenBurnsLoop = useRef(null);

  const openCard = useCallback((item, type, origin) => {
    setExpandedCard({ item, type, origin });
    progress.setValue(0);
    kenBurns.setValue(0);

    Animated.timing(progress, {
      toValue: 1,
      duration: OPEN_DURATION,
      easing: OPEN_EASE,
      useNativeDriver: false, // drives left/top/width/height, not eligible for native driver
    }).start(() => {
      kenBurnsLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(kenBurns, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(kenBurns, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      kenBurnsLoop.current.start();
    });
  }, [progress, kenBurns]);

  const closeCard = useCallback(() => {
    kenBurnsLoop.current?.stop();
    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_DURATION,
      easing: CLOSE_EASE,
      useNativeDriver: false,
    }).start(() => {
      setExpandedCard(null);
      kenBurns.setValue(0);
    });
  }, [progress, kenBurns]);

  // Used when navigating away via the CTA — no point playing a 420ms close
  // animation the person will never see because the screen is changing.
  const resetImmediate = useCallback(() => {
    kenBurnsLoop.current?.stop();
    progress.setValue(0);
    kenBurns.setValue(0);
    setExpandedCard(null);
  }, [progress, kenBurns]);

  return { expandedCard, progress, kenBurns, openCard, closeCard, resetImmediate };
}