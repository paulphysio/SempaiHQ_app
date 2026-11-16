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
