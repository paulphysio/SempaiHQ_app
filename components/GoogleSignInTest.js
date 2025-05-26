import React from 'react';
import { View, Button, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useGoogleAuth } from './GoogleAuthProvider';

export default function GoogleSignInTest() {
  const { signInWithGoogle, signOut, session, loading, error } = useGoogleAuth();

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : session?.user ? (
        <View style={styles.userInfo}>
          <Text style={styles.title}>Signed In</Text>
          <Text>Email: {session.user.email}</Text>
          <Button 
            title="Sign Out" 
            onPress={signOut}
            color="#ff4444"
          />
        </View>
      ) : (
        <View style={styles.signIn}>
          <Text style={styles.title}>Not Signed In</Text>
          <Button 
            title="Sign in with Google" 
            onPress={signInWithGoogle}
            color="#4285F4"
          />
        </View>
      )}
      
      {error && (
        <Text style={styles.error}>Error: {error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  userInfo: {
    alignItems: 'center',
  },
  signIn: {
    alignItems: 'center',
  },
  error: {
    color: 'red',
    marginTop: 20,
  },
}); 