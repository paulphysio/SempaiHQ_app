// Cash out USDC through Jupiter Send.
//
// The app puts USDC into a Jupiter Send "magic link" held on-chain by Jupiter's program, tied to a
// 12-character claim code. The person opens Jupiter Mobile, claims the code (Deposit → Receive funds →
// Claim Code) and withdraws to their bank there. Jupiter charges nothing to send or claim; the sender pays
// the Solana network + account costs (shown before sending). Unclaimed links return to the sender
// automatically when they expire, or can be cancelled early (clawback).
//
// The claim code is a bearer secret: whoever has it can claim the USDC. It never leaves this device
// except when the person copies or shares it. Jupiter's API never sees it — only the public key derived
// from it ("inviteSigner").
import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { sha256 } from '@noble/hashes/sha256';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { RPC_URL, USDC_MINT_ADDRESS } from '../constants';

const SEND_API = 'https://lite-api.jup.ag/send/v1';
const PRICE_API = 'https://lite-api.jup.ag/price/v3';
const INVITE_PROGRAM = new PublicKey('inv1tEtSwRMtM44tbvJGNiTxMvDfPVnX9StyqXfDfks');
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_DECIMALS = 6;
const STORE_KEY = 'cashout_links_v1';
const KEEP = 20;

export const CASHOUT_MIN = 1;
export const CASHOUT_MAX = 1000;
export const JUPITER_MOBILE_URL = 'https://jup.ag/mobile';

const connection = new Connection(RPC_URL, 'confirmed');

// ---- claim codes --------------------------------------------------------------------------------
/** A fresh 12-character base58 claim code (Jupiter's format: 13 random bytes, base58, first 12). */
export function newClaimCode() {
  return bs58.encode(Buffer.from(Crypto.getRandomBytes(13))).slice(0, 12);
}

/** The keypair Jupiter's program expects for a claim code: ed25519 seed = sha256("invite:" + code). */
export function claimKeypair(code) {
  return Keypair.fromSeed(sha256(new TextEncoder().encode(`invite:${code}`)));
}

export function invitePda(code) {
  return PublicKey.findProgramAddressSync([Buffer.from('invite'), claimKeypair(code).publicKey.toBuffer()], INVITE_PROGRAM)[0];
}

// ---- saved links (this device only) ------------------------------------------------------------
export async function loadLinks() {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function saveLinks(list) {
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(list.slice(0, KEEP)));
  } catch (e) {
    console.warn('[cashout] could not save links:', e.message);
  }
}

async function upsertLink(entry) {
  const list = await loadLinks();
  const i = list.findIndex((l) => l.code === entry.code);
  if (i >= 0) list[i] = { ...list[i], ...entry };
  else list.unshift(entry);
  await saveLinks(list);
  return list;
}

export async function forgetLink(code) {
  await saveLinks((await loadLinks()).filter((l) => l.code !== code));
}

// ---- balances, prices --------------------------------------------------------------------------
export async function getBalances(owner) {
  const pk = new PublicKey(owner);
  const [lamports, usdc] = await Promise.all([
    connection.getBalance(pk).catch(() => 0),
    connection
      .getTokenAccountBalance(getAssociatedTokenAddressSync(USDC_MINT_ADDRESS, pk))
      .then((r) => Number(r.value.uiAmount || 0))
      .catch(() => 0),
  ]);
  return { sol: lamports / 1e9, usdc };
}

let solPrice = { at: 0, usd: null };
export async function getSolUsd() {
  if (solPrice.usd && Date.now() - solPrice.at < 60_000) return solPrice.usd;
  try {
    const j = await (await fetch(`${PRICE_API}?ids=${SOL_MINT}`)).json();
    const usd = Number(j?.[SOL_MINT]?.usdPrice);
    if (usd > 0) solPrice = { at: Date.now(), usd };
  } catch { /* keep the last price */ }
  return solPrice.usd;
}

// ---- Jupiter Send ------------------------------------------------------------------------------
const toUnits = (usdc) => BigInt(Math.round(Number(usdc) * 10 ** USDC_DECIMALS)).toString();

async function post(path, body) {
  const r = await fetch(`${SEND_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.tx) throw new Error(j.error || `Jupiter is not responding (${r.status})`);
  return j;
}

/** Ask Jupiter what sending this amount costs, without creating anything. Returns SOL. */
export async function previewCashout(sender, amount) {
  const j = await post('craft-send', {
    inviteSigner: Keypair.generate().publicKey.toBase58(),
    sender,
    amount: toUnits(amount),
    mint: USDC_MINT_ADDRESS.toBase58(),
  });
  return { feeSol: Number(j.totalFeeLamports || 0) / 1e9 };
}

const expiryMs = (v) => {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  const d = Date.parse(v);
  return Number.isFinite(d) ? d : Date.now() + 7 * 86400_000;
};

async function sendSigned(base64) {
  const sig = await connection.sendRawTransaction(Buffer.from(base64, 'base64'), { skipPreflight: false, maxRetries: 3 });
  const until = Date.now() + 75_000;
  while (Date.now() < until) {
    const { value } = await connection.getSignatureStatuses([sig]);
    const st = value?.[0];
    if (st?.err) throw new Error('The transaction failed on Solana. Nothing was sent.');
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return sig;
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error('Solana is slow to confirm. Check "Your cash-out links" in a minute.');
}

/**
 * Put `amount` USDC into a Jupiter Send link. signTransactionOnly comes from EmbeddedWalletContext
 * (it shows the password / biometric prompt). The claim code is saved on this device before anything
 * is broadcast, so it can never be lost to a crash mid-send.
 */
export async function createCashout({ owner, amount, signTransactionOnly }) {
  const code = newClaimCode();
  const claim = claimKeypair(code);
  const j = await post('craft-send', {
    inviteSigner: claim.publicKey.toBase58(),
    sender: owner,
    amount: toUnits(amount),
    mint: USDC_MINT_ADDRESS.toBase58(),
  });
  const tx = VersionedTransaction.deserialize(Buffer.from(j.tx, 'base64'));
  tx.sign([claim]); // the claim-code key co-signs; the wallet adds the sender signature next
  const signed = await signTransactionOnly(tx);

  const entry = { code, amount: Number(amount), owner, createdAt: Date.now(), expiresAt: expiryMs(j.expiry), sig: null };
  await upsertLink(entry);
  const sig = await sendSigned(signed);
  await upsertLink({ code, sig });
  return { ...entry, sig };
}

/** waiting = still claimable · gone = claimed, cancelled or expired (the on-chain invite is closed) */
export async function linkStatus(code) {
  try {
    const info = await connection.getAccountInfo(invitePda(code));
    return info ? 'waiting' : 'gone';
  } catch {
    return 'unknown';
  }
}

/** Cancel an unclaimed link: the USDC goes back to the wallet that made it. */
export async function cancelCashout({ owner, code, signTransactionOnly }) {
  const j = await post('craft-clawback', { invitePDA: invitePda(code).toBase58(), sender: owner });
  const tx = VersionedTransaction.deserialize(Buffer.from(j.tx, 'base64'));
  const signed = await signTransactionOnly(tx);
  const sig = await sendSigned(signed);
  await upsertLink({ code, cancelledSig: sig });
  return sig;
}
