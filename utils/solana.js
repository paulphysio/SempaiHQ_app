import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { SMP_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../constants';

/**
 * Fetch the on-chain SMP SPL token balance for a given wallet address.
 * @param {string|PublicKey} walletAddress - The wallet public key (string or PublicKey)
 * @returns {Promise<number>} The SMP token balance (in SMP, not atomic units)
 */
export async function fetchSmpTokenBalance(walletAddress) {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const ata = await getAssociatedTokenAddress(
      SMP_MINT_ADDRESS,
      typeof walletAddress === 'string' ? new PublicKey(walletAddress) : walletAddress
    );
    const account = await getAccount(connection, ata);
    // account.amount is a BigInt
    return Number(account.amount) / Math.pow(10, SMP_DECIMALS);
  } catch (err) {
    // If the user does not have an ATA, treat as zero balance
    if (err.message && err.message.includes('Failed to find account')) {
      return 0;
    }
    console.error('[fetchSmpTokenBalance] Error:', err);
    throw err;
  }
}
