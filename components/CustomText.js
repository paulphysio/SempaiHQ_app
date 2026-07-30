import React from 'react';
import { Text } from 'react-native';

export default function CustomText(props) {
  return (
    <Text 
      {...props} 
      style={[
        { fontFamily: ' Yoruka' },
        props.style
      ]}
    >
      {props.children}
    </Text>
  );
}
