import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "npm:@solana/web3.js@1.95.3";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "npm:@solana/spl-token@0.4.8";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { Buffer } from "https://deno.land/std@0.153.0/node/buffer.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import * as crypto from "https://deno.land/std@0.153.0/node/crypto.ts";

const RPC_URL = Deno.env.get("RPC_URL") || "https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://xqeimsncmnqsiowftdmz.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZWltc25jbW5xc2lvd2Z0ZG16Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODA0MTE5NiwiZXhwIjoyMDUzNjE3MTk2fQ.Xe5Z6eF3i-f3SHXU26_8pG88Kn1i1qV97l4M1D_4e1o";
const AIRDROP_WALLET_KEYPAIR = JSON.parse(Deno.env.get("AIRDROP_WALLET_KEYPAIR") || "{}");
const SMP_MINT_ADDRESS = new PublicKey("SMP2iUmxiexwH1f2neZHYqV7QPrJpjFBN1V1VFLb4ah");
const KEYPAIR_ENCRYPTION_SECRET = Deno.env.get("KEYPAIR_ENCRYPTION_SECRET") || "your-secure-secret-key-123";
const ENCRYPTION_ALGORITHM = "aes-256-cbc";

const AIRDROP_KEYPAIR = Keypair.fromSecretKey(Uint8Array.from(AIRDROP_WALLET_KEYPAIR));
const MIN_SOL_REQUIRED = 0.0025 * 1e9; // 0.0025 SOL in lamports
const AIRDROP_SMP_AMOUNT = 1_000_000 * 1e6; // 1M SMP tokens (6 decimals)
const MAX_CLAIMS = 500;

const connection = new Connection(RPC_URL, "confirmed");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

interface ErrorResponse {
  error: string;
}

interface AirdropResponse {
  userPublicKey: string;
  signature: string;
}

interface CreateWalletResponse {
  userPublicKey: string;
}

interface RetrieveWalletResponse {
  userPublicKey: string;
  privateKey: number[];
}

interface WalletAddressResponse {
  walletAddress: string;
}

function generateKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

async function encrypt(data: Uint8Array): Promise<string> {
  try {
    console.log("[encrypt] Starting encryption");
    const key = generateKey(KEYPAIR_ENCRYPTION_SECRET);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(Buffer.from(data));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
  } catch (e: any) {
    console.error("[encrypt] Error:", e.message, e.stack);
    throw new Error(`Encryption failed: ${e.message}`);
  }
}

async function decrypt(data: string): Promise<Buffer> {
  try {
    console.log("[decrypt] Starting decryption");
    const [ivHex, encryptedHex] = data.split(":");
    if (!ivHex || !encryptedHex) {
      throw new Error("Invalid encrypted data format");
    }
    const key = generateKey(KEYPAIR_ENCRYPTION_SECRET);
    const iv = Buffer.from(ivHex, "hex");
    const encryptedData = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  } catch (e: any) {
    console.error("[decrypt] Error:", e.message, e.stack);
    throw new Error(`Decryption failed: ${e.message}`);
  }
}

function throwOnError<T>({ data, error }: { data: T; error: any }) {
  if (error) {
    console.error("[supabase] Error:", error.message, error.stack);
    throw new Error(error.message);
  }
  return data;
}

async function getOrCreateUserWallet(user_id: string): Promise<{ address: string; private_key: string }> {
  try {
    console.log("[getOrCreateUserWallet] Starting for user_id:", user_id);
    const { data: existingWallet } = await supabaseAdmin
      .from("user_wallets")
      .select("address, private_key")
      .eq("user_id", user_id)
      .maybeSingle()
      .then(throwOnError);

    if (existingWallet) {
      console.log("[getOrCreateUserWallet] Found existing wallet:", existingWallet.address);
      return existingWallet;
    }

    console.log("[getOrCreateUserWallet] Creating new wallet for user_id:", user_id);
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const privateKey = keypair.secretKey;
    const encryptedPrivateKey = await encrypt(privateKey);

    const { data: wallet } = await supabaseAdmin
      .from("user_wallets")
      .insert({
        user_id,
        address: publicKey,
        private_key: encryptedPrivateKey,
        created_at: new Date().toISOString(),
      })
      .select("address, private_key")
      .single()
      .then(throwOnError);

    console.log("[getOrCreateUserWallet] Created wallet:", publicKey);
    return wallet;
  } catch (e: any) {
    console.error("[getOrCreateUserWallet] Error:", e.message, e.stack);
    throw new Error(`Failed to get or create wallet: ${e.message}`);
  }
}

