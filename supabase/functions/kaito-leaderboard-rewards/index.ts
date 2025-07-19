// Follow this setup guide to integrate the Deno runtime with your Supabase project:
// https://supabase.com/docs/guides/functions/deno-runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48";

// Constants
const REWARD_AMOUNT = 5000000; // 5 million SMP tokens to distribute
const TOP_PLAYERS_COUNT = 10; // Top 10 players

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

// Calculate combined score for ranking: (gold * 0.5) + (xp * 0.1)
// This gives more weight to Gold (which resets weekly) than XP (which accumulates)
function calculatePlayerScore(gold: number, xp: number): number {
  return (gold * 0.5) + (xp * 0.1);
}

// Calculate reward distribution based on ranking (weighted distribution)
function calculateRewardDistribution(totalAmount: number, playerCount: number): number[] {
  // Weighted distribution: 1st place gets more, decreasing for lower ranks
  const weights = [];
  for (let i = 0; i < playerCount; i++) {
    // Higher weight for better ranks (rank 1 = weight 10, rank 2 = weight 9, etc.)
    weights.push(playerCount - i);
  }
  
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  return weights.map(weight => Math.floor((weight / totalWeight) * totalAmount));
}

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
    console.log("🚀 Starting Kaito Adventure leaderboard reward distribution...");

    // 1. Fetch all players with their gold, xp, and wallet_address
    const { data: players, error: playersError } = await supabaseAdmin
      .from("players")
      .select("wallet_address, name, gold, xp, level")
      .not("wallet_address", "is", null);

    if (playersError) {
      console.error("[rewards] Failed to fetch players:", playersError.message);
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    console.log("✅ Players fetched:", players?.length || 0);

    if (!players || players.length === 0) {
      console.log("❌ No players found, skipping distribution.");
      return new Response(JSON.stringify({
        success: false,
        message: "No players found to distribute rewards."
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    // 2. Calculate scores and rank players
    const playersWithScores = players.map(player => ({
      ...player,
      score: calculatePlayerScore(player.gold || 0, player.xp || 0)
    }));

    // Sort by score (highest first) and take top 10
    const topPlayers = playersWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_PLAYERS_COUNT);

    console.log("🏆 Top players calculated:");
    topPlayers.forEach((player, index) => {
      console.log(`${index + 1}. ${player.name} - Score: ${player.score.toFixed(2)} (Gold: ${player.gold}, XP: ${player.xp})`);
    });

    if (topPlayers.length === 0) {
      console.log("❌ No top players found, skipping distribution.");
      return new Response(JSON.stringify({
        success: false,
        message: "No top players found for reward distribution."
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    // 3. Calculate reward distribution
    const rewardAmounts = calculateRewardDistribution(REWARD_AMOUNT, topPlayers.length);

    // 4. Fetch existing wallets for these players
    const topPlayerWallets = topPlayers.map(player => player.wallet_address);
    const { data: wallets, error: walletsError } = await supabaseAdmin
      .from("wallet_balances")
      .select("user_id, wallet_address, amount, chain, currency")
      .in("wallet_address", topPlayerWallets)
      .eq("chain", "SOL")
      .eq("currency", "SMP");

    if (walletsError) {
      console.error("[rewards] Failed to fetch wallets:", walletsError.message);
      throw new Error(`Failed to fetch wallets: ${walletsError.message}`);
    }

    console.log("✅ Wallets fetched:", wallets?.length || 0);

    // 5. Create a wallet map by wallet_address
    const walletMap: Record<string, any> = {};
    if (wallets && wallets.length > 0) {
      for (const wallet of wallets) {
        walletMap[wallet.wallet_address] = wallet;
      }
    }

    // 6. Process rewards distribution
    console.log("🔍 Processing rewards:");
    const timestamp = new Date().toISOString();
    let successCount = 0;
    const errors: string[] = [];
    const distributionLog: any[] = [];

    for (let i = 0; i < topPlayers.length; i++) {
      const player = topPlayers[i];
      const rewardAmount = rewardAmounts[i];
      const rank = i + 1;

      try {
        console.log(`📌 Rank ${rank}: ${player.name} | Wallet: ${player.wallet_address} | Score: ${player.score.toFixed(2)} | Reward: ${rewardAmount} SMP`);

        const existingWallet = walletMap[player.wallet_address];

        if (existingWallet) {
          // Update existing wallet balance
          const { error: updateError } = await supabaseAdmin
            .from("wallet_balances")
            .update({
              amount: existingWallet.amount + rewardAmount,
              updated_at: timestamp
            })
            .eq("wallet_address", player.wallet_address)
            .eq("chain", "SOL")
            .eq("currency", "SMP");

          if (updateError) {
            console.error(`[rewards] Error updating wallet for ${player.name}:`, updateError.message);
            errors.push(`${player.name}: ${updateError.message}`);
            continue;
          }
        } else {
          // Insert new wallet balance
          const { error: insertError } = await supabaseAdmin
            .from("wallet_balances")
            .insert({
              user_id: null, // We don't have user_id from players table
              wallet_address: player.wallet_address,
              chain: "SOL",
              currency: "SMP",
              amount: rewardAmount,
              decimals: 9,
              created_at: timestamp,
              updated_at: timestamp
            });

          if (insertError) {
            console.error(`[rewards] Error inserting wallet for ${player.name}:`, insertError.message);
            errors.push(`${player.name}: ${insertError.message}`);
            continue;
          }
        }

        distributionLog.push({
          rank,
          player_name: player.name,
          wallet_address: player.wallet_address,
          gold: player.gold,
          xp: player.xp,
          score: player.score,
          reward_amount: rewardAmount
        });

        successCount++;
      } catch (err) {
        console.error(`[rewards] Unexpected error for ${player.name}:`, err.message);
        errors.push(`${player.name}: ${err.message}`);
      }
    }

    if (successCount === 0) {
      throw new Error(`Failed to distribute rewards to any players. Errors: ${errors.join("; ")}`);
    }

    console.log(`✅ Processed ${successCount}/${topPlayers.length} reward distributions`);
    if (errors.length > 0) {
      console.log(`⚠️ Encountered ${errors.length} errors: ${errors.join("; ")}`);
    }

    // 7. Log the distribution to kaito_leaderboard_rewards table
    const { error: logError } = await supabaseAdmin
      .from("kaito_leaderboard_rewards")
      .insert({
        total_amount_distributed: REWARD_AMOUNT,
        players_rewarded: successCount,
        top_players_count: TOP_PLAYERS_COUNT,
        distribution_details: distributionLog,
        distributed_at: timestamp
      });

    if (logError) {
      console.error("[rewards] Log error details:", logError);
      console.log("⚠️ Failed to log reward distribution, but rewards were distributed");
    } else {
      console.log("✅ Distribution logged successfully");
    }

    // 8. Reset gold for top 10 players
    console.log("🔄 Resetting gold for top 10 players...");
    const topPlayerWalletsForReset = topPlayers.map(p => p.wallet_address);

    const { error: resetError } = await supabaseAdmin
      .from("players")
      .update({ gold: 0 })
      .in("wallet_address", topPlayerWalletsForReset);

    if (resetError) {
      console.error("[rewards] Gold reset error details:", resetError);
      // This is not a critical failure, so we'll log it but not throw an error
      console.log("⚠️ Failed to reset gold for top players, but rewards were distributed");
    } else {
      console.log("✅ Gold reset for top 10 players successful!");
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Kaito Adventure leaderboard rewards distributed successfully to ${successCount} players! (${errors.length} errors) Gold has been reset for top players.`,
      total_amount: REWARD_AMOUNT,
      players_rewarded: successCount,
      top_players: distributionLog,
      timestamp: timestamp
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });

  } catch (err) {
    console.error("🔥 Error:", err.message);
    return new Response(JSON.stringify({
      success: false,
      message: `Failed: ${err.message}`
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
