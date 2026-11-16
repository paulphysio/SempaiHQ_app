# Edits to `kaiji/index.ts` (the deployed version you pasted). Apply in this order, AFTER running `kaiji_patch.sql`.

## 0. Add one import (top of file, with the other imports)
```ts
import bs58 from 'npm:bs58@5.0.0';
```

## 1. Claim 3: `sendTransfers` must not use the websocket confirm
Find:
```ts
  const sig = await c.conn.sendRawTransaction(tx.serialize());
  if (onSent) await onSent(sig);
  const res = await c.conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  if (res.value.err) throw new Error('payout_failed_onchain');
  return sig;
```
Replace with:
```ts
  const sig = await c.conn.sendRawTransaction(tx.serialize());
  if (onSent) await onSent(sig);
  await confirmSig(sig); // poll-based; websocket confirmTransaction hangs in edge runtimes
  return sig;
```
(`confirmSig` already exists lower in the file. A timeout lands in `settle_failed`; the retry path re-checks `settle_sig` first, so nothing is paid twice.)

## 2. Claim 4: record the SOL share BEFORE marking settled, and make a failure retryable
In `settleMatch`, find:
```ts
    await markSettled(m.id, sig);
    await recordSolShare(m);
```
Replace with:
```ts
    await recordSolShare(m); // idempotent upsert; must happen first or a crash here loses the share forever
    await markSettled(m.id, sig);
```
In `recordSolShare`, find:
```ts
  if (error) console.error('[kaiji sol share record failed]', m.id, error.message);
```
Replace with:
```ts
  if (error) throw new Error('sol_share_record_failed: ' + error.message);
```
(Throwing sends the match to `settle_failed`; the retry sees the payout already confirmed, records the share, then settles.)

## 3. Claim 2: replace the whole old `maybeSwapFeeToSol` function
Delete the existing `async function maybeSwapFeeToSol() { ... }` (from its comment line to its closing brace, the one that quotes Jupiter and calls `kaiji_sol_share ... update({ swapped: true })`).
In its place paste, in this order:
1. the entire contents of `swap_engine.ts` (you may delete the `export` keywords),
2. the entire contents of `swap_wiring.ts`.

Then in `sweep()`:
Find:
```ts
  const stats = { expired: 0, timeouts: 0, settled: 0 };
```
Replace with:
```ts
  const stats: Record<string, unknown> = { expired: 0, timeouts: 0, settled: 0 };
```
Find:
```ts
    const swap = await maybeSwapFeeToSol();
    if (swap.swapped) stats.solSwap = swap.solLamports;
```
Replace with:
```ts
    const swap = await maybeSwapFeeToSol();
    if (swap.result !== 'idle') stats.solSwap = swap.result;
```

## 4. New bug I found: one deposit could be refunded AND still play (concurrent `join` with the same signature)
Two `join` requests with the same signature and secret, sent at the same time: the second one hits the "already used" branch, sees no match yet, carries on, then `openMatchByWallet` finds the first request's match and calls `reject('already_in_match')`, which REFUNDS the deposit. The first request still creates the match. The player gets their money back and plays on the escrow's other funds.

a) Replace `refundDeposit` entirely with:
```ts
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
  } catch (e) {
    console.error('[kaiji refund failed]', signature, errMsg(e));
    await db().from('kaiji_deposits').update({ refund_error: errMsg(e).slice(0, 300) }).eq('sig', signature);
  }
}
```
b) In `joinMatch`, in the `if (dErr) { ... }` branch, find:
```ts
    // recorded earlier but never matched (for example a crash in between): carry on and join now
```
and put this line directly ABOVE it:
```ts
    // Another request is (or just was) joining with this same deposit. Only take over a stale attempt (a crash).
    if (Date.now() - new Date(dep.created_at).getTime() < 120_000) throw new Error('join_in_progress');
```
c) Find:
```ts
  await db().from('kaiji_deposits').update({ match_id: data.id }).eq('sig', signature);
```
Replace with:
```ts
  for (let i = 0; i < 3; i++) {
    const { error: linkErr } = await db().from('kaiji_deposits').update({ match_id: data.id }).eq('sig', signature);
    if (!linkErr) break;
    console.error('[kaiji deposit link failed]', signature, linkErr.message);
    await sleep(300);
  }
```
The app should treat `join_in_progress` as "wait a moment and call `state`/`join` again".
