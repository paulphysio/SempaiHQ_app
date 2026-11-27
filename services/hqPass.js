// HQ Access Pass — $1 for 30 days (renewing adds 30 days to the current pass).
// Needed to borrow Bazaar books (5 per week, 7-day loans) and to enter Kaiji tournaments (Fri–Sun).
// Paid to the platform wallet in SOL, USDC or SMP at the live price, tagged "hqpass:<account id>";
// the server checks the payment on-chain before turning the pass on (reader-actions → hq_pass_buy).
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import { RPC_URL, USDC_MINT_ADDRESS, SMP_MINT_ADDRESS } from '../constants';
import { readerAction } from './readerActions';
import { myId } from './chat';

export const HQ_PASS_USD = 1;
export const HQ_PASS_DAYS = 30;
const PLATFORM = new PublicKey('71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD');
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const BUFFER = 1.03; // tiny cushion so price moves between quote and payment don't fall short
const connection = new Connection(RPC_URL, 'confirmed');

export async function getPassStatus() {
  const res = await readerAction('hq_pass_status');
  if (res?.ok === false) throw new Error(res.error || 'Could not load your pass');
  return res; // { active, expiresAt, borrowsThisWeek, borrowLimit }
}

/** Before paying for a borrow. { ok, reason?: 'pass_required'|'weekly_limit', used, limit } */
export async function lendCheck() {
  const res = await readerAction('lend_check');
  if (res?.ok === false && res.error) throw new Error(res.error);
  return res;
}

/** What $1 costs right now in each currency (token amounts). */
export async function passQuotes() {
  const out = { USDC: HQ_PASS_USD };
  try {
    const j = await (await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`)).json();
    const p = Number(j?.[SOL_MINT]?.usdPrice);
    if (p > 0) out.SOL = (HQ_PASS_USD / p) * BUFFER;
  } catch { /* unavailable */ }
  try {
    const j = await (await fetch(`https://lite-api.jup.ag/ultra/v1/order?inputMint=${USDC_MINT_ADDRESS.toString()}&outputMint=${SMP_MINT_ADDRESS.toString()}&amount=1000000`)).json();
    const smpPerUsd = Number(j?.outAmount) / 1e6;
    if (smpPerUsd > 0) out.SMP = Math.ceil(smpPerUsd * HQ_PASS_USD * BUFFER);
  } catch { /* unavailable */ }
  return out;
}

/** Pay and activate. signAndSendTransaction comes from EmbeddedWalletContext. */
export async function buyPass({ wallet, currency, amount, signAndSendTransaction }) {
  const me = await myId();
  if (!me) throw new Error('Sign in first');
  const owner = new PublicKey(wallet);
  const tx = new Transaction();
  if (currency === 'SOL') {
    tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: PLATFORM, lamports: Math.ceil(amount * 1e9) }));
  } else {
    const mint = currency === 'USDC' ? USDC_MINT_ADDRESS : SMP_MINT_ADDRESS;
    const from = getAssociatedTokenAddressSync(mint, owner);
    const to = getAssociatedTokenAddressSync(mint, PLATFORM, true);
    const [fromInfo, toInfo] = await connection.getMultipleAccountsInfo([from, to]);
    if (!fromInfo) throw new Error(`You don't have any ${currency} yet.`);
    if (!toInfo) tx.add(createAssociatedTokenAccountInstruction(owner, to, PLATFORM, mint));
    tx.add(createTransferInstruction(from, to, owner, BigInt(Math.ceil(amount * 1e6))));
  }
  tx.add(new TransactionInstruction({ keys: [{ pubkey: owner, isSigner: true, isWritable: false }], programId: MEMO, data: Buffer.from(`hqpass:${me}`, 'utf8') }));
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;
  const signature = await signAndSendTransaction(tx); // password / biometrics
  // the server may need a moment to see the payment
  let last = null;
  for (let i = 0; i < 6; i++) {
    const res = await readerAction('hq_pass_buy', { signature, currency, walletAddress: wallet });
    if (res?.ok !== false) return { ...res, signature };
    last = res;
    if (res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error(`${last?.error || 'Could not activate your pass'} (payment ${signature.slice(0, 8)}… — contact support if this persists)`);
}
