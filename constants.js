// src/constants.js
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Treasury wallet configuration
let TREASURY_PRIVATE_KEY;
let TREASURY_PUBLIC_KEY;

// Fallback public key (replace with a valid Solana address for production)
const FALLBACK_PUBLIC_KEY = '11111111111111111111111111111111';

if (process.env.BACKEND_WALLET_PRIVATE_KEY) {
  try {
    TREASURY_PRIVATE_KEY = process.env.BACKEND_WALLET_PRIVATE_KEY.trim();
    const privateKeyBytes = bs58.decode(TREASURY_PRIVATE_KEY);
    if (privateKeyBytes.length !== 64) {
      throw new Error('Invalid treasury private key: Must be 64 bytes');
    }
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    TREASURY_PUBLIC_KEY = keypair.publicKey.toString();
    console.log(`[constants.js] Reward wallet address: ${TREASURY_PUBLIC_KEY}`);
  } catch (error) {
    console.error('[constants.js] Failed to parse BACKEND_WALLET_PRIVATE_KEY:', error);
    TREASURY_PRIVATE_KEY = null;
    TREASURY_PUBLIC_KEY = FALLBACK_PUBLIC_KEY;
    console.warn(`[constants.js] Using fallback reward wallet address: ${FALLBACK_PUBLIC_KEY}`);
  }
} else {
  console.warn('[constants.js] BACKEND_WALLET_PRIVATE_KEY not found in .env. Using fallback public key.');
  TREASURY_PRIVATE_KEY = null;
  TREASURY_PUBLIC_KEY = FALLBACK_PUBLIC_KEY;
  console.warn(`[constants.js] Using fallback reward wallet address: ${FALLBACK_PUBLIC_KEY}`);
}

export { TREASURY_PRIVATE_KEY, TREASURY_PUBLIC_KEY };

export const AMETHYST_MINT_ADDRESS = new PublicKey('4TxguLvR4vXwpS4CJXEemZ9DUhVYjhmsaTkqJkYrpump');
export const SMP_MINT_ADDRESS = new PublicKey('SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor');
export const USDC_MINT_ADDRESS = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const DEVNET_RPC_URL = "https://api.devnet.solana.com"; // Separate Devnet RP
export const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90"; 
export const TARGET_WALLET = TREASURY_PUBLIC_KEY;
export const SMP_DECIMALS = 6;
export const AMETHYST_DECIMALS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000;