serve(async (req: Request) => {
  console.log("[request] Received:", req.method, req.url);
  const url = new URL(req.url);
  const route = url.pathname.split("/").pop()?.toLowerCase();
  let body: any;

  try {
    body = await req.json();
    console.log("[request] Body:", body);
  } catch (e: any) {
    console.error("[request] Invalid JSON:", e.message, e.stack);
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" } as ErrorResponse),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const user_id = body.user_id;

  if (!["airdrop", "get-or-create", "retrieve", "get-wallet-address"].includes(route || "")) {
    console.error("[request] Invalid route:", route);
    return new Response(
      JSON.stringify({ error: "Invalid route" } as ErrorResponse),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (route !== "get-wallet-address" && !user_id) {
    console.error("[request] Missing user_id");
    return new Response(
      JSON.stringify({ error: "Missing user_id" } as ErrorResponse),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (route === "get-or-create") {
    try {
      const wallet = await getOrCreateUserWallet(user_id!);
      return new Response(
        JSON.stringify({ userPublicKey: wallet.address } as CreateWalletResponse),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e: any) {
      console.error("[get-or-create] Error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (route === "retrieve") {
    try {
      console.log("[retrieve] Starting for user_id:", user_id);
      const { data: wallet } = await supabaseAdmin
        .from("user_wallets")
        .select("address, private_key")
        .eq("user_id", user_id)
        .single()
        .then(throwOnError);

      if (!wallet) {
        console.error("[retrieve] No wallet found for user_id:", user_id);
        return new Response(
          JSON.stringify({ error: "No wallet found" } as ErrorResponse),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      const decryptedPrivateKey = await decrypt(wallet.private_key);
      const privateKeyArray = Array.from(decryptedPrivateKey);

      return new Response(
        JSON.stringify({
          userPublicKey: wallet.address,
          privateKey: privateKeyArray,
        } as RetrieveWalletResponse),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e: any) {
      console.error("[retrieve] Error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (route === "get-wallet-address") {
    try {
      const walletAddress = AIRDROP_KEYPAIR.publicKey.toBase58();
      console.log("[get-wallet-address] Returning address:", walletAddress);
      return new Response(
        JSON.stringify({ walletAddress } as WalletAddressResponse),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e: any) {
      console.error("[get-wallet-address] Error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to get wallet address: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (route === "airdrop") {
    console.log("[airdrop] Starting for user_id:", user_id);

    // Check Airdrop Wallet Balance
    try {
      const balance = await connection.getBalance(AIRDROP_KEYPAIR.publicKey);
      console.log("[airdrop] Airdrop wallet balance:", balance / 1e9, "SOL");
      if (balance < MIN_SOL_REQUIRED) {
        console.error("[airdrop] Insufficient SOL for transaction:", balance / 1e9);
        return new Response(
          JSON.stringify({ error: "Airdrop wallet has insufficient SOL" } as ErrorResponse),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (e: any) {
      console.error("[airdrop] Balance check error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to check airdrop wallet balance: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check Total Claims
    try {
      const { count } = await supabaseAdmin
        .from("airdrop_transactions")
        .select("id", { count: "exact" })
        .then(throwOnError);
      console.log("[airdrop] Total claims:", count);
      if (count >= MAX_CLAIMS) {
        console.error("[airdrop] Airdrop limit reached:", count);
        return new Response(
          JSON.stringify({ error: "Airdrop limit reached" } as ErrorResponse),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (e: any) {
      console.error("[airdrop] Limit check error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to check airdrop limit: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check User Eligibility
    try {
      const userActivity = await supabaseAdmin
        .from("user_activity")
        .select("has_claimed_airdrop")
        .eq("user_id", user_id)
        .limit(1)
        .maybeSingle()
        .then(throwOnError);
      console.log("[airdrop] User activity:", userActivity);
      if (userActivity?.has_claimed_airdrop) {
        console.error("[airdrop] User already claimed:", user_id);
        return new Response(
          JSON.stringify({ error: "User has already claimed the SMP airdrop" } as ErrorResponse),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (e: any) {
      console.error("[airdrop] Eligibility check error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to check eligibility: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get User Wallet
    let userWallet: { address: string; private_key: string };
    try {
      userWallet = await getOrCreateUserWallet(user_id!);
      console.log("[airdrop] User wallet:", userWallet.address);
    } catch (e: any) {
      console.error("[airdrop] Wallet retrieval error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve user wallet: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse User Public Key
    let user: PublicKey;
    try {
      user = new PublicKey(userWallet.address);
      console.log("[airdrop] User public key:", user.toBase58());
    } catch (e: any) {
      console.error("[airdrop] Invalid wallet address:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Invalid user wallet address: " + e.message } as ErrorResponse),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check for Existing SMP Airdrop
    const smpAta = {
      treasury: getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, AIRDROP_KEYPAIR.publicKey),
      user: getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, user),
    };
    try {
      const [userSmpAccountInfo] = await connection.getMultipleAccountsInfo([smpAta.user]);
      if (userSmpAccountInfo) {
        console.error("[airdrop] User already received SMP:", user.toBase58());
        return new Response(
          JSON.stringify({ error: "User has already received the SMP airdrop" } as ErrorResponse),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (e: any) {
      console.error("[airdrop] SMP account check error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to verify SMP account: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build Transaction
    const transaction = new Transaction();
    try {
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }), // Increased from 27,000
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }), // Increased for priority
        createAssociatedTokenAccountInstruction(
          AIRDROP_KEYPAIR.publicKey,
          smpAta.user,
          user,
          SMP_MINT_ADDRESS
        ),
        createTransferInstruction(
          smpAta.treasury,
          smpAta.user,
          AIRDROP_KEYPAIR.publicKey,
          AIRDROP_SMP_AMOUNT
        )
      );
      transaction.feePayer = AIRDROP_KEYPAIR.publicKey;
      console.log("[airdrop] Transaction built for user:", user.toBase58());
    } catch (e: any) {
      console.error("[airdrop] Transaction build error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to build transaction: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Send and Confirm Transaction
    let signature: string;
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.sign(AIRDROP_KEYPAIR);
      console.log("[transaction] Sending for user:", user.toBase58());
      signature = await sendAndConfirmTransaction(connection, transaction, [AIRDROP_KEYPAIR], {
        commitment: "confirmed",
        maxRetries: 3,
        skipPreflight: false, // Enable preflight simulation
      });
      console.log("[transaction] Confirmed signature:", signature);
    } catch (e: any) {
      console.error("[transaction] Error:", e.message, e.stack);
      if (e.logs) {
        console.error("[transaction] Logs:", JSON.stringify(e.logs));
      }
      return new Response(
        JSON.stringify({ error: `Transaction failed: ${e.message}${e.logs ? ' Logs: ' + JSON.stringify(e.logs) : ''}` } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Record Transaction
    try {
      await supabaseAdmin
        .from("airdrop_transactions")
        .insert({
          user_id,
          transaction_signature: signature,
          amount: AIRDROP_SMP_AMOUNT / 1e6,
          created_at: new Date().toISOString(),
        })
        .then(throwOnError);
      console.log("[airdrop] Recorded transaction");
    } catch (e: any) {
      console.error("[airdrop] Transaction record error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to record airdrop transaction: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update user_activity
    try {
      await supabaseAdmin
        .from("user_activity")
        .upsert(
          {
            user_id,
            has_claimed_airdrop: true,
            last_claim_timestamp: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .then(throwOnError);
      console.log("[airdrop] Updated user_activity for user_id:", user_id);
    } catch (e: any) {
      console.error("[airdrop] User activity update error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to update user activity: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
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
          address: user.toBase58(),
        })
        .then(throwOnError);
      console.log("[airdrop] Updated wallet_balances for user_id:", user_id);
    } catch (e: any) {
      console.error("[airdrop] Wallet balance update error:", e.message, e.stack);
      return new Response(
        JSON.stringify({ error: "Failed to update wallet balance: " + e.message } as ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ userPublicKey: user.toBase58(), signature } as AirdropResponse),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});