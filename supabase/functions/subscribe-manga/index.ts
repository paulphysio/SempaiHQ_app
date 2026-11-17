// deno-lint-ignore-file no-explicit-any
// subscribe-manga: records a manga series subscription AFTER the client has
// paid on-chain (SOL or USDC split 70% artist / 30% treasury).
// The app builds + signs the transaction itself (wallet password), then calls
// this function with the signature. We re-verify the payment landed at the
// right wallets before writing manga_subscriptions. Self-contained: paste whole file.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";
import {
  Connection,
  PublicKey,
} from "https://esm.sh/@solana/web3.js@1";

const RPC_URL = Deno.env.get("RPC_URL") || Deno.env.get("PUBLIC_RPC_URL") || "";
const connection = new Connection(RPC_URL, "confirmed");

const TREASURY_WALLET = "71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const PLANS: Record<string, { usd: number; days: number }> = {
  monthly: { usd: 5.0, days: 30 },
  days21: { usd: 3.0, days: 21 },
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) || "";
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

// USD value received by `destWallet` in the tx (SOL lamports or SPL mint)
async function receivedBy(signature: string, destWallet: string, mint: string | null): Promise<number> {
  const tx: any = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx?.meta || tx.meta.err) return 0;
  const keys: string[] = tx.transaction.message.accountKeys.map((k: any) => (k.toBase58 ? k.toBase58() : String(k)));

  if (!mint) {
    const idx = keys.indexOf(destWallet);
    if (idx === -1) return 0;
    return Math.max(0, (tx.meta.postBalances[idx] ?? 0) - (tx.meta.preBalances[idx] ?? 0)) / 1e9;
  }

  const pre = new Map<string, number>();
  for (const b of tx.meta.preTokenBalances || []) {
    if (b.mint === mint && b.owner === destWallet) pre.set(String(b.accountIndex), Number(b.uiTokenAmount?.uiAmount) || 0);
  }
  let received = 0;
  for (const b of tx.meta.postTokenBalances || []) {
    if (b.mint !== mint || b.owner !== destWallet) continue;
    received += Math.max(0, (Number(b.uiTokenAmount?.uiAmount) || 0) - (pre.get(String(b.accountIndex)) || 0));
  }
  return received;
}

serve(async (req) => {
  try {
    const body = await req.json();
    const { signature, mangaId, plan, currency, walletAddress } = body as {
      signature: string; mangaId: string; plan: string; currency: "SOL" | "USDC"; walletAddress: string;
    };
    const planCfg = PLANS[plan];
    if (!signature || !mangaId || !planCfg || !walletAddress || !["SOL", "USDC"].includes(currency)) {
      return new Response(JSON.stringify({ error: "Invalid request." }), { status: 400 });
    }

    const manga = await supabaseAdmin
      .from("manga")
      .select("id, user_id, title")
      .eq("id", mangaId)
      .maybeSingle()
      .then(throwOnError);
    if (!manga) return new Response(JSON.stringify({ error: "Manga not found" }), { status: 404 });

    const authorRow = await supabaseAdmin
      .from("users")
      .select("id, wallet_address")
      .eq("id", manga.user_id)
      .maybeSingle()
      .then(throwOnError);
    if (!authorRow?.wallet_address) {
      return new Response(JSON.stringify({ error: "Artist wallet not found" }), { status: 400 });
    }

    const userRow = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .maybeSingle()
      .then(throwOnError);
    if (!userRow) return new Response(JSON.stringify({ error: "Wallet not registered" }), { status: 400 });
    if (userRow.id === manga.user_id) {
      return new Response(JSON.stringify({ error: "You can't subscribe to your own manga." }), { status: 400 });
    }

    // One subscription per transaction signature
    const { data: dupe } = await supabaseAdmin
      .from("manga_subscriptions")
      .select("id")
      .eq("tx_sig", signature)
      .limit(1);
    if (dupe?.length) {
      return new Response(JSON.stringify({ success: true, alreadyRecorded: true }), { status: 200 });
    }

    // Verify payment on-chain: artist must receive ~70%, treasury ~30% of plan USD
    const mint = currency === "USDC" ? USDC_MINT : null;
    const solPrice = currency === "SOL" ? await solUsdPrice() : 1;
    const toUsd = (amount: number) => (currency === "SOL" ? amount * solPrice : amount);

    const authorRecv = toUsd(await receivedBy(signature, authorRow.wallet_address, mint));
    const treasuryRecv = toUsd(await receivedBy(signature, TREASURY_WALLET, mint));
    const totalRecv = authorRecv + treasuryRecv;

    const expected = planCfg.usd;
    if (totalRecv < expected * 0.85 || authorRecv < expected * 0.7 * 0.85 || treasuryRecv < expected * 0.3 * 0.85) {
      return new Response(JSON.stringify({
        error: `Payment verification failed (received ~$${totalRecv.toFixed(2)}).`,
      }), { status: 402 });
    }

    const expiresAt = new Date(Date.now() + planCfg.days * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("manga_subscriptions")
      .insert({
        user_id: userRow.id,
        manga_id: mangaId,
        plan,
        amount_usd: expected,
        currency,
        tx_sig: signature,
        expires_at: expiresAt,
      })
      .then(throwOnError);

    await logFeed({
      event_type: "manga_subscription",
      direction: "in",
      asset: currency,
      amount: totalRecv,
      usd_value: totalRecv,
      wallet: walletAddress,
      counterparty: authorRow.wallet_address,
      user_id: userRow.id,
      title: `Manga subscription (${plan})`,
      detail: manga.title || `manga ${mangaId}`,
      tx_sig: signature,
      meta: { manga_id: mangaId, plan },
    });

    return new Response(JSON.stringify({ success: true, expires_at: expiresAt }), { status: 200 });
  } catch (error: any) {
    console.error("[subscribe-manga] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), { status: 500 });
  }
});
