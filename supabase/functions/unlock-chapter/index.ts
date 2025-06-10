import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from "https://esm.sh/@solana/web3.js@1.93.0";
import {
  createBurnInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "https://esm.sh/@solana/spl-token@0.4.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Buffer } from "node:buffer";

// Constants
const RPC_URL = Deno.env.get("RPC_URL") || "https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90";
const connection = new Connection(RPC_URL, "confirmed");

const SMP_MINT_ADDRESS = new PublicKey("SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor");
const USDC_MINT_ADDRESS = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const SQUADS_WALLET = new PublicKey("4EeY4iDCp36yvLFvwhFhBrurKGJwNqLDzvM3PVsxrPdR");
const TREASURY_WALLET = new PublicKey("9JA3f2Nwx9wpgh2wAg8KQv2bSQGRvYwvyQbgTyPmB8nc");
const AIRDROP_WALLET_KEY = Deno.env.get("AIRDROP_WALLET_KEYPAIR") || "";
let airdropKeypair: Keypair | null = null;

// Price cache
let priceCache: { solPrice: number; smpPrice: number; usdcPrice: number } = { solPrice: 100, smpPrice: 0.01, usdcPrice: 1 };
let cacheTimestamp = 0;
const cacheExpiry = 5 * 60 * 1000; // 5 minutes

try {
  if (AIRDROP_WALLET_KEY) {
    const secretKey = JSON.parse(AIRDROP_WALLET_KEY);
    airdropKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    console.log("Airdrop keypair loaded successfully");
  }
} catch (error) {
  console.error("Failed to parse AIRDROP_WALLET_KEYPAIR:", error.message);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Validate public key
function validatePublicKey(key: string, label: string): PublicKey {
  try {
    return new PublicKey(key);
  } catch (error) {
    console.error(`Invalid ${label} public key:`, key, "Error:", error.message);
    throw new Error(`Invalid ${label} public key: ${error.message}`);
  }
}

// Helper: Fetch and decrypt user private key
async function getUserPrivateKey(userPublicKey: string): Promise<Keypair> {
  try {
    if (!userPublicKey || typeof userPublicKey !== "string") {
      console.error("Invalid user public key provided:", userPublicKey);
      throw new Error("Invalid user public key: must be a non-empty string");
    }

    const { data, error } = await supabase
      .from("user_wallets")
      .select("private_key")
      .eq("address", userPublicKey)
      .single();
    
    if (error || !data?.private_key) {
      console.error("User wallet query error:", error?.message || "No data found", "Public key:", userPublicKey);
      throw new Error("No wallet found for this public key in user_wallets table");
    }
    console.log("Fetched private key for user:", userPublicKey);

    const { data: decryptedData, error: decryptError } = await supabase.functions.invoke("wallet-encryption", {
      body: { action: "decrypt", data: data.private_key },
    });
    if (decryptError || !decryptedData?.result) {
      console.error("Decryption error:", decryptError?.message || "No result returned", "Public key:", userPublicKey);
      throw new Error("Failed to decrypt private key");
    }

    const privateKey = Buffer.from(decryptedData.result, "base64");
    if (privateKey.length !== 64) {
      console.error("Invalid private key length:", privateKey.length, "Public key:", userPublicKey);
      throw new Error("Decrypted private key is invalid");
    }
    
    return Keypair.fromSecretKey(privateKey);
  } catch (error) {
    console.error("Error in getUserPrivateKey:", error.message, "Public key:", userPublicKey);
    throw error;
  }
}

// Helper: Fetch prices
async function fetchPrices() {
  try {
    if (priceCache && Date.now() - cacheTimestamp < cacheExpiry) {
      return priceCache;
    }

    let solPrice = 100;
    let smpPrice = 0.01;
    const usdcPrice = 1;

    try {
      const solResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
      if (!solResponse.ok) throw new Error(`HTTP ${solResponse.status}`);
      const solData = await solResponse.json();
      solPrice = solData?.solana?.usd || 100;
    } catch (error) {
      console.warn("SOL price fetch error:", error.message);
    }

    try {
      const poolAddress = "3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33";
      const meteoraApiUrl = `https://amm-v2.meteora.ag/pools?address=${poolAddress}`;
      const response = await fetch(meteoraApiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const poolData = (await response.json())[0];

      if (!poolData || !poolData.pool_token_amounts) {
        throw new Error("Invalid pool data");
      }

      const smpAmount = parseFloat(poolData.pool_token_amounts[0]);
      const solAmount = parseFloat(poolData.pool_token_amounts[1]);

      if (isNaN(smpAmount) || isNaN(solAmount) || smpAmount <= 0 || solAmount <= 0) {
        throw new Error("Invalid pool amounts");
      }

      if (solAmount < 0.01) {
        console.warn("Low SOL liquidity; using fallback SMP price");
      } else {
        const priceInSol = solAmount / smpAmount;
        smpPrice = priceInSol * solPrice;
        if (smpPrice < 0.000001 || smpPrice > 1) {
          console.warn("SMP price out of range; using fallback");
          smpPrice = 0.01;
        }
      }
    } catch (error) {
      console.warn("SMP price fetch error:", error.message);
    }

    priceCache = { solPrice, smpPrice, usdcPrice };
    cacheTimestamp = Date.now();
    return priceCache;
  } catch (error) {
    console.error("Price fetch error:", error.message);
    return { solPrice: 100, smpPrice: 0.01, usdcPrice: 1 };
  }
}

// Main handler
serve(async (req: Request) => {
  try {
    if (!airdropKeypair) {
      return new Response(JSON.stringify({ error: "Airdrop wallet not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { userPublicKey, novelId, chapterId, paymentType, currency } = await req.json();
    if (!userPublicKey || !novelId || !chapterId || !paymentType || !currency) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log("Request payload:", { userPublicKey, novelId, chapterId, paymentType, currency });

    let user: PublicKey;
    try {
      user = validatePublicKey(userPublicKey, "user");
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid user public key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let userKeypair: Keypair;
    try {
      userKeypair = await getUserPrivateKey(userPublicKey);
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate novel
    const { data: novel, error: novelError } = await supabase
      .from("novels")
      .select("id, user_id")
      .eq("id", novelId)
      .single();
    if (novelError || !novel) {
      console.error("Novel query error:", novelError?.message || "No data");
      return new Response(JSON.stringify({ error: "Novel not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate chapter and lock status
    const { data: chapter, error: chapterError } = await supabase
      .from("chapter_queue")
      .select("is_advance, chapter_number")
      .eq("novel_id", novelId)
      .eq("chapter_number", parseInt(chapterId, 10))
      .single();
    if (chapterError || !chapter) {
      console.error("Chapter query error:", chapterError?.message || "No data");
      return new Response(JSON.stringify({ error: "Chapter not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (chapter.is_advance && paymentType === "SINGLE") {
      return new Response(JSON.stringify({ error: "Locked chapter requires 3CHAPTERS or FULL payment" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!chapter.is_advance && paymentType !== "SINGLE") {
      return new Response(JSON.stringify({ error: "Non-locked chapter requires SINGLE payment" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get author wallet
    const { data: authorData, error: authorError } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", novel.user_id)
      .single();
    if (authorError || !authorData?.wallet_address) {
      console.error("Author query error:", authorError?.message || "No wallet address");
      return new Response(JSON.stringify({ error: "Author wallet not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    let author: PublicKey;
    try {
      author = validatePublicKey(authorData.wallet_address, "author");
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid author wallet address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch prices
    const { solPrice, smpPrice, usdcPrice } = await fetchPrices();
    let amount: number;
    let decimals: number;
    if (paymentType === "SINGLE") {
      if (currency !== "SMP") {
        return new Response(JSON.stringify({ error: "Single chapter only supports SMP" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      amount = Math.ceil(0.025 / smpPrice) * 1e6; // SMP lamports (6 decimals)
      decimals = 6;
    } else if (paymentType === "3CHAPTERS") {
      if (currency === "SMP") {
        amount = Math.ceil(3 / smpPrice) * 1e6;
        decimals = 6;
      } else if (currency === "USDC") {
        amount = 3 * 1e6;
        decimals = 6;
      } else if (currency === "SOL") {
        amount = Math.ceil(3 / solPrice) * LAMPORTS_PER_SOL;
        decimals = 9;
      } else {
        return new Response(JSON.stringify({ error: "Invalid currency" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
        });
      }
    } else if (paymentType === "FULL") {
      if (currency === "SMP") {
        amount = Math.ceil(15 / smpPrice) * 1e6;
        decimals = 6;
      } else if (currency === "USDC") {
        amount = 15 * 1e6;
        decimals = 6;
      } else if (currency === "SOL") {
        amount = Math.ceil(15 / solPrice) * LAMPORTS_PER_SOL;
        decimals = 9;
      } else {
        return new Response(JSON.stringify({ error: "Invalid currency" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid payment type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check balances
    const userSolBalance = await connection.getBalance(user);
    const minSolRequired = paymentType === "SINGLE" ? 0.001 : 0.002;
    if (userSolBalance < minSolRequired * LAMPORTS_PER_SOL) {
      return new Response(JSON.stringify({ error: `Insufficient SOL for fees (need ${minSolRequired} SOL)` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (paymentType === "SINGLE") {
      const airdropBalance = await connection.getBalance(airdropKeypair.publicKey);
      if (airdropBalance < 0.001 * LAMPORTS_PER_SOL) {
        return new Response(JSON.stringify({ error: "Airdrop wallet has insufficient SOL" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    let userBalance = 0;
    const mint = currency === "SMP" ? SMP_MINT_ADDRESS : currency === "USDC" ? USDC_MINT_ADDRESS : NATIVE_MINT;
    if (currency !== "SOL") {
      const userAta = getAssociatedTokenAddressSync(mint, user);
      const ataInfo = await connection.getAccountInfo(userAta);
      userBalance = ataInfo ? Number(ataInfo.data.readBigUInt64LE(64)) : 0;
    } else {
      userBalance = userSolBalance;
    }
    if (userBalance < amount) {
      return new Response(JSON.stringify({ error: `Insufficient ${currency} balance` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build transaction
    const tx = new Transaction();
    const blockhashInfo = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhashInfo.blockhash;
    tx.feePayer = paymentType === "SINGLE" ? airdropKeypair.publicKey : user;

    if (currency === "SMP") {
      const userSmpAta = getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, user);
      if (paymentType === "SINGLE") {
        const amounts = {
          author: Math.floor(0.3 * amount),
          treasury: Math.floor(0.3 * amount),
          squads: Math.floor(0.25 * amount),
          burn: 0,
        };
        amounts.burn = amount - (amounts.author + amounts.treasury + amounts.squads);

        const authorAta = getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, author);
        tx.add(createTransferInstruction(userSmpAta, authorAta, user, amounts.author));

        const treasuryAta = getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, TREASURY_WALLET);
        tx.add(createTransferInstruction(userSmpAta, treasuryAta, user, amounts.treasury));

        const squadsAta = getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, SQUADS_WALLET);
        tx.add(createTransferInstruction(userSmpAta, squadsAta, user, amounts.squads));

        if (amounts.burn > 0) {
          tx.add(createBurnInstruction(userSmpAta, SMP_MINT_ADDRESS, user, amounts.burn));
        }
      } else {
        const amounts = {
          author: Math.floor(0.7 * amount),
          squads: 0,
        };
        amounts.squads = amount - amounts.author;

        const authorAta = getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, author);
        tx.add(createTransferInstruction(userSmpAta, authorAta, user, amounts.author));

        const squadsAta = getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, SQUADS_WALLET);
        tx.add(createTransferInstruction(userSmpAta, squadsAta, user, amounts.squads));
      }
    } else if (currency === "USDC") {
      const userAta = getAssociatedTokenAddressSync(USDC_MINT_ADDRESS, user);
      const amounts = {
        author: Math.floor(0.7 * amount),
        squads: 0,
      };
      amounts.squads = amount - amounts.author;

      const authorAta = getAssociatedTokenAddressSync(USDC_MINT_ADDRESS, author);
      tx.add(createTransferInstruction(userAta, authorAta, user, amounts.author));

      const squadsAta = getAssociatedTokenAddressSync(USDC_MINT_ADDRESS, SQUADS_WALLET);
      tx.add(createTransferInstruction(userAta, squadsAta, user, amounts.squads));
    } else if (currency === "SOL") {
      const amounts = {
        author: Math.floor(0.7 * amount),
        squads: 0,
      };
      amounts.squads = amount - amounts.author;

      tx.add(SystemProgram.transfer({ fromPubkey: user, toPubkey: author, lamports: amounts.author }));
      tx.add(SystemProgram.transfer({ fromPubkey: user, toPubkey: SQUADS_WALLET, lamports: amounts.squads }));
    }

    // Sign transaction
    if (paymentType === "SINGLE") {
      tx.partialSign(airdropKeypair);
      tx.partialSign(userKeypair);
    } else {
      tx.sign(userKeypair);
    }

    // Submit transaction
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });

    // Record payment
    const paymentData = {
      wallet_address: userPublicKey,
      novel_id: novelId,
      chapter_number: parseInt(chapterId, 10),
      amount: amount,
      currency,
      payment_type: paymentType,
      transaction_id: signature,
      decimals: currency === "SOL" ? 9 : 6,
    };
    const { error: paymentError } = await supabase
      .from("chapter_payments")
      .insert(paymentData);
    if (paymentError) {
      console.error("Payment insert error:", paymentError.message);
      return new Response(JSON.stringify({ error: `Failed to record payment: ${paymentError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Record unlock for 3CHAPTERS or FULL
    if (paymentType !== "SINGLE") {
      const chaptersToUnlock = paymentType === "3CHAPTERS" ? 3 : -1;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("wallet_address", userPublicKey)
        .single();
      if (userError || !userData) {
        console.error("User query error for unlock:", userError?.message || "No data");
        return new Response(JSON.stringify({ error: "User not found for unlock" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      const unlockData = {
        user_id: userData.id,
        story_id: novelId,
        chapter_unlocked_till: chaptersToUnlock === -1 ? -1 : parseInt(chapterId, 10) + chaptersToUnlock - 1,
        expires_at: expiresAt.toISOString(),
      };
      const { error: unlockError } = await supabase
        .from("unlocked_story_chapters")
        .upsert(unlockData);
      if (unlockError) {
        console.error("Unlock insert error:", unlockError.message);
        return new Response(JSON.stringify({ error: `Failed to record unlock: ${unlockError.message}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Serialize transaction for response
    const serializedTx = tx.serialize().toString("base64");
    return new Response(
      JSON.stringify({
        transaction: serializedTx,
        signature,
        amount: amount / 10 ** (currency === "SOL" ? 9 : 6),
        currency,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in unlock-chapter:", error.message, "Stack:", error.stack);
    return new Response(JSON.stringify({ error: error.message || "Unknown error in unlock-chapter" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});