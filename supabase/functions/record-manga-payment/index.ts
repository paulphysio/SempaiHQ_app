// deno-lint-ignore-file no-explicit-any
// record-manga-payment: the mobile app signs chapter payments client-side.
// After broadcast, the app calls this function with the signature; we verify
// the payment actually landed at the merchant wallet on-chain, then write
// user_payments + unlocked_manga_chapters with the service role.
// Self-contained: paste whole file into Supabase Edge Functions.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  Connection,
  PublicKey,
} from "https://esm.sh/@solana/web3.js@1";

const RPC_URL = Deno.env.get("RPC_URL") || Deno.env.get("PUBLIC_RPC_URL") || "";
const connection = new Connection(RPC_URL, "confirmed");

const MERCHANT_WALLET = "71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SMP_MINT = "SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

function throwOnError({ data, error }: { data: any; error: any }) {
  if (error) throw new Error(error?.message || "database error");
  return data;
}

async function logFeed(row: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("money_events").insert(row);
  } catch (e: any) {
    console.warn("[money_events] insert failed:", e?.message);
  }
}

async function solUsdPrice(): Promise<number> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    return (await r.json())?.solana?.usd || 150;
  } catch { return 150; }
}

// SMP per USD from the Meteora [SMP, SOL] pool (same source as unlock-manga-chapter)
async function smpPerUsd(): Promise<number> {
  try {
    const [pool] = await fetch("https://amm-v2.meteora.ag/pools?address=3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33").then((r) => r.json());
    const smp = parseFloat(pool.pool_token_amounts[0]);
    const smpUsd = parseFloat(pool.pool_token_usd_amounts[0]);
    return smp / smpUsd;
  } catch { return 0; }
}

// Returns the amount (in UI units) the merchant wallet received in `mint` (null = SOL).
async function merchantReceived(signature: string, mint: string | null): Promise<number> {
  const tx: any = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx?.meta || tx.meta.err) return 0;

  const accountKeys: string[] = tx.transaction.message.accountKeys.map((k: any) => k.toBase58 ? k.toBase58() : String(k));

  if (!mint) {
    // SOL: lamports delta on the merchant account
    const idx = accountKeys.indexOf(MERCHANT_WALLET);
    if (idx === -1) return 0;
    const pre = tx.meta.preBalances[idx] ?? 0;
    const post = tx.meta.postBalances[idx] ?? 0;
    return Math.max(0, post - pre) / 1e9;
  }

  // SPL: sum positive uiTokenAmount deltas on token accounts owned by merchant
  const pre = new Map<string, number>();
  for (const b of tx.meta.preTokenBalances || []) {
    if (b.mint === mint && b.owner === MERCHANT_WALLET) {
      pre.set(`${b.accountIndex}`, Number(b.uiTokenAmount?.uiAmount) || 0);
    }
  }
  let received = 0;
  for (const b of tx.meta.postTokenBalances || []) {
    if (b.mint !== mint || b.owner !== MERCHANT_WALLET) continue;
    const postAmt = Number(b.uiTokenAmount?.uiAmount) || 0;
    received += Math.max(0, postAmt - (pre.get(String(b.accountIndex)) || 0));
  }
  return received;
}

