/*
 * Wallet vault (v2) — the wallet key is locked ON THE PHONE with the user's
 * wallet password, then wrapped once more by the server. The server never
 * sees the password or the key, so a server or database breach alone can't
 * open any wallet.
 *
 *   12 recovery words ──► wallet key (same derivation as Phantom/Solflare:
 *                         m/44'/501'/0'/0')
 *   wallet key ──► locked with a random data key (XChaCha20-Poly1305)
 *   data key   ──► locked with the wallet password (scrypt → XChaCha20)
 *                  [a passkey slot can be added later — same data key]
 *   whole vault ─► wrapped by the server (wallet-encryption) → "v2:…" in DB
 *
 * Pure JavaScript (@noble / @scure) — ships over the air.
 */
import { scryptAsync } from '@noble/hashes/scrypt';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2';
import { randomBytes } from '@noble/hashes/utils';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { supabase } from './supabaseClient';

export const VAULT_PREFIX = 'v2:';
// scrypt cost: ~1–3 s on a phone, once per unlock on a new device. Each
// password guess costs an attacker the same.
const KDF = { name: 'scrypt', N: 2 ** 15, r: 8, p: 1 };
const SOLANA_PATH = [44, 501, 0, 0]; // m/44'/501'/0'/0'

const utf8 = (s) => new Uint8Array(Buffer.from(String(s), 'utf8'));
const b64 = (u8) => Buffer.from(u8).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(String(s), 'base64'));
const normalizeWords = (w) =>
  (Array.isArray(w) ? w.join(' ') : String(w || '')).trim().toLowerCase().split(/\s+/).join(' ');

export const MIN_PASSWORD_LENGTH = 10;
export const isV2 = (stored) => typeof stored === 'string' && stored.startsWith(VAULT_PREFIX);

// ── recovery words ─────────────────────────────────────────────────────────
export const newRecoveryWords = () => generateMnemonic(wordlist, 128).split(' ');
export const isValidRecoveryWords = (words) => validateMnemonic(normalizeWords(words), wordlist);
export const isRecoveryWord = (w) => wordlist.includes(String(w || '').trim().toLowerCase());

// SLIP-0010 ed25519 (all-hardened path), as used by Phantom & Solflare.
function slip10Ed25519(seed, path) {
  let I = hmac(sha512, utf8('ed25519 seed'), seed);
  let key = I.slice(0, 32);
  let chain = I.slice(32);
  for (const index of path) {
    const i = (index | 0x80000000) >>> 0;
    const data = new Uint8Array(37);
    data[0] = 0;
    data.set(key, 1);
    data[33] = (i >>> 24) & 255;
    data[34] = (i >>> 16) & 255;
    data[35] = (i >>> 8) & 255;
    data[36] = i & 255;
    I = hmac(sha512, chain, data);
    key = I.slice(0, 32);
    chain = I.slice(32);
  }
  return key;
}

export const addressOf = (secretKey) => bs58.encode(nacl.sign.keyPair.fromSecretKey(secretKey).publicKey);

/** 12 words → { secretKey (64 bytes), address }. */
export async function walletFromRecoveryWords(words) {
  const phrase = normalizeWords(words);
  if (!validateMnemonic(phrase, wordlist)) {
    throw new Error('Those recovery words aren’t valid. Check the spelling and the order.');
  }
  const seed = await mnemonicToSeed(phrase);
  const kp = nacl.sign.keyPair.fromSeed(slip10Ed25519(seed, SOLANA_PATH));
  return { secretKey: kp.secretKey, address: bs58.encode(kp.publicKey) };
}

// ── password lock ──────────────────────────────────────────────────────────
function passwordKey(password, salt, kdf = KDF) {
  return scryptAsync(utf8(String(password).normalize('NFKC')), salt, {
    N: kdf.N, r: kdf.r, p: kdf.p, dkLen: 32, asyncTick: 20,
  });
}

/** Lock a wallet key with the wallet password → vault JSON (no server involved). */
export async function sealVault({ secretKey, password }) {
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Your wallet password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const address = addressOf(secretKey);
  const dataKey = randomBytes(32);
  const walletNonce = randomBytes(24);
  const lockedWallet = xchacha20poly1305(dataKey, walletNonce).encrypt(secretKey);
  const salt = randomBytes(16);
  const slotNonce = randomBytes(24);
  const kek = await passwordKey(password, salt);
  const lockedDataKey = xchacha20poly1305(kek, slotNonce).encrypt(dataKey);
  return JSON.stringify({
    v: 2,
    address,
    kdf: KDF,
    wallet: { n: b64(walletNonce), c: b64(lockedWallet) },
    slots: { password: { s: b64(salt), n: b64(slotNonce), c: b64(lockedDataKey) } },
  });
}

/** Open a vault with the wallet password → { secretKey, address }. */
export async function openVaultWithPassword(vaultJson, password) {
  const v = typeof vaultJson === 'string' ? JSON.parse(vaultJson) : vaultJson;
  if (v?.v !== 2 || !v.slots?.password) throw new Error('This wallet backup uses an unknown format.');
  const slot = v.slots.password;
  const kek = await passwordKey(password, unb64(slot.s), v.kdf);
  let dataKey;
  try {
    dataKey = xchacha20poly1305(kek, unb64(slot.n)).decrypt(unb64(slot.c));
  } catch {
    throw new Error('That wallet password isn’t right.');
  }
  const secretKey = xchacha20poly1305(dataKey, unb64(v.wallet.n)).decrypt(unb64(v.wallet.c));
  if (addressOf(secretKey) !== v.address) throw new Error('Wallet check failed — please contact support.');
  return { secretKey, address: v.address };
}

// ── server's second lock ───────────────────────────────────────────────────
async function invokeVault(action, data) {
  const { data: res, error } = await supabase.functions.invoke('wallet-encryption', { body: { action, data } });
  if (!error && typeof res?.result === 'string') return res.result;
  let message = action === 'encrypt'
    ? 'Couldn’t save your wallet backup. Check your connection and try again.'
    : 'Couldn’t open your wallet backup.';
  try {
    const body = await error?.context?.json?.();
    if (body?.error) message = body.error;
  } catch {}
  throw new Error(message);
}

/** Vault JSON → "v2:<server-wrapped>" (what is stored in the database). */
export async function lockForServer(vaultJson) {
  return VAULT_PREFIX + (await invokeVault('encrypt', vaultJson));
}

/** "v2:<server-wrapped>" → vault JSON (only for the signed-in owner, Google sign-in). */
export async function unlockFromServer(stored) {
  if (!isV2(stored)) throw new Error('Not a new-format wallet backup.');
  return invokeVault('decrypt', stored.slice(VAULT_PREFIX.length));
}

// ── proof that this phone holds the new wallet ─────────────────────────────
export const walletProofMessage = (address, userId, ts) =>
  `SempaiHQ: secure wallet ${address} for ${userId} at ${ts}`;

export function signWalletProof(secretKey, userId, ts) {
  const msg = walletProofMessage(addressOf(secretKey), userId, ts);
  return bs58.encode(nacl.sign.detached(utf8(msg), secretKey));
}
