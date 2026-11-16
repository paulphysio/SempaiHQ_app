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