serve(async (req) => {
  try {
    const body = await req.json();
    const { signature, chapterId, mangaId, currency, paymentType, walletAddress, amountUsd } = body as {
      signature: string; chapterId: string; mangaId: string;
      currency: "SOL" | "USDC" | "SMP"; paymentType?: string;
      walletAddress: string; amountUsd?: number;
    };
    if (!signature || !chapterId || !mangaId || !currency || !walletAddress) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    // Never record the same signature twice
    const { data: dupe } = await supabaseAdmin
      .from("user_payments")
      .select("id")
      .eq("transaction_id", signature)
      .limit(1);
    if (dupe?.length) {
      return new Response(JSON.stringify({ success: true, alreadyRecorded: true }), { status: 200 });
    }

    const chapter = await supabaseAdmin
      .from("manga_chapters")
      .select("id, manga_id, is_premium, price, chapter_number")
      .eq("id", chapterId)
      .eq("manga_id", mangaId)
      .maybeSingle()
      .then(throwOnError);
    if (!chapter) return new Response(JSON.stringify({ error: "Chapter not found" }), { status: 404 });

    // Expected USD value of this unlock
    let expectedUsd = chapter.is_premium ? Number(chapter.price) || 2.5 : 0.005;
    if (paymentType === "threeChapters") expectedUsd = 3;
    if (paymentType === "fullChapters") expectedUsd = 15;

    // Verify on-chain payment to merchant (null mint = native SOL lamports)
    const solMint = currency === "USDC" ? USDC_MINT : currency === "SMP" ? SMP_MINT : null;
    const received = await merchantReceived(signature, solMint);
    if (received <= 0) {
      return new Response(JSON.stringify({ error: "Payment transaction not found or merchant received nothing." }), { status: 402 });
    }

    // Floor: received value must be >= ~85% of expected USD (price drift tolerance)
    let receivedUsd = 0;
    if (currency === "USDC") receivedUsd = received;
    else if (currency === "SOL") receivedUsd = received * (await solUsdPrice());
    else if (currency === "SMP") { const p = await smpPerUsd(); receivedUsd = p ? received / p : 0; }
    if (receivedUsd < expectedUsd * 0.85) {
      return new Response(JSON.stringify({ error: `Payment too small: ~$${receivedUsd.toFixed(2)} received, ~$${expectedUsd} expected.` }), { status: 402 });
    }

    const userRow = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .maybeSingle()
      .then(throwOnError);
    if (!userRow) return new Response(JSON.stringify({ error: "Wallet not registered" }), { status: 400 });

    const paidAt = new Date().toISOString();
    await supabaseAdmin.from("user_payments").insert({
      user_wallet: walletAddress,
      manga_id: mangaId,
      chapter_id: chapterId,
      transaction_id: signature,
      payment_amount: receivedUsd,
      payment_currency: currency,
      paid_at: paidAt,
    }).then(throwOnError);

    // Build unlock rows
    let unlockRows: any[] = [];
    if (paymentType === "threeChapters" || paymentType === "fullChapters") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (paymentType === "fullChapters") {
        unlockRows = [{ user_id: userRow.id, manga_id: mangaId, chapter_id: null, transaction_id: signature, unlocked_at: paidAt, expires_at: expiresAt }];
      } else {
        const { data: chapters } = await supabaseAdmin
          .from("manga_chapters")
          .select("id, chapter_number")
          .eq("manga_id", mangaId)
          .order("chapter_number", { ascending: true })
          .then(throwOnError);
        const idx = (chapters || []).findIndex((c: any) => c.id === chapterId);
        const targets = (chapters || []).slice(Math.max(0, idx), Math.max(0, idx) + 3);
        unlockRows = targets.map((c: any) => ({ user_id: userRow.id, manga_id: mangaId, chapter_id: c.id, transaction_id: signature, unlocked_at: paidAt, expires_at: expiresAt }));
      }
    } else {
      unlockRows = [{ user_id: userRow.id, manga_id: mangaId, chapter_id: chapterId, transaction_id: signature, unlocked_at: paidAt, expires_at: null }];
    }
    await supabaseAdmin.from("unlocked_manga_chapters").insert(unlockRows).then(throwOnError);

    const decimals = currency === "SOL" ? 9 : 6;
    await logFeed({
      event_type: "manga_unlock",
      direction: "in",
      asset: currency,
      amount: received,
      usd_value: receivedUsd,
      wallet: walletAddress,
      user_id: userRow.id,
      title: `Manga chapter unlock (${paymentType || "single"})`,
      detail: `manga ${mangaId}`,
      tx_sig: signature,
      meta: { manga_id: mangaId, chapter_id: chapterId, payment_type: paymentType || "single" },
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error("[record-manga-payment] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), { status: 500 });
  }
});
