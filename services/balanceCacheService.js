import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

const CACHE_PREFIX = 'balance_cache_';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes default
const LONG_CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes for stable balances

/**
 * Advanced balance caching service
 * Provides intelligent caching with different expiry times for different token types
 */

/**
 * Get cached balance with automatic expiry check
 */
export const getCachedBalance = async (walletAddress, tokenType) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${tokenType}_${walletAddress}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    
    if (!cachedData) return null;
    
    const { balance, timestamp } = JSON.parse(cachedData);
    const now = Date.now();
    
    // Use different expiry based on token type
    const expiry = tokenType === 'SMP' ? CACHE_EXPIRY : LONG_CACHE_EXPIRY;
    
    if (now - timestamp > expiry) {
      // Cache expired
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }
    
    return balance;
  } catch (error) {
    console.error('[BalanceCacheService] Error getting cached balance:', error);
    return null;
  }
};

/**
 * Set cached balance with timestamp
 */
export const setCachedBalance = async (walletAddress, tokenType, balance) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${tokenType}_${walletAddress}`;
    const cacheData = {
      balance,
      timestamp: Date.now()
    };
    
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    console.log(`[BalanceCacheService] Cached ${tokenType} balance for ${walletAddress}`);
  } catch (error) {
    console.error('[BalanceCacheService] Error setting cached balance:', error);
  }
};

/**
 * Invalidate cached balance for a specific token
 */
export const invalidateCachedBalance = async (walletAddress, tokenType) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${tokenType}_${walletAddress}`;
    await AsyncStorage.removeItem(cacheKey);
    console.log(`[BalanceCacheService] Invalidated ${tokenType} balance cache for ${walletAddress}`);
  } catch (error) {
    console.error('[BalanceCacheService] Error invalidating cache:', error);
  }
};

/**
 * Invalidate all cached balances for a wallet
 */
export const invalidateAllCachedBalances = async (walletAddress) => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const walletKeys = keys.filter(key => key.startsWith(CACHE_PREFIX) && key.includes(walletAddress));
    
    await AsyncStorage.multiRemove(walletKeys);
    console.log(`[BalanceCacheService] Invalidated all balance caches for ${walletAddress}`);
  } catch (error) {
    console.error('[BalanceCacheService] Error invalidating all caches:', error);
  }
};

/**
 * Get balance with intelligent caching
 * Returns cached balance if available and fresh, otherwise fetches fresh balance
 */
export const getBalanceWithCache = async (walletAddress, tokenType, fetchFunction) => {
  try {
    // Try to get cached balance first
    const cachedBalance = await getCachedBalance(walletAddress, tokenType);
    
    if (cachedBalance !== null) {
      console.log(`[BalanceCacheService] Using cached ${tokenType} balance: ${cachedBalance}`);
      return cachedBalance;
    }
    
    // Fetch fresh balance
    console.log(`[BalanceCacheService] Fetching fresh ${tokenType} balance`);
    const freshBalance = await fetchFunction(walletAddress);
    
    // Cache the fresh balance
    await setCachedBalance(walletAddress, tokenType, freshBalance);
    
    return freshBalance;
  } catch (error) {
    console.error('[BalanceCacheService] Error getting balance with cache:', error);
    throw error;
  }
};

/**
 * Prefetch balances for multiple tokens
 * Useful for loading screens to prepare data
 */
export const prefetchBalances = async (walletAddress, tokenTypes, fetchFunctions) => {
  try {
    const promises = tokenTypes.map(async (tokenType) => {
      const cachedBalance = await getCachedBalance(walletAddress, tokenType);
      
      if (cachedBalance === null && fetchFunctions[tokenType]) {
        const freshBalance = await fetchFunctions[tokenType](walletAddress);
        await setCachedBalance(walletAddress, tokenType, freshBalance);
        return { tokenType, balance: freshBalance };
      }
      
      return { tokenType, balance: cachedBalance };
    });
    
    const results = await Promise.all(promises);
    console.log('[BalanceCacheService] Prefetched balances:', results);
    return results;
  } catch (error) {
    console.error('[BalanceCacheService] Error prefetching balances:', error);
    return [];
  }
};

/**
 * Get cache statistics for debugging
 */
export const getCacheStats = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const balanceKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    const stats = {
      totalCachedBalances: balanceKeys.length,
      keys: balanceKeys
    };
    
    return stats;
  } catch (error) {
    console.error('[BalanceCacheService] Error getting cache stats:', error);
    return { totalCachedBalances: 0, keys: [] };
  }
};

/**
 * Clear all balance caches (useful for logout)
 */
export const clearAllBalanceCaches = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const balanceKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    await AsyncStorage.multiRemove(balanceKeys);
    console.log('[BalanceCacheService] Cleared all balance caches');
  } catch (error) {
    console.error('[BalanceCacheService] Error clearing all caches:', error);
  }
};

export default {
  getCachedBalance,
  setCachedBalance,
  invalidateCachedBalance,
  invalidateAllCachedBalances,
  getBalanceWithCache,
  prefetchBalances,
  getCacheStats,
  clearAllBalanceCaches
};
