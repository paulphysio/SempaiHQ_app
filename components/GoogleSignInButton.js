import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { useGoogleAuth } from './GoogleAuthProvider';
import { LinearGradient } from 'expo-linear-gradient';

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
      activeOpacity={0.8}
      style={styles.buttonWrapper}
      onPress={handlePress}
      disabled={loading}
    >
      <LinearGradient
        colors={['#FF5733', '#FF7F50']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={styles.buttonInner}>
          {loading ? (
            <ActivityIndicator color="#FF5733" size="small" />
          ) : (
            <>
              <AntDesign name="google" size={16} color="#FF5733" style={styles.icon} />
              <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
                {session ? 'Sign out' : 'Sign in'}
              </Text>
            </>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonWrapper: {
    width: '50%', // Already changed by user
    height: 38, // Reduced from 42
    borderRadius: 19,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
    marginVertical: 6, // Reduced from 8
  },
  gradientBorder: {
    height: '100%',
    borderRadius: 19,
    padding: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    width: '99%',
    height: '96%',
    paddingHorizontal: 12, // Reduced from 16
  },
  text: {
    color: '#333',
    fontSize: 13, // Reduced from 14
    fontWeight: '600',
    marginLeft: 5, // Reduced from 6
  },
  icon: {
    marginRight: 2,
  },
});

export default GoogleSignInButton;