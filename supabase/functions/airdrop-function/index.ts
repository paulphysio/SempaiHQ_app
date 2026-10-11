import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram } from "npm:@solana/web3.js@1.95.3";
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddressSync, getAccount, getMint } from "npm:@solana/spl-token@0.4.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48";
import * as nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@5.0.0";

// Constants
const SMP_MINT_ADDRESS = new PublicKey("SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor");
const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90";
const connection = new Connection(RPC_URL, "confirmed");
const AIRDROP_WALLET_KEYPAIR = Deno.env.get("AIRDROP_WALLET_KEYPAIR");
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://xqeimsncmnqsiowftdmz.supabase.co";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const KEYPAIR_ENCRYPTION_SECRET = Deno.env.get("KEYPAIR_ENCRYPTION_SECRET");
const AIRDROP_SMP_AMOUNT = BigInt(1_000_000 * 1_000_000);
const MINIMUM_SOL_BALANCE = BigInt(0.001 * 1_000_000_000);
const SIGNATURE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Critical environment check
if (!KEYPAIR_ENCRYPTION_SECRET) {
  throw new Error("KEYPAIR_ENCRYPTION_SECRET is not set");
}

if (!supabaseServiceRoleKey) {
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
  const mintInfo = await getMint(connection, SMP_MINT_ADDRESS, "confirmed");
  if (mintInfo.decimals !== 6) {
    throw new Error(`Invalid mint decimals: expected 6, got ${mintInfo.decimals}`);
  }
} catch (e) {
  throw new Error(`Invalid mint address ${SMP_MINT_ADDRESS.toBase58()}: ${e.message}`);
}

// Initialize Airdrop Keypair
let AIRDROP_KEYPAIR;
try {
  if (!AIRDROP_WALLET_KEYPAIR) {
    throw new Error("AIRDROP_WALLET_KEYPAIR is not set");
  }
  AIRDROP_KEYPAIR = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(AIRDROP_WALLET_KEYPAIR)));
  const balance = await connection.getBalance(AIRDROP_KEYPAIR.publicKey, "confirmed");

  if (balance < 100_000) {
    console.warn("[solana] Warning: Airdrop wallet has very low SOL balance");
  }
} catch (e) {
  throw new Error("Invalid airdrop wallet configuration: " + e.message);
}

// Signature verification
function verifyWalletSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
  } catch (e) {
    console.error("[auth] Signature verification failed:", e);
    return false;
  }
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

  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

async function getUserWalletData(user_id) {
  const { data: userData, error: userError } = await supabaseAdmin
    .from("users")
    .select("wallet_address")
    .eq("id", user_id)
    .single();

  if (userError || !userData?.wallet_address) {
    throw new Error("No wallet address found for user");
  }

  const { data: walletData, error: walletError } = await supabaseAdmin
    .from("user_wallets")
    .select("private_key")
    .eq("user_id", user_id)
    .eq("address", userData.wallet_address)
    .single();

  if (walletError || !walletData?.private_key) {
    throw new Error("No private key found for user wallet");
  }

  let privateKeyBase58;
  try {
    privateKeyBase58 = await decrypt(walletData.private_key, KEYPAIR_ENCRYPTION_SECRET);
  } catch (decryptError) {
    throw new Error("Failed to decrypt user's private key");
  }

  try {
    const privateKeyBytes = base58Decode(privateKeyBase58);

    if (privateKeyBytes.length !== 64) {
      throw new Error(`Invalid private key format: length ${privateKeyBytes.length}`);
    }

    const userKeypair = Keypair.fromSecretKey(privateKeyBytes);
    const publicKeyStr = userKeypair.publicKey.toString();

    if (publicKeyStr !== userData.wallet_address) {
      throw new Error("Public key mismatch between stored and derived keys");
    }

    return {
      publicKey: userKeypair.publicKey,
      keypair: userKeypair,
      address: userData.wallet_address
    };
  } catch (error) {
    throw new Error("Failed to create keypair from private key: " + error.message);
  }
}

async function checkAtaExists(mint, owner) {
  try {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    await getAccount(connection, ata, "confirmed");
    return true;
  } catch (e) {
    if (e.name === "TokenAccountNotFoundError") {
      return false;
    }
    throw e;
  }
}

// Main Handler
Deno.serve(async (req) => {
  try {
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

    // 1. Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { walletAddress, signature, timestamp } = body;

    // Validate required fields
    if (!walletAddress || typeof walletAddress !== "string") {
      return new Response(
        JSON.stringify({ error: "Wallet address is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!signature || typeof signature !== "string") {
      return new Response(
        JSON.stringify({ error: "Signature is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!timestamp || typeof timestamp !== "number") {
      return new Response(
        JSON.stringify({ error: "Timestamp is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check timestamp freshness
    const now = Date.now();
    if (Math.abs(now - timestamp) > SIGNATURE_TTL_MS) {
      return new Response(
        JSON.stringify({ error: "Signature expired" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Verify wallet signature
    const message = `airdrop:${timestamp}`;
    if (!verifyWalletSignature(message, signature, walletAddress)) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Get user_id from wallet address
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (userError || !userData?.id) {
      return new Response(
        JSON.stringify({ error: "Wallet not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const user_id = userData.id;

    // 4. Check if already claimed
    const { data: activityData, error: activityError } = await supabaseAdmin
      .from("user_activity")
      .select("has_claimed_airdrop")
      .eq("user_id", user_id)
      .single();

    if (!activityError && activityData?.has_claimed_airdrop) {
      return new Response(JSON.stringify({
        error: "User has already claimed the airdrop"
      }), {
        status: 409,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    // 5. Get User Wallet Data
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

    // 6. Check user's SOL balance
    try {
      const userBalance = await connection.getBalance(userWalletData.publicKey, "confirmed");
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
      return new Response(JSON.stringify({
        error: "Failed to check user balance"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    // 7. Build Transaction
    const transaction = new Transaction();
    const smpAta = {
      treasury: getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, AIRDROP_KEYPAIR.publicKey),
      user: getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, userWalletData.publicKey)
    };

    try {
      const ataExists = await checkAtaExists(SMP_MINT_ADDRESS, userWalletData.publicKey);
      if (!ataExists) {
        transaction.add(createAssociatedTokenAccountInstruction(
          userWalletData.publicKey,
          smpAta.user,
          userWalletData.publicKey,
          SMP_MINT_ADDRESS
        ));
      }

      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 300_000
        }),
        createTransferInstruction(
          smpAta.treasury,
          smpAta.user,
          AIRDROP_KEYPAIR.publicKey,
          AIRDROP_SMP_AMOUNT
        )
      );

      transaction.feePayer = userWalletData.publicKey;
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;

      transaction.sign(AIRDROP_KEYPAIR, userWalletData.keypair);

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [AIRDROP_KEYPAIR, userWalletData.keypair],
        {
          commitment: "confirmed"
        }
      );

      const { error: activityUpdateError } = await supabaseAdmin.from("user_activity").upsert({
        user_id,
        has_claimed_airdrop: true,
        last_claim_timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      });

      if (activityUpdateError) {
        console.error("[airdrop] Failed to update user_activity:", activityUpdateError);
      }

      await supabaseAdmin.from("airdrop_transactions").insert({
        user_id,
        transaction_signature: signature,
        amount: Number(AIRDROP_SMP_AMOUNT) / 1_000_000,
        created_at: new Date().toISOString()
      });

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
  } catch (error) {
    console.error("[airdrop] Unexpected error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
