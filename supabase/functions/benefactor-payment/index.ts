import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

serve(async (req) => {
  try {
    console.log("[benefactor-payment] Request received");

    const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jwt) throw new Error("Authorization header missing");

    const jwtBody = JSON.parse(new TextDecoder().decode(decodeBase64(jwt.split(".")[1])));
    if (typeof jwtBody?.email !== "string") throw new Error("JWT missing email");

    const body = await req.json();
    const { novelId, planType, signature, userPublicKey, currency } = body ?? {};

    console.log("[benefactor-payment] Received fields:", { novelId, planType, signature, userPublicKey, currency });

    const isMissing = (v: unknown) =>
      v === null || v === undefined || (typeof v === "string" && v.trim().length === 0);

    if (isMissing(novelId) || isMissing(planType) || isMissing(signature) || isMissing(userPublicKey)) {
      throw new Error("Missing required fields (novelId, planType, signature, userPublicKey)");
    }

    // Pricing tiers (SMP test mode - small amounts)
    const pricingTiers: Record<string, { price: number; chapters: number; name: string; durationDays: number }> = {
      blue: { price: 1, chapters: 3, name: "Blue", durationDays: 14 },
      iron: { price: 2, chapters: 6, name: "Iron", durationDays: 14 },
      silver: { price: 3, chapters: 10, name: "Silver", durationDays: 14 },
      gold: { price: 5, chapters: 999, name: "Gold", durationDays: 30 }, // 999 = unlimited, 30 days
    };

    const tier = pricingTiers[planType];
    if (!tier) {
      throw new Error("Invalid plan type");
    }

    console.log("[benefactor-payment] Payment details:", {
      tier: tier.name,
      price: tier.price,
      durationDays: tier.durationDays,
    });

    // Fetch user and novel data to get the writer (author)
    const [userResult, novelResult] = await Promise.all([
      supabaseAdmin.from("users").select("id").eq("email", jwtBody.email).maybeSingle(),
      supabaseAdmin.from("novels").select("id, user_id, chaptertitles").eq("id", novelId).maybeSingle()
    ]);

    const userData = throwOnError(userResult);
    if (!userData) throw new Error(`User not found for email ${jwtBody.email}`);

    const novel = throwOnError(novelResult);
    if (!novel) throw new Error("Novel not found");

    const writerId = novel.user_id;

    // Check if user already has an active subscription to this writer
    const { data: existingSubscription } = await supabaseAdmin
      .from("writer_subscriptions")
      .select("*")
      .eq("benefactor_wallet", userPublicKey)
      .eq("writer_id", writerId)
      .eq("is_active", true)
      .maybeSingle();

    if (existingSubscription) {
      console.log("[benefactor-payment] User already has active subscription to this writer");
      return Response.json({ 
        success: true, 
        signature,
        message: "You already have an active subscription to this writer"
      });
    }

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + (tier.durationDays * 24 * 60 * 60 * 1000)).toISOString();

    // Record writer subscription
    const { error: subscriptionError } = await supabaseAdmin
      .from("writer_subscriptions")
      .insert({
        benefactor_wallet: userPublicKey,
        writer_id: writerId,
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
          .eq("writer_id", writerId)
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

    // Update user's benefactor status
    const { data: currentUserData } = await supabaseAdmin
      .from("users")
      .select("is_benefactor, benefactor_level, total_benefactor_payments")
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
          current_writer_subscription: planType,
          current_writer_subscription_expires: expiresAt,
        })
        .eq("id", userData.id);

      if (updateError) {
        console.warn("[benefactor-payment] Failed to update benefactor status:", updateError.message);
      } else {
        console.log("[benefactor-payment] Updated benefactor status:", { level: newLevel, total: newTotalPayments, currentSubscription: planType });
      }
    }

    console.log(`[benefactor-payment] Success - ${tier.name} writer subscription activated for user ${userData.id}, writer ${writerId}`);
    return Response.json({ 
      success: true, 
      signature,
      plan_type: planType,
      chapters_unlocked: tier.chapters,
      expires_at: expiresAt,
      writer_id: writerId,
    });

  } catch (error: any) {
    console.error("[benefactor-payment] Error:", error.message);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: error.message.includes("not found") || error.message.includes("requires") ? 400 : 500 }
    );
  }
});
