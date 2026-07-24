import { useRef, useEffect, useState } from 'react';
import { Animated, TouchableWithoutFeedback, Easing } from 'react-native';

// ---------------------------------------------------------------------------
// AnimatedPressable — scale-down-on-press instead of TouchableOpacity's flat
// opacity fade. Spring-in on release gives buttons actual weight.
// ---------------------------------------------------------------------------
export const AnimatedPressable = ({ onPress, disabled, style, children, scaleTo = 0.96 }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : pressIn}
      onPressOut={disabled ? undefined : pressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

// ---------------------------------------------------------------------------
// useCountUp — ticks a displayed number toward `value` instead of snapping.
// Makes balance/portfolio refreshes feel alive instead of flickering.
// ---------------------------------------------------------------------------
export const useCountUp = (value, { duration = 500 } = {}) => {
  const [display, setDisplay] = useState(value || 0);
  const animRef = useRef(new Animated.Value(value || 0)).current;
  const fromRef = useRef(value || 0);

  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value)) return;
    animRef.setValue(fromRef.current);
    const listenerId = animRef.addListener(({ value: v }) => setDisplay(v));
    Animated.timing(animRef, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // listener-driven, can't use native driver
    }).start(() => {
      fromRef.current = value;
    });
    return () => animRef.removeListener(listenerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
};

// ---------------------------------------------------------------------------
// usePulse — gentle breathing opacity loop for skeleton/loading placeholders.
// ---------------------------------------------------------------------------
export const usePulse = () => {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return pulse;
};

// ---------------------------------------------------------------------------
// useEntrance — fade + slide-up for screen content on mount.
// ---------------------------------------------------------------------------
export const useEntrance = ({ duration = 450, distance = 16 } = {}) => {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(distance)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { opacity: fade, transform: [{ translateY: slide }] };
};

// ---------------------------------------------------------------------------
// useAnimatedVisibility — proper enter/exit for things that toggle on and
// off (error/success banners), instead of the element just vanishing.
// Caller is responsible for keeping the last non-empty content visible
// during the exit animation (see SwapScreen's `displayedError` pattern).
// ---------------------------------------------------------------------------
export const useAnimatedVisibility = (visible, { duration = 220 } = {}) => {
  const [shouldRender, setShouldRender] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setShouldRender(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return { shouldRender, anim };
};

// ---------------------------------------------------------------------------
// useStaggeredEntrance — staggered fade/slide-in for a list of items
// (portfolio action buttons, token rows).
// ---------------------------------------------------------------------------
export const useStaggeredEntrance = (count, { delayStep = 60, duration = 350 } = {}) => {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      delayStep,
      anims.map((a) => Animated.timing(a, { toValue: 1, duration, useNativeDriver: true }))
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return anims.map((a) => ({
    opacity: a,
    transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  }));
};