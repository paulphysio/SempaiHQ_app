import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

// Constants
const SMP_MINT_ADDRESS = "SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor";
const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SKR_MINT_ADDRESS = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

// Who is calling — VERIFIED by Supabase Auth (an unverified token can be forged).
async function verifiedClaims(token: string | undefined): Promise<{ sub?: string; email?: string }> {
  if (!token) return {};
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return {};
  return { sub: data.user.id, email: data.user.email ?? undefined };
}

function throwOnError({ data, error }: any) {
  if (error) {
    console.error("[supabase] Error:", error?.message);
    throw new Error(error?.message);
  }
  return data;
}

// Public money-activity feed (DAO Governance). Fire-and-forget: never breaks payments.
async function logFeed(row: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("money_events").insert(row);
  } catch (e: any) {
    console.warn("[money_events] insert failed:", e?.message);
  }
}

// Simple price cache (5 min TTL)
let priceCache: { smpPerUsd: number; solPerUsd: number } | null = null;
let priceCacheTime = 0;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPrices(currency: string) {
  const now = Date.now();
  if (priceCache && now - priceCacheTime < PRICE_CACHE_TTL) {
    return priceCache;
  }

  try {
    const res = await fetch(
      "https://amm-v2.meteora.ag/pools?address=3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33",
      { signal: AbortSignal.timeout(4000) }
    );
    const [pool] = await res.json();

    const smpAmount = parseFloat(pool?.pool_token_amounts?.[0] || "0");
    const solAmount = parseFloat(pool?.pool_token_amounts?.[1] || "0");

    let smpPerUsd = 0.000000304; // safe fallback
    const solPerUsd = 100;        // fallback SOL price

    if (smpAmount > 0 && solAmount > 0) {
      const smpPerSol = smpAmount / solAmount;
      smpPerUsd = smpPerSol / solPerUsd;
    }

    priceCache = { smpPerUsd, solPerUsd };
    priceCacheTime = now;
    return priceCache;
  } catch (e) {
    console.warn("[prices] Fetch failed, using fallback", e.message);
    priceCache = { smpPerUsd: 0.000000304, solPerUsd: 100 };
    priceCacheTime = now;
    return priceCache;
  }
}

// ─── On-chain payment verification ─────────────────────────────────────────
// A chapter is only unlocked for a real, successful, recent payment made BY
// the reader's wallet TO the writer / SempaiHQ, that hasn't been used before.
const RPC_ENDPOINT = Deno.env.get("RPC_URL") || Deno.env.get("SOLANA_RPC_URL") ||
  Deno.env.get("HELIUS_RPC_URL") || "https://api.mainnet-beta.solana.com";
