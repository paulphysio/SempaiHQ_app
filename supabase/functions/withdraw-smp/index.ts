import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from "https://esm.sh/@solana/web3.js@1.95.3";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID
} from "https://esm.sh/@solana/spl-token@0.4.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48";
import bs58 from "https://esm.sh/bs58@5.0.0";
import * as nacl from "https://esm.sh/tweetnacl@1.0.3";

// --- CONFIG & VALIDATION ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RPC_URL = Deno.env.get("RPC_URL");
const SMP_MINT_ADDRESS_STR = Deno.env.get("SMP_MINT_ADDRESS");
const SMP_DECIMALS = 6;
const MIN_WITHDRAWAL = 2500;
const MAX_WITHDRAWAL = 10000;
const DAILY_LIMIT = 10000;
const SIGNATURE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Critical environment check
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RPC_URL || !SMP_MINT_ADDRESS_STR) {
  throw new Error("Missing required environment variables");
}

let SMP_MINT_ADDRESS: PublicKey;
try {
  SMP_MINT_ADDRESS = new PublicKey(SMP_MINT_ADDRESS_STR);
} catch (e) {
  throw new Error(`Invalid SMP_MINT_ADDRESS: ${SMP_MINT_ADDRESS_STR}`);
}

const TREASURY_KEYPAIR_JSON = Deno.env.get("TREASURY_KEYPAIR");
if (!TREASURY_KEYPAIR_JSON) {
  throw new Error("TREASURY_KEYPAIR environment variable is required");
}

const TREASURY_KEYPAIR = (() => {
  try {
    const arr = JSON.parse(TREASURY_KEYPAIR_JSON);
    return arr.length === 64
      ? (new Uint8Array(arr))
      : bs58.decode(TREASURY_KEYPAIR_JSON);
  } catch {
    return bs58.decode(TREASURY_KEYPAIR_JSON);
  }
})();

const treasuryKeypair = Keypair.fromSecretKey(TREASURY_KEYPAIR);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

function validateAmount(amount: unknown): number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number");
  }
  if (amount < MIN_WITHDRAWAL) {
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL} SMP`);
  }
  if (amount > MAX_WITHDRAWAL) {
    throw new Error(`Maximum withdrawal is ${MAX_WITHDRAWAL} SMP`);
  }
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 6) {
    throw new Error("Amount cannot have more than 6 decimal places");
  }
  return Math.round(amount * 1_000_000) / 1_000_000;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
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

    const { amount, walletAddress, signature, timestamp, idempotencyKey } = body;

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

    // Check timestamp freshness (prevent replay attacks)
    const now = Date.now();
    if (Math.abs(now - timestamp) > SIGNATURE_TTL_MS) {
      return new Response(
        JSON.stringify({ error: "Signature expired" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate amount
    const validatedAmount = validateAmount(amount);

    // Validate idempotency key
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return new Response(
        JSON.stringify({ error: "Idempotency key is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Verify wallet signature
    const message = `withdraw:${validatedAmount}:${timestamp}:${idempotencyKey}`;
    if (!verifyWalletSignature(message, signature, walletAddress)) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Get user_id from wallet address
    const { data: userData, error: userError } = await supabase
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

    const userId = userData.id;

    // 4. Check idempotency
    const { data: existingWithdrawal } = await supabase
      .from("withdrawals")
      .select("id, status, transaction_signature")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingWithdrawal) {
      if (existingWithdrawal.status === "confirmed") {
        return new Response(
          JSON.stringify({
            success: true,
            signature: existingWithdrawal.transaction_signature,
            alreadyProcessed: true
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (existingWithdrawal.status === "pending" || existingWithdrawal.status === "sent") {
        return new Response(
          JSON.stringify({ error: "Withdrawal already in progress" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Check daily withdrawal limit
    const { data: limitCheck } = await supabase
      .rpc("check_daily_withdrawal_limit", {
        p_user: userId,
        p_amount: validatedAmount
      });

    if (!limitCheck) {
      return new Response(
        JSON.stringify({ error: "Daily withdrawal limit exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const connection = new Connection(RPC_URL, "confirmed");

    // 6. Validate treasury balance
    const treasuryPubkey = treasuryKeypair.publicKey;
    const treasuryATA = await getAssociatedTokenAddress(SMP_MINT_ADDRESS, treasuryPubkey);
    const treasuryBalance = await connection.getTokenAccountBalance(treasuryATA);

    if (parseFloat(treasuryBalance.value.amount) / 10 ** SMP_DECIMALS < validatedAmount) {
      return new Response(
        JSON.stringify({ error: "Insufficient treasury balance. Please try again later." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    // 7. Atomic debit before sending
    const { data: newBalance, error: debitError } = await supabase
      .rpc("debit_smp", {
        p_user: userId,
        p_amount: validatedAmount
      });

    if (debitError || newBalance === null) {
      return new Response(
        JSON.stringify({ error: "Insufficient balance" }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // 8. Create withdrawal record
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("withdrawals")
      .insert({
        user_id: userId,
        wallet_address: walletAddress,
        amount: validatedAmount,
        currency: "SMP",
        chain: "SOL",
        status: "pending",
        idempotency_key: idempotencyKey
      })
      .select("id")
      .single();

    if (withdrawalError || !withdrawal) {
      await supabase.rpc("credit_smp", {
        p_user: userId,
        p_amount: validatedAmount
      });
      return new Response(
        JSON.stringify({ error: "Failed to create withdrawal record" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const withdrawalId = withdrawal.id;

    try {
      // 9. Build transaction with ATA creation
      const userATA = await getAssociatedTokenAddress(SMP_MINT_ADDRESS, new PublicKey(walletAddress));
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: treasuryPubkey,
      });

      try {
        await getAccount(connection, userATA, "confirmed");
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            treasuryPubkey,
            userATA,
            new PublicKey(walletAddress),
            SMP_MINT_ADDRESS
          )
        );
      }

      transaction.add(
        createTransferInstruction(
          treasuryATA,
          userATA,
          treasuryPubkey,
          Math.round(validatedAmount * (10 ** SMP_DECIMALS)),
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // 10. Sign and send transaction
      transaction.sign(treasuryKeypair);
      const signature = await connection.sendRawTransaction(transaction.serialize());

      await supabase.rpc("update_withdrawal_status", {
        p_id: withdrawalId,
        p_status: "sent",
        p_signature: signature
      });

      // 11. Confirm transaction
      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      await supabase.rpc("update_withdrawal_status", {
        p_id: withdrawalId,
        p_status: "confirmed"
      });

      // 12. Record wallet event
      await supabase.from("wallet_events").insert({
        destination_user_id: userId,
        event_type: "withdrawal",
        event_details: `withdrawal-${withdrawalId}`,
        source_chain: "SOL",
        source_currency: "SMP",
        amount_change: -validatedAmount,
        wallet_address: walletAddress,
        source_user_id: userId,
        destination_chain: "SOL",
        destination_currency: "SMP",
        destination_transaction_signature: signature,
      });

      return new Response(
        JSON.stringify({ success: true, signature }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    } catch (txError) {
      await supabase.rpc("credit_smp", {
        p_user: userId,
        p_amount: validatedAmount
      });

      await supabase.rpc("update_withdrawal_status", {
        p_id: withdrawalId,
        p_status: "failed",
        p_error: txError instanceof Error ? txError.message : String(txError)
      });

      return new Response(
        JSON.stringify({ error: "Transaction failed. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Withdrawal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
