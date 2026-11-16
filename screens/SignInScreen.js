import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const SignInScreen = () => {
  const { signIn, skipSignIn } = useAuth();
  const navigation = useNavigation();
  const { isDark, colors } = useTheme();

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
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <TouchableOpacity
        style={{ backgroundColor: colors.accent, padding: 15, borderRadius: 10, marginBottom: 10 }}
        onPress={handleSignIn}
      >
        <Text style={{ color: '#fff', fontSize: 16 }}>Sign In with Google</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ backgroundColor: colors.bgCard, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
        onPress={handleSkip}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Skip Sign-In</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignInScreen;
