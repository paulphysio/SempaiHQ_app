// deno-lint-ignore-file no-explicit-any
// DEVNET TEST VERSION of subscribe-manga.
// Paste this file as the edge function named `subscribe-manga` TEMPORARILY to
// test the subscription flow on Solana devnet, then paste the production
// version back. No secrets needed — devnet RPC is hardcoded.
//
// Differences vs production:
//  - RPC is devnet (api.devnet.solana.com)
//  - SOL only (devnet has no canonical USDC/SMP)
//  - No money_events feed logging (keeps the DAO feed clean of test data)
//  - Still writes real manga_subscriptions rows — delete test rows after.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1";

const RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const TREASURY_WALLET = "71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD";

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

async function solUsdPrice(): Promise<number> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    return (await r.json())?.solana?.usd || 150;
  } catch { return 150; }
}

// SOL (lamports->SOL) received by destWallet in the tx
async function receivedSol(signature: string, destWallet: string): Promise<number> {
  const tx: any = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx?.meta || tx.meta.err) return 0;
  const keys: string[] = tx.transaction.message.accountKeys.map((k: any) => (k.toBase58 ? k.toBase58() : String(k)));
  const idx = keys.indexOf(destWallet);
  if (idx === -1) return 0;
  return Math.max(0, (tx.meta.postBalances[idx] ?? 0) - (tx.meta.preBalances[idx] ?? 0)) / 1e9;
}

serve(async (req) => {
  try {
    const body = await req.json();
    const { signature, mangaId, plan, currency, walletAddress } = body as {
      signature: string; mangaId: string; plan: string; currency: string; walletAddress: string;
    };
    const planCfg = PLANS[plan];
    if (!signature || !mangaId || !planCfg || !walletAddress) {
      return new Response(JSON.stringify({ error: "Invalid request." }), { status: 400 });
    }
    if (currency !== "SOL") {
      return new Response(JSON.stringify({ error: "Devnet test supports SOL payments only." }), { status: 400 });
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

    const { data: dupe } = await supabaseAdmin
      .from("manga_subscriptions")
      .select("id")
      .eq("tx_sig", signature)
      .limit(1);
    if (dupe?.length) {
      return new Response(JSON.stringify({ success: true, alreadyRecorded: true }), { status: 200 });
    }

    // Verify on devnet: artist ~70%, treasury ~30% of plan USD value
    const solPrice = await solUsdPrice();
    const authorUsd = (await receivedSol(signature, authorRow.wallet_address)) * solPrice;
    const treasuryUsd = (await receivedSol(signature, TREASURY_WALLET)) * solPrice;
    const totalUsd = authorUsd + treasuryUsd;
    const expected = planCfg.usd;

    if (totalUsd < expected * 0.85 || authorUsd < expected * 0.7 * 0.85 || treasuryUsd < expected * 0.3 * 0.85) {
      return new Response(JSON.stringify({
        error: `Devnet payment verification failed (received ~$${totalUsd.toFixed(2)} total, artist ~$${authorUsd.toFixed(2)}, treasury ~$${treasuryUsd.toFixed(2)}).`,
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
        currency: "SOL",
        tx_sig: signature,
        expires_at: expiresAt,
      })
      .then(throwOnError);

    return new Response(JSON.stringify({ success: true, expires_at: expiresAt, devnet: true }), { status: 200 });
  } catch (error: any) {
    console.error("[subscribe-manga-devnet] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), { status: 500 });
  }
});
