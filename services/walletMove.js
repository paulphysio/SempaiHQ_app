/*
 * Move everything from one wallet to another (used when a user secures their
 * wallet: old, stolen-key wallet → new wallet locked with their password).
 *
 *  1. close EMPTY token accounts first — each returns ~0.002 SOL of rent,
 *     which pays for the moves that follow
 *  2. move each token in its own transaction (create the receiving account,
 *     transfer, close the old account → rent back to the old wallet), so one
 *     stuck token (frozen / special NFT) never blocks the rest
 *  3. sweep the remaining SOL last
 */
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  createCloseAccountInstruction,
} from '@solana/spl-token';

const FEE_LAMPORTS = 5000;
const ATA_RENT_LAMPORTS = 2039280; // ~0.00204 SOL

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendAndConfirm(connection, tx, signer) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = signer.publicKey;
  tx.sign(signer);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  // Poll (websocket confirmations can hang in React Native)
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([sig]);
    const st = value?.[0];
    if (st?.err) throw new Error('Transaction failed on-chain');
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return sig;
    if ((await connection.getBlockHeight('confirmed')) > lastValidBlockHeight) throw new Error('Transaction expired');
    await sleep(1200);
  }
  throw new Error('Transaction not confirmed in time');
}

/**
 * @returns {{ moved: Array, skipped: Array, solMoved: number, signatures: string[], lowSol: boolean }}
 */
export async function moveAllFunds({ connection, from, to, onProgress = () => {} }) {
  const owner = from.publicKey;
  const toKey = new PublicKey(to);
  const out = { moved: [], skipped: [], solMoved: 0, signatures: [], lowSol: false };

  onProgress('Looking at your old wallet…');
  const accounts = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const { value } = await connection.getParsedTokenAccountsByOwner(owner, { programId });
      for (const a of value) accounts.push({ programId, pubkey: a.pubkey, info: a.account.data.parsed.info });
    } catch { /* program may be unavailable on this RPC — skip */ }
  }
  const empty = accounts.filter((a) => a.info.tokenAmount.amount === '0');
  const full = accounts.filter((a) => a.info.tokenAmount.amount !== '0');

  // 1. close empty accounts (frees rent for the moves)
  for (let i = 0; i < empty.length; i += 8) {
    const tx = new Transaction();
    for (const a of empty.slice(i, i + 8)) {
      tx.add(createCloseAccountInstruction(a.pubkey, owner, owner, [], a.programId));
    }
    try { out.signatures.push(await sendAndConfirm(connection, tx, from)); } catch { /* not fatal */ }
  }

  // 2. move each token
  for (const a of full) {
    const mint = new PublicKey(a.info.mint);
    const amount = BigInt(a.info.tokenAmount.amount);
    const decimals = a.info.tokenAmount.decimals;
    const label = `${a.info.tokenAmount.uiAmountString} of ${a.info.mint.slice(0, 4)}…`;
    const balance = await connection.getBalance(owner);
    if (balance < ATA_RENT_LAMPORTS + FEE_LAMPORTS) {
      out.lowSol = true;
      out.skipped.push({ mint: a.info.mint, amount: a.info.tokenAmount.uiAmountString, reason: 'no SOL for the network fee' });
      continue;
    }
    onProgress(`Moving ${label}`);
    const dest = getAssociatedTokenAddressSync(mint, toKey, true, a.programId);
    const tx = new Transaction()
      .add(createAssociatedTokenAccountIdempotentInstruction(owner, dest, toKey, mint, a.programId))
      .add(createTransferCheckedInstruction(a.pubkey, mint, dest, owner, amount, decimals, [], a.programId))
      .add(createCloseAccountInstruction(a.pubkey, owner, owner, [], a.programId));
    try {
      out.signatures.push(await sendAndConfirm(connection, tx, from));
      out.moved.push({ mint: a.info.mint, amount: a.info.tokenAmount.uiAmountString });
    } catch (e) {
      out.skipped.push({ mint: a.info.mint, amount: a.info.tokenAmount.uiAmountString, reason: e?.message || 'failed' });
    }
  }

  // 3. sweep SOL
  const remaining = await connection.getBalance(owner);
  if (remaining > FEE_LAMPORTS) {
    onProgress('Moving your SOL…');
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: owner, toPubkey: toKey, lamports: remaining - FEE_LAMPORTS }),
    );
    try {
      out.signatures.push(await sendAndConfirm(connection, tx, from));
      out.solMoved = (remaining - FEE_LAMPORTS) / 1e9;
    } catch (e) {
      out.skipped.push({ mint: 'SOL', amount: String(remaining / 1e9), reason: e?.message || 'failed' });
    }
  }
  return out;
}
