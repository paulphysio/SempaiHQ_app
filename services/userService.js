import { supabase } from './supabaseClient';
import { generateWalletKeypair, storePrivateKey, getPrivateKey } from '../utils/cryptoUtils';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Table names from the schema
const USER_WALLETS_TABLE = 'user_wallets';
const USERS_TABLE = 'users';
const WALLET_BALANCES_TABLE = 'wallet_balances';
const PROFILES_TABLE = 'writer_profiles';

/**
 * Check if a user exists in the database
 * @param {string} userId - User's ID from authentication
 * @returns {Promise<Object|null>} - User data or null if not found
 */
export const checkUserExists = async (userId) => {
  try {
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error && error.code !== 'PGREST116') {
      // PGREST116 is the error code for "no rows returned"
      console.error('Error checking user:', error);
      throw error;
    }
    
    return data || null;
  } catch (error) {
    console.error('Error in checkUserExists:', error);
    return null;
  }
};

/**
 * Create a new user in the database without a wallet
 * @param {Object} userData - User data including userId, email, name, picture, etc.
 * @returns {Promise<Object>} - Created user data
 */
export const createUser = async (userData) => {
  try {
    const createdAt = new Date();
    
    // 1. Create the user in the users table
    const { data: userData1, error: userError } = await supabase
      .from(USERS_TABLE)
      .upsert({
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email?.split('@')[0],
        image: userData.picture,
        wallet_address: null, // Will be set when wallet is created
        has_updated_profile: false,
        balance: 0,
        weekly_points: 0
      }, { onConflict: 'id' })
      .select()
      .single();
      
    if (userError) {
      console.error('Error creating/updating user:', userError);
      throw userError;
    }
    
    // 2. Create an empty profile for the user
    const { error: profileError } = await supabase
      .from(PROFILES_TABLE)
      .insert({
        user_id: userData.id,
        bio: '',
        created_at: createdAt
      });
      
    if (profileError && !profileError.message.includes('duplicate')) {
      console.error('Error creating user profile:', profileError);
      // Don't throw here, as profile is not critical for wallet functionality
    }
    
    return userData1;
  } catch (error) {
    console.error('Error in createUser:', error);
    throw new Error('Failed to create user');
  }
};

/**
 * Create a wallet for an existing user
 * @param {string} userId - User ID
 * @param {string} email - User's email for secure storage
 * @returns {Promise<Object>} - Created wallet data
 */
export const createUserWallet = async (userId, email) => {
  try {
    // Generate a new wallet keypair
    const { publicKey, privateKey } = await generateWalletKeypair();
    
    // 1. Create the user wallet
    const { data: walletData, error: walletError } = await supabase
      .from(USER_WALLETS_TABLE)
      .insert({
        user_id: userId,
        address: publicKey,
        private_key: privateKey,
        created_at: new Date()
      })
      .select()
      .single();
      
    if (walletError) {
      console.error('Error creating user wallet:', walletError);
      throw walletError;
    }
    
    // 2. Update user's wallet address
    const { error: updateError } = await supabase
      .from(USERS_TABLE)
      .update({ wallet_address: publicKey })
      .eq('id', userId);
      
    if (updateError) {
      console.error('Error updating user wallet address:', updateError);
      throw updateError;
    }
    
    // 3. Create initial wallet balance records for SOL and SMP
    const balanceEntries = [
      {
        user_id: userId,
        wallet_address: publicKey,
        chain: 'solana',
        currency: 'SOL',
        amount: 0,
        decimals: 9
      },
      {
        user_id: userId,
        wallet_address: publicKey,
        chain: 'solana',
        currency: 'SMP',
        amount: 0,
        decimals: 6
      }
    ];
    
    const { error: balanceError } = await supabase
      .from(WALLET_BALANCES_TABLE)
      .insert(balanceEntries);
      
    if (balanceError) {
      console.error('Error creating wallet balances:', balanceError);
      throw balanceError;
    }
    
    // Store private key in device secure storage
    await storePrivateKey(privateKey, email);
    
    return walletData;
  } catch (error) {
    console.error('Error in createUserWallet:', error);
    throw new Error('Failed to create user wallet');
  }
};

/**
 * Get user wallet info from database and ensure it's stored in device
 * @param {string} userId - User's ID
 * @param {string} email - User's email (needed for secure storage)
 * @returns {Promise<Object>} - Wallet info including public key
 */
