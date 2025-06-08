import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useGoogleAuth } from './GoogleAuthProvider';

const GoogleSignInButton = () => {
  const { signIn, signOut, session, loading } = useGoogleAuth();

  const handlePress = async () => {
    try {
      if (session) {
        await signOut();
      } else {
        await signIn();
      }
    } catch (error) {
      console.error('Google sign in/out error:', error.message);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.disabledButton]}
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <>
          <Icon name="google" size={20} color="#ffffff" style={styles.icon} />
          <Text style={styles.text}>
            {session ? 'Sign out of Google' : 'Sign in with Google'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginVertical: 10,
  },
  disabledButton: {
    backgroundColor: '#a0c4ff',
  },
  text: {
    color: '#ffffff',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  icon: {
    marginRight: 8,
  },
});

export default GoogleSignInButton;