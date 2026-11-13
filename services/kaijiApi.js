import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token';
import { supabase } from './supabaseClient';

/**
 * Wallet-based Kaiji client. No Supabase sign-in is needed: a player is their wallet.
 *
 * How a player proves who they are:
 *  - the app makes a random 32-byte secret and puts sha256(secret) into the deposit transaction as a memo
 *  - the server reads that memo and the wallet that signed the transfer from the chain
 *  - every later call sends the secret, which only the depositor knows
 * The secret is kept in SecureStore so a match can be resumed after the app is closed.
 */

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const SESSION_KEY = 'kaiji_session_v1'; // { secret, matchId, signature?, wager?, at }

// join errors that will never succeed on retry
const FINAL_JOIN_ERRORS = [
  'deposit_refunded', 'deposit_already_used', 'already_in_match', 'not_allowed', 'wager_out_of_range',
  'deposit_memo_missing', 'deposit_amount_mismatch', 'deposit_tx_failed', 'deposit_tx_too_old', 'deposit_no_single_depositor',
];

async function call(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('kaiji', { body: { action, ...payload } });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch (e) {
      // keep the default message
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---- local session (the secret) --------------------------------------------------------------
export async function loadSession() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
const saveSession = (s) => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s));
export const clearSession = () => SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
async function secretOrThrow() {
  const s = await loadSession();
  if (!s?.secret) throw new Error('no_session');
  return s.secret;
}

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const newSecret = () => toHex(Crypto.getRandomBytes(32));
const sha256Hex = (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);

// ---- config ----------------------------------------------------------------------------------
const configCache = {};
export async function getKaijiConfig(walletAddress = '') {
  if (!configCache[walletAddress]) configCache[walletAddress] = await call('config', { wallet: walletAddress });
  return configCache[walletAddress]; // { mint, escrow, decimals, rpcUrl, minWager, maxWager, allowed, restricted, ... }
}

export const toBaseUnits = (tokens, decimals) => BigInt(Math.round(tokens * 10 ** decimals));
export const fromBaseUnits = (units, decimals) => Number(units) / 10 ** decimals;

/**
 * Sign the wager transfer (+ memo) with signTransactionOnly from EmbeddedWalletContext, broadcast it on the
 * Kaiji cluster ourselves (signAndSendTransaction always uses the app-wide RPC_URL), then ask the server to
 * verify it and find an opponent. Resolves to { match, side }; status stays 'waiting' until someone joins.
 */
export async function depositAndJoin({ wallet, signTransactionOnly, wagerTokens }) {
  const owner = new PublicKey(wallet.publicKey);
  const cfg = await getKaijiConfig(owner.toBase58());
  if (!cfg.allowed) throw new Error('not_allowed');
  const amount = toBaseUnits(wagerTokens, cfg.decimals);
  if (amount < BigInt(cfg.minWager) || amount > BigInt(cfg.maxWager)) throw new Error('wager_out_of_range');

  const secret = newSecret();
  const commitment = await sha256Hex(secret);
  await saveSession({ secret, matchId: null, at: Date.now() }); // saved BEFORE paying, so a crash can never orphan a deposit

  const mint = new PublicKey(cfg.mint);
  const escrow = new PublicKey(cfg.escrow);
  const tx = new Transaction().add(
    createTransferInstruction(
      getAssociatedTokenAddressSync(mint, owner),
      getAssociatedTokenAddressSync(mint, escrow),
      owner,
      amount
    ),
    new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM_ID, data: Buffer.from(`kaiji:${commitment}`, 'utf8') })
  );
  const connection = new Connection(cfg.rpcUrl, 'confirmed');
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  const signedBase64 = await signTransactionOnly(tx); // shows the password or biometric prompt
  const signature = await connection.sendRawTransaction(Buffer.from(signedBase64, 'base64'), {
    skipPreflight: false,
    maxRetries: 3,
  });
  // remember the signature right away: if the app dies now, resumeMatch() finishes the join on the next start
  await saveSession({ secret, matchId: null, signature, wager: amount.toString(), at: Date.now() });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  try {
    const { match, side } = await call('join', { signature, wager: amount.toString(), secret });
    await saveSession({ secret, matchId: match.id, at: Date.now() });
    return { match, side };
  } catch (e) {
    if (FINAL_JOIN_ERRORS.includes(e.message)) await clearSession();
    throw e;
  }
}

// ---- during a match --------------------------------------------------------------------------
/** Resume after the app was closed. Resolves to { match, side, rounds } or null. */
export async function resumeMatch() {
  const s = await loadSession();
  if (!s?.secret) return null;

  // A deposit was sent but the join never finished (app closed, no signal). Finish it now. It is safe to
  // repeat: the server returns the same match for the same signature and secret.
  if (s.signature && !s.matchId) {
    try {
      const { match } = await call('join', { signature: s.signature, wager: s.wager, secret: s.secret });
      s.matchId = match.id;
      await saveSession({ secret: s.secret, matchId: match.id, at: Date.now() });
    } catch (e) {
      const stale = Date.now() - (s.at || 0) > 20 * 60 * 1000;
      if (FINAL_JOIN_ERRORS.includes(e.message) || stale) await clearSession();
      return null;
    }
  }

  try {
    const state = await call('state', { secret: s.secret, matchId: s.matchId || undefined });
    if (!state.match) {
      await clearSession();
      return null;
    }
    return state;
  } catch (e) {
    return null;
  }
}

export const getMatchState = async (matchId) => call('state', { secret: await secretOrThrow(), matchId });
export const submitPick = async (matchId, card) => (await call('pick', { secret: await secretOrThrow(), matchId, card })).match; // 'R' | 'P' | 'S'
export const cancelWaiting = async (matchId) => (await call('cancel', { secret: await secretOrThrow(), matchId })).match;

/**
 * Poll the match state (default every 1.5s). The server applies pick timeouts when it is polled, and the
 * `rounds` array grows by one each time a round is resolved, which is what the reveal animation keys off.
 * Returns a stop function.
 */
export function watchMatch(matchId, { onState, onError, intervalMs = 1500 }) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const state = await getMatchState(matchId);
      if (!stopped) onState?.(state);
    } catch (e) {
      if (!stopped) onError?.(e);
    }
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
