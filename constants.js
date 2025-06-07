// src/constants.js
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Treasury wallet configuration
let TREASURY_PRIVATE_KEY = null;
let TREASURY_PUBLIC_KEY = null;

// Fallback public key (valid Solana address for safety)
const FALLBACK_PUBLIC_KEY = '3p1HL3nY5LUNwuAj6dKLRiseSU93UYRqYPGbR7LQaWd5';
const isValidBase58 = (str) => {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return typeof str === 'string' && base58Regex.test(str);
};

if (process.env.BACKEND_WALLET_PRIVATE_KEY) {
  try {
    const rawKey = process.env.BACKEND_WALLET_PRIVATE_KEY.trim();
    console.log('[constants.js] Raw BACKEND_WALLET_PRIVATE_KEY:', rawKey);
    if (!isValidBase58(rawKey)) {
      throw new Error('Invalid Base58 characters in BACKEND_WALLET_PRIVATE_KEY');
    }
    const privateKeyBytes = bs58.decode(rawKey);
    if (privateKeyBytes.length !== 64) {
      throw new Error(`Invalid private key length: expected 64 bytes, got ${privateKeyBytes.length}`);
    }
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    TREASURY_PRIVATE_KEY = rawKey;
    TREASURY_PUBLIC_KEY = keypair.publicKey.toString();
    console.log(`[constants.js] Reward wallet: ${TREASURY_PUBLIC_KEY}`);
  } catch (error) {
    console.error('[constants.js] Failed to parse BACKEND_WALLET_PRIVATE_KEY:', error.message);
    TREASURY_PRIVATE_KEY = null;
    TREASURY_PUBLIC_KEY = FALLBACK_PUBLIC_KEY;
    console.warn(`[constants.js] Using fallback reward wallet: ${FALLBACK_PUBLIC_KEY}`);
  }
} else {
  console.warn('[constants.js] BACKEND_WALLET_PRIVATE_KEY not found in .env. Using fallback.');
  TREASURY_PRIVATE_KEY = null;
  TREASURY_PUBLIC_KEY = FALLBACK_PUBLIC_KEY;
  console.warn(`[constants.js] Using fallback reward wallet: ${FALLBACK_PUBLIC_KEY}`);
}

export { TREASURY_PRIVATE_KEY, TREASURY_PUBLIC_KEY };

export const AMETHYST_MINT_ADDRESS = new PublicKey('4TxguLvR4vXwpS4CJXEemZ9DUhVYjhmsaTkqJkYrpump');
export const SMP_MINT_ADDRESS = new PublicKey('SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor');
export const USDC_MINT_ADDRESS = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
export const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90';
export const TARGET_WALLET = TREASURY_PUBLIC_KEY;
export const SMP_DECIMALS = 6;
export const AMETHYST_DECIMALS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000;
