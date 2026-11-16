import React from 'react';
import { StyleSheet } from 'react-native';

/**
 * Global mobile-appropriate font scale.
 * Wraps React Native's Text export so every <Text> in the app renders at
 * FONT_SCALE of its declared fontSize (lineHeight scaled proportionally).
 * Imported once at the top of App.js before any screen renders.
 */
const FONT_SCALE = 0.85;

function scaleStyle(style) {
  if (style == null) return style;
  const flat = StyleSheet.flatten(style);
  if (!flat || typeof flat.fontSize !== 'number') return style;
  const out = { ...flat, fontSize: Math.round(flat.fontSize * FONT_SCALE * 10) / 10 };
  if (typeof flat.lineHeight === 'number') {
    out.lineHeight = Math.round(flat.lineHeight * FONT_SCALE * 10) / 10;
  }
  return out;
}

const RN = require('react-native');
const OriginalText = RN.Text;

if (OriginalText && !OriginalText.__sempaiFontScaled) {
  const ScaledText = React.forwardRef((props, ref) => (
    <OriginalText {...props} ref={ref} style={scaleStyle(props.style)} />
  ));
  ScaledText.displayName = 'ScaledText';
  ScaledText.__sempaiFontScaled = true;
  RN.Text = ScaledText;
}
