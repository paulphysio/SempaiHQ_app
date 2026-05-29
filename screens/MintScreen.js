import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/MintStyles';

const API_BASE_URL = 'https://sempaihq.com/api';

const MintScreen = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  
  const [mintType, setMintType] = useState('nft'); // nft, token
  const [nftName, setNftName] = useState('');
  const [nftDescription, setNftDescription] = useState('');
  const [nftImageUrl, setNftImageUrl] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenSupply, setTokenSupply] = useState('');
  const [loading, setLoading] = useState(false);
  const [mintResult, setMintResult] = useState(null);

  const handleMintNFT = async () => {
    if (!nftName.trim() || !nftDescription.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet?.publicKey)
        .single();

      if (userData) {
        const response = await fetch(`${API_BASE_URL}/mint/nft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.id,
            name: nftName.trim(),
            description: nftDescription.trim(),
            imageUrl: nftImageUrl.trim()
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setMintResult({
          success: true,
          message: 'NFT minted successfully',
          nftMint: data.nftMint
        });
        Alert.alert('Success', 'NFT minted successfully!');
        setNftName('');
        setNftDescription('');
        setNftImageUrl('');
      }
    } catch (error) {
      console.error('[MintScreen] Error minting NFT:', error);
      Alert.alert('Error', 'Failed to mint NFT');
    } finally {
      setLoading(false);
    }
  };

  const handleMintToken = async () => {
    if (!tokenName.trim() || !tokenSymbol.trim() || !tokenSupply) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet?.publicKey)
        .single();

      if (userData) {
        const response = await fetch(`${API_BASE_URL}/mint/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.id,
            name: tokenName.trim(),
            symbol: tokenSymbol.trim().toUpperCase(),
            supply: parseInt(tokenSupply)
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setMintResult({
          success: true,
          message: 'Token minted successfully',
          tokenMint: data.tokenMint
        });
        Alert.alert('Success', 'Token minted successfully!');
        setTokenName('');
        setTokenSymbol('');
        setTokenSupply('');
      }
    } catch (error) {
      console.error('[MintScreen] Error minting token:', error);
      Alert.alert('Error', 'Failed to mint token');
    } finally {
      setLoading(false);
    }
  };

  if (!isWalletConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lockedContainer}>
          <FontAwesome5 name="wallet" size={48} color="#E74C3C" />
          <Text style={styles.lockedMessage}>Connect Wallet to Mint</Text>
          <TouchableOpacity 
            style={styles.connectButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <FontAwesome5 name="wallet" size={16} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView>
          <View style={styles.infoCard}>
            <FontAwesome5 name="gem" size={24} color="#9B59B6" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Create Digital Assets</Text>
              <Text style={styles.infoDescription}>
                Mint NFTs and tokens on the Solana blockchain with ease
              </Text>
            </View>
          </View>

          <View style={styles.mintTypeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                mintType === 'nft' && styles.activeTypeButton
              ]}
              onPress={() => setMintType('nft')}
            >
              <FontAwesome5 
                name="image" 
                size={18} 
                color={mintType === 'nft' ? '#FFFFFF' : '#CCCCCC'} 
              />
              <Text style={[
                styles.typeButtonText,
                mintType === 'nft' && styles.activeTypeButtonText
              ]}>
                Mint NFT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                mintType === 'token' && styles.activeTypeButton
              ]}
              onPress={() => setMintType('token')}
            >
              <FontAwesome5 
                name="coins" 
                size={18} 
                color={mintType === 'token' ? '#FFFFFF' : '#CCCCCC'} 
              />
              <Text style={[
                styles.typeButtonText,
                mintType === 'token' && styles.activeTypeButtonText
              ]}>
                Mint Token
              </Text>
            </TouchableOpacity>
          </View>

          {mintType === 'nft' && (
            <View style={styles.mintForm}>
              <Text style={styles.formTitle}>Mint NFT</Text>
              <Text style={styles.formDescription}>
                Create a unique non-fungible token on the blockchain
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>NFT Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter NFT name"
                  placeholderTextColor="#888"
                  value={nftName}
                  onChangeText={setNftName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Describe your NFT"
                  placeholderTextColor="#888"
                  value={nftDescription}
                  onChangeText={setNftDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Image URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter image URL"
                  placeholderTextColor="#888"
                  value={nftImageUrl}
                  onChangeText={setNftImageUrl}
                />
              </View>

              {nftImageUrl && (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: nftImageUrl }} style={styles.previewImage} />
                </View>
              )}

              <TouchableOpacity 
                style={styles.mintButton}
                onPress={handleMintNFT}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FontAwesome5 name="magic" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Mint NFT</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <FontAwesome5 name="info-circle" size={16} color="#4A90E2" />
                <Text style={styles.infoBoxText}>
                  Your NFT will be minted on the Solana blockchain and added to your hoard. Minting fees apply.
                </Text>
              </View>
            </View>
          )}

          {mintType === 'token' && (
            <View style={styles.mintForm}>
              <Text style={styles.formTitle}>Mint Token</Text>
              <Text style={styles.formDescription}>
                Create a fungible token on the Solana blockchain
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Token Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter token name"
                  placeholderTextColor="#888"
                  value={tokenName}
                  onChangeText={setTokenName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Token Symbol *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter token symbol (e.g., SMP)"
                  placeholderTextColor="#888"
                  value={tokenSymbol}
                  onChangeText={setTokenSymbol}
                  autoCapitalize="characters"
                  maxLength={10}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Total Supply *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter total supply"
                  placeholderTextColor="#888"
                  value={tokenSupply}
                  onChangeText={setTokenSupply}
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity 
                style={styles.mintButton}
                onPress={handleMintToken}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FontAwesome5 name="coins" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Mint Token</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <FontAwesome5 name="info-circle" size={16} color="#4A90E2" />
                <Text style={styles.infoBoxText}>
                  Your token will be created as a Solana SPL Token. You'll need to pay rent for the token mint account.
                </Text>
              </View>
            </View>
          )}

          {mintResult && (
            <View style={styles.resultCard}>
              <LinearGradient
                colors={['#4CAF50', '#45A049']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.resultBanner}
              >
                <FontAwesome5 name="check-circle" size={24} color="#FFFFFF" />
                <Text style={styles.resultText}>{mintResult.message}</Text>
              </LinearGradient>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default MintScreen;
