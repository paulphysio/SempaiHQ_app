import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Connection, PublicKey, Transaction, Keypair } from "https://esm.sh/@solana/web3.js@1.95.3";
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, TOKEN_PROGRAM_ID } from "https://esm.sh/@solana/spl-token@0.4.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48";
import bs58 from "https://esm.sh/bs58@5.0.0";

// --- CONFIG ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RPC_URL = Deno.env.get("RPC_URL");
const SMP_MINT_ADDRESS = new PublicKey(Deno.env.get("SMP_MINT_ADDRESS"));
const SMP_DECIMALS = 6;
const MIN_WITHDRAWAL = 2500;

// Load treasury keypair from env (base58 or JSON array)
const TREASURY_KEYPAIR_JSON = Deno.env.get("TREASURY_KEYPAIR");
const TREASURY_KEYPAIR = TREASURY_KEYPAIR_JSON
  ? (() => {
      try {
        const arr = JSON.parse(TREASURY_KEYPAIR_JSON);
        return arr.length === 64
          ? (new Uint8Array(arr))
          : bs58.decode(TREASURY_KEYPAIR_JSON);
      } catch {
        return bs58.decode(TREASURY_KEYPAIR_JSON);
      }
    })()
  : null;
const treasuryKeypair = TREASURY_KEYPAIR
  ? Keypair.fromSecretKey(TREASURY_KEYPAIR)
  : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    // Log environment variables and request for debugging
    console.log('SUPABASE_URL:', SUPABASE_URL);
    console.log('RPC_URL:', RPC_URL);
    console.log('SMP_MINT_ADDRESS:', SMP_MINT_ADDRESS?.toBase58?.() || SMP_MINT_ADDRESS);
    console.log('TREASURY_KEYPAIR type:', typeof TREASURY_KEYPAIR, Array.isArray(TREASURY_KEYPAIR) ? 'array' : 'not array');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RPC_URL || !SMP_MINT_ADDRESS || !TREASURY_KEYPAIR) {
      console.error('One or more required environment variables are missing!');
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }
    let body;
    try {
      body = await req.json();
      console.log('Request body:', body);
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
    }
    const { userId, walletAddress, amount } = body;

    if (!userId || !walletAddress || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields: userId, walletAddress, amount" }), { status: 400 });
    }

    if (amount < MIN_WITHDRAWAL) {
      return new Response(JSON.stringify({ error: `Withdrawal amount must be at least ${MIN_WITHDRAWAL} SMP` }), { status: 400 });
    }

    const connection = new Connection(RPC_URL, "confirmed");

    // Validate balance
    const { data: walletBalance, error: balanceError } = await supabase
      .from("wallet_balances")
      .select("amount")
      .eq("user_id", userId)
      .eq("currency", "SMP")
      .eq("chain", "SOL")
      .single();

    if (balanceError || !walletBalance) {
      throw new Error("Wallet balance not found");
    }
    if (walletBalance.amount < amount) {
      throw new Error(`Insufficient balance: ${walletBalance.amount.toLocaleString()} SMP available`);
    }

    // Check treasury balance
    const treasuryPubkey = treasuryKeypair.publicKey;
    const treasuryATA = await getAssociatedTokenAddress(SMP_MINT_ADDRESS, treasuryPubkey);
    const treasuryAccountInfo = await connection.getAccountInfo(treasuryATA);
    const treasuryBalance = treasuryAccountInfo
      ? Number((await getAccount(connection, treasuryATA)).amount) / 10 ** SMP_DECIMALS
      : 0;
    if (treasuryBalance < amount) {
      throw new Error(`Treasury has insufficient SMP: ${treasuryBalance.toLocaleString()} SMP available`);
    }

    // Build transaction
    const userATA = await getAssociatedTokenAddress(SMP_MINT_ADDRESS, new PublicKey(walletAddress));
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: treasuryPubkey,
    }).add(
      createTransferInstruction(
        treasuryATA,
        userATA,
        treasuryPubkey,
        Math.round(amount * (10 ** SMP_DECIMALS)),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Sign and send transaction
    transaction.sign(treasuryKeypair);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

    // Update balance
    const newBalance = walletBalance.amount - amount;
    const { error: updateError } = await supabase
      .from("wallet_balances")
      .update({ amount: newBalance })
      .eq("user_id", userId)
      .eq("currency", "SMP")
      .eq("chain", "SOL");

    if (updateError) throw new Error(`Failed to update balance: ${updateError.message}`);

    // Record event
    const eventDetails = `withdrawal-${Date.now()}`;
    const { error: eventError } = await supabase
      .from("wallet_events")
      .insert({
        destination_user_id: userId,
        event_type: "withdrawal",
        event_details: eventDetails,
        source_chain: "SOL",
        source_currency: "SMP",
        amount_change: -amount,
        wallet_address: walletAddress,
        source_user_id: userId,
        destination_chain: "SOL",
        destination_currency: "SMP",
        destination_transaction_signature: signature,
      });

    if (eventError) throw new Error(`Failed to record event: ${eventError.message}`);

    return new Response(JSON.stringify({ signature }), { status: 200 });
  } catch (error) {
    console.error("API error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}); 