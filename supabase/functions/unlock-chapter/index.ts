import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Constants
const SMP_MINT_ADDRESS = "SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor";
const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

function throwOnError({ data, error }: any) {
  if (error) {
    console.error("[supabase] Error:", error?.message);
    throw new Error(error?.message);
  }
  return data;
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

serve(async (req) => {
  try {
    console.log("[unlock-chapter] Request received");

    const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jwt) throw new Error("Authorization header missing");

    const jwtBody = JSON.parse(new TextDecoder().decode(decodeBase64(jwt.split(".")[1])));
    if (typeof jwtBody?.email !== "string") throw new Error("JWT missing email");

    const { novelId, chapterId, paymentType, currency, signature, transactionId } = await req.json();

    if (!novelId || !chapterId || !paymentType || !currency || !signature) {
      throw new Error("Missing required fields (novelId, chapterId, paymentType, currency, signature)");
    }

    // Parallel DB fetches
    const [userResult, novelResult] = await Promise.all([
      supabaseAdmin.from("users").select("id").eq("email", jwtBody.email).maybeSingle(),
      supabaseAdmin.from("novels").select("id, user_id, chaptertitles, advance_chapters").eq("id", novelId).maybeSingle()
    ]);

    const userData = throwOnError(userResult);
    if (!userData) throw new Error(`User not found for email ${jwtBody.email}`);

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
    const usdAmount = 0.025;
    let paymentAmount = 0;
    let paymentMint = null;

    if (currency === "USDC") {
      paymentMint = USDC_MINT_ADDRESS;
      paymentAmount = Math.floor(usdAmount * 1e6);
    } else {
      const prices = await getPrices(currency);
      if (currency === "SOL") {
        paymentAmount = Math.floor(usdAmount * prices.solPerUsd * 1e9);
      } else if (currency === "SMP") {
        paymentMint = SMP_MINT_ADDRESS;
        paymentAmount = Math.floor(usdAmount * prices.smpPerUsd * 1e6);
      } else {
        throw new Error(`Invalid currency: ${currency}`);
      }
    }

    // Record payment
    try {
      const { error: insertError } = await supabaseAdmin
        .from("chapter_payments")
        .insert({
          wallet_address: jwtBody.email,
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
            .eq("wallet_address", jwtBody.email)
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

    // Award points
    const pointsToAdd = paymentType === "SINGLE" ? 100 : 1000;
    await supabaseAdmin.rpc('increment_weekly_points', {
      user_id: userData.id,
      points: pointsToAdd
    });

    console.log(`[unlock-chapter] Success - Chapter ${chapterId} unlocked for user ${userData.id}`);
    return Response.json({ success: true, signature });

  } catch (error: any) {
    console.error("[unlock-chapter] Error:", error.message);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: error.message.includes("not found") || error.message.includes("requires") ? 400 : 500 }
    );
  }
});

