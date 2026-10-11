// @ts-nocheck - Deno edge function with Deno-specific imports
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const solanaRpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.devnet.solana.com";
const treasuryWallet = Deno.env.get("TREASURY_WALLET") || "4ZFvgNZygfiCSAS4aKBbQEgwJgBq5fRT9oLAH56GrF6H";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

function throwOnError({ data, error }: any) {
  if (error) {
    console.error("[supabase] Error:", error?.message);
    throw new Error(error?.message);
  }
  return data;
}

async function verifyPayment({ signature, payer, mint, minRaw }: {
  signature: string; payer: string; mint: string | null; minRaw: bigint;
}): Promise<void> {
  const res = await fetch(solanaRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "getTransaction",
      params: [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
    }),
  });
  const { result: tx } = await res.json();
  if (!tx || tx.meta?.err) throw new Error("Payment transaction not found or failed");

  const keys = tx.transaction.message.accountKeys;
  if (keys[0].pubkey !== payer) throw new Error("Payer mismatch");
  const blockTime = tx.blockTime || 0;
  if (Date.now() / 1000 - blockTime > 600) throw new Error("Transaction too old");

  let received = 0n;
  if (!mint) {
    const i = keys.findIndex((k: any) => k.pubkey === treasuryWallet);
    if (i < 0) throw new Error("Treasury not in transaction");
    received = BigInt(tx.meta.postBalances[i]) - BigInt(tx.meta.preBalances[i]);
  } else {
    const sum = (arr: any[]) => arr
      .filter((b) => b.owner === treasuryWallet && b.mint === mint)
      .reduce((a: bigint, b: any) => a + BigInt(b.uiTokenAmount.amount), 0n);
    received = sum(tx.meta.postTokenBalances ?? []) - sum(tx.meta.preTokenBalances ?? []);
  }
  if (received < minRaw) throw new Error("Insufficient payment amount");
}

