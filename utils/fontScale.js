import React from 'react';
import { StyleSheet } from 'react-native';

/**
 * Global text baseline. Wraps React Native's Text export (imported once at the
 * top of App.js, before any screen renders) so every <Text>:
 *
 *  1. renders at FONT_SCALE of its declared fontSize (lineHeight scaled
 *     proportionally). The style files were authored at desktop-ish sizes;
 *     this keeps them mobile-appropriate in one place. It still multiplies
 *     with the user's OS font-size setting (allowFontScaling is untouched).
 *  2. gets the current theme's primary text colour when its style sets none.
 *     Previously colourless text fell back to React Native's black (invisible
 *     on the dark theme) or to a hardcoded white (invisible on light paper).
 *     ThemeContext keeps the colour in sync via setBaseTextColor().
 */
const FONT_SCALE = 0.85;

let baseTextColor = '#FFFFFF';
export const setBaseTextColor = (color) => {
  if (color) baseTextColor = color;
};

function resolveStyle(style) {
  const flat = StyleSheet.flatten(style) || {};
  const out = flat.color == null ? { color: baseTextColor, ...flat } : { ...flat };
  if (typeof flat.fontSize === 'number') {
    out.fontSize = Math.round(flat.fontSize * FONT_SCALE * 10) / 10;
    if (typeof flat.lineHeight === 'number') {
      out.lineHeight = Math.round(flat.lineHeight * FONT_SCALE * 10) / 10;
    }
  }
  return out;
}

const RN = require('react-native');
const OriginalText = RN.Text;

if (OriginalText && !OriginalText.__sempaiFontScaled) {
  const ScaledText = React.forwardRef((props, ref) => (
    <OriginalText {...props} ref={ref} style={resolveStyle(props.style)} />
  ));
  ScaledText.displayName = 'ScaledText';
  ScaledText.__sempaiFontScaled = true;
  RN.Text = ScaledText;
}
