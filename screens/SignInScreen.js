import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

const SignInScreen = () => {
  const { signIn, skipSignIn } = useAuth();
  const navigation = useNavigation();

  const handleSignIn = async () => {
    try {
      const success = await signIn();
      if (success) {
        navigation.navigate('Home');
      } else {
        Alert.alert('Error', 'Failed to sign in with Google');
      }
    } catch (err) {
      Alert.alert('Error', 'Sign-in failed: ' + err.message);
    }
  };

  const handleSkip = async () => {
    try {
      await skipSignIn();
      navigation.navigate('Home');
    } catch (err) {
      Alert.alert('Error', 'Failed to skip sign-in');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Sign In</Text>
      <TouchableOpacity
        style={{ backgroundColor: '#333', padding: 15, borderRadius: 10, marginBottom: 10 }}
        onPress={handleSignIn}
      >
        <Text style={{ color: '#fff', fontSize: 16 }}>Sign In with Google</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ backgroundColor: '#666', padding: 15, borderRadius: 10 }}
        onPress={handleSkip}
      >
        <Text style={{ color: '#fff', fontSize: 16 }}>Skip Sign-In</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignInScreen;