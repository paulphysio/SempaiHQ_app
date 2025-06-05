import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { Keypair, PublicKey, Connection, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  ComputeBudgetProgram,
} from "@solana/spl-token";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

const KEYPAIR_ENCRYPTION_SECRET = Deno.env.get("KEYPAIR_ENCRYPTION_SECRET") || "0162dfbc4a051f147c621d2b73a074f440e375de4f25d3db89fa1959ff70a677";
const SOLANA_RPC_URL = Deno.env.get("SOLANA_RPC_URL") || "https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90";
const SMP_MINT_ADDRESS = new PublicKey(
  Deno.env.get("SMP_MINT_ADDRESS") || "SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor"
);
let AIRDROP_KEYPAIR: Keypair;
try {
  AIRDROP_KEYPAIR = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(Deno.env.get("AIRDROP_WALLET_KEYPAIR") || "[]"))
  );
} catch (e) {
  console.error('[airdrop-wallet] Failed to parse AIRDROP_WALLET_KEYPAIR:', e.message);
  return Response.json({ message: "Invalid airdrop wallet keypair", error: e.message }, { status: 500 });
}
const AIRDROP_SMP_AMOUNT = 1 * 1e6; // 1 SMP token
const USE_MOCK_AIRDROP = Deno.env.get("USE_MOCK_AIRDROP") === "true";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let connection: Connection;
try {
  connection = new Connection(SOLANA_RPC_URL, "confirmed");
} catch (e) {
  console.error('[airdrop-wallet] Failed to initialize Solana connection:', e.message);
  return Response.json({ message: "Solana RPC connection failed", error: e.message }, { status: 500 });
}

function throwOnError({ data, error }: { data: any; error: any }) {
  if (error) {
    console.error('[throwOnError] Error:', JSON.stringify(error, null, 2));
    throw new Error(error.message);
  }
  return data;
}

function encrypt(data: Buffer, secret: string): string {
  const crypto = require("node:crypto");
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(data, null, "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + encrypted;
}

function decrypt(data: string, secret: string): Buffer {
  const crypto = require("node:crypto");
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = Buffer.from(data.slice(0, 32), "hex");
  const encrypted = data.slice(32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex");
  decrypted += decipher.final();
  return Buffer.from(decrypted);
}

Deno.serve(async (req: Request) => {
  const path = new URL(req.url).pathname.replace(/^\/functions\/v1\/airdrop-wallet/, '');
  const authHeader = req.headers.get('Authorization');

  if (req.method !== "POST" && path !== "/health") {
    return Response.json({ error: `Method must be POST, got: ${req.method}` }, { status: 405 });
  }

  if (path === "/health") {
    try {
      const { data } = await supabaseAdmin.from("users").select("id").limit(1);
      return Response.json({ status: "ok", database: "connected" }, { status: 200 });
    } catch (e) {
      console.error('[airdrop-wallet] Health check error:', e.message);
      return Response.json({ status: "error", message: e.message }, { status: 500 });
    }
  }

  if (!authHeader) {
    return Response.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  if (path === "/create-wallet") {
    const { user_id } = await req.json();
    if (!user_id || user_id !== user.id) {
      return Response.json({ error: `Invalid user id: ${user_id}` }, { status: 400 });
    }

    try {
      const existingWallet = await supabaseAdmin
        .from("user_wallets")
        .select("user_id")
        .eq("user_id", user_id)
        .single();
      if (existingWallet.data) {
        return Response.json({ error: `Wallet already exists for user ${user_id}` }, { status: 400 });
      }

      const newKeypair = Keypair.generate();
      const publicKey = newKeypair.publicKey.toString();
      const privateKeyEncrypted = encrypt(Buffer.from(newKeypair.secretKey), KEYPAIR_ENCRYPTION_SECRET);

      await supabaseAdmin
        .from("user_wallets")
        .insert({
          user_id,
          address: publicKey,
          private_key: privateKeyEncrypted,
        })
        .then(throwOnError);

      await supabaseAdmin
        .from("user_activity")
        .insert({
          user_id,
          activity_type: "wallet_created",
        })
        .then(throwOnError);

      return Response.json({ userPublicKey: publicKey }, { status: 200 });
    } catch (e) {
      console.error('[airdrop-wallet] Create wallet error:', e.message);
      return Response.json({ message: e.message }, { status: 500 });
    }
  }

  if (path === "/airdrop-wallet" || path === "") {
    const { user_id } = await req.json();
    if (!user_id || user_id !== user.id) {
      return Response.json({ error: `Invalid user id: ${user_id}` }, { status: 400 });
    }

    try {
      const userWallet = await supabaseAdmin
        .from("user_wallets")
        .select("address, private_key")
        .eq("user_id", user_id)
        .single()
        .then(throwOnError);
      if (!userWallet) {
        return Response.json({ error: "User wallet not found" }, { status: 404 });
      }

      const existingClaim = await supabaseAdmin
        .from("airdrop_transactions")
        .select("id")
        .eq("user_id", user_id)
        .single();
      if (existingClaim.data) {
        return Response.json({ error: `User ${user_id} already claimed airdrop` }, { status: 400 });
      }

      const { count } = await supabaseAdmin
        .from("airdrop_transactions")
        .select("id", { count: "exact" });
      if (count >= 500) {
        return Response.json({ error: "Airdrop limit of 500 users reached" }, { status: 400 });
      }

      let signature: string;
      if (USE_MOCK_AIRDROP) {
        signature = `mock-transaction-${randomUUID()}`;
      } else {
        try {
          const smpAta = {
            treasury: getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, AIRDROP_KEYPAIR.publicKey),
            user: getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, new PublicKey(userWallet.address)),
          };

          const transaction = new Transaction();
          transaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 27_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
            createAssociatedTokenAccountInstruction(
              AIRDROP_KEYPAIR.publicKey,
              smpAta.user,
              new PublicKey(userWallet.address),
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

          const { blockhash } = await connection.getLatestBlockhash("confirmed");
          transaction.recentBlockhash = blockhash;

          signature = await sendAndConfirmTransaction(connection, transaction, [AIRDROP_KEYPAIR]);
        } catch (e) {
          console.error('[airdrop-wallet] Solana transaction failed:', e.message);
          return Response.json({ message: "Solana transaction failed", error: e.message }, { status: 500 });
        }
      }

      await supabaseAdmin
        .from("airdrop_transactions")
        .insert({
          user_id,
          wallet_address: userWallet.address,
          signature,
          amount: AIRDROP_SMP_AMOUNT,
        })
        .then(throwOnError);

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

      await supabaseAdmin
        .from("wallet_balances")
        .upsert(
          {
            user_id,
            chain: "SOL",
            currency: "SMP",
            amount: AIRDROP_SMP_AMOUNT,
            decimals: 6,
            wallet_address: userWallet.address,
          },
          { onConflict: ["user_id", "chain", "currency"] }
        )
        .then(throwOnError);

      return Response.json({
        userPublicKey: userWallet.address,
        signature,
        confirmationError: null,
      }, { status: 200 });
    } catch (e) {
      console.error('[airdrop-wallet] Airdrop error:', e.message);
      return Response.json({ message: e.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Invalid endpoint", path }, { status: 404 });
});