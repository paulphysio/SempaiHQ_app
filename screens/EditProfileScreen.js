// screens/EditProfileScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import { useNavigation } from '@react-navigation/native';

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const [publicKey, setPublicKey] = useState(null);
  const [name, setName] = useState('');
  const [isWriter, setIsWriter] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const key = await AsyncStorage.getItem('walletAddress');
        if (key) {
          setPublicKey(key);
          const { data: user, error } = await supabase
            .from('users')
            .select('name, isWriter, isArtist')
            .eq('wallet_address', key)
            .single();
          if (error) throw error;
          if (user) {
            setName(user.name || '');
            setIsWriter(user.isWriter || false);
            setIsArtist(user.isArtist || false);
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err.message);
        Alert.alert('Error', 'Failed to load profile data.');
      }
    };
    fetchUserData();
  }, []);

  // Save profile changes
  const handleSave = async () => {
    if (!publicKey) {
      Alert.alert('Error', 'Wallet not connected.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          wallet_address: publicKey,
          name,
          isWriter,
          isArtist,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      Alert.alert('Success', 'Profile updated successfully.');
      navigation.navigate('Home');
    } catch (err) {
      console.error('Error saving profile:', err.message);
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Enter your name"
        placeholderTextColor="#888"
      />
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={[styles.checkbox, isWriter && styles.checkboxActive]}
          onPress={() => setIsWriter(!isWriter)}
        >
          <Text style={styles.checkboxText}>Writer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkbox, isArtist && styles.checkboxActive]}
          onPress={() => setIsArtist(!isArtist)}
        >
          <Text style={styles.checkboxText}>Artist</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Profile'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.backButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  checkbox: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 5,
  },
  checkboxActive: {
    backgroundColor: '#FF5733',
    borderColor: '#FF5733',
  },
  checkboxText: {
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#FF5733',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#888',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FF5733',
    fontSize: 16,
  },
});

export default EditProfileScreen;