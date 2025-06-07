import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "npm:@solana/web3.js@1";
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddressSync } from "npm:@solana/spl-token";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48";
import { ComputeBudgetProgram } from "npm:@solana/web3.js@1";

// Constants
const SMP_MINT_ADDRESS = new PublicKey("SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor");
const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90";
const connection = new Connection(RPC_URL, "confirmed");
const AIRDROP_WALLET_KEYPAIR = Deno.env.get("AIRDROP_WALLET_KEYPAIR");
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://xqeimsncmnqsiowftdmz.supabase.co";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const MAX_CLAIMS = 500;
const AIRDROP_SMP_AMOUNT = 1_000_000 * 1e6; // 1M SMP tokens with 6 decimals
const MINIMUM_SOL_BALANCE = 0.003 * 1e9; // 0.003 SOL for one airdrop (~0.00204344 SOL + buffer)
const COMPUTE_UNIT_LIMIT = 100_000;

// Supabase Admin Client
if (!supabaseServiceRoleKey) {
  console.error("[supabase] init: SUPABASE_SERVICE_ROLE_KEY is not set");
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Initialize Airdrop Keypair
let AIRDROP_KEYPAIR: Keypair;
try {
  console.log("[solana] Parsing AIRDROP_WALLET_KEYPAIR");
  if (!AIRDROP_WALLET_KEYPAIR) {
    throw new Error("AIRDROP_WALLET_KEYPAIR is not set");
  }
  AIRDROP_KEYPAIR = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(AIRDROP_WALLET_KEYPAIR)));
  console.log("[solana] Airdrop wallet public key:", AIRDROP_KEYPAIR.publicKey.toString());
  const balance = await connection.getBalance(AIRDROP_KEYPAIR.publicKey);
  console.log("[solana] Airdrop wallet balance:", balance / 1e9, "SOL");
  if (balance < MINIMUM_SOL_BALANCE) {
    console.error("[solana] Airdrop wallet has insufficient SOL:", balance / 1e9, "SOL");
  }
} catch (e) {
  console.error("[solana] Failed to parse AIRDROP_WALLET_KEYPAIR:", e.message, e.stack);
  throw new Error("Invalid airdrop wallet configuration: " + e.message);
}

// Helper to Throw Errors from Supabase Responses
function throwOnError<T>({ data, error }: { data: T; error: any }): T {
  if (error) {
    console.error("[supabase] Error:", error.message, error.stack);
    throw new Error(error.message);
  }
  return data;
}

// Helper to Get User Wallet
async function getUserWallet(user_id: string) {
  console.log("[wallet] Retrieving wallet for user_id:", user_id);
  const userWallet = await supabaseAdmin
    .from("user_wallets")
    .select("address")
    .eq("user_id", user_id)
    .limit(1)
    .then(throwOnError);
  if (!userWallet || userWallet.length === 0) {
    console.error("[wallet] No wallet found for user_id:", user_id);
    throw new Error("No wallet found for user");
  }
  console.log("[wallet] Wallet retrieved, address:", userWallet[0].address);
  return userWallet[0];
}

