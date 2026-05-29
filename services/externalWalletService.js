import { Platform, Linking } from 'react-native';
import { PublicKey, Transaction } from '@solana/web3.js';

const API_BASE_URL = 'https://sempaihq.com/api';

/**
 * External wallet service for connecting to Phantom, Solflare, and other mobile wallets
 * Supports deep linking to mobile wallet apps
 */

const WALLET_DEEP_LINKS = {
  phantom: {
    ios: 'phantom://',
    android: 'phantom://',
    web: 'https://phantom.app/ul/v1/'
  },
  solflare: {
    ios: 'solflare://',
    android: 'solflare://',
    web: 'https://solflare.com/ul/v1/'
  },
  backpack: {
    ios: 'backpack://',
    android: 'backpack://',
    web: 'https://backpack.app/ul/v1/'
  }
};

/**
 * Check if a wallet app is installed
 */
export const isWalletInstalled = async (walletName) => {
  try {
    const deepLink = WALLET_DEEP_LINKS[walletName]?.[Platform.OS] || WALLET_DEEP_LINKS[walletName]?.web;
    if (!deepLink) return false;
    
    // For mobile, we can check if the deep link can be opened
    if (Platform.OS !== 'web') {
      const canOpen = await Linking.canOpenURL(deepLink);
      return canOpen;
    }
    
    return true;
  } catch (error) {
    console.error('[ExternalWalletService] Error checking wallet installation:', error);
    return false;
  }
};

/**
 * Connect to an external wallet via deep link
 */
export const connectExternalWallet = async (walletName, dappUrl) => {
  try {
    const deepLink = WALLET_DEEP_LINKS[walletName]?.[Platform.OS] || WALLET_DEEP_LINKS[walletName]?.web;
    if (!deepLink) {
      throw new Error(`Wallet ${walletName} not supported`);
    }

    const cluster = 'mainnet-beta';
    const appUrl = encodeURIComponent(dappUrl || 'https://sempaihq.com');
    
    // Construct the connect URL
    const connectUrl = `${deepLink}connect?dapp_encryption_public_key=${encodeURIComponent('placeholder_public_key')}&cluster=${cluster}&app_url=${appUrl}`;
    
    // Open the wallet app
    await Linking.openURL(connectUrl);
    
    return { success: true, walletName };
  } catch (error) {
    console.error('[ExternalWalletService] Error connecting to wallet:', error);
    throw error;
  }
};

/**
 * Sign a transaction with external wallet
 */
export const signTransactionWithExternalWallet = async (walletName, transaction, dappUrl) => {
  try {
    const deepLink = WALLET_DEEP_LINKS[walletName]?.[Platform.OS] || WALLET_DEEP_LINKS[walletName]?.web;
    if (!deepLink) {
      throw new Error(`Wallet ${walletName} not supported`);
    }

    const cluster = 'mainnet-beta';
    const appUrl = encodeURIComponent(dappUrl || 'https://sempaihq.com');
    
    // Serialize the transaction
    const serializedTransaction = transaction.serialize({ requireAllSignatures: false }).toString('base64');
    
    // Construct the sign URL
    const signUrl = `${deepLink}signTransaction?dapp_encryption_public_key=${encodeURIComponent('placeholder_public_key')}&cluster=${cluster}&app_url=${appUrl}&transaction=${encodeURIComponent(serializedTransaction)}`;
    
    // Open the wallet app
    await Linking.openURL(signUrl);
    
    return { success: true, walletName };
  } catch (error) {
    console.error('[ExternalWalletService] Error signing transaction:', error);
    throw error;
  }
};

/**
 * Get list of supported external wallets
 */
export const getSupportedWallets = () => {
  return Object.keys(WALLET_DEEP_LINKS).map(walletName => ({
    name: walletName,
    displayName: walletName.charAt(0).toUpperCase() + walletName.slice(1),
    deepLink: WALLET_DEEP_LINKS[walletName][Platform.OS] || WALLET_DEEP_LINKS[walletName].web
  }));
};

/**
 * Disconnect from external wallet
 */
export const disconnectExternalWallet = async (walletName) => {
  try {
    // For external wallets, disconnection is handled by the wallet app
    // We just need to clear the local state
    console.log('[ExternalWalletService] Disconnected from wallet:', walletName);
    return { success: true };
  } catch (error) {
    console.error('[ExternalWalletService] Error disconnecting wallet:', error);
    throw error;
  }
};

/**
 * Get wallet balance via API
 */
export const getWalletBalance = async (walletAddress, mintAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[ExternalWalletService] Error getting wallet balance:', error);
    throw error;
  }
};

export default {
  isWalletInstalled,
  connectExternalWallet,
  signTransactionWithExternalWallet,
  getSupportedWallets,
  disconnectExternalWallet,
  getWalletBalance
};
