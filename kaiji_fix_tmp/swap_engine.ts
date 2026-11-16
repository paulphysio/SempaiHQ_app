// KAIJI SOL-swap state machine (pure: no Solana/Supabase imports, so it is unit-testable).
// Paste this block into index.ts above maybeSwapFeeToSol (drop the `export` keywords if you want).
//
// Safety rules enforced here:
//  1. Only ONE swap exists at a time and only the lease holder acts on it (enforced in SQL).
//  2. The transaction signature is saved BEFORE the transaction is broadcast, so a crash can never lose it.
//  3. A swap is released (its shares freed to be swapped again) ONLY when its signature definitely can no longer
//     land: it failed on-chain, or its blockhash has expired and the signature is still not on-chain.
//  4. Once the swap landed (status 'swapped') it is NEVER swapped again. Only the SOL forward is retried.

export type SigState = 'confirmed' | 'failed' | 'unknown';
export type SwapRow = {
  id: string;
  status: 'claimed' | 'sent' | 'swapped';
  total: string | number;
  swap_sig: string | null;
  swap_last_valid: number | string | null;
  min_out: string | number | null;
  forward_sig: string | null;
  forward_last_valid: number | string | null;
};
export type Prepared = { signature: string; lastValidBlockHeight: number; broadcast: () => Promise<void> };
export interface SwapDeps {
  acquire(): Promise<SwapRow | null>;
  patch(id: string, patch: Record<string, unknown>): Promise<void>;
  release(id: string, reason: string): Promise<boolean>;
  finish(id: string): Promise<boolean>;
  prepareSwap(total: bigint): Promise<Prepared & { minOut: bigint }>; // signs, must NOT broadcast
  prepareForward(lamports: bigint): Promise<Prepared>; // signs, must NOT broadcast
  sigState(sig: string): Promise<SigState>;
  blockHeight(): Promise<number>;
  log(msg: string): void;
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

export async function runSwapStep(d: SwapDeps): Promise<{ result: string }> {
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
      return { result: 'done' };
    }
    if (r === 'pending') return { result: 'forward_pending' };
    await d.patch(row.id, { forward_sig: null, forward_last_valid: null });
    return { result: 'forward_retry' };
  }
  return { result: 'idle' };
}