export const getUserWallet = async (userId, email) => {
  try {
    // Check if user exists in database
    const userData = await checkUserExists(userId);
    
    if (!userData) {
      throw new Error('User wallet not found');
    }
    
    // Get private key from secure storage
    let privateKey = await getPrivateKey(email);
    
    // If not in secure storage, get from database and store it
    if (!privateKey) {
      console.log(`Private key not found in secure storage for user ${userId}, attempting recovery from database`);
      privateKey = userData.private_key;
      if (privateKey) {
        await storePrivateKey(privateKey, email);
        console.log(`Successfully recovered private key from database for user ${userId}`);
        
        // Also store in SecureStore for the wallet component
        await SecureStore.setItemAsync('walletPublicKey', userData.address);
        await SecureStore.setItemAsync('walletAddress', userData.address);
        
        // Create a temporary password-based storage for ConnectButton component
        const tempPassword = 'temp-' + Math.random().toString(36).substring(2, 10);
        const storageKey = `wallet-secret-${userData.address}-${tempPassword}`;
        await SecureStore.setItemAsync(storageKey, privateKey);
        console.log(`Created temporary password-protected storage for wallet`);
      } else {
        console.error(`No private key found in database for user ${userId}`);
      }
    } else {
      console.log(`Found private key in secure storage for user ${userId}`);
    }
    
    return {
      publicKey: userData.address,
      hasPrivateKey: !!privateKey
    };
  } catch (error) {
    console.error('Error in getUserWallet:', error);
    throw new Error('Failed to get user wallet');
  }
};

/**
 * Process user authentication - create new user or get existing user
 * @param {Object} googleUser - User data from Google Auth
 * @returns {Promise<Object>} - Processed user data with wallet info
 */
export const processUserAuth = async (googleUser) => {
  try {
    const userId = googleUser.id;
    const email = googleUser.email;
    const name = googleUser.name || googleUser.user_metadata?.full_name;
    const picture = googleUser.picture || googleUser.user_metadata?.avatar_url;
    
    // Check if user already exists
    const existingWallet = await checkUserExists(userId);
    
    if (existingWallet) {
      console.log(`User ${userId} already exists, ensuring wallet data is properly stored`);
      
      // User exists, ensure private key is in secure storage
      const privateKey = existingWallet.private_key;
      if (!privateKey) {
        console.warn(`No private key found in database for existing user ${userId}`);
      } else {
        await storePrivateKey(privateKey, email);
        console.log(`Stored private key in secure storage for user ${userId}`);
        
        // Create a temporary password-based storage for ConnectButton component
        const tempPassword = 'temp-' + Math.random().toString(36).substring(2, 10);
        const storageKey = `wallet-secret-${existingWallet.address}-${tempPassword}`;
        await SecureStore.setItemAsync(storageKey, privateKey);
        console.log(`Created temporary password-protected storage for wallet recovery`);
      }
      
      // Store the wallet address in SecureStore for the wallet component
      await SecureStore.setItemAsync('walletPublicKey', existingWallet.address);
      await SecureStore.setItemAsync('walletAddress', existingWallet.address);
      console.log(`Stored wallet addresses in secure storage: ${existingWallet.address}`);
      
      // Update user data in users table to ensure it's current
      const { error: updateError } = await supabase
        .from(USERS_TABLE)
        .upsert({
          id: userId,
          email: email,
          name: name || email?.split('@')[0],
          image: picture,
          wallet_address: existingWallet.address
        }, { onConflict: 'id' });
        
      if (updateError) {
        console.error('Error updating user data:', updateError);
        // Continue despite error, as wallet functionality is more important
      } else {
        console.log(`Updated user data in ${USERS_TABLE} table`);
      }
      
      return {
        ...existingWallet,
        isNewUser: false
      };
    } else {
      console.log(`User ${userId} does not exist, creating new user and wallet`);
      // Create new user with wallet and all associated records
      const newWallet = await createUser({
        id: userId,
        email: email,
        name: name,
        picture: picture
      });
      
      // Store the wallet address in SecureStore for the wallet component
      await SecureStore.setItemAsync('walletPublicKey', newWallet.address);
      await SecureStore.setItemAsync('walletAddress', newWallet.address);
      console.log(`Stored new wallet addresses in secure storage: ${newWallet.address}`);
      
      // Create a temporary password-based storage for ConnectButton component
      if (newWallet.private_key) {
        const tempPassword = 'temp-' + Math.random().toString(36).substring(2, 10);
        const storageKey = `wallet-secret-${newWallet.address}-${tempPassword}`;
        await SecureStore.setItemAsync(storageKey, newWallet.private_key);
        console.log(`Created temporary password-protected storage for new wallet`);
      }
      
      return {
        ...newWallet,
        isNewUser: true
      };
    }
  } catch (error) {
    console.error('Error in processUserAuth:', error);
    throw new Error('Failed to process user authentication');
  }
};
