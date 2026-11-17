// =====================================================================================================
// KAIJI edge function (ONE FILE). Paste all of it into Supabase > Edge Functions > kaiji > Code, then Deploy.
//
// Secrets it needs (Edge Functions > Secrets):
//   KAIJI_RPC_URL        Solana RPC url (devnet while testing)       (SOLANA_RPC_URL also works)
//   KAIJI_MINT           the token players wager
//   ESCROW_SECRET_KEY    escrow wallet key, a JSON array of 64 numbers
//   FEE_WALLET           wallet that receives the 10% fee
// Optional:
//   KAIJI_ALLOWED_WALLETS  comma-separated wallets allowed to play (leave out to allow everyone)
//   PUBLIC_RPC_URL         RPC the app uses (defaults to KAIJI_RPC_URL; it is sent to the app, so no private keys)
//   KAIJI_DECIMALS (6), MIN_WAGER (1000000), MAX_WAGER (100000000), PICK_SECONDS (35), WAIT_SECONDS (45)
//   SOL_FEE_SHARE_BPS (2500)  share of the 10% fee kept for conversion to SOL (2500 = 25%)
//   SOL_FEE_SWAP_MIN (20000000)  SKR base units of accumulated fee share needed before a SOL swap runs
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
//
// Actions (POST json { action, ... }): config, health, join, pick, cancel, state, sweep
// =====================================================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import bs58 from 'npm:bs58@5.0.0';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction, SystemProgram } from 'npm:@solana/web3.js@1.98.0';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
} from 'npm:@solana/spl-token@0.4.9';

// ------------------------------------------------------------------------------------------ config
const envFirst = (...names: string[]): string | undefined => {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  return undefined;
};
const need = (...names: string[]): string => {
  const v = envFirst(...names);
  if (!v) throw new Error(`missing_secret_${names[0]}`);
  return v;
};

const RULES = {
  winsNeeded: 3, // first to 3 round wins
  startHand: { R: 4, P: 4, S: 4 },
  pickSeconds: Number(envFirst('PICK_SECONDS') ?? '35'),
  waitingSeconds: Number(envFirst('WAIT_SECONDS') ?? '45'),
  maxIdleRounds: 2, // two rounds in a row where nobody picks voids the match
  feeBps: 1000, // 10%
  feeSolShareBps: Number(envFirst('SOL_FEE_SHARE_BPS') ?? '2500'), // 25% of the fee, converted to SOL in batches
};

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUP_API = 'https://lite-api.jup.ag/swap/v1';
const SOL_FEE_SWAP_MIN = BigInt(envFirst('SOL_FEE_SWAP_MIN') ?? '20000000'); // 20 SKR (6 decimals)

// Public money-activity feed (DAO Governance). Fire-and-forget: never breaks the game.
async function logFeed(row: Record<string, unknown>) {
  try {
    await db().from('money_events').insert(row);
  } catch (e: any) {
    console.warn('[money_events] insert failed:', e?.message);
  }
}

