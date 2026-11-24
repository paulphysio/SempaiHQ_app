// Keeps inputs above the keyboard on every platform.
//
// The app hides Android's navigation bar (immersive mode), and in that mode Android stops resizing the
// window for the keyboard — so React Native's KeyboardAvoidingView (with no Android behavior) lets the
// keyboard cover the text box. This view measures how much of itself the keyboard actually covers and
// pads its bottom by exactly that. If the system already resized the window, the overlap is 0 and
// nothing is added, so it never double-lifts.
//
// Drop-in for KeyboardAvoidingView in full screens (not inside a <Modal>: modals get their own window,
// which does resize). `behavior` and `keyboardVerticalOffset` are accepted and ignored.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, StyleSheet, View } from 'react-native';

export default function KeyboardSafe({ style, children, enabled = true, behavior, keyboardVerticalOffset, onLayout, ...rest }) {
  const ref = useRef(null);
  const kbTop = useRef(null);
  const [pad, setPad] = useState(0);

  const measure = useCallback(() => {
    if (kbTop.current == null || !ref.current?.measureInWindow) {
      setPad(0);
      return;
    }
    ref.current.measureInWindow((x, y, w, h) => {
      if (kbTop.current == null) return setPad(0);
      const overlap = Math.max(0, Math.round(y + h - kbTop.current));
      setPad((p) => (Math.abs(p - overlap) < 2 ? p : overlap));
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) return undefined;
    const ios = Platform.OS === 'ios';
    const show = (e) => {
      if (ios && e?.duration) LayoutAnimation.configureNext(LayoutAnimation.create(e.duration, 'keyboard', 'opacity'));
      kbTop.current = e?.endCoordinates?.screenY ?? null;
      measure();
      if (!ios) setTimeout(measure, 150); // the window may still be settling after the keyboard opens
    };
    const hide = (e) => {
      if (ios && e?.duration) LayoutAnimation.configureNext(LayoutAnimation.create(e.duration, 'keyboard', 'opacity'));
      kbTop.current = null;
      setPad(0);
    };
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', show),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', hide),
    ];
    if (ios) subs.push(Keyboard.addListener('keyboardWillChangeFrame', show));
    return () => subs.forEach((s) => s.remove());
  }, [enabled, measure]);

  const flat = StyleSheet.flatten(style) || {};
  const base = flat.paddingBottom ?? flat.padding ?? flat.paddingVertical ?? 0;
  return (
    <View
      ref={ref}
      style={[style, pad ? { paddingBottom: base + pad } : null]}
      onLayout={(e) => { onLayout?.(e); if (kbTop.current != null) measure(); }}
      {...rest}
    >
      {children}
    </View>
  );
}
