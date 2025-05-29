import React from 'react';
import { View } from 'react-native';
import SignIn from '../components/SignIn';
import { useSystemUi } from '../context/SystemUiContext';

const SignInScreen = ({ navigation }) => {
  const { setIsSystemUiVisible } = useSystemUi();

  const handleWalletConnect = (address) => {
    if (address) {
      navigation.replace('Home');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A18' }}>
      <SignIn onWalletConnect={handleWalletConnect} />
    </View>
  );
};

export default SignInScreen; 