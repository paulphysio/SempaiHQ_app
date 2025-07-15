import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram } from "npm:@solana/web3.js@1.95.3";
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddressSync, getAccount, getMint } from "npm:@solana/spl-token@0.4.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48";
import * as nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@5.0.0";

// Constants
const SMP_MINT_ADDRESS = new PublicKey("SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor"); // REPLACE WITH VALID SPL TOKEN MINT ADDRESS (e.g., USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90"; // Use Devnet for testing
const connection = new Connection(RPC_URL, "confirmed");
const AIRDROP_WALLET_KEYPAIR = Deno.env.get("AIRDROP_WALLET_KEYPAIR");
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://xqeimsncmnqsiowftdmz.supabase.co";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const KEYPAIR_ENCRYPTION_SECRET = Deno.env.get("KEYPAIR_ENCRYPTION_SECRET");
const AIRDROP_SMP_AMOUNT = BigInt(1_000_000 * 1_000_000); // 1M tokens with 6 decimals
const MINIMUM_SOL_BALANCE = BigInt(0.001 * 1_000_000_000); // 0.001 SOL for user's transaction fees

// Check encryption secret
if (!KEYPAIR_ENCRYPTION_SECRET) {
  console.error("[encryption] KEYPAIR_ENCRYPTION_SECRET is not set");
  throw new Error("KEYPAIR_ENCRYPTION_SECRET is not set");
}

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
  
  // No need to check minimum balance since user will pay for gas
  // Just log a warning if balance is very low
  if (balance < 100_000) { // 0.0001 SOL
    console.warn("[solana] Warning: Airdrop wallet has very low SOL balance");
  }
} catch (e) {
  console.error("[solana] Failed to parse AIRDROP_WALLET_KEYPAIR:", e.message);
  throw new Error("Invalid airdrop wallet configuration: " + e.message);
}

// Helper functions for encryption/decryption
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

async function generateKey(secret) {
  if (!secret) throw new Error("Secret is undefined");
  const keyMaterial = textEncoder.encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", keyMaterial);
  return crypto.subtle.importKey("raw", hash, {
    name: "AES-CBC"
  }, false, [
    "encrypt",
    "decrypt"
  ]);
}

async function decrypt(data, secret) {
  if (!data || typeof data !== "string") throw new Error("Data must be a non-empty string");
  if (data.length < 32) throw new Error("Data too short for valid IV");
  const key = await generateKey(secret);
  const ivHex = data.slice(0, 32);
  const encryptedHex = data.slice(32);
  if (!encryptedHex) throw new Error("No encrypted data provided");
  const iv = hexToBuffer(ivHex);
  const encrypted = hexToBuffer(encryptedHex);
  try {
    const decrypted = await crypto.subtle.decrypt({
      name: "AES-CBC",
      iv
    }, key, encrypted);
    return textDecoder.decode(decrypted);
  } catch (err) {
    throw new Error(`Decryption failed: ${err.message}`);
  }
}

// Base58 encode/decode functions for Deno environment
function base58Decode(str) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const ALPHABET_MAP = {};
  for (let i = 0; i < ALPHABET.length; i++) {
    ALPHABET_MAP[ALPHABET.charAt(i)] = i;
  }
  
  if (str.length === 0) return new Uint8Array(0);
  
  let bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = ALPHABET_MAP[char];
    if (value === undefined) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] *= 58;
    }
    
    bytes[0] += value;
    
    let carry = 0;
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  
  // Handle leading zeros
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.push(0);
  }
  
  return new Uint8Array(bytes.reverse());
}

