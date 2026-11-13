import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Verifies the caller's JWT against Supabase Auth (signature-checked).
async function authenticate(req: Request) {
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jwt) return { error: json({ error: "Authorization header missing" }, 401) };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !authData?.user) {
    return { error: json({ error: "Invalid or expired session" }, 401) };
  }

  const email = authData.user.email;
  if (!email) return { error: json({ error: "Account has no email address" }, 403) };

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, email, wallet_address, isSuperuser")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!user) return { error: json({ error: "User profile not found" }, 404) };

  return { user };
}

// ---------- Payment verification (inlined; was _shared/verify.ts) ----------
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SMP_MINT = "SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor";
const HQ_WALLET = "71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD";
const SMP_DECIMALS = 6;
const SOL_TOLERANCE = 0.05; // allowed SOL/USD drift between client quote and server check

type Failure = { ok: false; error: string; status: number };
type Success = { ok: true; author: number; platform: number };

const fail = (error: string, status = 400): Failure => ({ ok: false, error, status });

function memoTexts(tx: any): string[] {
  const out: string[] = [];
  for (const ix of tx?.transaction?.message?.instructions || []) {
    if ((ix?.program === "spl-memo" || ix?.programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr") && typeof ix?.parsed === "string") {
      out.push(ix.parsed);
    }
  }
  return out;
}

// SOL lamports sent from `source` to `destination` (top-level + inner instructions).
function sumSolTo(tx: any, destination: string, source: string): number {
  const ixs: any[] = [...(tx?.transaction?.message?.instructions || [])];
  for (const g of tx?.meta?.innerInstructions || []) ixs.push(...(g.instructions || []));
  let total = 0;
  for (const ix of ixs) {
    const p = ix?.parsed;
    if (ix?.program === "system" && p?.type === "transfer" && p.info?.destination === destination && p.info?.source === source) {
      total += Number(p.info.lamports || 0);
    }
  }
  return total;
}

// Token base units RECEIVED by `owner` in this tx (post - pre per account).
function sumTokenTo(tx: any, mint: string, owner: string): number {
  const pre = new Map<string, number>();
  for (const b of tx?.meta?.preTokenBalances || []) {
    if (b?.mint === mint) pre.set(String(b.accountIndex), Number(b?.uiTokenAmount?.amount || 0));
  }
  let total = 0;
  for (const b of tx?.meta?.postTokenBalances || []) {
    if (b?.mint !== mint || b?.owner !== owner) continue;
    const delta = Number(b?.uiTokenAmount?.amount || 0) - (pre.get(String(b.accountIndex)) || 0);
    if (delta > 0) total += delta;
  }
  return total;
}

function verifyPayment(p: {
  tx: any;
  type: "purchase" | "lend";
  currency: string;
  book: { id: string; price_usd: number | string; author_share_pct: number; lend_price_smp: number | string };
  authorWallet: string;
  buyerWallet: string;
  solPriceUsd: number | null;
}): Success | Failure {
  const { tx, type, currency, book, authorWallet, buyerWallet, solPriceUsd } = p;
  if (tx?.meta?.err) return fail("Transaction failed on-chain");

  const keys = tx?.transaction?.message?.accountKeys;
  const feePayer = keys?.[0]?.pubkey ?? keys?.[0];
  if (feePayer !== buyerWallet) return fail("Transaction fee payer does not match your wallet");

  const expectedMemo = `bazaar:${book.id}:${type}`;
  if (!memoTexts(tx).includes(expectedMemo)) {
    return fail("Payment is not tagged for this book (memo missing or wrong).");
  }

  const share = Number(book.author_share_pct);
  const priceUsd = Number(book.price_usd);

  if (type === "lend") {
    if (currency !== "SMP") return fail("Lending currency must be SMP");
    const expected = Math.floor(Number(book.lend_price_smp) * 10 ** SMP_DECIMALS);
    const hq = sumTokenTo(tx, SMP_MINT, HQ_WALLET);
    if (hq < expected) return fail("Lending payment is short. The full SMP amount must reach the platform wallet.");
    return { ok: true, author: 0, platform: hq / 10 ** SMP_DECIMALS };
  }

  if (currency === "USDC") {
    const expected = Math.round(priceUsd * 1e6);
    const expAuthor = Math.floor((expected * share) / 100);
    const expHq = expected - expAuthor;
    const a = sumTokenTo(tx, USDC_MINT, authorWallet);
    const h = sumTokenTo(tx, USDC_MINT, HQ_WALLET);
    if (a < expAuthor || h < expHq) return fail("USDC payment or split is incorrect.");
    return { ok: true, author: a / 1e6, platform: h / 1e6 };
  }

  if (currency === "SOL") {
    if (!solPriceUsd) return fail("Could not check the SOL price. Try again in a moment.", 503);
    const expectedLamports = (priceUsd / solPriceUsd) * 1e9;
    const a = sumSolTo(tx, authorWallet, buyerWallet);
    const h = sumSolTo(tx, HQ_WALLET, buyerWallet);
    const total = a + h;
    if (total < expectedLamports * (1 - SOL_TOLERANCE)) return fail("SOL payment is below the book price.");
    const tol = Math.max(2, total * 0.01);
    if (a < (total * share) / 100 - tol || h < (total * (100 - share)) / 100 - tol) {
      return fail("SOL payment split is incorrect.");
    }
    return { ok: true, author: a / 1e9, platform: h / 1e9 };
  }

  return fail("Purchase currency must be SOL or USDC");
}
// ---------- End payment verification ----------

const RPC_URL =
  Deno.env.get("SOLANA_RPC_URL") ||
  Deno.env.get("HELIUS_RPC_URL") ||
  Deno.env.get("KAIJI_RPC_URL") ||
  "https://api.mainnet-beta.solana.com";

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  return data.result;
}

