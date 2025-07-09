import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram } from "npm:@solana/web3.js@1.95.3";
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddressSync, getAccount, getMint } from "npm:@solana/spl-token@0.4.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48";
// Constants
const SMP_MINT_ADDRESS = new PublicKey("SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor"); // REPLACE WITH VALID SPL TOKEN MINT ADDRESS (e.g., USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90"; // Use Devnet for testing
const connection = new Connection(RPC_URL, "confirmed");
const AIRDROP_WALLET_KEYPAIR = Deno.env.get("AIRDROP_WALLET_KEYPAIR");
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://xqeimsncmnqsiowftdmz.supabase.co";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const AIRDROP_SMP_AMOUNT = BigInt(1_000_000 * 1_000_000); // 1M tokens with 6 decimals
const MINIMUM_SOL_BALANCE = BigInt(0.003 * 1_000_000_000); // 0.003 SOL for tx + ATA creation
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
// Validate Mint Address at Startup
try {
  console.log("[airdrop] Validating mint:", SMP_MINT_ADDRESS.toBase58());
  const mintInfo = await getMint(connection, SMP_MINT_ADDRESS, "confirmed");
  if (mintInfo.decimals !== 6) {
    throw new Error(`Invalid mint decimals: expected 6, got ${mintInfo.decimals}`);
  }
  console.log("[airdrop] Mint validated, decimals:", mintInfo.decimals);
} catch (e) {
  console.error("[airdrop] Mint validation failed:", e.message);
  throw new Error(`Invalid mint address ${SMP_MINT_ADDRESS.toBase58()}: ${e.message}`);
}
// Initialize Airdrop Keypair
let AIRDROP_KEYPAIR;
try {
  console.log("[solana] Parsing AIRDROP_WALLET_KEYPAIR");
  if (!AIRDROP_WALLET_KEYPAIR) {
    throw new Error("AIRDROP_WALLET_KEYPAIR is not set");
  }
  AIRDROP_KEYPAIR = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(AIRDROP_WALLET_KEYPAIR)));
  console.log("[solana] Airdrop wallet:", AIRDROP_KEYPAIR.publicKey.toBase58());
  const balance = await connection.getBalance(AIRDROP_KEYPAIR.publicKey, "confirmed");
  console.log("[solana] Airdrop wallet balance:", balance / 1_000_000_000, "SOL");
  if (balance < MINIMUM_SOL_BALANCE) {
    throw new Error("Airdrop wallet has insufficient SOL");
  }
} catch (e) {
  console.error("[solana] Failed to parse AIRDROP_WALLET_KEYPAIR:", e.message);
  throw new Error("Invalid airdrop wallet configuration: " + e.message);
}
// Helper to Get User Wallet
async function getUserWallet(user_id) {
  console.log("[wallet] Retrieving wallet for user_id:", user_id);
  const { data, error } = await supabaseAdmin.from("users").select("wallet_address").eq("id", user_id).single();
  if (error || !data?.wallet_address) {
    console.error("[wallet] No wallet_address found:", user_id);
    throw new Error("No wallet address found for user");
  }
  console.log("[wallet] Wallet retrieved:", data.wallet_address);
  return data.wallet_address;
}
// Helper to Check if ATA Exists
async function checkAtaExists(mint, owner) {
  try {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    console.log("[airdrop] Checking ATA for mint:", mint.toBase58(), "owner:", owner.toBase58(), "ATA:", ata.toBase58());
    await getAccount(connection, ata, "confirmed");
    console.log("[airdrop] ATA exists:", ata.toBase58());
    return true;
  } catch (e) {
    if (e.name === "TokenAccountNotFoundError") {
      console.log("[airdrop] ATA does not exist for owner:", owner.toBase58());
      return false;
    }
    console.error("[airdrop] Failed to check ATA:", e.message);
    throw e;
  }
}
// Main Handler
Deno.serve(async (req)=>{
  console.log("[http] Request received:", {
    method: req.method,
    url: req.url
  });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method must be POST"
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  let user_id;
  try {
    const body = await req.json();
    user_id = body.user_id;
    console.log("[http] Request body:", body);
    if (!user_id) {
      return new Response(JSON.stringify({
        error: "Invalid user_id"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({
      error: "Invalid request body"
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  // Get User Wallet
  let wallet_address;
  try {
    wallet_address = await getUserWallet(user_id);
  } catch (e) {
    return new Response(JSON.stringify({
      error: e.message
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  // Parse User Public Key
  let user;
  try {
    user = new PublicKey(wallet_address);
    console.log("[airdrop] User public key:", user.toBase58());
  } catch (e) {
    console.error("[airdrop] Invalid wallet address:", e.message);
    return new Response(JSON.stringify({
      error: "Invalid wallet address"
    }), {
      status: 400,
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
  console.log("[airdrop] Treasury ATA:", smpAta.treasury.toBase58());
  console.log("[airdrop] User ATA:", smpAta.user.toBase58());
  try {
    // Check and Create User ATA
    const ataExists = await checkAtaExists(SMP_MINT_ADDRESS, user);
    if (!ataExists) {
      console.log("[airdrop] Adding ATA creation for user:", user.toBase58());
      transaction.add(createAssociatedTokenAccountInstruction(AIRDROP_KEYPAIR.publicKey, smpAta.user, user, SMP_MINT_ADDRESS // Mint
      ));
    }
    // Add Transfer Instruction
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({
      units: 300_000
    }), createTransferInstruction(smpAta.treasury, smpAta.user, AIRDROP_KEYPAIR.publicKey, AIRDROP_SMP_AMOUNT // Amount
    ));
    // Set Fee Payer and Blockhash
    transaction.feePayer = AIRDROP_KEYPAIR.publicKey;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    console.log("[airdrop] Blockhash set:", blockhash);
    // Send Transaction
    transaction.sign(AIRDROP_KEYPAIR);
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      AIRDROP_KEYPAIR
    ], {
      commitment: "confirmed"
    });
    console.log("[airdrop] Transaction confirmed, signature:", signature);
    // Update Supabase: airdrop_transactions
    await supabaseAdmin.from("airdrop_transactions").insert({
      user_id,
      transaction_signature: signature,
      amount: Number(AIRDROP_SMP_AMOUNT) / 1_000_000,
      created_at: new Date().toISOString()
    });
    // Update Supabase: user_activity
    await supabaseAdmin.from("user_activity").upsert({
      user_id,
      has_claimed_airdrop: true,
      last_claim_timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    }, {
      onConflict: "user_id"
    });
    console.log("[airdrop] Airdrop completed for user_id:", user_id);
    return new Response(JSON.stringify({
      userPublicKey: user.toBase58(),
      signature
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.error("[airdrop] Error:", e.message);
    return new Response(JSON.stringify({
      error: "Airdrop failed: " + e.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
