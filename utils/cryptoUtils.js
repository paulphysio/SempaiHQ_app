import * as solanaWeb3 from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { Platform } from 'react-native';

// Key for storing the wallet private key securely
const WALLET_PRIVATE_KEY = 'WALLET_PRIVATE_KEY';

// Generate a new Solana wallet keypair
export const generateWalletKeypair = async () => {
  try {
    // Generate a new Solana keypair
    const keypair = solanaWeb3.Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    const privateKey = bs58.encode(keypair.secretKey);
    
    console.log('Generated new wallet keypair');
    return { publicKey, privateKey };
  } catch (error) {
    console.error('Error generating wallet keypair:', error);
    throw new Error('Failed to generate wallet keypair');
  }
};

// Store private key securely
export const storePrivateKey = async (privateKey, email) => {
  try {
    // Create a key that includes the email to avoid conflicts
    const storageKey = `${WALLET_PRIVATE_KEY}_${email}`;
    
    if (Platform.OS === 'web') {
      // For web, use localStorage with some basic encryption
      // Note: This is not as secure as SecureStore
      const encryptedKey = await simpleEncrypt(privateKey);
      localStorage.setItem(storageKey, encryptedKey);
      console.log('Stored private key in localStorage for web');
    } else {
      // For native platforms, use SecureStore
      await SecureStore.setItemAsync(storageKey, privateKey);
      console.log('Stored private key in SecureStore');
    }
    return true;
  } catch (error) {
    console.error('Error storing private key:', error);
    throw new Error('Failed to store private key securely');
  }
};

// Retrieve private key securely
export const getPrivateKey = async (email) => {
  try {
    const storageKey = `${WALLET_PRIVATE_KEY}_${email}`;
    
    if (Platform.OS === 'web') {
      // For web, retrieve from localStorage and decrypt
      const encryptedKey = localStorage.getItem(storageKey);
      if (!encryptedKey) return null;
      return await simpleDecrypt(encryptedKey);
    } else {
      // For native platforms, use SecureStore
      return await SecureStore.getItemAsync(storageKey);
    }
  } catch (error) {
    console.error('Error retrieving private key:', error);
    return null;
  }
};

// Delete private key from secure storage
export const deletePrivateKey = async (email) => {
  try {
    const storageKey = `${WALLET_PRIVATE_KEY}_${email}`;
    
    if (Platform.OS === 'web') {
      localStorage.removeItem(storageKey);
    } else {
      await SecureStore.deleteItemAsync(storageKey);
    }
    return true;
  } catch (error) {
    console.error('Error deleting private key:', error);
    return false;
  }
};

// Very simple encryption for web storage (not for production use)
// In a real app, you'd use a proper encryption library
const simpleEncrypt = async (text) => {
  const salt = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    new Date().toISOString()
  );
  const key = salt.substring(0, 16);
  let result = '';
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  
  return Buffer.from(salt + result).toString('base64');
};

// Simple decryption for web storage
const simpleDecrypt = async (encryptedText) => {
  const decoded = Buffer.from(encryptedText, 'base64').toString();
  const salt = decoded.substring(0, 64);
  const text = decoded.substring(64);
  let result = '';
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
    result += String.fromCharCode(charCode);
  }
  
  return result;
};