const PLATFORM_WALLET = "71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD"; // SempaiHQ + founder fund
const SOL_MINT = "So11111111111111111111111111111111111111112";
const MAX_TX_AGE_SECONDS = 24 * 60 * 60; // phones may retry a saved unlock later
const MIN_PAID_FRACTION = 0.5;           // generous: price feeds differ between app and server

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(RPC_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

async function fetchConfirmedTx(signature: string) {
  for (let i = 0; i < 5; i++) {
    const tx = await rpc("getTransaction", [signature, {
      encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0,
    }]).catch(() => null);
    if (tx) return tx;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

/** Live USD price per whole token (Jupiter). null if unavailable. */
async function usdPrice(mint: string): Promise<number | null> {
  // SMP isn't tradable on Jupiter — use the same price the app charges with.
  if (mint === SMP_MINT_ADDRESS) {
    try {
      const res = await fetch("https://www.sempaihq.com/api/smp-fallback-price", { signal: AbortSignal.timeout(4000) });
      const json = await res.json();
      const smpPerUsd = Number(json?.fallbackPrice);
      return Number.isFinite(smpPerUsd) && smpPerUsd > 0 ? 1 / smpPerUsd : null;
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`, { signal: AbortSignal.timeout(4000) });
    const json = await res.json();
    const p = Number(json?.[mint]?.usdPrice);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

/**
 * Throws a reader-safe error unless `signature` is a successful payment from
 * `payer` to the writer/platform in `currency`. Returns the raw amount received.
 */
async function verifyChapterPayment(opts: {
  signature: string; payer: string; authorWallet: string; currency: string; usdAmount: number;
}) {
  const { signature, payer, authorWallet, currency, usdAmount } = opts;
  const tx = await fetchConfirmedTx(signature);
  if (!tx) throw new Error("Payment not found on Solana yet — please try again in a minute");
  if (tx.meta?.err) throw new Error("Payment transaction failed on-chain");
  if (tx.blockTime && Date.now() / 1000 - tx.blockTime > MAX_TX_AGE_SECONDS) {
    throw new Error("Payment transaction is too old to unlock a chapter");
  }

  const keys: string[] = (tx.transaction?.message?.accountKeys || []).map((k: any) =>
    typeof k === "string" ? k : k.pubkey);
  const signers = new Set((tx.transaction?.message?.accountKeys || [])
    .filter((k: any) => typeof k !== "string" && k.signer).map((k: any) => k.pubkey));
  if (keys[0] !== payer || !signers.has(payer)) {
    throw new Error("Payment was not made by this wallet");
  }

  // The payer's own accounts never count as "received" — that matters when a
  // writer reads their own paid chapter (they're both payer and author).
  const recipients = new Set([authorWallet, PLATFORM_WALLET].filter((w) => w !== payer));
  let received = 0;
  let decimals = currency === "SOL" ? 9 : 6;
  const mint = currency === "USDC" ? USDC_MINT_ADDRESS : currency === "SMP" ? SMP_MINT_ADDRESS
    : currency === "SKR" ? SKR_MINT_ADDRESS : null;

  if (currency === "SOL") {
    keys.forEach((k, i) => {
      if (recipients.has(k)) received += (tx.meta.postBalances[i] ?? 0) - (tx.meta.preBalances[i] ?? 0);
    });
  } else if (mint) {
    const pre = new Map<number, number>();
    for (const b of tx.meta?.preTokenBalances || []) {
      if (b.mint === mint) pre.set(b.accountIndex, Number(b.uiTokenAmount?.amount || 0));
    }
    for (const b of tx.meta?.postTokenBalances || []) {
      if (b.mint !== mint || !recipients.has(b.owner)) continue;
      decimals = b.uiTokenAmount?.decimals ?? decimals;
      received += Number(b.uiTokenAmount?.amount || 0) - (pre.get(b.accountIndex) || 0);
    }
  } else {
    throw new Error(`Invalid currency: ${currency}`);
  }

  if (received <= 0) throw new Error("This transaction didn't pay the writer");

  // Amount floor from a live price; skipped (but logged) if no price is available.
  const price = currency === "USDC" ? 1 : await usdPrice(currency === "SOL" ? SOL_MINT : mint!);
  if (price) {
    // Split is 70% writer / 20% treasury / 10% burned (SMP; other currencies
    // send that 10% to the treasury). Burned tokens reach no one, so a normal
    // payment shows ~90% received — well above the floor below.
    // Self-payment (a writer reading their own paid chapter): only the
    // treasury's 20% reaches someone else.
    const share = authorWallet === payer ? 0.2 : 1;
    const expectedRaw = (usdAmount / price) * 10 ** decimals * share;
    if (received < expectedRaw * MIN_PAID_FRACTION) {
      throw new Error("Payment amount is too low for this chapter");
    }
  } else {
    console.warn("[unlock-chapter] No live price for", currency, "- amount floor skipped");
  }
  return { received, decimals };
}

serve(async (req) => {
  try {
    console.log("[unlock-chapter] Request received");

    const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jwt) throw new Error("Authorization header missing");

    // The gateway has verified this JWT's signature; read who it is.
    const jwtBody = await verifiedClaims(jwt);
    if (typeof jwtBody?.sub !== "string" && typeof jwtBody?.email !== "string") {
      throw new Error("Please sign in to unlock chapters");
    }

    const { novelId, chapterId, paymentType, currency, signature, transactionId, walletAddress } = await req.json();

    if (!novelId || !chapterId || !paymentType || !currency || !signature || !walletAddress) {
      throw new Error("Missing required fields (novelId, chapterId, paymentType, currency, signature, walletAddress)");
    }

    // Parallel DB fetches
    const [userByIdResult, novelResult] = await Promise.all([
      jwtBody.sub
        ? supabaseAdmin.from("users").select("id").eq("id", jwtBody.sub).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin.from("novels").select("id, user_id, chaptertitles, advance_chapters").eq("id", novelId).maybeSingle()
    ]);

    // By account id first (can't be faked); email only for older accounts.
    let userData = throwOnError(userByIdResult);
    if (!userData && typeof jwtBody.email === "string") {
      const { data: byEmail } = await supabaseAdmin.from("users").select("id").eq("email", jwtBody.email).limit(2);
      if (byEmail?.length === 1) userData = byEmail[0];
    }
    if (!userData) throw new Error("Account not found — please sign in again");

    const novel = throwOnError(novelResult);
    if (!novel) throw new Error("Novel not found");

    // Chapter validation
    const chapterIndex = Number(chapterId) - 1;
    if (!novel.chaptertitles?.[chapterIndex]) {
      throw new Error("Chapter not found");
    }

    // Advance chapter logic
    let isAdvance = false;
    if (Array.isArray(novel.advance_chapters)) {
      const adv = novel.advance_chapters.find((ch: any) => ch.index === chapterIndex);
      if (adv) {
        isAdvance = adv.is_advance;
        if (adv.free_release_date && new Date(adv.free_release_date) <= new Date()) {
          isAdvance = false;
        }
      }
    }

    if (isAdvance && paymentType === "SINGLE") {
      throw new Error("Locked chapter requires 3CHAPTERS or FULL payment");
    }
    if (!isAdvance && paymentType !== "SINGLE") {
      throw new Error("Non-locked chapter requires SINGLE payment");
    }

    // Author wallet (for future verification if needed)
    const authorData = await supabaseAdmin
      .from("users")
      .select("wallet_address")
      .eq("id", novel.user_id)
      .maybeSingle()
      .then(throwOnError);

    if (!authorData?.wallet_address) throw new Error("Author wallet not found");

    // Calculate payment amount (very light)
    // Real price $0.025. Accounts listed in settings.test_pricing (comma-
    // separated emails or account ids) pay the $0.0025 test price instead.
    let usdAmount = 0.025;
    try {
      const { data: tp } = await supabaseAdmin.from("settings").select("value").eq("key", "test_pricing").maybeSingle();
      const list = String(tp?.value || "").toLowerCase().split(",").map((s: string) => s.trim()).filter(Boolean);
      const me = [String(userData.id).toLowerCase(), String(jwtBody.email || "").toLowerCase()];
      if (list.some((x: string) => me.includes(x))) usdAmount = 0.0025;
    } catch { /* real price */ }
    let paymentAmount = 0;
    let paymentMint = null;

    // Fetch prices for token currencies
    const prices = await getPrices(currency);

    if (currency === "USDC") {
      paymentMint = USDC_MINT_ADDRESS;
      paymentAmount = Math.floor(usdAmount * 1e6);
    } else if (currency === "SKR") {
      paymentMint = SKR_MINT_ADDRESS;
      paymentAmount = Math.floor(usdAmount * prices.smpPerUsd * 1e6); // Using same decimals as SMP
    } else if (currency === "SOL") {
      paymentAmount = Math.floor(usdAmount * prices.solPerUsd * 1e9);
    } else if (currency === "SMP") {
      paymentMint = SMP_MINT_ADDRESS;
      paymentAmount = Math.floor(usdAmount * prices.smpPerUsd * 1e6);
    } else {
      throw new Error(`Invalid currency: ${currency}`);
    }

    // One payment, one unlock: a signature already recorded for anything else is refused.
    const { data: usedFor } = await supabaseAdmin
      .from("chapter_payments")
      .select("wallet_address, novel_id, chapter_number")
      .eq("transaction_id", signature)
      .limit(1);
    if (usedFor?.length) {
      const u = usedFor[0];
      const same = u.wallet_address === walletAddress && String(u.novel_id) === String(novelId) &&
        Number(u.chapter_number) === parseInt(chapterId, 10);
      if (!same) throw new Error("This payment was already used to unlock another chapter");
      return Response.json({ success: true, signature, message: "Payment already recorded" });
    }

    // Prove the payment happened on-chain before unlocking anything.
    const verified = await verifyChapterPayment({
      signature,
      payer: walletAddress,
      authorWallet: authorData.wallet_address,
      currency,
      usdAmount,
    });

    // Record payment
    try {
      const { error: insertError } = await supabaseAdmin
        .from("chapter_payments")
        .insert({
          wallet_address: walletAddress,
          novel_id: novelId,
          chapter_number: parseInt(chapterId, 10),
          payment_type: paymentType,
          currency,
          amount: Math.floor(usdAmount * 100), // Convert USD to cents for bigint
          transaction_id: signature,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        // Check if it's a duplicate key error
        if (insertError.code === '23505') {
          console.log("[unlock-chapter] Payment already recorded, checking if valid");
          // Verify the existing payment
          const { data: existingPayment } = await supabaseAdmin
            .from("chapter_payments")
            .select("*")
            .eq("wallet_address", walletAddress)
            .eq("novel_id", novelId)
            .eq("chapter_number", parseInt(chapterId, 10))
            .single();
          
          if (existingPayment) {
            console.log("[unlock-chapter] Found existing payment:", existingPayment);
            return new Response(
              JSON.stringify({ 
                success: true, 
                signature: existingPayment.transaction_id,
                message: "Payment already recorded"
              }),
              { headers: { "Content-Type": "application/json" }, status: 200 }
            );
          }
        }
        throw insertError;
      }
    } catch (error) {
      console.error("[unlock-chapter] Failed to record payment:", error);
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    // Record unlock
    if (paymentType === "SINGLE") {
      await supabaseAdmin.from("unlocked_story_chapters").upsert({
        user_id: userData.id,
        story_id: novelId,
        purchase_start_chapter: chapterId
      }).then(throwOnError);
    } else {
      const chaptersToUnlock = paymentType === "3CHAPTERS" ? 3 : -1;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabaseAdmin.from("unlocked_story_chapters").upsert({
        user_id: userData.id,
        story_id: novelId,
        purchase_start_chapter: chapterId,
        chapter_unlocked_till: chaptersToUnlock === -1 ? -1 : chapterId + chaptersToUnlock - 1,
        expires_at: expiresAt.toISOString()
      }).then(throwOnError);
    }

    // Pioneer badge: grant when this is the user's first-ever payment to this writer
    let isPioneer = false;
    try {
      const { data: authorNovels } = await supabaseAdmin
        .from("novels")
        .select("id")
        .eq("user_id", novel.user_id);
      const authorNovelIds = (authorNovels || []).map((n: any) => n.id);

      const { data: priorPayments } = await supabaseAdmin
        .from("chapter_payments")
        .select("id")
        .eq("wallet_address", walletAddress)
        .in("novel_id", authorNovelIds)
        .neq("transaction_id", signature)
        .limit(1);

      if (!priorPayments || priorPayments.length === 0) {
        // Ensure a pioneer badge definition exists
        let badgeId: string | null = null;
        const { data: existingBadge } = await supabaseAdmin
          .from("badges")
          .select("id")
          .eq("type", "pioneer")
          .limit(1)
          .maybeSingle();
        badgeId = existingBadge?.id ?? null;

        if (!badgeId) {
          const { data: newBadge, error: badgeInsertError } = await supabaseAdmin
            .from("badges")
            .insert({
              name: "Pioneer",
              description: "First supporter of a writer on Sempai HQ",
              type: "pioneer",
              price: 0,
            })
            .select("id")
            .single();
          if (badgeInsertError) throw badgeInsertError;
          badgeId = newBadge.id;
        }

        // Grant the badge if the user doesn't already own it
        const { data: owned } = await supabaseAdmin
          .from("user_badges")
          .select("id")
          .eq("user_id", userData.id)
          .eq("badge_id", badgeId)
          .maybeSingle();

        if (!owned) {
          const { error: grantError } = await supabaseAdmin
            .from("user_badges")
            .insert({
              user_id: userData.id,
              badge_id: badgeId,
              acquired_at: new Date().toISOString(),
            });
          if (grantError) throw grantError;
        }
        isPioneer = true;

        // Also insert into pioneer_creators table to track the relationship
        const { error: pioneerError } = await supabaseAdmin
          .from("pioneer_creators")
          .insert({
            user_id: userData.id,
            creator_id: novel.user_id,
            first_payment_at: new Date().toISOString(),
          });
        if (pioneerError && !pioneerError.message.includes('duplicate key')) {
          console.warn("[unlock-chapter] Pioneer creators insert failed:", pioneerError.message);
        }
      }
    } catch (pioneerError: any) {
      console.warn("[unlock-chapter] Pioneer badge grant failed:", pioneerError?.message);
    }

    // Award points
    const pointsToAdd = paymentType === "SINGLE" ? 100 : 1000;
    await supabaseAdmin.rpc('increment_weekly_points', {
      user_id: userData.id,
      points: pointsToAdd
    });

    console.log(`[unlock-chapter] Success - Chapter ${chapterId} unlocked for user ${userData.id}`);

    await logFeed({
      event_type: "chapter_unlock",
      direction: "in",
      asset: currency,
      // the amount actually received on-chain (writer + platform)
      amount: verified.received / 10 ** verified.decimals,
      usd_value: usdAmount,
      wallet: walletAddress,
      counterparty: authorData.wallet_address,
      user_id: userData.id,
      title: `Chapter ${chapterId} unlock`,
      detail: `${paymentType} · ${novel.chaptertitles?.[chapterIndex] || ""}`.trim(),
      tx_sig: signature,
      meta: { novel_id: novelId, chapter_id: chapterId, payment_type: paymentType },
    });

    return Response.json({ success: true, signature, isPioneer });

  } catch (error: any) {
    console.error("[unlock-chapter] Error:", error.message);
    return Response.json(
      { error: error.message || "Internal server error" },
      {
        status: /authorization header missing/i.test(error.message || "") ? 401 // not signed in — not a server fault
          : /not found on solana yet/i.test(error.message || "") ? 503 // temporary: retry later
          : /not found|requires|already used|too low|didn't pay|not made by this wallet|failed on-chain|too old|invalid currency|sign in/i
              .test(error.message || "") ? 400 // permanent: retrying won't help
          : 500,
      }
    );
  }
});

