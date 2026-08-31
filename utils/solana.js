import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { SMP_MINT_ADDRESS, RPC_URL, FALLBACK_RPC_URL, SMP_DECIMALS, LAMPORTS_PER_SOL } from '../constants';

/**
 * Create a Connection with fallback logic
 * @param {string} commitment - Commitment level
 * @returns {Connection} Connection instance
 */
export function createConnectionWithFallback(commitment = 'confirmed') {
  return new Connection(RPC_URL, commitment, {
    confirmTransactionInitialTimeout: 60000,
  });
}

/**
 * Create a Connection with fallback to public RPC
 * @param {string} commitment - Commitment level
 * @returns {Connection} Connection instance
 */
export function createConnectionWithPublicFallback(commitment = 'confirmed') {
  return new Connection(RPC_URL, commitment, {
    confirmTransactionInitialTimeout: 60000,
  });
}

/**
 * Fetch the on-chain SMP SPL token balance for a given wallet address with fallback.
 * @param {string|PublicKey} walletAddress - The wallet public key (string or PublicKey)
 * @returns {Promise<number>} The SMP token balance (in SMP, not atomic units)
 */
export async function fetchSmpTokenBalance(walletAddress) {
  let lastError = null;
  const rpcUrls = [RPC_URL, FALLBACK_RPC_URL];
  
  for (const rpcUrl of rpcUrls) {
    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const ata = await getAssociatedTokenAddress(
        SMP_MINT_ADDRESS,
        typeof walletAddress === 'string' ? new PublicKey(walletAddress) : walletAddress
      );
      const account = await getAccount(connection, ata);
      // account.amount is a BigInt
      return Number(account.amount) / Math.pow(10, SMP_DECIMALS);
    } catch (err) {
      lastError = err;
      // If the user does not have an ATA, treat as zero balance
      if (err.message && err.message.includes('Failed to find account')) {
        return 0;
      }
      console.warn(`[fetchSmpTokenBalance] Failed with ${rpcUrl}, trying next RPC...`);
    }
  }
  
  console.error('[fetchSmpTokenBalance] All RPCs failed:', lastError);
  throw lastError;
}

/**
 * Fetch the SOL balance for a given wallet address with fallback.
 * @param {string|PublicKey} walletAddress - The wallet public key (string or PublicKey)
 * @returns {Promise<number>} The SOL balance (in SOL, not lamports)
 */
export async function fetchSolBalance(walletAddress) {
  let lastError = null;
  const rpcUrls = [RPC_URL, FALLBACK_RPC_URL];
  
  for (const rpcUrl of rpcUrls) {
    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const publicKey = typeof walletAddress === 'string' ? new PublicKey(walletAddress) : walletAddress;
      const lamports = await connection.getBalance(publicKey);
      return lamports / LAMPORTS_PER_SOL;
    } catch (err) {
      lastError = err;
      console.warn(`[fetchSolBalance] Failed with ${rpcUrl}, trying next RPC...`);
    }
  }
  
  console.error('[fetchSolBalance] All RPCs failed:', lastError);
  throw lastError;
}
