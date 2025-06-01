import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import bs58 from 'bs58';

const secureStoreWrapper = {
  setItemAsync: async (key, value) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        console.log(`[secureStoreWrapper] Set ${key} in localStorage`);
      } else {
        await SecureStore.setItemAsync(key, value, {
          authenticationPrompt: 'Authenticate to secure your wallet',
          requireAuthentication: true,
        });
        console.log(`[secureStoreWrapper] Set ${key} in SecureStore`);
      }
    } catch (err) {
      console.error(`[secureStoreWrapper] Failed to set ${key}:`, err.message);
      throw new Error(`Failed to set ${key}: ${err.message}`);
    }
  },
  getItemAsync: async (key) => {
    try {
      if (Platform.OS === 'web') {
        const value = localStorage.getItem(key);
        console.log(`[secureStoreWrapper] Got ${key} from localStorage: ${value ? 'found' : 'null'}`);
        return value;
      } else {
        let result;
        try {
          result = await SecureStore.getItemAsync(key, {
            authenticationPrompt: 'Authenticate to access your wallet',
            requireAuthentication: true,
          });
          console.log(`[secureStoreWrapper] Biometric get for ${key}: ${result ? 'found' : 'null'}`);
        } catch (biometricError) {
          console.warn('[secureStoreWrapper] Biometric get failed, falling back:', biometricError.message);
          result = await SecureStore.getItemAsync(key);
          console.log(`[secureStoreWrapper] Fallback get for ${key}: ${result ? 'found' : 'null'}`);
        }
        if (!result) {
          throw new Error(`No value found for ${key}`);
        }
        if (key.includes('wallet-secret') || key === 'walletPrivateKey') {
          try {
            const privateKeyBytes = bs58.decode(result);
            if (privateKeyBytes.length !== 64) {
              throw new Error(`Invalid private key length: ${privateKeyBytes.length}`);
            }
            console.log(`[secureStoreWrapper] Validated private key for ${key}`);
          } catch (decodeError) {
            console.error(`[secureStoreWrapper] Invalid private key format for ${key}:`, decodeError.message);
            throw new Error(`Invalid private key format: ${decodeError.message}`);
          }
        }
        return result;
      }
    } catch (err) {
      console.error(`[secureStoreWrapper] Failed to get ${key}:`, err.message);
      throw new Error(`Failed to get ${key}: ${err.message}`);
    }
  },
  deleteItemAsync: async (key) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        console.log(`[secureStoreWrapper] Deleted ${key} from localStorage`);
      } else {
        await SecureStore.deleteItemAsync(key);
        console.log(`[secureStoreWrapper] Deleted ${key} from SecureStore`);
      }
    } catch (err) {
      console.error(`[secureStoreWrapper] Error deleting ${key}:`, err.message);
      throw new Error(`Failed to delete ${key}: ${err.message}`);
    }
  },
};

export default secureStoreWrapper;