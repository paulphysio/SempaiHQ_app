import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useGoogleAuth } from './GoogleAuthProvider';
import { EmbeddedWalletContext } from './ConnectButton';
import { useContext } from 'react';

const GoogleSignInButton = () => {
  const { signInWithGoogle, signOut, session, loading } = useGoogleAuth();
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
      <TouchableOpacity style={styles.connectedButton} onPress={handlePress}>
        <View style={styles.walletInfo}>
          <Icon name="google" size={20} color="#ffffff" style={styles.icon} />
          <Text style={styles.walletText}>
            {wallet.publicKey.toString().slice(0, 4)}...{wallet.publicKey.toString().slice(-4)}
          </Text>
        </View>
        <Icon name="sign-out-alt" size={20} color="#ffffff" style={styles.signOutIcon} />
      </TouchableOpacity>
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
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 250,
  },
  connectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 250,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  signOutIcon: {
    marginLeft: 10,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  walletText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});

export default GoogleSignInButton; 