// Retry briefly for propagation lag after the client confirms.
async function getTransaction(signature: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const tx = await rpcCall("getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
      ]);
      if (tx) return tx;
    } catch (e: any) {
      console.warn(`[purchase] getTransaction attempt ${attempt} failed:`, e?.message);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

// Server-side SOL/USD (60s cache). Never trust a client-supplied price.
let solCache: { price: number; at: number } | null = null;
async function getSolPriceUsd(): Promise<number | null> {
  if (solCache && Date.now() - solCache.at < 60_000) return solCache.price;
  const SOL = "So11111111111111111111111111111111111111112";
  const sources: Array<() => Promise<number | null>> = [
    async () => {
      const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL}`, { signal: AbortSignal.timeout(4000) });
      return (await r.json())?.[SOL]?.usdPrice ?? null;
    },
    async () => {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {
        signal: AbortSignal.timeout(4000),
      });
      return (await r.json())?.solana?.usd ?? null;
    },
  ];
  for (const src of sources) {
    try {
      const p = Number(await src());
      if (p > 0) {
        solCache = { price: p, at: Date.now() };
        return p;
      }
    } catch (e: any) {
      console.warn("[purchase] price source failed:", e?.message);
    }
  }
  return solCache?.price ?? null;
}

serve(async (req) => {
  try {
    const auth = await authenticate(req);
    if (auth.error) return auth.error;
    const buyer = auth.user!;

    const { bookId, currency, signature, walletAddress, accessType } = await req.json();
    if (!bookId || !currency || !signature || !walletAddress) {
      return json({ error: "Missing required fields (bookId, currency, signature, walletAddress)" }, 400);
    }
    const type: "purchase" | "lend" = accessType === "lend" ? "lend" : "purchase";
    if (type === "purchase" && !["SOL", "USDC"].includes(currency)) {
      return json({ error: "Purchase currency must be SOL or USDC" }, 400);
    }
    if (type === "lend" && currency !== "SMP") return json({ error: "Lending currency must be SMP" }, 400);

    // The paying wallet must be the signed-in user's wallet.
    if (!buyer.wallet_address || buyer.wallet_address !== walletAddress) {
      return json({ error: "Wallet does not match your account" }, 403);
    }

    // Idempotency: a signature can only ever belong to one buyer.
    const { data: existing } = await supabaseAdmin
      .from("bazaar_purchases")
      .select("id, buyer_id")
      .eq("tx_signature", signature)
      .maybeSingle();
    if (existing) {
      if (existing.buyer_id !== buyer.id) return json({ error: "This transaction was already used" }, 409);
      return json({ success: true, purchaseId: existing.id, message: "Already recorded" });
    }

    const { data: book, error: bookError } = await supabaseAdmin
      .from("bazaar_books")
      .select("id, author_id, status, price_usd, author_share_pct, ownership_confirmed, sale_enabled, lending_enabled, lend_price_smp")
      .eq("id", bookId)
      .maybeSingle();
    if (bookError) throw new Error(bookError.message);
    if (!book) return json({ error: "Book not found" }, 404);
    if (book.status !== "active") return json({ error: "Book is not available" }, 400);
    if (type === "purchase" && !(book.sale_enabled && book.ownership_confirmed)) {
      return json({ error: "This book is not for sale" }, 400);
    }
    if (type === "lend" && !book.lending_enabled) {
      return json({ error: "This book is not available for lending" }, 400);
    }
    if (book.author_id === buyer.id) return json({ error: "Authors already own their books" }, 400);

    const { data: author } = await supabaseAdmin
      .from("users")
      .select("wallet_address")
      .eq("id", book.author_id)
      .maybeSingle();
    if (!author?.wallet_address) return json({ error: "Author wallet not found" }, 500);
    if (author.wallet_address === HQ_WALLET) return json({ error: "Invalid author wallet" }, 500);

    const tx = await getTransaction(signature);
    if (!tx) return json({ error: "Transaction not found on-chain yet. Try again in a few seconds.", retriable: true }, 503);

    const solPriceUsd = currency === "SOL" ? await getSolPriceUsd() : null;
    const result = verifyPayment({
      tx,
      type,
      currency,
      book,
      authorWallet: author.wallet_address,
      buyerWallet: walletAddress,
      solPriceUsd,
    });
    if (!result.ok) {
      console.warn("[purchase] verification failed:", { signature, currency, type, error: result.error });
      return json({ error: result.error, retriable: result.status === 503 }, result.status);
    }

    const { data: purchase, error: insertError } = await supabaseAdmin
      .from("bazaar_purchases")
      .insert({
        book_id: book.id,
        buyer_id: buyer.id,
        buyer_wallet: walletAddress,
        access_type: type,
        currency,
        price_usd: type === "lend" ? 0 : book.price_usd,
        author_share_pct: book.author_share_pct,
        author_amount: result.author,
        platform_amount: result.platform,
        tx_signature: signature,
        verification_status: "verified",
        status: "completed",
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: dup } = await supabaseAdmin.from("bazaar_purchases").select("id").eq("tx_signature", signature).single();
        return json({ success: true, purchaseId: dup?.id, message: "Already recorded" });
      }
      throw new Error(insertError.message);
    }
    console.log(`[purchase] book ${book.id} -> buyer ${buyer.id} (${currency}/${type}) sig=${signature}`);
    return json({ success: true, purchaseId: purchase.id });
  } catch (error: any) {
    console.error("[purchase-bazaar-book] Error:", error?.message);
    return json({ error: error?.message || "Internal server error" }, 500);
  }
});
