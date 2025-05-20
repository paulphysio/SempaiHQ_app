import React from 'react';
import { Text as RNText } from 'react-native';

export const Text = ({ style, allowFontScaling = false, ...props }) => {
  return (
    <RNText
      style={[{ fontFamily: 'AnimeAce' }, style]}
      allowFontScaling={allowFontScaling}
      {...props}
    />
  );
};