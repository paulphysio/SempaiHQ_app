import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decodeBase64 } from "jsr:@std/encoding/base64";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1";
import { createAssociatedTokenAccountInstruction, createBurnInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddressSync } from "https://esm.sh/@solana/spl-token@0.4.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import bs58 from "https://esm.sh/bs58@4.0.1";
// Constants
const RPC_URL = Deno.env.get("RPC_URL") || "https://mainnet.helius-rpc.com/?api-key=ad8457f8-9c51-4122-95d4-91b15728ea90";
const connection = new Connection(RPC_URL, "confirmed");
const SMP_MINT_ADDRESS = new PublicKey("SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor");
const USDC_MINT_ADDRESS = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const SQUADS_WALLET = new PublicKey("4EeY4iDCp36yvLFvwhFhBrurKGJwNqLDzvM3PVsxrPdR");
const TREASURY_WALLET = new PublicKey("62PPSRhAk6hdn85MUoYAnUDisswZRfos68Zqf7N1QLkr");
const AIRDROP_WALLET_KEY = Deno.env.get("AIRDROP_WALLET_KEYPAIR") || "";
let airdropKeypair;
try {
  if (AIRDROP_WALLET_KEY) {
    const secretKey = JSON.parse(AIRDROP_WALLET_KEY);
    airdropKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    console.log("Airdrop keypair loaded successfully");
  }
} catch (error) {
  console.error("Failed to parse AIRDROP_WALLET_KEYPAIR:", error);
}
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);
function throwOnError({ data, error }) {
  if (error) {
    console.error("[supabase] Error:", error?.message, error?.stack);
    throw new Error(error?.message);
  }
  return data;
}
// Helper: Fetch and decrypt user private key
async function getUserPrivateKey(userId) {
  const wallet = await supabaseAdmin.from("user_wallets").select("private_key").eq("user_id", userId).maybeSingle().then(throwOnError);
  if (!wallet) throw new Error(`could not find wallet for user ${userId}`);
  const { data: decryptResult, error: decryptError } = await supabaseAdmin.functions.invoke("wallet-encryption", {
    body: { action: "decrypt", data: wallet.private_key }
  });
  if (decryptError) throw new Error('wallet-encryption failed: ' + decryptError.message);
  // Accept .result, .privateKey, or the value itself
  const privateKeyBase58 = decryptResult?.result || decryptResult?.privateKey || decryptResult;
  console.log('[getUserPrivateKey] Decrypted privateKey:', privateKeyBase58, 'Type:', typeof privateKeyBase58);
  if (typeof privateKeyBase58 !== 'string') {
    throw new Error('Decrypted private key is not a string. Value: ' + JSON.stringify(privateKeyBase58));
  }
  let privateKeyBytes;
  try {
    privateKeyBytes = bs58.decode(privateKeyBase58);
  } catch (e) {
    throw new Error('Failed to decode base58 private key: ' + e.message);
  }
  if (privateKeyBytes.length !== 64) {
    throw new Error(`Invalid private key format: length ${privateKeyBytes.length}`);
  }
  return Keypair.fromSecretKey(privateKeyBytes);
}
// Helper: Fetch prices
async function fetchPrices() {
  const [pool] = await fetch("https://amm-v2.meteora.ag/pools?address=3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33").then((r)=>r.json());
  // pool: [SMP, SOL]
  const smpAmount = parseFloat(pool.pool_token_amounts[0]);
  const solAmount = parseFloat(pool.pool_token_amounts[1]);
  const smpUsdAmount = parseFloat(pool.pool_token_usd_amounts[0]);
  const solUsdAmount = parseFloat(pool.pool_token_usd_amounts[1]);
  return {
    smpPerUsd: smpAmount / smpUsdAmount,
    solPerUsd: solAmount / solUsdAmount
  };
}
async function createPaymentTransaction({ paymentMint, paymentAmount, user, author }) {
  const [authorAmount, treasuryAmount, squadsAmount, burnAmount] = splitAmountWithResidual(paymentAmount, [
    30,
    30,
    25,
    15
  ]);
  const instructions = [];
  const userPublicKey = "publicKey" in user ? user.publicKey : user;
  if (!paymentMint) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: author,
        lamports: authorAmount
      }),
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: TREASURY_WALLET,
        lamports: treasuryAmount + burnAmount
      }),
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: SQUADS_WALLET,
        lamports: squadsAmount
      })
    );
  } else {
    const userAta = getAssociatedTokenAddressSync(paymentMint, userPublicKey);
    const authorAta = getAssociatedTokenAddressSync(paymentMint, author);
    const treasuryAta = getAssociatedTokenAddressSync(paymentMint, TREASURY_WALLET, true);
    const squadsAta = getAssociatedTokenAddressSync(paymentMint, SQUADS_WALLET, true);

    const [userAtaInfo, authorAtaInfo, treasuryAtaInfo, squadsAtaInfo] = await connection.getMultipleAccountsInfo([
      userAta,
      authorAta,
      treasuryAta,
      squadsAta,
    ]);

    if (!userAtaInfo) {
      console.error('[unlock-chapter] User ATA missing:', userAta.toBase58());
      throw new Error('User wallet is missing associated token account (ATA) for this token. Please create it first.');
    }
    let reroutedToTreasury = 0;
    // Author
    let authorDestAta = authorAta;
    let authorDestAmount = authorAmount;
    if (!authorAtaInfo) {
      console.warn('[unlock-chapter] Author ATA missing:', authorAta.toBase58(), 'Rerouting author share to treasury.');
      reroutedToTreasury += authorAmount;
      authorDestAta = null;
      authorDestAmount = 0;
    }
    // Squads
    let squadsDestAta = squadsAta;
    let squadsDestAmount = squadsAmount;
    if (!squadsAtaInfo) {
      console.warn('[unlock-chapter] Squads ATA missing:', squadsAta.toBase58(), 'Rerouting squads share to treasury.');
      reroutedToTreasury += squadsAmount;
      squadsDestAta = null;
      squadsDestAmount = 0;
    }
    // Treasury must exist
    if (!treasuryAtaInfo) {
      console.error('[unlock-chapter] Treasury ATA missing:', treasuryAta.toBase58());
      throw new Error('Treasury wallet is missing associated token account (ATA) for this token. Please contact support.');
    }
    // Build transfer instructions
    if (authorDestAta && authorDestAmount > 0) {
      instructions.push(createTransferInstruction(userAta, authorDestAta, userPublicKey, authorDestAmount));
    }
    if (squadsDestAta && squadsDestAmount > 0) {
      instructions.push(createTransferInstruction(userAta, squadsDestAta, userPublicKey, squadsDestAmount));
    }
    // Treasury gets its share + any rerouted shares
    const totalTreasuryAmount = treasuryAmount + burnAmount + reroutedToTreasury;
    if (totalTreasuryAmount > 0) {
      instructions.push(createTransferInstruction(userAta, treasuryAta, userPublicKey, totalTreasuryAmount));
    }
    if (paymentMint.equals(SMP_MINT_ADDRESS)) {
      instructions.push(createBurnInstruction(userAta, paymentMint, userPublicKey, burnAmount));
    }
  }

  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = userPublicKey;
  return tx;
}
function splitAmountWithResidual(amount, ratios) {
  const totalRatio = ratios.reduce((a, b)=>a + b, 0);
  const r = [];
  let runningTotal = 0;
  for(let i = 0; i < ratios.length - 1; i++){
    r[i] = Math.floor(amount * ratios[i] / totalRatio);
    runningTotal += r[i];
  }
  r[ratios.length - 1] = amount - runningTotal;
  return r;
}
// Main handler
serve(async (req) => {
  try {
    console.log('[unlock-chapter] Incoming request');
    if (!airdropKeypair) {
      console.error('[unlock-chapter] Airdrop wallet not configured');
      return Response.json({
        error: "Airdrop wallet not configured"
      }, {
        status: 500
      });
    }
    const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jwt) {
      console.error('[unlock-chapter] Authorization header missing');
      return Response.json(JSON.stringify({
        error: "authorization header missing"
      }), {
        status: 403,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const jwtBody = JSON.parse(new TextDecoder().decode(decodeBase64(jwt.split(".")[1])));
    console.log('[unlock-chapter] JWT body:', jwtBody);
    if (typeof jwtBody?.email != "string") {
      console.error('[unlock-chapter] Authorization header missing email');
      return Response.json({
        error: "authorization header missing email"
      }, {
        status: 400
      });
    }
    const { data: userData, error } = await supabaseAdmin.from("users").select("id").eq("email", jwtBody.email).maybeSingle();
    if (!userData) {
      console.error('[unlock-chapter] Could not find user with email:', jwtBody.email, error);
      return Response.json({
        error: `could not find user with email ${jwtBody.email}: ` + error?.message
      }, {
        status: 400
      });
    }
    const { novelId, chapterId, paymentType, currency } = await req.json();
    console.log('[unlock-chapter] Parsed body:', { novelId, chapterId, paymentType, currency });
    if (!novelId || !chapterId || !paymentType || !currency) {
      console.error('[unlock-chapter] Missing required fields in request:', { novelId, chapterId, paymentType, currency });
      return Response.json({
        error: "Missing required fields"
      }, {
        status: 400
      });
    }
    // Always resolve user keypair from DB
    console.log('[unlock-chapter] Fetching user keypair from DB for user_id:', userData.id);
    const userKeypair = await getUserPrivateKey(userData.id);
    const user = userKeypair.publicKey;
    console.log('[unlock-chapter] Loaded user keypair for user:', user.toBase58());
    // Validate novel and fetch chapter data
    const novel = await supabaseAdmin.from("novels").select("id, user_id, chaptertitles, advance_chapters").eq("id", novelId).maybeSingle().then(throwOnError);
    console.log('[unlock-chapter] Loaded novel:', novelId, 'advance_chapters:', novel.advance_chapters);
    // Validate chapter existence
    const chapterIndex = chapterId - 1; // 1-based chapterNumber, 0-based array index
    if (!novel?.chaptertitles?.[chapterIndex]) {
      console.error('[unlock-chapter] No chapter found for novelId:', novelId, 'chapterNumber:', chapterId);
      return Response.json({
        error: "Chapter not found"
      }, {
        status: 404
      });
    }
    // Determine if chapter is advance
    let isAdvance = false;
    if (Array.isArray(novel.advance_chapters)) {
      const advanceChapter = novel.advance_chapters.find((ch)=>ch.index === chapterIndex);
      if (advanceChapter) {
        isAdvance = advanceChapter.is_advance;
        if (advanceChapter.free_release_date && new Date(advanceChapter.free_release_date) <= new Date()) {
          isAdvance = false;
        }
      }
    }
    console.log('[unlock-chapter] Chapter', chapterId, 'isAdvance:', isAdvance);
    // Validate payment type based on advance status
    if (isAdvance && paymentType === "SINGLE") {
      console.error('[unlock-chapter] Locked chapter requires 3CHAPTERS or FULL payment');
      return new Response(JSON.stringify({
        error: "Locked chapter requires 3CHAPTERS or FULL payment"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (!isAdvance && paymentType !== "SINGLE") {
      console.error('[unlock-chapter] Non-locked chapter requires SINGLE payment');
      return new Response(JSON.stringify({
        error: "Non-locked chapter requires SINGLE payment"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Get author wallet
    const authorData = await supabaseAdmin.from("users").select("wallet_address").eq("id", novel.user_id).maybeSingle().then(throwOnError);
    if (!authorData) throw new Error(`could not load author data for ${novel.user_id}`);
    const author = new PublicKey(authorData.wallet_address);
    console.log('[unlock-chapter] Author wallet:', author.toBase58());
    let usdAmount = 0;
    switch(paymentType){
      case "SINGLE":
        usdAmount = 0.025;
        break;
      case "3CHAPTERS":
        usdAmount = 0.025;
        break;
      case "FULL":
        usdAmount = 0.025;
        break;
      default:
        console.error('[unlock-chapter] Invalid payment type:', paymentType);
        return Response.json({
          error: `Invalid payment type: ${paymentType}`
        }, {
          status: 400
        });
    }
    // Fetch prices
    let paymentMint = null;
    let paymentAmount = 0;
    if (currency == "USDC") {
      paymentMint = USDC_MINT_ADDRESS;
      paymentAmount = Math.floor(usdAmount * 1e6);
      console.log('[unlock-chapter] Payment in USDC:', paymentAmount, 'mint:', paymentMint.toBase58());
    } else {
      const { smpPerUsd, solPerUsd } = await fetchPrices();
      console.log('[unlock-chapter] Prices:', { smpPerUsd, solPerUsd });
      if (currency == "SOL") {
        paymentAmount = Math.floor(usdAmount * solPerUsd * 1e9);
        console.log('[unlock-chapter] Payment in SOL:', paymentAmount, 'lamports');
      } else if (currency == "SMP") {
        paymentMint = SMP_MINT_ADDRESS;
        paymentAmount = Math.floor(usdAmount * smpPerUsd * 1e6);
        console.log('[unlock-chapter] Payment in SMP:', paymentAmount, 'mint:', paymentMint.toBase58());
      } else {
        console.error('[unlock-chapter] Invalid currency:', currency);
        return Response.json({
          error: `Invalid currency: ${currency}`
        }, {
          status: 400
        });
      }
    }
    // Check balances
    const userSolBalance = await connection.getBalance(user);
    const rentExempt = await connection.getMinimumBalanceForRentExemption(165); // 165 is the size of a token account
    const feeEstimate = 10000; // Add a little extra for transaction fees
    const minRequired = rentExempt + feeEstimate;
    console.log('[unlock-chapter] User SOL balance:', userSolBalance, 'lamports', userSolBalance / LAMPORTS_PER_SOL, 'SOL');
    console.log('[unlock-chapter] Rent-exempt minimum:', rentExempt, 'lamports', rentExempt / LAMPORTS_PER_SOL, 'SOL');
    console.log('[unlock-chapter] Fee estimate:', feeEstimate, 'lamports');
    console.log('[unlock-chapter] Minimum required:', minRequired, 'lamports', minRequired / LAMPORTS_PER_SOL, 'SOL');
    if (userSolBalance < minRequired) {
      console.error('[unlock-chapter] Insufficient SOL for transaction fees and account creation. User has', userSolBalance, 'needs', minRequired);
      throw new Error(
        `Insufficient SOL for transaction fees and account creation. You have ${(userSolBalance / 1e9).toFixed(6)} SOL, but need at least ${(minRequired / 1e9).toFixed(6)} SOL.`
      );
    }
    if (paymentMint) {
      const userAta = getAssociatedTokenAddressSync(paymentMint, user);
      let userBalance = 0;
      try {
        userBalance = await getAccount(connection, userAta).then((a)=>Number(a.amount));
        console.log('[unlock-chapter] User token balance:', userBalance, 'mint:', paymentMint.toBase58());
      } catch (e) {
        console.warn('[unlock-chapter] Could not fetch user token account:', e.message);
      }
      if (userBalance < paymentAmount) {
        console.error('[unlock-chapter] Insufficient token balance. User has', userBalance, 'needs', paymentAmount);
        return Response.json({
          error: `Insufficient ${paymentMint} balance`
        }, {
          status: 400
        });
      }
    }
    const instructions = [];
    console.log('[unlock-chapter] Building transaction...');
    // Build transaction
    const tx = await createPaymentTransaction({
      paymentMint,
      paymentAmount,
      author,
      user: userKeypair
    });
    console.log('[unlock-chapter] Transaction built. Instructions:', tx.instructions.length);
    const blockhashInfo = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhashInfo.blockhash;
    tx.feePayer = userKeypair.publicKey;
    console.log('[unlock-chapter] Sending and confirming transaction...');
    const signature = await sendAndConfirmTransaction(connection, tx, [userKeypair], {
      skipPreflight: false
    });
    console.log('[unlock-chapter] Transaction confirmed. Signature:', signature);
    // update database
    console.log('[unlock-chapter] Inserting chapter payment record...');
    await supabaseAdmin.from("chapter_payments").insert({
      wallet_address: user.toBase58(),
      novel_id: novelId,
      chapter_number: chapterId,
      amount: paymentAmount,
      currency,
      payment_type: paymentType,
      transaction_id: signature,
      decimals: currency === "SOL" ? 9 : 6
    }).then(throwOnError);
    // record unlock
    if (paymentType == "SINGLE") {
      console.log('[unlock-chapter] Upserting unlocked_story_chapters for SINGLE payment...');
      await supabaseAdmin.from("unlocked_story_chapters").upsert({
        user_id: userData.id,
        story_id: novelId,
        purchase_start_chapter: chapterId
      }).then(throwOnError);
    } else {
      const chaptersToUnlock = paymentType === "3CHAPTERS" ? 3 : -1;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      console.log('[unlock-chapter] Upserting unlocked_story_chapters for subscription payment...');
      await supabaseAdmin.from("unlocked_story_chapters").upsert({
        user_id: userData.id,
        story_id: novelId,
        purchase_start_chapter: chapterId,
        chapter_unlocked_till: chaptersToUnlock === -1 ? -1 : chapterId + chaptersToUnlock - 1,
        expires_at: expiresAt.toISOString()
      }).then(throwOnError);
    }
    // Award weekly_points after successful payment
    let pointsToAdd = 0;
    if (paymentType === "SINGLE") {
      pointsToAdd = 100;
    } else if (paymentType === "3CHAPTERS" || paymentType === "FULL") {
      pointsToAdd = 1000;
    }
    if (pointsToAdd > 0) {
      console.log(`[unlock-chapter] Awarding ${pointsToAdd} weekly_points to user ${userData.id}`);
      await supabaseAdmin.rpc('increment_weekly_points', {
        user_id: userData.id,
        points: pointsToAdd
      });
    }
    console.log('[unlock-chapter] All DB updates complete. Returning success.');
    return Response.json({
      success: true,
      signature,
    });
  } catch (error) {
    console.error("[unlock-chapter] An unexpected error occurred:", error);
    return Response.json(
      {
        error: "An internal server error occurred.",
        details: error.message,
      },
      { status: 500 },
    );
  }
});
