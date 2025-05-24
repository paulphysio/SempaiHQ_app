// screens/WalletImportScreen.js
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import Icon from 'react-native-vector-icons/FontAwesome5';

const WalletImportScreen = () => {
  const navigation = useNavigation();
  const { session } = useGoogleAuth();

  useEffect(() => {
    if (session) {
      // If user is authenticated with Google, they should already have a wallet
      // created by the GoogleAuthProvider
      navigation.replace('Home');
    }
  }, [session, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Icon name="wallet" size={48} color="#E67E22" style={styles.icon} />
        <Text style={styles.title}>Connect to Sempai HQ</Text>
        <Text style={styles.subtitle}>Sign in with Google to create or access your wallet</Text>
        
        <GoogleSignInButton />
        
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 24,
  },
  backButton: {
    marginTop: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E67E22',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#E67E22',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default WalletImportScreen;