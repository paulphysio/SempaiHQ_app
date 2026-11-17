import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import { RPC_URL, USDC_MINT_ADDRESS, SMP_MINT_ADDRESS, SMP_DECIMALS } from '../constants';
import { supabase, FUNCTIONS_URL } from '../services/supabaseClient';
import { safeFetch } from './urlValidation';

export const BAZAAR_FUNCTIONS_BASE = FUNCTIONS_URL;
export const BAZAAR_HQ_WALLET = new PublicKey('71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD');
export const BAZAAR_BOOK_PRICE_USD = 1.0;
export const BAZAAR_AUTHOR_SHARE_PCT = 70;
export const BAZAAR_LEND_PRICE_SMP = 12500;
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export const bazaarConnection = new Connection(RPC_URL, 'confirmed', {
  confirmTransactionInitialTimeout: 60000,
});

export function splitAmountWithResidual(amount, ratios) {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  const r = [];
  let runningTotal = 0;
  for (let i = 0; i < ratios.length - 1; i++) {
    r[i] = Math.floor((amount * ratios[i]) / totalRatio);
    runningTotal += r[i];
  }
  r[ratios.length - 1] = amount - runningTotal;
  return r;
}

export async function fetchSolPriceUsd() {
  try {
    const res = await safeFetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.[SOL_MINT]?.usdPrice || null;
  } catch (e) {
    console.error('[bazaar] fetchSolPriceUsd failed:', e.message);
    return null;
  }
}

// On-chain tag that binds a payment to one book + one access type. The server
// requires this exact memo, so a payment can't be replayed against another book.
export const bazaarMemoText = (bookId, accessType) => `bazaar:${bookId}:${accessType}`;

function memoInstruction(userPublicKey, text) {
  return new TransactionInstruction({
    keys: [{ pubkey: userPublicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(text, 'utf8'),
  });
}

// Amount in base units. Prices come from the book row (not hardcoded).
// USDC/SMP have 6 decimals, SOL has 9.
export function bookPriceInBaseUnits(currency, solPriceUsd, book) {
  const priceUsd = Number(book?.price_usd ?? BAZAAR_BOOK_PRICE_USD);
  if (currency === 'USDC') return Math.round(priceUsd * 1e6);
  if (currency === 'SMP') {
    return Math.round(Number(book?.lend_price_smp ?? BAZAAR_LEND_PRICE_SMP) * 10 ** SMP_DECIMALS);
  }
  if (!solPriceUsd) throw new Error('SOL price unavailable');
  return Math.round((priceUsd / solPriceUsd) * 1e9);
}

// Sale: author gets book.author_share_pct, HQ gets the rest. SOL or USDC.
export async function createBazaarPaymentTransaction({ book, currency, paymentAmount, userPublicKey, authorPublicKey }) {
  const share = Number(book.author_share_pct ?? BAZAAR_AUTHOR_SHARE_PCT);
  const [authorAmount, platformAmount] = splitAmountWithResidual(paymentAmount, [share, 100 - share]);
  const instructions = [];

  if (currency === 'SOL') {
    instructions.push(
      SystemProgram.transfer({ fromPubkey: userPublicKey, toPubkey: authorPublicKey, lamports: authorAmount }),
      SystemProgram.transfer({ fromPubkey: userPublicKey, toPubkey: BAZAAR_HQ_WALLET, lamports: platformAmount })
    );
  } else {
    const mint = USDC_MINT_ADDRESS;
    const userAta = getAssociatedTokenAddressSync(mint, userPublicKey);
    const authorAta = getAssociatedTokenAddressSync(mint, authorPublicKey);
    const hqAta = getAssociatedTokenAddressSync(mint, BAZAAR_HQ_WALLET, true);

    const [userAtaInfo, authorAtaInfo, hqAtaInfo] = await bazaarConnection.getMultipleAccountsInfo([userAta, authorAta, hqAta]);
    if (!userAtaInfo) throw new Error('You do not have a USDC token account.');

    if (!authorAtaInfo) {
      instructions.push(createAssociatedTokenAccountInstruction(userPublicKey, authorAta, authorPublicKey, mint));
    }
    if (!hqAtaInfo) {
      instructions.push(createAssociatedTokenAccountInstruction(userPublicKey, hqAta, BAZAAR_HQ_WALLET, mint));
    }
    // Skip zero-amount transfers (e.g. 100% author share).
    if (authorAmount > 0) instructions.push(createTransferInstruction(userAta, authorAta, userPublicKey, authorAmount));
    if (platformAmount > 0) instructions.push(createTransferInstruction(userAta, hqAta, userPublicKey, platformAmount));
  }

  instructions.push(memoInstruction(userPublicKey, bazaarMemoText(book.id, 'purchase')));

  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = userPublicKey;
  return { tx, authorAmount, platformAmount };
}

// Lend: full amount in SMP to the platform wallet.
export async function createBazaarLendTransaction({ book, paymentAmount, userPublicKey }) {
  const mint = SMP_MINT_ADDRESS;
  const userAta = getAssociatedTokenAddressSync(mint, userPublicKey);
  const hqAta = getAssociatedTokenAddressSync(mint, BAZAAR_HQ_WALLET, true);

  const [userAtaInfo, hqAtaInfo] = await bazaarConnection.getMultipleAccountsInfo([userAta, hqAta]);
  if (!userAtaInfo) throw new Error('You do not have an SMP token account.');

  const instructions = [];
  if (!hqAtaInfo) {
    instructions.push(createAssociatedTokenAccountInstruction(userPublicKey, hqAta, BAZAAR_HQ_WALLET, mint));
  }
  instructions.push(createTransferInstruction(userAta, hqAta, userPublicKey, paymentAmount));
  instructions.push(memoInstruction(userPublicKey, bazaarMemoText(book.id, 'lend')));

  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = userPublicKey;
  return { tx, authorAmount: 0, platformAmount: paymentAmount };
}

export async function callBazaarFunction(fnName, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated. Please sign in again.');

  const res = await safeFetch(`${BAZAAR_FUNCTIONS_BASE}/${fnName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Record a payment that already landed on-chain. Retries while the server waits for
// RPC propagation (HTTP 503 / retriable) or the network blips. Safe to call repeatedly:
// the server is idempotent per signature.
export async function recordPurchase(payload, { attempts = 6, delayMs = 2500 } = {}) {
  let last = { ok: false, status: 0, data: { error: 'Could not reach the server.' } };
  for (let i = 0; i < attempts; i++) {
    try {
      last = await callBazaarFunction('purchase-bazaar-book', payload);
      if (last.ok && last.data?.success) return last;
      const retriable = last.status === 503 || last.data?.retriable || last.status >= 500;
      if (!retriable) return last; // 4xx: retrying won't help
    } catch (e) {
      last = { ok: false, status: 0, data: { error: e.message || 'Network error' } };
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return last;
}

// Short-lived signed URL for the (private) book file; only works for the author or a buyer.
export async function getBookFileUrl(bookId) {
  const result = await callBazaarFunction('get-bazaar-book-url', { bookId });
  if (!result.ok || !result.data?.url) {
    throw new Error(result.data?.error || 'Could not open this book.');
  }
  return result.data.url;
}

export const resolveRefund = (refundId, action, note) =>
  callBazaarFunction('resolve-bazaar-refund', { refundId, action, note });
