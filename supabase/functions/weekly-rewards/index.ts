// Follow this setup guide to integrate the Deno runtime with your Supabase project:
// https://supabase.com/docs/guides/functions/deno-runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48";

// Constants
const REWARD_AMOUNT = 2000000; // 2 million SMP tokens to distribute

// Initialize Supabase clients
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Validate environment variables
if (!supabaseUrl) {
  console.error("[supabase] init: SUPABASE_URL is not set");
  throw new Error("SUPABASE_URL is not set");
}

if (!supabaseServiceRoleKey) {
  console.error("[supabase] init: SUPABASE_SERVICE_ROLE_KEY is not set");
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

// Create Supabase admin client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

Deno.serve(async (req) => {
  console.log("[http] Request received:", {
    method: req.method,
    url: req.url
  });

  // Only allow POST requests for manual triggers
  if (req.method !== "POST" && !req.url.includes("cron")) {
    return new Response(JSON.stringify({
      error: "Method must be POST"
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  try {
    console.log("🚀 Starting weekly reward distribution...");

    // 1. Fetch users with weekly points > 0, including wallet_address
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, weekly_points, wallet_address")
      .gt("weekly_points", 0);

    if (usersError) {
      console.error("[rewards] Failed to fetch users:", usersError.message);
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    console.log("✅ Users fetched:", users?.length || 0);

    if (!users || users.length === 0) {
      console.log("❌ No users with points, skipping distribution.");
      return new Response(
        JSON.stringify({
          success: false,
          message: "No users with points to distribute."
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch existing wallets for these users
    const userIds = users.map((user) => user.id);
    const { data: wallets, error: walletsError } = await supabaseAdmin
      .from("wallet_balances")
      .select("user_id, wallet_address, amount, chain, currency")
      .in("user_id", userIds)
      .eq("chain", "SOL")
      .eq("currency", "SMP");

    if (walletsError) {
      console.error("[rewards] Failed to fetch wallets:", walletsError.message);
      throw new Error(`Failed to fetch wallets: ${walletsError.message}`);
    }

    console.log("✅ Wallets fetched:", wallets?.length || 0);

    // 3. Create a wallet map by user_id
    const walletMap = {};
    if (wallets && wallets.length > 0) {
      for (const wallet of wallets) {
        const key = `${wallet.user_id}_${wallet.chain}_${wallet.currency}`;
        walletMap[key] = wallet;
      }
    }

    // 4. Calculate total points & reward per point
    const totalPoints = users.reduce((sum, user) => sum + user.weekly_points, 0);
    if (totalPoints === 0) {
      console.log("❌ Total points is zero, skipping distribution.");
      return new Response(
        JSON.stringify({
          success: false,
          message: "No valid points for distribution."
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const rewardPerPoint = REWARD_AMOUNT / totalPoints;
    console.log(`⚡ Reward per point: ${rewardPerPoint}`);

    // 5. Prepare updates/inserts and log
    console.log("🔍 Processing rewards:");
    const updates = [];
    const timestamp = new Date().toISOString();
    
    for (const user of users) {
      if (!user.wallet_address) {
        console.log(`⚠️ User ${user.id} has no wallet address, skipping`);
        continue;
      }
      
      const rewardAmount = user.weekly_points * rewardPerPoint;
      console.log(
        `📌 User ID: ${user.id} | Wallet: ${user.wallet_address} | Points: ${user.weekly_points} | Reward: ${rewardAmount} SMP`
      );
      updates.push({ user_id: user.id, wallet_address: user.wallet_address, rewardAmount });
    }

    if (updates.length === 0) {
      console.log("❌ No valid users to reward after filtering, skipping distribution.");
      return new Response(
        JSON.stringify({
          success: false,
          message: "No valid users to reward after filtering."
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 6. Process wallet balance updates
    let successCount = 0;
    const errors = [];

    for (const update of updates) {
      try {
        const { user_id, wallet_address, rewardAmount } = update;
        const key = `${user_id}_SOL_SMP`;
        const existingWallet = walletMap[key];
        
        if (existingWallet) {
          // Update existing wallet balance
          const { error: updateError } = await supabaseAdmin
            .from("wallet_balances")
            .update({
              amount: existingWallet.amount + rewardAmount,
              updated_at: timestamp
            })
            .eq("user_id", user_id)
            .eq("chain", "SOL")
            .eq("currency", "SMP");

          if (updateError) {
            console.error(`[rewards] Error updating wallet for user ${user_id}:`, updateError.message);
            errors.push(`User ${user_id}: ${updateError.message}`);
            continue;
          }
        } else {
          // Insert new wallet balance
          const { error: insertError } = await supabaseAdmin
            .from("wallet_balances")
            .insert({
              user_id,
              wallet_address,
              chain: "SOL",
              currency: "SMP",
              amount: rewardAmount,
              decimals: 9,
              created_at: timestamp,
              updated_at: timestamp
            });

          if (insertError) {
            console.error(`[rewards] Error inserting wallet for user ${user_id}:`, insertError.message);
            errors.push(`User ${user_id}: ${insertError.message}`);
            continue;
          }
        }

        successCount++;
      } catch (err) {
        console.error(`[rewards] Unexpected error for user ${update.user_id}:`, err.message);
        errors.push(`User ${update.user_id}: ${err.message}`);
      }
    }

    if (successCount === 0) {
      throw new Error(`Failed to update any wallet balances. Errors: ${errors.join("; ")}`);
    }

    console.log(`✅ Processed ${successCount}/${updates.length} wallet balances (updates and inserts)`);
    if (errors.length > 0) {
      console.log(`⚠️ Encountered ${errors.length} errors: ${errors.join("; ")}`);
    }

    // 7. Add entry to rewards_log table
    const { error: logError } = await supabaseAdmin
      .from("rewards_log")
      .insert({
        amount_distributed: REWARD_AMOUNT,
        total_points: totalPoints,
        reward_per_point: rewardPerPoint,
        distributed_at: timestamp
      });

    if (logError) {
      console.error("[rewards] Log error details:", logError);
      console.log("⚠️ Failed to log reward distribution, but rewards were distributed");
    } else {
      console.log("✅ Distribution logged successfully");
    }

    // 8. Reset weekly points
    const { error: resetError } = await supabaseAdmin
      .from("users")
      .update({ 
        weekly_points: 0,
        last_reward_time: timestamp
      })
      .neq("weekly_points", 0);

    if (resetError) {
      console.error("[rewards] Reset error details:", resetError);
      throw new Error(`Failed to reset weekly points: ${resetError.message}`);
    }

    console.log("✅ Weekly points reset!");

    return new Response(
      JSON.stringify({
        success: true,
        message: `Rewards distributed successfully to ${successCount} users! (${errors.length} errors)`,
        total_amount: REWARD_AMOUNT,
        total_points: totalPoints,
        reward_per_point: rewardPerPoint,
        timestamp: timestamp
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("🔥 Error:", err.message);
    return new Response(
      JSON.stringify({ success: false, message: `Failed: ${err.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}); 