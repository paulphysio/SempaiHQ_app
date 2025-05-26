import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useGoogleAuth } from './GoogleAuthProvider';
import { EmbeddedWalletContext } from './ConnectButton';
import { useContext } from 'react';

const GoogleSignInButton = () => {
  const { signInWithGoogle, signOut, forceSignOut, session, loading } = useGoogleAuth();
  const { wallet } = useContext(EmbeddedWalletContext);

  const handlePress = async () => {
    try {
      if (session) {
        await signOut();
      } else {
        await signInWithGoogle();
      }
    } catch (error) {
      console.error('Google sign in/out error:', error);
    }
  };

  if (loading) {
    return (
      <TouchableOpacity style={styles.button} disabled>
        <ActivityIndicator color="#ffffff" />
      </TouchableOpacity>
    );
  }

  if (session && wallet) {
    return (
      <View>
      <TouchableOpacity style={styles.connectedButton} onPress={handlePress}>
        <View style={styles.walletInfo}>
          <Icon name="google" size={20} color="#ffffff" style={styles.icon} />
          <Text style={styles.walletText}>
            {wallet.publicKey.toString().slice(0, 4)}...{wallet.publicKey.toString().slice(-4)}
          </Text>
        </View>
        <Icon name="sign-out-alt" size={20} color="#ffffff" style={styles.signOutIcon} />
      </TouchableOpacity>
        <TouchableOpacity style={styles.forceSignOutButton} onPress={forceSignOut}>
          <Text style={styles.forceSignOutText}>Force Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Icon name="google" size={20} color="#ffffff" style={styles.icon} />
      <Text style={styles.text}>Sign in with Google</Text>
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
  connectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34A853',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  forceSignOutButton: {
    backgroundColor: '#DC3545',
    padding: 8,
    borderRadius: 8,
    marginTop: 5,
    alignItems: 'center',
  },
  forceSignOutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
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
  signOutIcon: {
    marginLeft: 8,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default GoogleSignInButton; 