serve(async (req) => {
  try {
    console.log("[benefactor-payment] Request received");

    const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jwt) throw new Error("Authorization header missing");

    // Verify JWT with Supabase instead of manual parsing
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !user) throw new Error("Invalid or expired JWT");

    const body = await req.json();
    const { novelId, writerId, badgeId, planType, signature, userPublicKey, currency } = body ?? {};

    console.log("[benefactor-payment] Received fields:", { novelId, writerId, badgeId, planType, signature, userPublicKey, currency });

    const isMissing = (v: unknown) =>
      v === null || v === undefined || (typeof v === "string" && v.trim().length === 0);

    // writerId is required, novelId is optional (for backward compatibility)
    if (isMissing(writerId) || isMissing(signature) || isMissing(userPublicKey)) {
      throw new Error("Missing required fields (writerId, signature, userPublicKey)");
    }

    // Fetch user data and verify wallet address matches
    const userResult = await supabaseAdmin.from("users").select("id, wallet_address").eq("email", user.email).maybeSingle();
    const userData = throwOnError(userResult);
    if (!userData) throw new Error(`User not found for email ${user.email}`);
    if (userData.wallet_address !== userPublicKey) throw new Error("Wallet address does not match authenticated user");

    // Use writerId from request, or derive from novelId for backward compatibility
    let finalWriterId = writerId;
    if (!finalWriterId && novelId) {
      const novelResult = await supabaseAdmin.from("novels").select("id, user_id").eq("id", novelId).maybeSingle();
      const novel = throwOnError(novelResult);
      if (!novel) throw new Error("Novel not found");
      finalWriterId = novel.user_id;
    }

    if (!finalWriterId) throw new Error("Writer ID not provided and could not be derived from novel");

    // Fetch badge if provided to get pricing and type
    let finalPlanType = planType;
    let finalBadgeId = badgeId;
    let tier: { price: number; chapters: number; name: string; durationDays: number };

    if (badgeId) {
      const badgeResult = await supabaseAdmin.from("badges").select("id, type, price, writer_id").eq("id", badgeId).maybeSingle();
      const badge = throwOnError(badgeResult);
      if (!badge) throw new Error("Badge not found");
      if (badge.writer_id !== finalWriterId) throw new Error("Badge does not belong to this writer");
      finalPlanType = badge.type;
      finalBadgeId = badge.id;
    }

    // Pricing tiers
    const pricingTiers: Record<string, { price: number; chapters: number; name: string; durationDays: number }> = {
      blue: { price: 1, chapters: 3, name: "Blue", durationDays: 14 },
      iron: { price: 2, chapters: 6, name: "Iron", durationDays: 14 },
      silver: { price: 3, chapters: 10, name: "Silver", durationDays: 14 },
      gold: { price: 5, chapters: 999, name: "Gold", durationDays: 30 },
    };

    tier = pricingTiers[finalPlanType];
    if (!tier) {
      throw new Error("Invalid plan type");
    }

    console.log("[benefactor-payment] Payment details:", {
      tier: tier.name,
      price: tier.price,
      durationDays: tier.durationDays,
    });

    // Verify payment on-chain
    const mint = currency === 'USDC' ? Deno.env.get("USDC_MINT_ADDRESS") :
                currency === 'SKR' ? Deno.env.get("SKR_MINT_ADDRESS") : null;
    const minRaw = BigInt(Math.round(tier.price * (mint ? 1_000_000 : 1_000_000_000)));

    await verifyPayment({
      signature,
      payer: userPublicKey,
      mint,
      minRaw,
    });

    console.log("[benefactor-payment] Payment verified successfully");

    // Check if user already has an active subscription to this writer
    const { data: existingSubscription } = await supabaseAdmin
      .from("writer_subscriptions")
      .select("*")
      .eq("benefactor_wallet", userPublicKey)
      .eq("writer_id", finalWriterId)
      .eq("is_active", true)
      .maybeSingle();

    if (existingSubscription) {
      console.log("[benefactor-payment] User already has active subscription to this writer");
      throw new Error("You already have an active subscription to this writer. Please wait for it to expire or contact support.");
    }

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + (tier.durationDays * 24 * 60 * 60 * 1000)).toISOString();

    // Record writer subscription
    const { error: subscriptionError } = await supabaseAdmin
      .from("writer_subscriptions")
      .insert({
        benefactor_wallet: userPublicKey,
        writer_id: finalWriterId,
        plan_type: planType,
        chapters_unlocked: tier.chapters,
        chapters_remaining: tier.chapters,
        payment_amount: tier.price,
        payment_currency: currency || "SMP",
        transaction_id: signature,
        paid_at: new Date().toISOString(),
        expires_at: expiresAt,
        is_active: true,
      });

    if (subscriptionError) {
      // Check if it's a duplicate key error
      if (subscriptionError.code === '23505') {
        console.log("[benefactor-payment] Subscription already recorded, checking if valid");
        // Verify the existing subscription
        const { data: existingSub } = await supabaseAdmin
          .from("writer_subscriptions")
          .select("*")
          .eq("benefactor_wallet", userPublicKey)
          .eq("writer_id", finalWriterId)
          .eq("transaction_id", signature)
          .maybeSingle();
        
        if (existingSub) {
          console.log("[benefactor-payment] Found existing subscription:", existingSub);
          return Response.json({ 
            success: true, 
            signature,
            message: "Subscription already recorded"
          });
        }
      }
      throw new Error(`Failed to record subscription: ${subscriptionError.message}`);
    }

    // Record badge purchase if badgeId is provided
    if (badgeId) {
      const { error: badgeError } = await supabaseAdmin
        .from("user_badges")
        .insert({
          user_id: userData.id,
          badge_id: badgeId,
          acquired_at: new Date().toISOString(),
        });

      if (badgeError) {
        console.warn("[benefactor-payment] Failed to record badge purchase:", badgeError.message);
        // Don't fail the transaction if badge recording fails
      } else {
        console.log("[benefactor-payment] Badge recorded:", badgeId);
      }
    }

    // Update user's benefactor status
    const { data: currentUserData } = await supabaseAdmin
      .from("users")
      .select("is_benefactor, benefactor_level, benefactor_since, total_benefactor_payments")
      .eq("id", userData.id)
      .maybeSingle();

    if (currentUserData) {
      const newTotalPayments = (currentUserData.total_benefactor_payments || 0) + tier.price;
      let newLevel = currentUserData.benefactor_level || 'bronze';

      // Determine benefactor level based on total payments
      if (newTotalPayments >= 50) {
        newLevel = 'platinum';
      } else if (newTotalPayments >= 20) {
        newLevel = 'gold';
      } else if (newTotalPayments >= 10) {
        newLevel = 'silver';
      } else {
        newLevel = 'bronze';
      }

      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          is_benefactor: true,
          benefactor_level: newLevel,
          benefactor_since: currentUserData.benefactor_since || new Date().toISOString(),
          total_benefactor_payments: newTotalPayments,
          current_writer_subscription: finalPlanType,
          current_writer_subscription_expires: expiresAt,
        })
        .eq("id", userData.id);

      if (updateError) {
        console.warn("[benefactor-payment] Failed to update benefactor status:", updateError.message);
      } else {
        console.log("[benefactor-payment] Updated benefactor status:", { level: newLevel, total: newTotalPayments, currentSubscription: finalPlanType });
      }
    }

    console.log(`[benefactor-payment] Success - ${tier.name} writer subscription activated for user ${userData.id}, writer ${finalWriterId}`);
    return Response.json({
      success: true,
      signature,
      plan_type: finalPlanType,
      chapters_unlocked: tier.chapters,
      expires_at: expiresAt,
      writer_id: finalWriterId,
      badge_id: finalBadgeId,
    });

  } catch (error: any) {
    console.error("[benefactor-payment] Error:", error.message);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: error.message.includes("not found") || error.message.includes("requires") ? 400 : 500 }
    );
  }
});
