import { Platform } from 'react-native';
import { PublicKey, Keypair } from '@solana/web3.js';

// Handle bs58 import for ESM compatibility
let bs58;
try {
  bs58 = require('bs58');
} catch (error) {
  console.warn('[constants.js] Failed to load bs58 with require, trying import:', error.message);
  import('bs58').then(module => {
    bs58 = module.default;
  }).catch(err => {
    console.error('[constants.js] Failed to load bs58:', err.message);
  });
}

// Treasury wallet configuration
// The ONLY treasury: all platform shares and payments go here. Public
// address only — no private key is read or kept anywhere in this code.
const TREASURY_PUBLIC_KEY = '71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD';

export { TREASURY_PUBLIC_KEY };

export const AMETHYST_MINT_ADDRESS = new PublicKey('4TxguLvR4vXwpS4CJXEemZ9DUhVYjhmsaTkqJkYrpump');
export const SMP_MINT_ADDRESS = new PublicKey('SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor');
export const USDC_MINT_ADDRESS = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const SKR_MINT_ADDRESS = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');
export const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
// Set true ONLY for devnet testing — NEVER ship with this on.
export const USE_DEVNET = false;
export const RPC_URL = USE_DEVNET ? DEVNET_RPC_URL : 'https://mainnet.helius-rpc.com/?api-key=10569fbb-6306-4fd1-868d-ae082d32204a';
export const FALLBACK_RPC_URL = 'https://api.mainnet-beta.solana.com';
export const TARGET_WALLET = TREASURY_PUBLIC_KEY;
// Sempai treasury share for manga subscriptions — must match TREASURY_WALLET
// in subscribe-manga / subscribe-manga-devnet edge functions.
export const MANGA_TREASURY_WALLET = '71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD';
export const SMP_DECIMALS = 6;
export const AMETHYST_DECIMALS = 6;
export const USDC_DECIMALS = 6;
export const SKR_DECIMALS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000;

// Web API URL for fetching fallback SMP price
export const WEB_API_BASE_URL = 'https://www.sempaihq.com';

// The website's API (/api/*). On the web the app is served by that same website (app.sempaihq.com),
// so it calls its own /api — a call to another domain would be blocked by the browser.
export const SITE_API = Platform.OS === 'web' ? '/api' : 'https://sempaihq.com/api';