// Helper to Get User Wallet and Private Key
async function getUserWalletData(user_id) {
  console.log("[wallet] Retrieving wallet data for user_id:", user_id);
  
  // First get the wallet address from users table
  const { data: userData, error: userError } = await supabaseAdmin
    .from("users")
    .select("wallet_address")
    .eq("id", user_id)
    .single();
  
  if (userError || !userData?.wallet_address) {
    console.error("[wallet] No wallet_address found:", user_id);
    throw new Error("No wallet address found for user");
  }
  
  // Now get the encrypted private key from user_wallets table
  const { data: walletData, error: walletError } = await supabaseAdmin
    .from("user_wallets")
    .select("private_key")
    .eq("user_id", user_id)
    .eq("address", userData.wallet_address)
    .single();
  
  if (walletError || !walletData?.private_key) {
    console.error("[wallet] No private key found for user:", user_id);
    throw new Error("No private key found for user wallet");
  }
  
  // Decrypt the private key
  let privateKeyBase58;
  try {
    privateKeyBase58 = await decrypt(walletData.private_key, KEYPAIR_ENCRYPTION_SECRET);
    console.log("[wallet] Successfully decrypted private key");
  } catch (decryptError) {
    console.error("[wallet] Failed to decrypt private key:", decryptError.message);
    throw new Error("Failed to decrypt user's private key");
  }
  
  // Create keypair from private key
  try {
    // Use our custom base58 decode function
    const privateKeyBytes = base58Decode(privateKeyBase58);
    
    if (privateKeyBytes.length !== 64) {
      throw new Error(`Invalid private key format: length ${privateKeyBytes.length}`);
    }
    
    const userKeypair = Keypair.fromSecretKey(privateKeyBytes);
    const publicKeyStr = userKeypair.publicKey.toString();
    
    // Verify the public key matches
    if (publicKeyStr !== userData.wallet_address) {
      console.error("[wallet] Public key mismatch:", {
        stored: userData.wallet_address,
        derived: publicKeyStr,
      });
      throw new Error("Public key mismatch between stored and derived keys");
    }
    
    console.log("[wallet] Wallet data retrieved for:", userData.wallet_address);
    return {
      publicKey: userKeypair.publicKey,
      keypair: userKeypair,
      address: userData.wallet_address
    };
  } catch (error) {
    console.error("[wallet] Failed to create keypair:", error.message);
    throw new Error("Failed to create keypair from private key: " + error.message);
  }
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
Deno.serve(async (req) => {
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

  // Add validation to prevent duplicate claims
  try {
    const { data: activityData, error: activityError } = await supabaseAdmin
      .from("user_activity")
      .select("has_claimed_airdrop")
      .eq("user_id", user_id)
      .single();

    if (!activityError && activityData?.has_claimed_airdrop) {
      return new Response(JSON.stringify({
        error: "User has already claimed the airdrop"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  } catch (e) {
    console.error("[airdrop] Error checking user activity:", e.message);
    return new Response(JSON.stringify({
      error: "Failed to check airdrop status"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Get User Wallet Data including keypair
  let userWalletData;
  try {
    userWalletData = await getUserWalletData(user_id);
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
  
  // Check user's SOL balance
  try {
    const userBalance = await connection.getBalance(userWalletData.publicKey, "confirmed");
    console.log("[solana] User wallet balance:", userBalance / 1_000_000_000, "SOL");
    if (userBalance < MINIMUM_SOL_BALANCE) {
      return new Response(JSON.stringify({
        error: "User wallet has insufficient SOL for transaction fees"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  } catch (e) {
    console.error("[solana] Failed to check user balance:", e.message);
    return new Response(JSON.stringify({
      error: "Failed to check user balance: " + e.message
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
    user: getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, userWalletData.publicKey)
  };
  console.log("[airdrop] Treasury ATA:", smpAta.treasury.toBase58());
  console.log("[airdrop] User ATA:", smpAta.user.toBase58());
  
  try {
    // Check and Create User ATA
    const ataExists = await checkAtaExists(SMP_MINT_ADDRESS, userWalletData.publicKey);
    if (!ataExists) {
      console.log("[airdrop] Adding ATA creation for user:", userWalletData.publicKey.toBase58());
      // User pays for ATA creation
      transaction.add(createAssociatedTokenAccountInstruction(
        userWalletData.publicKey, // Payer (user)
        smpAta.user,              // ATA address
        userWalletData.publicKey, // Owner
        SMP_MINT_ADDRESS          // Mint
      ));
    }
    
    // Add Transfer Instruction
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000
      }),
      createTransferInstruction(
        smpAta.treasury,           // Source
        smpAta.user,               // Destination
        AIRDROP_KEYPAIR.publicKey, // Authority
        AIRDROP_SMP_AMOUNT         // Amount
      )
    );
    
    // Set Fee Payer and Blockhash
    transaction.feePayer = userWalletData.publicKey; // User pays for transaction fees
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    console.log("[airdrop] Blockhash set:", blockhash);
    
    // Sign Transaction with both keypairs
    transaction.sign(AIRDROP_KEYPAIR, userWalletData.keypair);
    
    // Send Transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [AIRDROP_KEYPAIR, userWalletData.keypair],
      {
        commitment: "confirmed"
      }
    );
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
      userPublicKey: userWalletData.publicKey.toBase58(),
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