// Main Handler
Deno.serve(async (req: Request) => {
  console.log("[http] Request received:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers)
  });

  if (req.method !== "POST") {
    console.error("[http] Invalid method:", req.method);
    return new Response(JSON.stringify({
      error: `Method must be POST, got: ${req.method}`
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  let user_id: string, route: string;
  try {
    const url = new URL(req.url);
    route = url.pathname.split("/").pop();
    console.log("[http] Route:", route);
    const body = await req.json();
    user_id = body.user_id;
    console.log("[http] Request body:", body);
    if (!user_id) {
      console.error("[http] Invalid user_id:", user_id);
      return new Response(JSON.stringify({
        error: `Invalid user id: ${user_id}`
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  } catch (e) {
    console.error("[http] Error parsing request:", e.message, e.stack);
    return new Response(JSON.stringify({
      error: "Invalid request body or URL: " + e.message}
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Route: Airdrop
  if (route === "airdrop") {
    console.log("[airdrop] Starting airdrop for user_id:", user_id);

    // Check Total Claims
    try {
      const { count } = await supabaseAdmin
        .from("airdrop_transactions")
        .select("id", {
          count: "exact"
        });
      console.log("[airdrop] Total claims:", count);
      if (count >= MAX_CLAIMS) {
        console.error("[airdrop] Airdrop limit reached:", count, "/", MAX_CLAIMS);
        return new Response(JSON.stringify({
          error: "Airdrop limit reached"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        );
      }
    } catch (e) {
      console.error("[airdrop] Airdrop limit check error:", err.message);
      throw err;
    }
  }

  // Check User Eligibility
  try {
    const { data: userActivity, error } = await supabaseAdmin
      .from("user_activity")
      .select("has_claimed_airdrop")
      .eq("user_id", user_id)
      .limit(1);
    if (error) {
      throw error;
    }
    console.log("[airdrop] User activity result:", userActivity);
    if (userData.length === 0) {
      console.log("[airdrop] No user_activity record for user_id, eligible for airdrop:", user_id);
    } else if (userActivity[0].has_claimed_airdrop) {
      console.error("[airdrop] User already claimed airdrop:", user_id);
      return new Response(JSON.stringify({
        error: "User has already claimed the SMP airdrop"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  } catch (e) {
    console.error("[airdrop] Eligibility check error:", e.message, e.stack);
    return new Response(JSON.stringify({
      error: "Failed to check eligibility: " + e.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Get User Wallet
  let userWallet;
  try {
    userWallet = await getUserWallet(user_id);
    console.log("[airdrop] User wallet retrieved:", userWallet.address);
  } catch (e) {
    console.error("[airdrop] User wallet error:", e.message, e.stack);
    return new Response(JSON.stringify({
      error: "Failed to retrieve user wallet: " + e.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Parse User Public Key
  let user: PublicKey;
  try {
    user = new PublicKey(userWallet.address);
    console.log("[airdrop] User public key parsed:", user.toString());
  } catch (e) {
    console.error("[airdrop] Invalid wallet address:", e.message, e.stack);
    return new Response(JSON.stringify({
      error: "Invalid user wallet address: " + e.message
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Validate Airdrop Wallet Balance
  try {
    const balance = await connection.getBalance(AIRDROP_KEYPAIR.publicKey);
    console.log("[airdrop] Airdrop wallet balance check:", balance / 1e9, "SOL");
    console.log("[airdrop] Estimated cost per airdrop: ~0.00204344 SOL (tx fee: 0.000005 SOL, ATA creation: 0.00203844 SOL)");
    if (balance < MINIMUM_SOL_BALANCE) {
      console.error("[airdrop] Insufficient SOL in airdrop wallet:", balance / 1e9, "SOL", "required:", MINIMUM_SOL_BALANCE / 1e9, "SOL");
      return new Response(JSON.stringify({
        error: "Airdrop wallet has insufficient SOL to process transaction"
      }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.error("[airdrop] Failed to check airdrop wallet balance:", e.message, e.stack);
    return new Response(JSON.stringify({
      error: "Failed to verify airdrop wallet balance: " + e.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Build Transaction
  const transaction = new Transaction();
  const smpAta = {
    treasury: getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, AIRDROP_KEYPAIR.publicKey),
    user: getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, user)
  };
  try {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: COMPUTE_UNIT_LIMIT
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 10_000
      }),
      createAssociatedTokenAccountInstruction(AIRDROP_KEYPAIR.publicKey, smpAta.user, user, SMP_MINT_ADDRESS),
      createTransferInstruction(smpAta.treasury, smpAta.user, AIRDROP_KEYPAIR.publicKey, AIRDROP_SMP_AMOUNT)
    );
    transaction.feePayer = AIRDROP_KEYPAIR.publicKey;
    console.log("[airdrop] Transaction built for user:", user.toString());
  } catch (e) {
    console.error("[airdrop] Failed to build transaction:", e.message, e.stack);
    return new Response(JSON.stringify({
      error: "Failed to build transaction: " + e.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Send and Confirm Transaction
  let signature: string | null = null;
  try {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.sign(AIRDROP_KEYPAIR);
    console.log("[airdrop] Sending transaction for user:", user.toString());
    signature = await sendAndConfirmTransaction(connection, transaction, [AIRDROP_KEYPAIR], {
      commitment: "confirmed",
      maxRetries: 3,
      preflightCommitment: "confirmed"
    });
    console.log("[airdrop] Transaction confirmed, signature:", signature);
  } catch (e) {
    console.error("[airdrop] Transaction error:", e.message, e.stack);
    let errorMessage = "Transaction failed: " + e.message;
    if (e.message.includes("Insufficient funds")) {
      errorMessage = "Airdrop wallet has insufficient SOL to process transaction";
    } else if (e.message.includes("exceeded CUs")) {
      errorMessage = "Transaction failed due to insufficient compute units";
    }
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Record Transaction in airdrop_transactions
  try {
    await supabaseAdmin
      .from("airdrop_transactions")
      .insert({
        user_id,
        transaction_signature: signature,
        amount: AIRDROP_SMP_AMOUNT / 1e6,
        created_at: new Date().toISOString()
      })
      .then(throwOnError);
    console.log("[airdrop] Recorded transaction in airdrop_transactions");
  } catch (e) {
    console.error("[airdrop] Failed to record airdrop transaction:", e.message, e.stack);
    return new Response(JSON.stringify({
      error: "Failed to record airdrop transaction: " + e.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Update user_activity
  try {
    await supabaseAdmin
      .from("user_activity")
      .upsert({
        user_id,
        has_claimed_airdrop: true,
        last_claim_timestamp: new Date().toISOString()
      }, {
        onConflict: "user_id"
      })
      .then(throwOnError);
    console.log("[airdrop] Updated user_activity for user_id:", user_id);
  } catch (e) {
    console.error("[airdrop] Failed to update user_activity:", e.message, e.stack);
    return new Response(JSON.stringify({
      error: "Failed to update user activity: " + e.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Update wallet_balances
  try {
    await supabaseAdmin
      .from("wallet_balances")
      .upsert({
        user_id,
        chain: "SOL",
        currency: "SMP",
        amount: AIRDROP_SMP_AMOUNT / 1e6,
        decimals: 6,
        wallet_address: user.toString()
      })
      .then(throwOnError);
    console.log("[airdrop] Updated wallet_balances for user_id:", user_id);
  } catch (e) {
    console.error("[airdrop] Failed to update wallet_balances:", e.message, e.stack);
    return new Response(JSON.stringify({
      error: "Failed to update wallet balance: " + e.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  return new Response(JSON.stringify({
    userPublicKey: user.toString(),
    signature
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

// Invalid Route
console.error("[http] Invalid route:", route);
return new Response(JSON.stringify({
  error: `Invalid route: ${route}`
}), {
  status: 404,
  headers: {
    "Content-Type": "application/json"
  }
});
});