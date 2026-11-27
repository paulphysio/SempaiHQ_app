// @ts-nocheck - Deno edge function
// lending-rewards: on the 1st of each month (pg_cron, migrations/20261209_hq_pass.sql) —
// 30% of the previous month's Bazaar lending fees go to the uploaders of the 3 most-borrowed books,
// split by how many times each was borrowed.
//
// Safety:
//  · one payout per book per month (unique rows; re-running never pays twice);
//  · pays from the platform wallet only if TREASURY_KEYPAIR is that exact wallet, and only up to
//    MAX_POOL_SMP — otherwise the rows stay "pending" for an admin to pay by hand;
//  · called only with the secret generated inside the database (x-job-secret).
//
// Deploy with --no-verify-jwt (the database calls it without a user login).
// Manual run for a month: POST {"period":"2026-11"} with the same secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";
import { Connection, PublicKey, Transaction, Keypair } from "npm:@solana/web3.js@1.95.3";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "npm:@solana/spl-token@0.4.8";
import bs58 from "npm:bs58@5.0.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!);
const PLATFORM_WALLET = "71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD";
const SMP_MINT = new PublicKey("SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor");
const SMP_DECIMALS = 6;
const SHARE = 0.3;                   // 30% of lending fees
const TOP_N = 3;
const MAX_POOL_SMP = 200_000_000;    // safety cap per month; above this an admin pays by hand
const RPC_URL = Deno.env.get("RPC_URL") || Deno.env.get("SOLANA_RPC_URL") || Deno.env.get("HELIUS_RPC_URL") || "https://api.mainnet-beta.solana.com";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function treasury(): Keypair | null {
  const raw = Deno.env.get("TREASURY_KEYPAIR");
  if (!raw) return null;
  try {
    const bytes = raw.trim().startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw.trim());
    const kp = Keypair.fromSecretKey(bytes);
    return kp.publicKey.toBase58() === PLATFORM_WALLET ? kp : null; // only ever the platform wallet
  } catch {
    return null;
  }
}

function previousPeriod(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function bounds(period: string) {
  const [y, m] = period.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)).toISOString(), to: new Date(Date.UTC(y, m, 1)).toISOString() };
}

async function payOut(kp: Keypair, wallet: string, amountSmp: number) {
  const conn = new Connection(RPC_URL, "confirmed");
  const to = new PublicKey(wallet);
  const fromAta = await getAssociatedTokenAddress(SMP_MINT, kp.publicKey);
  const toAta = await getAssociatedTokenAddress(SMP_MINT, to);
  const units = BigInt(Math.floor(amountSmp * 10 ** SMP_DECIMALS));
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, toAta, to, SMP_MINT),
    createTransferCheckedInstruction(fromAta, SMP_MINT, toAta, kp.publicKey, units, SMP_DECIMALS),
  );
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = kp.publicKey;
  tx.sign(kp);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { data: secretRow } = await admin.from("job_secrets").select("secret").eq("name", "lending-rewards").maybeSingle();
  if (!secretRow?.secret || req.headers.get("x-job-secret") !== secretRow.secret) return json({ error: "Forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* cron sends {} */ }
  const period = /^\d{4}-\d{2}$/.test(body?.period || "") ? body.period : previousPeriod();
  const { from, to } = bounds(period);

  // 1) the month's borrows
  const { data: lends, error } = await admin
    .from("bazaar_purchases")
    .select("book_id, platform_amount")
    .eq("access_type", "lend")
    .eq("status", "completed")
    .gte("created_at", from)
    .lt("created_at", to);
  if (error) return json({ error: error.message }, 500);
  const fees = (lends || []).reduce((n, l) => n + (Number(l.platform_amount) || 0), 0);
  const pool = Math.floor(fees * SHARE);
  if (!lends?.length || pool <= 0) return json({ period, borrows: 0, pool: 0, note: "No borrows this month" });

  // 2) top 3 books by borrow count
  const counts = new Map<string, number>();
  for (const l of lends) counts.set(l.book_id, (counts.get(l.book_id) || 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_N);
  const topTotal = top.reduce((n, [, c]) => n + c, 0);

  // 3) one row per book (unique per month → re-runs never duplicate)
  const kp = treasury();
  const canPay = !!kp && pool <= MAX_POOL_SMP;
  const results = [];
  for (const [i, [bookId, borrows]] of top.entries()) {
    const amount = Math.floor((pool * borrows) / topTotal);
    const { data: book } = await admin.from("bazaar_books").select("author_id").eq("id", bookId).maybeSingle();
    const { data: owner } = book?.author_id
      ? await admin.from("users").select("id, wallet_address").eq("id", book.author_id).maybeSingle()
      : { data: null };
    const wallet = owner?.wallet_address || null;
    const { data: row } = await admin
      .from("lending_rewards")
      .upsert({ period, book_id: bookId, rank: i + 1, recipient_id: owner?.id || null, wallet, borrows, amount_smp: amount, pool_smp: pool }, { onConflict: "period,book_id", ignoreDuplicates: true })
      .select("id, status")
      .maybeSingle();
    const { data: current } = await admin.from("lending_rewards").select("id, status").eq("period", period).eq("book_id", bookId).maybeSingle();
    if (!current || current.status !== "pending") { results.push({ bookId, status: current?.status || "exists" }); continue; }
    if (!wallet || wallet === PLATFORM_WALLET || amount <= 0) {
      await admin.from("lending_rewards").update({ status: "skipped", error: !wallet ? "Uploader has no wallet" : "Nothing to pay" }).eq("id", current.id);
      results.push({ bookId, status: "skipped" });
      continue;
    }
    if (!canPay) { results.push({ bookId, status: "pending", amount }); continue; }
    try {
      const sig = await payOut(kp!, wallet, amount);
      await admin.from("lending_rewards").update({ status: "paid", tx_signature: sig, paid_at: new Date().toISOString(), error: null }).eq("id", current.id);
      results.push({ bookId, status: "paid", amount, sig });
    } catch (e) {
      await admin.from("lending_rewards").update({ status: "failed", error: String((e as Error)?.message || e).slice(0, 300) }).eq("id", current.id);
      results.push({ bookId, status: "failed" });
    }
  }
  return json({ period, borrows: lends.length, fees, pool, payingAutomatically: canPay, results });
});
