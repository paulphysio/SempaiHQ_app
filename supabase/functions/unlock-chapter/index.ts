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
const TREASURY_WALLET = new PublicKey("9JA3f2Nwx9wpgh2wAg8KQv2bSQGRvYwvyQbgTyPmB8nc");
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
  const { privateKey } = await supabaseAdmin.functions.invoke("wallet-encryption", {
    body: {
      action: "decrypt",
      data: wallet.private_key
    }
  }).then(throwOnError);
  return Keypair.fromSecretKey(bs58.decode(privateKey));
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
  // sol
  if (!paymentMint) {
    instructions.push(// author
    SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: author,
      lamports: authorAmount
    }), // treasury + burn
    SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: TREASURY_WALLET,
      lamports: treasuryAmount + burnAmount
    }), // squads
    SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: SQUADS_WALLET,
      lamports: squadsAmount
    }));
  } else {
    const userAta = getAssociatedTokenAddressSync(paymentMint, userPublicKey);
    const authorAta = getAssociatedTokenAddressSync(paymentMint, author);
    const treasuryAta = getAssociatedTokenAddressSync(paymentMint, TREASURY_WALLET, true);
    const squadsAta = getAssociatedTokenAddressSync(paymentMint, SQUADS_WALLET, true);

    const [authorAtaInfo, treasuryAtaInfo, squadsAtaInfo] = await connection.getMultipleAccountsInfo([
      authorAta,
      treasuryAta,
      squadsAta,
    ]);

    if (!authorAtaInfo) {
      instructions.push(createAssociatedTokenAccountInstruction(userPublicKey, authorAta, author, paymentMint));
    }
    if (!treasuryAtaInfo) {
      instructions.push(createAssociatedTokenAccountInstruction(userPublicKey, treasuryAta, TREASURY_WALLET, paymentMint));
    }
    if (!squadsAtaInfo) {
      instructions.push(createAssociatedTokenAccountInstruction(userPublicKey, squadsAta, SQUADS_WALLET, paymentMint));
    }

    if (paymentMint.equals(USDC_MINT_ADDRESS)) {
      instructions.push(
        createTransferInstruction(userAta, authorAta, userPublicKey, authorAmount),
        createTransferInstruction(userAta, treasuryAta, userPublicKey, treasuryAmount + burnAmount),
        createTransferInstruction(userAta, squadsAta, userPublicKey, squadsAmount),
      );
    } else if (paymentMint.equals(SMP_MINT_ADDRESS)) {
      instructions.push(
        createTransferInstruction(userAta, authorAta, userPublicKey, authorAmount),
        createTransferInstruction(userAta, treasuryAta, userPublicKey, treasuryAmount),
        createTransferInstruction(userAta, squadsAta, userPublicKey, squadsAmount),
        createBurnInstruction(userAta, paymentMint, userPublicKey, burnAmount),
      );
    } else {
      throw new Error(`Unsupported payment mint: ${paymentMint.toBase58()}`);
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
  if (!airdropKeypair) {
    return Response.json({
      error: "Airdrop wallet not configured"
    }, {
      status: 500
    });
  }
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jwt) return Response.json(JSON.stringify({
    error: "authorization header missing"
  }), {
    status: 403,
    headers: {
      "Content-Type": "application/json"
    }
  });
  const jwtBody = JSON.parse(new TextDecoder().decode(decodeBase64(jwt.split(".")[1])));
  if (typeof jwtBody?.email != "string") return Response.json({
    error: "authorization header missing email"
  }, {
    status: 400
  });
  const { data: userData, error } = await supabaseAdmin.from("users").select("id").eq("email", jwtBody.email).maybeSingle();
  if (!userData) {
    console.error(error);
    return Response.json({
      error: `could not find user with email ${jwtBody.email}: ` + error?.message
    }, {
      status: 400
    });
  }
  const { userPublicKey, novelId, chapterId, paymentType, currency } = await req.json();
  if (!novelId || !chapterId || !paymentType || !currency) {
    console.error("Missing required fields in request:", {
      userPublicKey,
      novelId,
      chapterId,
      paymentType,
      currency
    });
    return Response.json({
      error: "Missing required fields"
    }, {
      status: 400
    });
  }
  let user;
  let userKeypair = null;
  if (userPublicKey) {
    user = new PublicKey(userPublicKey);
  } else {
    userKeypair = await getUserPrivateKey(userData.id);
    user = userKeypair.publicKey;
  }
  if (!userKeypair) {
    const airdropBalance = await connection.getBalance(airdropKeypair.publicKey);
    if (airdropBalance < 1_000_000) {
      return Response.json({
        error: "Airdrop wallet has insufficient SOL"
      }, {
        status: 500
      });
    }
  }
  // Validate novel and fetch chapter data
  const novel = await supabaseAdmin.from("novels").select("id, user_id, chaptertitles, advance_chapters").eq("id", novelId).maybeSingle().then(throwOnError);
  // Validate chapter existence
  const chapterIndex = chapterId - 1; // 1-based chapterNumber, 0-based array index
  if (!novel?.chaptertitles?.[chapterIndex]) {
    console.error("No chapter found for novelId:", novelId, "chapterNumber:", chapterId);
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
  // Validate payment type based on advance status
  if (isAdvance && paymentType === "SINGLE") {
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
  } else {
    const { smpPerUsd, solPerUsd } = await fetchPrices();
    if (currency == "SOL") {
      paymentAmount = Math.floor(usdAmount * solPerUsd * 1e9);
    } else if (currency == "SMP") {
      paymentMint = SMP_MINT_ADDRESS;
      paymentAmount = Math.floor(usdAmount * smpPerUsd * 1e6);
    } else {
      return Response.json({
        error: `Invalid currency: ${currency}`
      }, {
        status: 400
      });
    }
  }
  // Check balances
  if (!userKeypair) {
    const userSolBalance = await connection.getBalance(user);
    const minSolRequired = 1_000_000 + (currency == "SOL" ? paymentAmount : 0);
    if (userSolBalance < minSolRequired) {
      return Response.json({
        error: "Insufficient SOL for fees " + `(need ${(minSolRequired / LAMPORTS_PER_SOL).toFixed(4)} SOL)`
      }, {
        status: 400
      });
    }
  }
  if (paymentMint) {
    const userAta = getAssociatedTokenAddressSync(paymentMint, user);
    const userBalance = await getAccount(connection, userAta).then((a)=>Number(a.amount)).catch(()=>0);
    if (userBalance < paymentAmount) {
      return Response.json({
        error: `Insufficient ${paymentMint} balance`
      }, {
        status: 400
      });
    }
  }
  const instructions = [];



  // Build transaction
  const tx = await createPaymentTransaction({
    paymentMint,
    paymentAmount,
    author,
    user: userKeypair ?? user
  });

  const blockhashInfo = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhashInfo.blockhash;

  // user is sending the transaction
  if (!userKeypair) {
    return Response.json({
      serializedTx: tx.serialize({ requireAllSignatures: false }).toString("base64"),
      blockhashInfo,
    });
  }
  tx.recentBlockhash = PublicKey.default.toBase58();
  tx.feePayer = userKeypair.publicKey;
  const signature = await sendAndConfirmTransaction(connection, tx, [userKeypair], {
    skipPreflight: false
  });
  // update database
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
    await supabaseAdmin.from("unlocked_story_chapters").upsert({
      user_id: userData.id,
      story_id: novelId,
      purchase_start_chapter: chapterId
    }).then(throwOnError);
  } else {
    const chaptersToUnlock = paymentType === "3CHAPTERS" ? 3 : -1;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await supabaseAdmin.from("unlocked_story_chapters").upsert({
      user_id: userData.id,
      story_id: novelId,
      purchase_start_chapter: chapterId,
      chapter_unlocked_till: chaptersToUnlock === -1 ? -1 : chapterId + chaptersToUnlock - 1,
      expires_at: expiresAt.toISOString()
    }).then(throwOnError);
  }
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
