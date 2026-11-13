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
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
//
// Actions (POST json { action, ... }): config, health, join, pick, cancel, state, sweep
// =====================================================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Connection, Keypair, PublicKey, Transaction } from 'npm:@solana/web3.js@1.98.0';
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
};

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
  (_db ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
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
  const res = await c.conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  if (res.value.err) throw new Error('payout_failed_onchain');
  return sig;
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
      await markSettled(m.id, m.settle_sig);
      return;
    }
    const wager = BigInt(m.wager);
    let items: { wallet: string; amount: bigint }[];
    if (m.outcome === 'win') {
      const { fee, payout } = settlementAmounts(wager);
      const winnerWallet = m.winner === 'a' ? m.wallet_a : m.wallet_b;
      items = [
        { wallet: winnerWallet, amount: payout },
        { wallet: cfg().feeWallet, amount: fee },
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
    await markSettled(m.id, sig);
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
  try {
    const sig = await sendTransfers([{ wallet, amount: wager }]);
    await db().from('kaiji_deposits').update({ refund_sig: sig }).eq('sig', signature);
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
  await db().from('kaiji_deposits').update({ match_id: data.id }).eq('sig', signature);
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
  const stats = { expired: 0, timeouts: 0, settled: 0 };

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