let _cfg: any = null;
// Read lazily so that a missing secret shows up as a clear JSON error instead of a crash on boot.
function cfg() {
  if (_cfg) return _cfg;
  const rpc = need('KAIJI_RPC_URL', 'SOLANA_RPC_URL');
  const mint = new PublicKey(need('KAIJI_MINT'));
  let escrow: Keypair;
  try {
    escrow = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(need('ESCROW_SECRET_KEY'))));
  } catch (e) {
    throw new Error('bad_secret_ESCROW_SECRET_KEY');
  }
  _cfg = {
    conn: new Connection(rpc, 'confirmed'),
    mint,
    mintAddress: mint.toBase58(),
    escrow,
    escrowAddress: escrow.publicKey.toBase58(),
    escrowAta: getAssociatedTokenAddressSync(mint, escrow.publicKey),
    feeWallet: need('FEE_WALLET'),
    decimals: Number(envFirst('KAIJI_DECIMALS') ?? '6'),
    publicRpc: envFirst('PUBLIC_RPC_URL') ?? rpc,
    minWager: BigInt(envFirst('MIN_WAGER') ?? '1000000'),
    maxWager: BigInt(envFirst('MAX_WAGER') ?? '100000000'),
    allowedWallets: (envFirst('KAIJI_ALLOWED_WALLETS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  };
  return _cfg;
}

let _db: any = null;
const db = () =>
  (_db ??= createClient(Deno.env.get('SUPABASE_URL')!, (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!, {
    auth: { persistSession: false },
  }));

const OPEN = ['waiting', 'active', 'settling', 'settle_failed'];
const iso = (ms = 0) => new Date(Date.now() + ms).toISOString();
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------------------------- game rules
type Card = 'R' | 'P' | 'S';
type Hand = Record<Card, number>;
type Side = 'a' | 'b';
const BEATS: Record<Card, Card> = { R: 'S', S: 'P', P: 'R' };
const isCard = (c: unknown): c is Card => c === 'R' || c === 'P' || c === 'S';
const outcome = (a: Card, b: Card): 0 | 1 | -1 => (a === b ? 0 : BEATS[a] === b ? 1 : -1);
const handTotal = (h: Hand) => h.R + h.P + h.S;

function settlementAmounts(wager: bigint) {
  const pool = wager * 2n;
  const fee = (pool * BigInt(RULES.feeBps)) / 10000n; // floor, so the winner never gets less than 90%
  return { pool, fee, payout: pool - fee };
}

interface MatchState {
  handA: Hand;
  handB: Hand;
  winsA: number;
  winsB: number;
  round: number;
  idleRounds: number;
}
type Finish = { outcome: 'win'; winner: Side } | { outcome: 'draw' | 'void'; winner: null } | null;

// A null card means that player did not pick in time.
//  both picked: normal result, both cards consumed (a tie replays the round)
//  one picked : the picker wins the round, only the picker's card is consumed
//  none picked: idle round, nothing consumed, two idle rounds in a row void the match
function resolveRound(s: MatchState, cardA: Card | null, cardB: Card | null) {
  const handA = { ...s.handA };
  const handB = { ...s.handB };
  let winsA = s.winsA;
  let winsB = s.winsB;
  let idle = s.idleRounds;
  let result: 'a' | 'b' | 'tie' | 'idle';
  let forfeit = false;

  if (!cardA && !cardB) {
    idle += 1;
    result = 'idle';
  } else {
    idle = 0;
    if (cardA) handA[cardA] -= 1;
    if (cardB) handB[cardB] -= 1;
    if (cardA && cardB) {
      const r = outcome(cardA, cardB);
      if (r > 0) {
        winsA += 1;
        result = 'a';
      } else if (r < 0) {
        winsB += 1;
        result = 'b';
      } else result = 'tie';
    } else {
      forfeit = true;
      if (cardA) {
        winsA += 1;
        result = 'a';
      } else {
        winsB += 1;
        result = 'b';
      }
    }
  }
  const next: MatchState = { handA, handB, winsA, winsB, round: s.round + 1, idleRounds: idle };

  let finish: Finish = null;
  if (idle >= RULES.maxIdleRounds) finish = { outcome: 'void', winner: null };
  else if (winsA >= RULES.winsNeeded) finish = { outcome: 'win', winner: 'a' };
  else if (winsB >= RULES.winsNeeded) finish = { outcome: 'win', winner: 'b' };
  else if (handTotal(handA) === 0 || handTotal(handB) === 0) {
    // someone ran out of cards before anyone reached the target: most wins takes it, equal wins is a draw
    if (winsA > winsB) finish = { outcome: 'win', winner: 'a' };
    else if (winsB > winsA) finish = { outcome: 'win', winner: 'b' };
    else finish = { outcome: 'draw', winner: null };
  }
  return { next, result, forfeit, finish };
}

// -------------------------------------------------------------------------------------- blockchain
// Proves who is joining using only the chain. The deposit transaction must contain
//   1) an spl-token transfer of exactly `amount` into the escrow token account, and
//   2) a memo equal to "kaiji:" + sha256(secret).
// The wallet that signed the transfer IS the player (payouts and refunds go there). Someone who copies the
// public signature cannot join as that wallet, because they do not know the secret behind the memo hash.
async function verifyDeposit(
  signature: string,
  secretHash: string,
  amount: bigint,
): Promise<{ ok: true; wallet: string } | { ok: false; reason: string; wallet?: string; total?: bigint }> {
  const c = cfg();
  let tx: any = null;
  const tries = Number(envFirst('VERIFY_RETRIES') ?? '10');
  for (let i = 0; i < tries; i++) {
    tx = await c.conn.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (tx) break;
    await sleep(1000);
  }
  if (!tx) return { ok: false, reason: 'tx_not_found' };
  if (tx.meta?.err) return { ok: false, reason: 'tx_failed' };
  if (tx.blockTime && Date.now() / 1000 - tx.blockTime > 900) return { ok: false, reason: 'tx_too_old' };

  const dest = c.escrowAta.toBase58();
  const memoExpected = `kaiji:${secretHash}`;
  const ixs: any[] = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions ?? []).flatMap((i: any) => i.instructions),
  ];
  let memoOk = false;
  const totals = new Map<string, bigint>();
  for (const ix of ixs) {
    if (ix.program === 'spl-memo' && ix.parsed === memoExpected) memoOk = true;
    if (ix.program !== 'spl-token' || !ix.parsed) continue;
    const { type, info } = ix.parsed;
    if (type !== 'transfer' && type !== 'transferChecked') continue;
    if (info.destination !== dest) continue;
    if (type === 'transferChecked' && info.mint !== c.mintAddress) continue;
    const amt = BigInt(type === 'transfer' ? info.amount : info.tokenAmount.amount);
    totals.set(info.authority, (totals.get(info.authority) ?? 0n) + amt);
  }
  if (!memoOk) return { ok: false, reason: 'memo_missing' };
  if (totals.size !== 1) return { ok: false, reason: 'no_single_depositor' };
  const [wallet, total] = [...totals.entries()][0];
  return total === amount ? { ok: true, wallet } : { ok: false, reason: 'amount_mismatch', wallet, total };
}

async function signatureConfirmed(sig: string): Promise<boolean> {
  const { value } = await cfg().conn.getSignatureStatuses([sig], { searchTransactionHistory: true });
  const st = value[0];
  return !!st && !st.err && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized');
}

// One transaction signed by the escrow wallet: for each recipient create their token account if needed
// (escrow pays the rent) and transfer. `onSent` runs right after broadcast so the signature is stored
// before we wait for confirmation, which is what makes retries safe.
async function sendTransfers(
  items: { wallet: string; amount: bigint }[],
  onSent?: (sig: string) => Promise<void>,
): Promise<string> {
  const c = cfg();
  const tx = new Transaction();
  for (const it of items) {
    if (it.amount <= 0n) continue;
    const owner = new PublicKey(it.wallet);
    // allowOwnerOffCurve = true so program-owned wallets (for example a Squads vault) work as recipients
    const ata = getAssociatedTokenAddressSync(c.mint, owner, true);
    tx.add(createAssociatedTokenAccountIdempotentInstruction(c.escrow.publicKey, ata, owner, c.mint));
    tx.add(createTransferInstruction(c.escrowAta, ata, c.escrow.publicKey, it.amount));
  }
  const { blockhash, lastValidBlockHeight } = await c.conn.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = c.escrow.publicKey;
  tx.sign(c.escrow);
  const sig = await c.conn.sendRawTransaction(tx.serialize());
  if (onSent) await onSent(sig);
  await confirmSig(sig); // poll-based; websocket confirmTransaction hangs in edge runtimes
  return sig;
}

// Poll-based confirmation — websocket confirmTransaction is unreliable in edge runtimes.
async function confirmSig(sig: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await cfg().conn.getSignatureStatuses([sig], { searchTransactionHistory: true });
    const st = value[0];
    if (st?.err) throw new Error('tx_failed_onchain');
    if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('confirm_timeout');
}

// The 25%-of-fee share that stays in the escrow ATA after a win settlement.
// Upsert keyed by match id so settlement retries never double-count.
async function recordSolShare(m: any) {
  if (m.outcome !== 'win') return;
  const { fee } = settlementAmounts(BigInt(m.wager));
  const solShare = (fee * BigInt(RULES.feeSolShareBps)) / 10000n;
  if (solShare <= 0n) return;
  const { error } = await db()
    .from('kaiji_sol_share')
    .upsert({ match_id: m.id, amount: solShare.toString() }, { onConflict: 'match_id', ignoreDuplicates: true });
  if (error) throw new Error('sol_share_record_failed: ' + error.message);
}

// KAIJI SOL-swap state machine (pure: no Solana/Supabase imports, so it is unit-testable).
// Paste this block into index.ts above maybeSwapFeeToSol (drop the `export` keywords if you want).
//
// Safety rules enforced here:
//  1. Only ONE swap exists at a time and only the lease holder acts on it (enforced in SQL).
//  2. The transaction signature is saved BEFORE the transaction is broadcast, so a crash can never lose it.
//  3. A swap is released (its shares freed to be swapped again) ONLY when its signature definitely can no longer
//     land: it failed on-chain, or its blockhash has expired and the signature is still not on-chain.
//  4. Once the swap landed (status 'swapped') it is NEVER swapped again. Only the SOL forward is retried.

type SigState = 'confirmed' | 'failed' | 'unknown';
type SwapRow = {
  id: string;
  status: 'claimed' | 'sent' | 'swapped';
  total: string | number;
  swap_sig: string | null;
  swap_last_valid: number | string | null;
  min_out: string | number | null;
  forward_sig: string | null;
  forward_last_valid: number | string | null;
};
type Prepared = { signature: string; lastValidBlockHeight: number; broadcast: () => Promise<void> };
interface SwapDeps {
  acquire(): Promise<SwapRow | null>;
  patch(id: string, patch: Record<string, unknown>): Promise<void>;
  release(id: string, reason: string): Promise<boolean>;
  finish(id: string): Promise<boolean>;
  prepareSwap(total: bigint): Promise<Prepared & { minOut: bigint }>; // signs, must NOT broadcast
  prepareForward(lamports: bigint): Promise<Prepared>; // signs, must NOT broadcast
  sigState(sig: string): Promise<SigState>;
  blockHeight(): Promise<number>;
  log(msg: string): void;
  onDone?(row: SwapRow): Promise<void>; // called once per swap after finish() succeeds
}

const EXPIRY_MARGIN = 20; // blocks of extra patience before declaring a blockhash expired

type Resolution = 'confirmed' | 'failed' | 'expired' | 'pending';
async function resolveSig(d: SwapDeps, sig: string, lastValid: number | string | null): Promise<Resolution> {
  const s = await d.sigState(sig);
  if (s === 'confirmed') return 'confirmed';
  if (s === 'failed') return 'failed';
  if (lastValid == null) return 'pending'; // never guess: without an expiry height we cannot prove it is dead
  const h = await d.blockHeight();
  if (h > Number(lastValid) + EXPIRY_MARGIN) {
    const s2 = await d.sigState(sig); // one last look, in case it landed right at the end
    if (s2 === 'confirmed') return 'confirmed';
    if (s2 === 'failed') return 'failed';
    return 'expired';
  }
  return 'pending';
}

async function runSwapStep(d: SwapDeps): Promise<{ result: string }> {
  const sw = await d.acquire();
  if (!sw) return { result: 'idle' };
  let row: SwapRow = sw;

  // ---- step 1: build + sign + SAVE the signature, then broadcast
  if (row.status === 'claimed') {
    let prep: Prepared & { minOut: bigint };
    try {
      prep = await d.prepareSwap(BigInt(row.total));
    } catch (e) {
      await d.release(row.id, 'prepare_failed'); // nothing was signed or sent, so this is safe
      throw e;
    }
    await d.patch(row.id, {
      status: 'sent',
      swap_sig: prep.signature,
      swap_last_valid: prep.lastValidBlockHeight,
      min_out: prep.minOut.toString(),
    });
    row = { ...row, status: 'sent', swap_sig: prep.signature, swap_last_valid: prep.lastValidBlockHeight, min_out: prep.minOut.toString() };
    try {
      await prep.broadcast();
    } catch (e) {
      d.log('swap broadcast error (outcome unknown, will be resolved by signature): ' + String((e as Error)?.message ?? e));
    }
  }

  // ---- step 2: resolve what happened to the swap transaction
  if (row.status === 'sent') {
    const r = await resolveSig(d, row.swap_sig!, row.swap_last_valid);
    if (r === 'pending') return { result: 'swap_pending' };
    if (r === 'failed' || r === 'expired') {
      await d.release(row.id, r);
      return { result: 'released_' + r };
    }
    await d.patch(row.id, { status: 'swapped' });
    row = { ...row, status: 'swapped' };
  }

  // ---- step 3: forward the SOL (retryable; never re-swaps)
  if (row.status === 'swapped') {
    if (row.min_out == null) throw new Error('swap_missing_min_out');
    if (row.forward_sig) {
      const r = await resolveSig(d, row.forward_sig, row.forward_last_valid);
      if (r === 'pending') return { result: 'forward_pending' };
      if (r === 'confirmed') {
        await d.finish(row.id);
        if (d.onDone) await d.onDone(row);
        return { result: 'done' };
      }
      await d.patch(row.id, { forward_sig: null, forward_last_valid: null }); // dead: safe to rebuild
    }
    const prep = await d.prepareForward(BigInt(row.min_out));
    await d.patch(row.id, { forward_sig: prep.signature, forward_last_valid: prep.lastValidBlockHeight });
    try {
      await prep.broadcast();
    } catch (e) {
      d.log('forward broadcast error: ' + String((e as Error)?.message ?? e));
    }
    const r = await resolveSig(d, prep.signature, prep.lastValidBlockHeight);
    if (r === 'confirmed') {
      await d.finish(row.id);
      if (d.onDone) await d.onDone(row);
      return { result: 'done' };
    }
    if (r === 'pending') return { result: 'forward_pending' };
    await d.patch(row.id, { forward_sig: null, forward_last_valid: null });
    return { result: 'forward_retry' };
  }
  return { result: 'idle' };
}

// KAIJI: replaces your existing maybeSwapFeeToSol(). Needs, at the top of index.ts:
//    import bs58 from 'npm:bs58@5.0.0';
// and the swap_engine.ts block pasted above this function.
async function maybeSwapFeeToSol(): Promise<{ result: string }> {
  const c = cfg();
  const rpcRow = (data: any) => (Array.isArray(data) ? data[0] : data);

  const deps: SwapDeps = {
    log: (m) => console.log('[kaiji swap]', m),

    acquire: async () => {
      const { data, error } = await db().rpc('kaiji_acquire_sol_swap', {
        p_min: SOL_FEE_SWAP_MIN.toString(),
        p_lease_secs: 120,
      });
      if (error) throw new Error('swap_acquire_failed: ' + error.message);
      const row = rpcRow(data);
      return row?.id ? (row as SwapRow) : null;
    },
    patch: async (id, patch) => {
      const { error } = await db().from('kaiji_sol_swaps').update({ ...patch, updated_at: iso() }).eq('id', id);
      if (error) throw new Error('swap_patch_failed: ' + error.message);
    },
    release: async (id, reason) => {
      const { data, error } = await db().rpc('kaiji_release_sol_swap', { p_swap: id, p_reason: reason });
      if (error) throw new Error('swap_release_failed: ' + error.message);
      return !!data;
    },
    finish: async (id) => {
      const { data, error } = await db().rpc('kaiji_finish_sol_swap', { p_swap: id });
      if (error) throw new Error('swap_finish_failed: ' + error.message);
      return !!data;
    },
    onDone: async (row) => {
      await logFeed({
        event_type: 'kaiji_sol_swap',
        direction: 'swap',
        asset: 'SOL',
        amount: Number(row.min_out) / 1e9,
        wallet: c.escrowAddress,
        counterparty: c.feeWallet,
        title: 'Kaiji fee → SOL swap',
        detail: `${Number(row.total) / 10 ** c.decimals} SKR → SOL`,
        tx_sig: row.forward_sig,
        meta: { swap_id: row.id, skr_amount: row.total, sol_lamports: row.min_out },
      });
    },
    sigState: async (sig) => {
      const { value } = await c.conn.getSignatureStatuses([sig], { searchTransactionHistory: true });
      const st = value[0];
      if (!st) return 'unknown';
      if (st.err) return 'failed';
      return st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized' ? 'confirmed' : 'unknown';
    },
    blockHeight: () => c.conn.getBlockHeight('confirmed'),

    // Build + sign only. The engine saves the signature, THEN calls broadcast().
    prepareSwap: async (total) => {
      const qRes = await fetch(
        `${JUP_API}/quote?inputMint=${c.mintAddress}&outputMint=${SOL_MINT}&amount=${total.toString()}&slippageBps=50`,
      );
      if (!qRes.ok) throw new Error('jupiter_quote_http_' + qRes.status);
      const quote = await qRes.json();
      if (!quote?.outAmount) throw new Error('jupiter_no_route');
      const sRes = await fetch(`${JUP_API}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: c.escrowAddress,
          wrapAndUnwrapSOL: true,
          dynamicComputeUnitLimit: true,
        }),
      });
      if (!sRes.ok) throw new Error('jupiter_swap_http_' + sRes.status);
      const swapJson = await sRes.json();
      if (!swapJson?.swapTransaction) throw new Error('jupiter_no_tx');

      const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(swapJson.swapTransaction), (ch) => ch.charCodeAt(0)));
      tx.sign([c.escrow]);
      const lastValid = Number(swapJson.lastValidBlockHeight) || (await c.conn.getBlockHeight('confirmed')) + 150;
      // Jupiter guarantees at least otherAmountThreshold; forward only that so we never spend SOL we did not receive.
      const minOut = BigInt(quote.otherAmountThreshold ?? (BigInt(quote.outAmount) * 99n) / 100n);
      return {
        signature: bs58.encode(tx.signatures[0]),
        lastValidBlockHeight: lastValid,
        minOut,
        broadcast: async () => {
          await c.conn.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
        },
      };
    },
    prepareForward: async (lamports) => {
      const ftx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: c.escrow.publicKey, toPubkey: new PublicKey(c.feeWallet), lamports }),
      );
      const { blockhash, lastValidBlockHeight } = await c.conn.getLatestBlockhash('confirmed');
      ftx.recentBlockhash = blockhash;
      ftx.feePayer = c.escrow.publicKey;
      ftx.sign(c.escrow);
      return {
        signature: bs58.encode(ftx.signature!),
        lastValidBlockHeight,
        broadcast: async () => {
          await c.conn.sendRawTransaction(ftx.serialize(), { maxRetries: 3 });
        },
      };
    },
  };
  return await runSwapStep(deps);
}

// --------------------------------------------------------------------------------------- identity
// A player is a wallet. Their credential is a 32-byte secret whose sha256 hash was put on-chain (as a memo)
// inside the deposit transaction, so only the person who made the deposit knows the secret.
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function validSecret(secret: unknown): string {
  if (typeof secret !== 'string' || !/^[0-9a-f]{64}$/.test(secret)) throw new Error('bad_secret');
  return secret;
}
function publicMatch(m: any) {
  const { token_a: _a, token_b: _b, ...rest } = m;
  return rest;
}
function sideOf(m: any, tokenHash: string): Side {
  if (m.token_a === tokenHash) return 'a';
  if (m.token_b === tokenHash) return 'b';
  throw new Error('forbidden');
}

// -------------------------------------------------------------------------------------- database
async function getMatch(id: string) {
  const { data, error } = await db().from('kaiji_matches').select('*').eq('id', id).single();
  if (error || !data) throw new Error('match_not_found');
  return data;
}
async function openMatchByToken(hash: string) {
  const { data } = await db()
    .from('kaiji_matches')
    .select('*')
    .or(`token_a.eq.${hash},token_b.eq.${hash}`)
    .in('status', OPEN)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
async function openMatchByWallet(wallet: string) {
  const { data } = await db()
    .from('kaiji_matches')
    .select('id')
    .or(`wallet_a.eq.${wallet},wallet_b.eq.${wallet}`)
    .in('status', OPEN)
    .limit(1)
    .maybeSingle();
  return data;
}

// ----------------------------------------------------------------------------------- settlement
// Win payout, draw/void refund, cancelled refund.
async function markSettled(id: string, sig: string) {
  await db().from('kaiji_matches').update({ status: 'settled', settle_sig: sig, error: null, updated_at: iso() }).eq('id', id);
}

async function settleMatch(matchId: string) {
  // Only one caller can claim a settlement. A claim older than 3 minutes can be retaken
  // (a blockhash is dead after ~90s, so an earlier transaction can no longer land).
  const { data: claimed, error: claimError } = await db().rpc('kaiji_claim_settlement', {
    p_match: matchId,
    p_stale_before: iso(-180_000),
  });
  if (claimError) {
    console.error('[kaiji claim failed]', matchId, claimError.message);
    return;
  }
  const m = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!m) return;

  let sent: string | null = null;
  try {
    if (m.settle_sig && (await signatureConfirmed(m.settle_sig))) {
      await recordSolShare(m);
      await markSettled(m.id, m.settle_sig);
      return;
    }
    const wager = BigInt(m.wager);
    let items: { wallet: string; amount: bigint }[];
    if (m.outcome === 'win') {
      const { fee, payout } = settlementAmounts(wager);
      const winnerWallet = m.winner === 'a' ? m.wallet_a : m.wallet_b;
      // feeSolShareBps of the fee stays in the escrow ATA for later SOL conversion;
      // the rest goes to the fee wallet as SKR.
      const solShare = (fee * BigInt(RULES.feeSolShareBps)) / 10000n;
      items = [
        { wallet: winnerWallet, amount: payout },
        { wallet: cfg().feeWallet, amount: fee - solShare },
      ];
    } else if (m.outcome === 'cancelled') {
      items = [{ wallet: m.wallet_a, amount: wager }];
    } else {
      items = [
        { wallet: m.wallet_a, amount: wager },
        { wallet: m.wallet_b, amount: wager },
      ];
    }
    const sig = await sendTransfers(items, async (s) => {
      sent = s;
      await db().from('kaiji_matches').update({ settle_sig: s }).eq('id', m.id);
    });
    await recordSolShare(m); // idempotent upsert; must happen first or a crash here loses the share forever
    await markSettled(m.id, sig);

    // One feed row per recipient so draws (two refunds) and win+fee splits both show.
    const isWin = m.outcome === 'win';
    const wagerHuman = Number(wager) / 10 ** cfg().decimals;
    for (const it of items) {
      const isFeeShare = it.wallet === cfg().feeWallet;
      await logFeed({
        event_type: isWin ? 'kaiji_payout' : 'kaiji_refund',
        direction: 'out',
        asset: 'SKR',
        amount: Number(it.amount) / 10 ** cfg().decimals,
        wallet: isFeeShare ? null : (m.winner === 'a' ? m.wallet_a : m.wallet_b),
        counterparty: isFeeShare ? cfg().feeWallet : (isWin ? (m.winner === 'a' ? m.wallet_b : m.wallet_a) : null),
        title: isFeeShare ? 'Kaiji fee' : `Kaiji ${isWin ? 'payout' : m.outcome === 'cancelled' ? 'cancel refund' : 'draw refund'}`,
        detail: `match ${m.id.slice(0, 8)} · wager ${wagerHuman} SKR`,
        tx_sig: sig,
        meta: { match_id: m.id, wager: wager.toString(), outcome: m.outcome, role: isFeeShare ? 'fee' : 'player' },
      });
    }
  } catch (e) {
    console.error('[kaiji settle failed]', matchId, errMsg(e));
    const patch: Record<string, unknown> = { status: 'settle_failed', error: errMsg(e).slice(0, 300), updated_at: iso() };
    if (!sent) patch.payout_started_at = null; // nothing was broadcast, so it is safe to retry right away
    await db().from('kaiji_matches').update(patch).eq('id', m.id);
  }
}

// ---------------------------------------------------------------------------------------- rounds
async function finishRound(m: any, cardA: Card | null, cardB: Card | null) {
  const s: MatchState = {
    handA: m.hand_a,
    handB: m.hand_b,
    winsA: m.wins_a,
    winsB: m.wins_b,
    round: m.round,
    idleRounds: m.idle_rounds,
  };
  const r = resolveRound(s, cardA, cardB);
  const f = r.finish;
  const { data: applied, error } = await db().rpc('kaiji_apply_round', {
    p_match: m.id,
    p_round: m.round,
    p_hand_a: r.next.handA,
    p_hand_b: r.next.handB,
    p_wins_a: r.next.winsA,
    p_wins_b: r.next.winsB,
    p_idle: r.next.idleRounds,
    p_card_a: cardA,
    p_card_b: cardB,
    p_result: r.result,
    p_forfeit: r.forfeit,
    p_status: f ? 'settling' : 'active',
    p_outcome: f ? f.outcome : null,
    p_winner: f && f.winner ? f.winner : null,
    p_next_deadline: f ? null : iso(RULES.pickSeconds * 1000),
  });
  if (error) throw new Error(error.message);
  if (applied && f) await settleMatch(m.id);
  return !!applied;
}

async function picksFor(m: any): Promise<{ a: Card | null; b: Card | null }> {
  const { data } = await db().from('kaiji_picks').select('side, card').eq('match_id', m.id).eq('round', m.round);
  return {
    a: (data?.find((p: any) => p.side === 'a')?.card ?? null) as Card | null,
    b: (data?.find((p: any) => p.side === 'b')?.card ?? null) as Card | null,
  };
}

async function processTimeout(m: any) {
  if (m.status !== 'active' || !m.round_deadline || new Date(m.round_deadline).getTime() > Date.now()) return;
  const p = await picksFor(m);
  await finishRound(m, p.a, p.b);
}

async function submitPick(secret: unknown, matchId: string, card: unknown) {
  if (!isCard(card)) throw new Error('bad_card');
  const hash = await sha256Hex(validSecret(secret));
  const m = await getMatch(matchId);
  const side = sideOf(m, hash);
  if (m.status !== 'active') throw new Error('not_active');
  if (new Date(m.round_deadline).getTime() < Date.now()) {
    await processTimeout(m);
    return publicMatch(await getMatch(matchId));
  }
  const hand = side === 'a' ? m.hand_a : m.hand_b;
  if ((hand[card] ?? 0) <= 0) throw new Error('no_such_card');
  const lockedKey = side === 'a' ? 'locked_a' : 'locked_b';
  if (m[lockedKey]) throw new Error('already_locked');

  const { error } = await db().from('kaiji_picks').insert({ match_id: m.id, round: m.round, side, card });
  if (error) throw new Error(error.code === '23505' ? 'already_locked' : error.message);
  await db()
    .from('kaiji_matches')
    .update({ [lockedKey]: true, updated_at: iso() })
    .eq('id', m.id)
    .eq('round', m.round)
    .eq('status', 'active');

  const p = await picksFor(m);
  if (p.a && p.b) await finishRound(m, p.a, p.b);
  return publicMatch(await getMatch(matchId));
}

// --------------------------------------------------------------------- joining, cancelling, state
async function refundDeposit(wallet: string, wager: bigint, signature: string) {
  // Atomic claim: only ONE caller can ever refund a deposit, and never one already attached to a match.
  const { data: claimed, error: claimErr } = await db().rpc('kaiji_claim_deposit_refund', {
    p_sig: signature,
    p_stale_before: iso(-180_000),
  });
  if (claimErr) {
    console.error('[kaiji refund claim failed]', signature, claimErr.message);
    return;
  }
  if (!claimed) return;
  try {
    const sig = await sendTransfers([{ wallet, amount: wager }]);
    await db().from('kaiji_deposits').update({ refund_sig: sig }).eq('sig', signature);
    await logFeed({
      event_type: 'kaiji_deposit_refund',
      direction: 'out',
      asset: 'SKR',
      amount: Number(wager) / 10 ** cfg().decimals,
      wallet,
      title: 'Kaiji deposit refund',
      tx_sig: sig,
      meta: { deposit_sig: signature },
    });
  } catch (e) {
    console.error('[kaiji refund failed]', signature, errMsg(e));
    await db().from('kaiji_deposits').update({ refund_error: errMsg(e).slice(0, 300) }).eq('sig', signature);
  }
}

async function joinMatch(signature: string, wagerStr: string, secret: unknown) {
  const sec = validSecret(secret);
  const hash = await sha256Hex(sec);
  let wager: bigint;
  try {
    wager = BigInt(wagerStr);
  } catch {
    throw new Error('bad_wager');
  }

  // 1) prove the deposit on-chain; this also tells us which wallet is the player
  const v = await verifyDeposit(signature, hash, wager);
  if (!v.ok) {
    // The memo proved the caller made this deposit, so a wrong amount can be returned in full.
    // (A missing or wrong memo proves nothing, so those are never refunded automatically: a stranger could
    // otherwise trigger refunds of other people's deposits.)
    if (v.reason === 'amount_mismatch' && v.wallet && v.total && v.total > 0n) {
      const { error: e0 } = await db().from('kaiji_deposits').insert({ sig: signature, wallet: v.wallet, amount: v.total.toString() });
      if (!e0) await refundDeposit(v.wallet, v.total, signature);
    }
    throw new Error('deposit_' + v.reason);
  }
  const wallet = v.wallet;

  // 2) the signature can only ever be used once. Calling join again with the same signature and secret is
  //    safe (the app does this after a crash): it returns the same match instead of creating a new one.
  const { error: dErr } = await db().from('kaiji_deposits').insert({ sig: signature, wallet, amount: wager.toString() });
  if (dErr) {
    if (dErr.code !== '23505') throw new Error(dErr.message);
    const { data: dep } = await db().from('kaiji_deposits').select('*').eq('sig', signature).single();
    if (dep?.refund_sig) throw new Error('deposit_refunded');
    if (dep?.match_id) {
      const existing = await getMatch(dep.match_id);
      if (existing.token_a === hash || existing.token_b === hash) {
        return { match: publicMatch(existing), side: (existing.token_a === hash ? 'a' : 'b') as Side };
      }
      throw new Error('deposit_already_used');
    }
    // Another request is (or just was) joining with this same deposit. Only take over a stale attempt (a crash).
    if (Date.now() - new Date(dep.created_at).getTime() < 120_000) throw new Error('join_in_progress');
    // recorded earlier but never matched (for example a crash in between): carry on and join now
  }

  // 3) from here on, any rejection refunds the deposit
  const reject = async (code: string): Promise<never> => {
    await refundDeposit(wallet, wager, signature);
    throw new Error(code);
  };
  const c = cfg();
  if (wager < c.minWager || wager > c.maxWager) return reject('wager_out_of_range');
  if (c.allowedWallets.length && !c.allowedWallets.includes(wallet)) return reject('not_allowed');
  if (await openMatchByWallet(wallet)) return reject('already_in_match');

  const { data, error } = await db().rpc('kaiji_join_or_create', {
    p_wallet: wallet,
    p_token: hash,
    p_wager: wager.toString(),
    p_mint: c.mintAddress,
    p_deadline: iso(RULES.pickSeconds * 1000),
  });
  if (error || !data) return reject(error?.message ?? 'join_failed');
  for (let i = 0; i < 3; i++) {
    const { error: linkErr } = await db().from('kaiji_deposits').update({ match_id: data.id }).eq('sig', signature);
    if (!linkErr) break;
    console.error('[kaiji deposit link failed]', signature, linkErr.message);
    await sleep(300);
  }
  await logFeed({
    event_type: 'kaiji_deposit',
    direction: 'in',
    asset: 'SKR',
    amount: Number(wager) / 10 ** cfg().decimals,
    wallet,
    title: 'Kaiji wager deposit',
    detail: `match ${data.id.slice(0, 8)}`,
    tx_sig: signature,
    meta: { match_id: data.id, wager: wager.toString() },
  });
  return { match: publicMatch(data), side: (data.token_a === hash ? 'a' : 'b') as Side };
}

async function cancelWaiting(matchId: string): Promise<boolean> {
  const { data } = await db()
    .from('kaiji_matches')
    .update({ status: 'settling', outcome: 'cancelled', updated_at: iso() })
    .eq('id', matchId)
    .eq('status', 'waiting')
    .select()
    .maybeSingle();
  if (data) await settleMatch(matchId);
  return !!data;
}

async function cancelMatch(secret: unknown, matchId: string) {
  const hash = await sha256Hex(validSecret(secret));
  const m = await getMatch(matchId);
  if (sideOf(m, hash) !== 'a') throw new Error('cannot_cancel');
  if (!(await cancelWaiting(matchId))) throw new Error('cannot_cancel');
  return publicMatch(await getMatch(matchId));
}

async function getState(secret: unknown, matchId?: string) {
  const hash = await sha256Hex(validSecret(secret));
  let m: any = matchId ? await getMatch(matchId) : await openMatchByToken(hash);
  if (!m) return { match: null, side: null, rounds: [] };
  const side = sideOf(m, hash);

  if (m.status === 'waiting' && Date.now() - new Date(m.created_at).getTime() > RULES.waitingSeconds * 1000) {
    await cancelWaiting(m.id);
  } else if (m.status === 'active') {
    await processTimeout(m);
  } else if (m.status === 'settling' || m.status === 'settle_failed') {
    await settleMatch(m.id);
  }
  m = await getMatch(m.id);

  const { data: rounds } = await db()
    .from('kaiji_rounds')
    .select('round, card_a, card_b, result, forfeit')
    .eq('match_id', m.id)
    .order('round');
  return { match: publicMatch(m), side, rounds: rounds ?? [] };
}

// Expires unmatched wagers, applies pick timeouts and retries refunds and payouts.
// Safe for anyone to call: it only advances things that are already due, and money only ever goes to
// the wallets recorded on the match.
async function sweep() {
  const stats: { expired: number; timeouts: number; settled: number; solSwap?: string } = { expired: 0, timeouts: 0, settled: 0 };

  const { data: waiting } = await db()
    .from('kaiji_matches')
    .select('id')
    .eq('status', 'waiting')
    .lt('created_at', iso(-RULES.waitingSeconds * 1000));
  for (const r of waiting ?? []) if (await cancelWaiting(r.id)) stats.expired++;

  const { data: active } = await db().from('kaiji_matches').select('*').eq('status', 'active').lt('round_deadline', iso());
  for (const m of active ?? []) {
    await processTimeout(m);
    stats.timeouts++;
  }

  const { data: pending } = await db().from('kaiji_matches').select('id').in('status', ['settling', 'settle_failed']);
  for (const r of pending ?? []) {
    await settleMatch(r.id);
    stats.settled++;
  }

  // Convert accumulated fee shares to SOL once enough has piled up.
  try {
    const swap = await maybeSwapFeeToSol();
    if (swap.result !== 'idle') stats.solSwap = swap.result;
  } catch (e) {
    console.error('[kaiji sol swap]', errMsg(e));
  }
  return stats;
}

// Runs a cleanup pass at most every 10 seconds, whenever anyone calls the function, so refunds and
// timeouts happen even if no cron job is running.
let lastSweep = 0;
async function maybeSweep() {
  if (Date.now() - lastSweep < 10_000) return;
  lastSweep = Date.now();
  try {
    await sweep();
  } catch (e) {
    console.error('[kaiji sweep]', errMsg(e));
  }
}

async function health() {
  const c = cfg();
  const out: Record<string, unknown> = {
    escrow: c.escrowAddress,
    mint: c.mintAddress,
    feeWallet: c.feeWallet,
    allowedWallets: c.allowedWallets.length,
    pickSeconds: RULES.pickSeconds,
  };
  try {
    out.escrowSol = (await c.conn.getBalance(c.escrow.publicKey)) / 1e9;
  } catch (e) {
    out.escrowSol = 'error: ' + errMsg(e);
  }
  try {
    const bal = await c.conn.getTokenAccountBalance(c.escrowAta);
    out.escrowTokens = bal.value.uiAmountString;
  } catch (e) {
    out.escrowTokens = 'no token account for this mint yet';
  }
  try {
    const { data: all } = await db().from('kaiji_matches').select('status');
    const counts: Record<string, number> = {};
    for (const r of all ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    out.matches = counts;
  } catch (e) {
    out.matches = 'error: ' + errMsg(e);
  }
  out.ok =
    typeof out.escrowSol === 'number' && out.escrowSol >= 0.02 && typeof out.escrowTokens === 'string' && !out.escrowTokens.startsWith('no ');
  return out;
}

// ----------------------------------------------------------------------------------------- server
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    let result: unknown;
    switch (String(body.action ?? '')) {
      case 'config': {
        const c = cfg();
        const wallet = String(body.wallet ?? '');
        result = {
          mint: c.mintAddress,
          escrow: c.escrowAddress,
          decimals: c.decimals,
          rpcUrl: c.publicRpc,
          minWager: c.minWager.toString(),
          maxWager: c.maxWager.toString(),
          feeBps: RULES.feeBps,
          winsNeeded: RULES.winsNeeded,
          pickSeconds: RULES.pickSeconds,
          waitingSeconds: RULES.waitingSeconds,
          restricted: c.allowedWallets.length > 0,
          allowed: c.allowedWallets.length === 0 || c.allowedWallets.includes(wallet),
        };
        break;
      }
      case 'health':
        result = await health();
        break;
      case 'join':
        result = await joinMatch(String(body.signature ?? ''), String(body.wager ?? ''), body.secret);
        break;
      case 'pick':
        result = { match: await submitPick(body.secret, String(body.matchId ?? ''), body.card) };
        break;
      case 'cancel':
        result = { match: await cancelMatch(body.secret, String(body.matchId ?? '')) };
        break;
      case 'state':
        result = await getState(body.secret, body.matchId ? String(body.matchId) : undefined);
        break;
      case 'sweep':
        result = await sweep();
        break;
      default:
        return json({ error: 'unknown_action' }, 400);
    }

    // opportunistic cleanup after the answer is ready
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(maybeSweep());
    else await maybeSweep();

    return json(result);
  } catch (e) {
    const message = errMsg(e);
    console.error('[kaiji]', message);
    return json({ error: message }, message === 'forbidden' ? 403 : 400);
  }
});
