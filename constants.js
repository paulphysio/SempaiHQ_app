// src/constants.js
import { Keypair, PublicKey } from '@solana/web3.js';

let TREASURY_KEYPAIR;
let TREASURY_PUBLIC_KEY;

if (process.env.BACKEND_WALLET_KEYPAIR) {
  try {
    const treasuryKeypairArray = JSON.parse(process.env.BACKEND_WALLET_KEYPAIR);
    TREASURY_KEYPAIR = Keypair.fromSecretKey(new Uint8Array(treasuryKeypairArray));
    TREASURY_PUBLIC_KEY = TREASURY_KEYPAIR.publicKey.toString();
  } catch (error) {
    console.error('Failed to parse BACKEND_WALLET_KEYPAIR:', error);
  }
} else {
  console.warn('BACKEND_WALLET_KEYPAIR not found in .env');
}

export { TREASURY_KEYPAIR, TREASURY_PUBLIC_KEY };

export const AMETHYST_MINT_ADDRESS = new PublicKey('4TxguLvR4vXwpS4CJXEemZ9DUhVYjhmsaTkqJkYrpump');
export const SMP_MINT_ADDRESS = new PublicKey('SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor');
export const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90';
export const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
export const TARGET_WALLET = TREASURY_PUBLIC_KEY || 'Fallback_Wallet_Address'; // Replace with actual fallback if needed
export const SMP_DECIMALS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000;