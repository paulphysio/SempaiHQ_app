// deno-lint-ignore-file no-explicit-any
// ════════════════════════════════════════════════════════════════════════
// reader-actions — the server side of things the app used to decide itself
// (Phase 3). The app sends { action, ...params } with the reader's sign-in;
// this function checks the rules and writes with the server key.
//
//   ad_unlock            one free (ad-watched) chapter per reader per day
//   comment_reward       points for commenting (10 rewarded comments / day)
//   comment_notify       tell the parent comment's author / the title's creator
//   notify_readers       creator → their readers (new chapter, new title, …)
//   announcement_notify  deliver an announcement (admins: everyone/audience;
//                        creators: their readers)
//   referral_bonus       +100 points to a new reader and their inviter, once
//   subscription_access  use a writer subscription for one chapter
//   benefactor_activate  verify a writer-subscription payment on-chain, activate
//   reward_timer_reset   restart the weekly reward countdown when it's due
// ════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import bs58 from "https://esm.sh/bs58@5.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) || "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const RPC_ENDPOINT = Deno.env.get("RPC_URL") || Deno.env.get("SOLANA_RPC_URL") ||
  Deno.env.get("HELIUS_RPC_URL") || "https://api.mainnet-beta.solana.com";
const PLATFORM_WALLET = "71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD";
const SYSTEM_USER = "6f859ff9-3557-473c-b8ca-f23fd9f7af27";
const MINTS: Record<string, string> = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  SKR: "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3",
  SOL: "So11111111111111111111111111111111111111112",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class Refuse extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const startOfUtcDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);
const uniq = (a: any[]) => [...new Set(a.filter(Boolean))];

// ─── who is calling ────────────────────────────────────────────────────────
async function caller(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Refuse("Please sign in first", 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Refuse("Please sign in first", 401);
  const authUser = data.user;

  let { data: row } = await admin.from("users")
    .select("id, name, wallet_address, weekly_points, referred_by, has_updated_profile, \"isSuperuser\", \"isWriter\", \"isArtist\"")
    .eq("id", authUser.id).maybeSingle();
  if (!row && authUser.email) {
    const { data: byEmail } = await admin.from("users")
      .select("id, name, wallet_address, weekly_points, referred_by, has_updated_profile, \"isSuperuser\", \"isWriter\", \"isArtist\"")
      .eq("email", authUser.email).limit(2);
    if (byEmail?.length === 1) row = byEmail[0];
  }
  if (!row) throw new Refuse("Account not found — please sign in again", 401);

  const { data: wallets } = await admin.from("user_wallets").select("address").eq("user_id", row.id);
  const myWallets = new Set(uniq([row.wallet_address, ...(wallets || []).map((w: any) => w.address)]));
  return { user: row, myWallets, isAdmin: !!row.isSuperuser };
}

// ─── helpers ───────────────────────────────────────────────────────────────
async function amethystOf(userId: string) {
  const { data } = await admin.from("amethyst_balances").select("amethyst_balance").eq("user_id", userId).maybeSingle();
  return Number(data?.amethyst_balance) || 0;
}

async function logEvent(row: Record<string, unknown>) {
  await admin.from("wallet_events").insert({
    source_user_id: SYSTEM_USER, source_chain: "SOL", destination_chain: "SOL",
    timestamp: new Date().toISOString(), ...row,
  });
}

/** Has an event with exactly these details been recorded? (used as a once-only marker) */
async function eventExists(details: string) {
  const { data } = await admin.from("wallet_events").select("id").eq("event_details", details).limit(1);
  return !!data?.length;
}

async function push(userIds: string[], title: string, body: string, data: Record<string, unknown> = {}) {
  if (!userIds.length) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ userIds, title, body, data }),
    });
  } catch (e: any) {
    console.warn("[reader-actions] push failed:", e?.message);
  }
}

async function insertNotifications(rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("notifications").insert(rows.slice(i, i + 500));
    if (error) console.warn("[reader-actions] notifications insert:", error.message);
  }
}

const CONTENT = {
  novel: { table: "novels", interactions: "novel_interactions", fk: "novel_id" },
  manga: { table: "manga", interactions: "manga_interactions", fk: "manga_id" },
} as const;

async function titleReaders(kind: "novel" | "manga", contentId: string) {
  const k = CONTENT[kind];
  const { data } = await admin.from(k.interactions).select("user_id").eq(k.fk, contentId);
  return uniq((data || []).map((r: any) => r.user_id));
}

async function creatorReaders(creatorId: string, excludeContentId?: string) {
  const ids: string[] = [];
  for (const kind of ["novel", "manga"] as const) {
    const k = CONTENT[kind];
    const { data: titles } = await admin.from(k.table).select("id").eq("user_id", creatorId);
    const titleIds = (titles || []).map((t: any) => t.id).filter((id: string) => id !== excludeContentId);
    for (let i = 0; i < titleIds.length; i += 100) {
      const { data: rows } = await admin.from(k.interactions).select("user_id").in(k.fk, titleIds.slice(i, i + 100));
      ids.push(...(rows || []).map((r: any) => r.user_id));
    }
  }
  return uniq(ids);
}

// ─── on-chain check for writer-subscription payments ──────────────────────
async function rpc(method: string, params: unknown[]) {
  const res = await fetch(RPC_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(10000),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

async function usdPrice(currency: string): Promise<number | null> {
  if (currency === "USDC") return 1;
  if (currency === "SMP") {
    // SMP isn't tradable on Jupiter — same price the app charges with.
    try {
      const r = await fetch("https://www.sempaihq.com/api/smp-fallback-price", { signal: AbortSignal.timeout(4000) });
      const perUsd = Number((await r.json())?.fallbackPrice);
      return Number.isFinite(perUsd) && perUsd > 0 ? 1 / perUsd : null;
    } catch { return null; }
  }
  if (!MINTS[currency]) return null;
  try {
    const mint = MINTS[currency];
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`, { signal: AbortSignal.timeout(4000) });
    const p = Number((await r.json())?.[mint]?.usdPrice);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch { return null; }
}

/** USD value the writer + platform received from `payer` in this transaction. */
async function verifiedUsdReceived(signature: string, payer: string, authorWallet: string, currency: string) {
  let tx: any = null;
  for (let i = 0; i < 5 && !tx; i++) {
    tx = await rpc("getTransaction", [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]).catch(() => null);
    if (!tx) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!tx) throw new Refuse("Payment not found on Solana yet — please try again in a minute", 503);
  if (tx.meta?.err) throw new Refuse("Payment transaction failed on-chain");
  if (tx.blockTime && Date.now() / 1000 - tx.blockTime > 24 * 3600) throw new Refuse("Payment transaction is too old");

  const keys = (tx.transaction?.message?.accountKeys || []).map((k: any) => (typeof k === "string" ? k : k.pubkey));
  if (keys[0] !== payer) throw new Refuse("Payment was not made by this wallet");

  const recipients = new Set([authorWallet, PLATFORM_WALLET].filter((w) => w !== payer));
  let raw = 0;
  let decimals = currency === "SOL" ? 9 : 6;
  if (currency === "SOL") {
    keys.forEach((k: string, i: number) => {
      if (recipients.has(k)) raw += (tx.meta.postBalances[i] ?? 0) - (tx.meta.preBalances[i] ?? 0);
    });
  } else {
    const mint = MINTS[currency];
    if (!mint) throw new Refuse("Unsupported currency");
    const pre = new Map<number, number>();
    for (const b of tx.meta?.preTokenBalances || []) if (b.mint === mint) pre.set(b.accountIndex, Number(b.uiTokenAmount?.amount || 0));
    for (const b of tx.meta?.postTokenBalances || []) {
      if (b.mint !== mint || !recipients.has(b.owner)) continue;
      decimals = b.uiTokenAmount?.decimals ?? decimals;
      raw += Number(b.uiTokenAmount?.amount || 0) - (pre.get(b.accountIndex) || 0);
    }
  }
  if (raw <= 0) throw new Refuse("This transaction didn't pay the writer");
  const price = await usdPrice(currency);
  return { usd: price ? (raw / 10 ** decimals) * price : null, raw };
}

// ─── actions ───────────────────────────────────────────────────────────────
type Ctx = Awaited<ReturnType<typeof caller>>;

const actions: Record<string, (ctx: Ctx, p: any) => Promise<unknown>> = {
  async ad_unlock({ user, myWallets }, p) {
    const novelId = String(p.novelId || "");
    const chapterNumber = parseInt(p.chapterNumber, 10);
    if (!novelId || !Number.isFinite(chapterNumber)) throw new Refuse("Missing chapter");
    const wallet = p.walletAddress ? String(p.walletAddress) : user.wallet_address;
    if (wallet && !myWallets.has(wallet)) throw new Refuse("That wallet isn't yours");

    const { data: today } = await admin.from("ad_based_unlocks").select("id")
      .eq("user_id", user.id).gte("ad_watched_at", startOfUtcDay()).limit(1);
    if (today?.length) throw new Refuse("You've already used today's free ad unlock — come back tomorrow", 429);

    const now = new Date().toISOString();
    const { error } = await admin.from("ad_based_unlocks").insert({
      user_id: user.id, novel_id: novelId, chapter_number: chapterNumber, unlocked_at: now, ad_watched_at: now,
    });
    if (error) throw new Error(error.message);
    if (wallet) {
      await admin.from("chapter_payments").insert({
        wallet_address: wallet, novel_id: novelId, chapter_number: chapterNumber, payment_type: "AD_BASED",
        currency: "FREE", amount: 0, transaction_id: `AD_UNLOCK_${user.id}_${Date.now()}`, created_at: now,
      });
    }
    return { unlocked: true };
  },

  async comment_reward({ user }, p) {
    const table = String(p.table || "");
    if (!["comments", "manga_comments", "manga_detail_comments"].includes(table)) throw new Refuse("Unknown comment type");
    const { data: c } = await admin.from(table).select("id, user_id, created_at, content").eq("id", p.commentId).maybeSingle();
    if (!c || c.user_id !== user.id) throw new Refuse("Comment not found");
    if (Date.now() - new Date(c.created_at).getTime() > 15 * 60 * 1000) throw new Refuse("Too late to reward this comment");
    if (String(c.content || "").trim().length < 2) return { rewarded: false, reason: "too_short" };

    const marker = `comment_reward:${table}:${c.id}`;
    if (await eventExists(marker)) return { rewarded: false, reason: "already" };
    const { count } = await admin.from("wallet_events").select("id", { count: "exact", head: true })
      .eq("destination_user_id", user.id).like("event_details", "comment_reward:%").gte("timestamp", startOfUtcDay());
    if ((count || 0) >= 10) return { rewarded: false, reason: "daily_limit" };

    const bal = await amethystOf(user.id);
    const points = bal >= 5e6 ? 25 : bal >= 1e6 ? 20 : bal >= 5e5 ? 17 : bal >= 2.5e5 ? 15 : bal >= 1e5 ? 12 : 10;
    await admin.rpc("increment_weekly_points", { user_id: user.id, points });
    await admin.from(table).update({ is_rewarded: true }).eq("id", c.id);
    await logEvent({ destination_user_id: user.id, event_type: "credit", amount_change: points, source_currency: "Token",
      event_details: marker, wallet_address: user.wallet_address });
    return { rewarded: true, points };
  },

  async comment_notify({ user }, p) {
    const table = String(p.table || "");
    if (!["comments", "manga_comments", "manga_detail_comments"].includes(table)) throw new Refuse("Unknown comment type");
    const { data: c } = await admin.from(table).select("*").eq("id", p.commentId).maybeSingle();
    if (!c || c.user_id !== user.id) throw new Refuse("Comment not found");
    if (Date.now() - new Date(c.created_at).getTime() > 15 * 60 * 1000) return { notified: 0 };

    const who = clip(user.name || "A reader", 40);
    const rows: Record<string, unknown>[] = [];
    const scope: Record<string, unknown> = {};
    let owner: string | null = null;
    let title = "";
    if (c.novel_id) {
      const { data: n } = await admin.from("novels").select("user_id, title").eq("id", c.novel_id).maybeSingle();
      owner = n?.user_id ?? null; title = n?.title || "";
      Object.assign(scope, { novel_id: c.novel_id, novel_title: title, ...(c.chapter != null ? { chapter: c.chapter } : {}) });
    } else if (c.manga_id) {
      const { data: m } = await admin.from("manga").select("user_id, title").eq("id", c.manga_id).maybeSingle();
      owner = m?.user_id ?? null; title = m?.title || "";
      Object.assign(scope, { manga_id: c.manga_id });
    }

    let parentAuthor: string | null = null;
    if (c.parent_id) {
      const { data: parent } = await admin.from(table).select("user_id").eq("id", c.parent_id).maybeSingle();
      parentAuthor = parent?.user_id ?? null;
      if (parentAuthor && parentAuthor !== user.id) {
        rows.push({ user_id: parentAuthor, type: "reply", message: `${who} replied to your comment${title ? ` on ${title}` : ""}`, comment_id: c.id, is_read: false, ...scope });
      }
    }
    if (p.notifyOwner && owner && owner !== user.id && owner !== parentAuthor) {
      rows.push({ user_id: owner, type: "comment", message: `${who} commented on ${title || "your work"}`, comment_id: c.id, is_read: false, ...scope });
    }
    await insertNotifications(rows);
    return { notified: rows.length };
  },

  async notify_readers({ user, isAdmin }, p) {
    const kind = p.kind === "manga" ? "manga" : "novel";
    const contentId = String(p.contentId || "");
    const { data: content } = await admin.from(CONTENT[kind].table).select("id, user_id, title").eq("id", contentId).maybeSingle();
    if (!content) throw new Refuse("Title not found");
    if (content.user_id !== user.id && !isAdmin) throw new Refuse("Only the creator can notify this title's readers", 403);

    const targets = (p.audience === "creator"
      ? await creatorReaders(content.user_id, contentId)
      : await titleReaders(kind, contentId)).filter((id) => id !== user.id);
    if (!targets.length) return { notified: 0 };

    const type = ["new_chapter", "new_novel", "new_manga", "new_title", "announcement", "update"].includes(p.type) ? p.type : "update";
    const message = clip(p.message || p.body || `New update on ${content.title}`, 300);
    const extra: Record<string, unknown> = kind === "novel"
      ? { novel_id: contentId, novel_title: content.title, ...(p.chapter != null ? { chapter: clip(p.chapter, 20) } : {}) }
      : { manga_id: contentId };
    await insertNotifications(targets.map((id) => ({ user_id: id, type, message, is_read: false, ...extra })));

    // Push "tap to open" data: only known keys, and the title id always comes from the server.
    const d = (p.data && typeof p.data === "object") ? p.data : {};
    const pushData: Record<string, string> = { type };
    if (kind === "novel") pushData.novelId = contentId; else pushData.mangaId = contentId;
    if (d.chapterId != null) pushData.chapterId = clip(d.chapterId, 40);
    await push(targets, clip(p.title || content.title, 80), clip(p.body || message, 180), pushData);
    return { notified: targets.length };
  },

  async announcement_notify({ user, isAdmin }, p) {
    const { data: a } = await admin.from("announcements").select("*").eq("id", p.announcementId).maybeSingle();
    if (!a) throw new Refuse("Announcement not found");
    if (a.user_id !== user.id && !isAdmin) throw new Refuse("Not your announcement", 403);

    let targets: string[] = [];
    if (a.is_superuser_announcement) {
      if (!isAdmin) throw new Refuse("Admins only", 403);
      let q = admin.from("users").select("id");
      if (a.audience === "writers") q = q.eq("isWriter", true);
      else if (a.audience === "artists") q = q.eq("isArtist", true);
      else if (a.audience === "creators") q = q.or("isWriter.eq.true,isArtist.eq.true");
      for (let from = 0; ; from += 1000) {
        const { data } = await q.range(from, from + 999);
        targets.push(...(data || []).map((r: any) => r.id));
        if (!data || data.length < 1000) break;
      }
    } else {
      targets = await creatorReaders(user.id);
    }
    targets = uniq(targets).filter((id) => id !== user.id);
    const message = clip(`${a.title}: ${a.message}`, 400);
    await insertNotifications(targets.map((id) => ({ user_id: id, type: "announcement", message, is_read: false })));
    await push(targets, clip(a.title, 80), clip(a.message, 180), { type: "announcement", announcementId: a.id });
    return { notified: targets.length };
  },

  async referral_bonus({ user }) {
    if (!user.referred_by) return { awarded: false, reason: "no_referrer" };
    const marker = `referral_bonus:${user.id}`;
    if (await eventExists(marker)) return { awarded: false, reason: "already" };

    // referred_by may hold the inviter's id or wallet address
    const ref = String(user.referred_by);
    const isUuid = /^[0-9a-f-]{36}$/i.test(ref);
    const { data: inviter } = await admin.from("users").select("id, wallet_address")
      .eq(isUuid ? "id" : "wallet_address", ref).maybeSingle();
    if (!inviter || inviter.id === user.id) return { awarded: false, reason: "bad_referrer" };

    await admin.rpc("increment_weekly_points", { user_id: user.id, points: 100 });
    await admin.rpc("increment_weekly_points", { user_id: inviter.id, points: 100 });
    await logEvent({ destination_user_id: user.id, event_type: "credit", amount_change: 100, source_currency: "Token",
      event_details: marker, wallet_address: user.wallet_address });
    await logEvent({ destination_user_id: inviter.id, event_type: "credit", amount_change: 100, source_currency: "Token",
      event_details: `referral_inviter:${user.id}`, wallet_address: inviter.wallet_address });
    return { awarded: true, points: 100 };
  },

  async subscription_access({ myWallets }, p) {
    const novelId = String(p.novelId || "");
    const chapterNumber = parseInt(p.chapterNumber, 10);
    const wallet = String(p.walletAddress || "");
    if (!myWallets.has(wallet)) throw new Refuse("That wallet isn't yours");
    const { data: novel } = await admin.from("novels").select("id, user_id").eq("id", novelId).maybeSingle();
    if (!novel || !Number.isFinite(chapterNumber)) throw new Refuse("Chapter not found");

    const { data: sub } = await admin.from("writer_subscriptions").select("*")
      .eq("benefactor_wallet", wallet).eq("writer_id", novel.user_id).eq("is_active", true).maybeSingle();
    if (!sub) return { access: false };
    if (sub.expires_at && new Date(sub.expires_at) <= new Date()) {
      await admin.from("writer_subscriptions").update({ is_active: false }).eq("id", sub.id);
      return { access: false, reason: "expired" };
    }
    const { data: seen } = await admin.from("writer_access_log").select("id")
      .eq("subscription_id", sub.id).eq("novel_id", novelId).eq("chapter_number", chapterNumber).maybeSingle();
    if (seen) return { access: true, subscription: sub };
    if (sub.plan_type !== "gold" && !(sub.chapters_remaining > 0)) return { access: false, reason: "used_up" };

    await admin.from("writer_access_log").insert({
      subscription_id: sub.id, novel_id: novelId, chapter_number: chapterNumber, accessed_at: new Date().toISOString(),
    });
    let remaining = sub.chapters_remaining;
    if (sub.plan_type !== "gold") {
      remaining = sub.chapters_remaining - 1;
      await admin.from("writer_subscriptions").update({ chapters_remaining: remaining }).eq("id", sub.id);
    }
    return { access: true, subscription: { ...sub, chapters_remaining: remaining } };
  },

  async benefactor_activate({ user, myWallets }, p) {
    const tiers: Record<string, { price: number; chapters: number; name: string; days: number }> = {
      blue: { price: 1, chapters: 3, name: "Blue", days: 14 },
      iron: { price: 2, chapters: 6, name: "Iron", days: 14 },
      silver: { price: 3, chapters: 10, name: "Silver", days: 14 },
      gold: { price: 5, chapters: 999, name: "Gold", days: 30 },
    };
    const tier = tiers[p.plan];
    if (!tier) throw new Refuse("Invalid plan");
    const wallet = String(p.walletAddress || "");
    const signature = String(p.signature || "");
    const currency = String(p.currency || "");
    if (!myWallets.has(wallet)) throw new Refuse("That wallet isn't yours");
    if (!signature) throw new Refuse("Missing payment");

    const { data: used } = await admin.from("writer_subscriptions").select("id, benefactor_wallet")
      .eq("transaction_id", signature).limit(1);
    if (used?.length) {
      if (used[0].benefactor_wallet === wallet) return { activated: true, already: true };
      throw new Refuse("This payment was already used");
    }

    const { data: novel } = await admin.from("novels").select("user_id").eq("id", p.novelId).maybeSingle();
    if (!novel) throw new Refuse("Novel not found");
    const { data: author } = await admin.from("users").select("wallet_address").eq("id", novel.user_id).maybeSingle();
    if (!author?.wallet_address) throw new Refuse("Writer wallet not found");

    const { usd } = await verifiedUsdReceived(signature, wallet, author.wallet_address, currency);
    const expected = author.wallet_address === wallet ? tier.price * 0.2 : tier.price; // 80/20 split
    if (usd != null && usd < expected * 0.5) throw new Refuse("Payment amount is too low for this plan");

    const expiresAt = new Date(Date.now() + tier.days * 24 * 3600 * 1000).toISOString();
    const { error } = await admin.from("writer_subscriptions").insert({
      benefactor_wallet: wallet, writer_id: novel.user_id, plan_type: p.plan,
      chapters_unlocked: tier.chapters, chapters_remaining: tier.chapters,
      payment_amount: tier.price, payment_currency: currency, transaction_id: signature,
      paid_at: new Date().toISOString(), expires_at: expiresAt, is_active: true,
    });
    if (error) throw new Error(error.message);
    await admin.from("users").update({ is_benefactor: true, benefactor_level: p.plan }).eq("id", user.id);
    return { activated: true, expiresAt, chapters: tier.chapters };
  },

  // Public money feed (DAO Governance): swaps, sends, tips made from the app.
  // Only logged for a real transaction signed by one of the caller's wallets.
  async money_event({ user, myWallets }, p) {
    const sig = String(p.tx_sig || "");
    if (!sig) throw new Refuse("Missing transaction");
    const { data: dupe } = await admin.from("money_events").select("id").eq("tx_sig", sig).limit(1);
    if (dupe?.length) return { logged: false, reason: "already" };

    let tx: any = null;
    for (let i = 0; i < 4 && !tx; i++) {
      tx = await rpc("getTransaction", [sig, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]).catch(() => null);
      if (!tx) await new Promise((r) => setTimeout(r, 1500));
    }
    if (!tx || tx.meta?.err) throw new Refuse("Transaction not found or failed", tx ? 400 : 503);
    const signers = (tx.transaction?.message?.accountKeys || [])
      .filter((k: any) => typeof k !== "string" && k.signer).map((k: any) => k.pubkey);
    if (!signers.some((s: string) => myWallets.has(s))) throw new Refuse("Not your transaction", 403);

    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
    // Dollar value from a live price for the token — never the app's own figure
    // (it used to treat every non-SOL token as $1, so 5 SKR showed as $5).
    const asset = clip(p.asset || "", 16).toUpperCase();
    const amount = num(p.amount);
    const price = amount != null ? await usdPrice(asset) : null;
    await admin.from("money_events").insert({
      event_type: clip(p.event_type || "transfer", 40),
      direction: ["in", "out"].includes(p.direction) ? p.direction : "out",
      asset,
      amount,
      usd_value: price != null && amount != null ? amount * price : null,
      wallet: signers.find((s: string) => myWallets.has(s)),
      counterparty: p.counterparty ? clip(p.counterparty, 64) : null,
      user_id: user.id,
      title: clip(p.title || "", 120),
      detail: clip(p.detail || "", 240),
      tx_sig: sig,
      meta: (p.meta && typeof p.meta === "object") ? p.meta : null,
    });
    return { logged: true };
  },

  // Become a writer/artist. Today applications are approved instantly (as the
  // app always did); set AUTO_APPROVE_CREATORS=false in the function's secrets
  // to make them wait for an admin instead.
  async apply_creator({ user }, p) {
    const role = p.role === "artist" ? "artist" : p.role === "writer" ? "writer" : null;
    if (!role) throw new Refuse("Choose writer or artist");
    const reason = clip(p.reason, 2000).trim();
    if (!reason) throw new Refuse("A reason for applying is required");
    const auto = (Deno.env.get("AUTO_APPROVE_CREATORS") ?? "true") !== "false";

    const { error: appErr } = await admin.from("creator_applications").insert({
      user_id: user.id, name: clip(p.name, 120), email: clip(p.email, 200), role, reason,
      submission_link: p.submissionLink ? clip(p.submissionLink, 500) : null,
      application_status: auto ? "approved" : "pending",
    });
    if (appErr) throw new Error(appErr.message);
    if (auto) {
      const { error } = await admin.from("users")
        .update(role === "writer" ? { isWriter: true } : { isArtist: true }).eq("id", user.id);
      if (error) throw new Error(error.message);
    }
    return { approved: auto, role };
  },

  // Delete one of YOUR titles and everything attached to it (other readers'
  // comments, unlocks, purchase records) — which a creator can't do directly.
  async delete_title({ user, isAdmin }, p) {
    if (p.kind !== "manga") throw new Refuse("Only manga titles are deleted this way");
    const { data: m } = await admin.from("manga").select("id, user_id").eq("id", p.id).maybeSingle();
    if (!m) throw new Refuse("Title not found");
    if (m.user_id !== user.id && !isAdmin) throw new Refuse("Only the creator can delete this title", 403);

    const { data: chapters } = await admin.from("manga_chapters").select("id").eq("manga_id", m.id);
    const chapterIds = (chapters || []).map((c: any) => c.id);
    await admin.from("manga_comments").delete().eq("manga_id", m.id);
    if (chapterIds.length) await admin.from("manga_pages").delete().in("chapter_id", chapterIds);
    await admin.from("manga_chapters").delete().eq("manga_id", m.id);
    await admin.from("manga_subscriptions").delete().eq("manga_id", m.id);
    await admin.from("unlocked_manga_chapters").delete().eq("manga_id", m.id);
    await admin.from("user_payments").delete().eq("manga_id", m.id);
    const { error } = await admin.from("manga").delete().eq("id", m.id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },

  // Switch this account to a NEW wallet whose key is locked with the user's
  // own password (vault v2). Used for brand-new wallets and for moving off an
  // old (server-encrypted, now considered stolen) wallet. The phone proves it
  // holds the new wallet by signing; the account's history follows the wallet.
  async wallet_secure({ user, myWallets }, p) {
    const address = String(p.address || "");
    const vault = String(p.vault || "");
    const ts = Number(p.ts);
    if (!vault.startsWith("v2:") || vault.length > 20000) throw new Refuse("Invalid wallet backup");
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 10 * 60 * 1000) throw new Refuse("This request expired — please try again");
    let ok = false;
    try {
      const msg = new TextEncoder().encode(`SempaiHQ: secure wallet ${address} for ${user.id} at ${ts}`);
      ok = nacl.sign.detached.verify(msg, bs58.decode(String(p.signature || "")), bs58.decode(address));
    } catch { ok = false; }
    if (!ok) throw new Refuse("Couldn't verify the new wallet");

    // Not someone else's wallet
    const { data: taken } = await admin.from("users").select("id").eq("wallet_address", address).neq("id", user.id).limit(1);
    if (taken?.length) throw new Refuse("That wallet belongs to another account");

    const oldAddress = user.wallet_address && user.wallet_address !== address ? user.wallet_address : null;

    // The new locked backup replaces the old one (one stored wallet per account).
    const { error: wErr } = await admin.from("user_wallets")
      .upsert({ user_id: user.id, address, private_key: vault }, { onConflict: "user_id" });
    if (wErr) throw new Error(wErr.message);
    const { error: uErr } = await admin.from("users").update({ wallet_address: address }).eq("id", user.id);
    if (uErr) throw new Error(uErr.message);

    // History follows the wallet (unlocks, purchases, subscriptions, saves, chats…)
    const moved: Record<string, number> = {};
    if (oldAddress && myWallets.has(oldAddress)) {
      const refs: [string, string][] = [
        ["chapter_payments", "wallet_address"], ["writer_subscriptions", "benefactor_wallet"],
        ["benefactor_early_access", "benefactor_wallet"], ["players", "wallet_address"],
        ["private_messages", "sender_wallet"], ["private_messages", "recipient_wallet"],
        ["notifications", "recipient_wallet_address"], ["notifications", "sender_wallet_address"],
        ["messages", "wallet_address"], ["messages", "recipient_wallet_address"],
        ["wallet_balances", "wallet_address"], ["user_payments", "user_wallet"],
        ["bazaar_purchases", "buyer_wallet"], ["bazaar_read_sessions", "wallet_address"],
        ["novel_interactions", "wallet_address"], ["amethyst_balances", "wallet_address"],
      ];
      for (const [table, col] of refs) {
        try {
          const { data, error } = await admin.from(table).update({ [col]: address }).eq(col, oldAddress).select(col);
          if (!error) moved[`${table}.${col}`] = data?.length || 0;
        } catch { /* table/column may not exist — skip */ }
      }
    }
    await logEvent({
      destination_user_id: user.id, event_type: "wallet_secured", amount_change: 0, source_currency: "SOL",
      event_details: `wallet_secured:${oldAddress || "new"}->${address}`.slice(0, 255), wallet_address: address,
    });
    return { secured: true, address, oldAddress, moved };
  },

  async reward_timer_reset() {
    const { data } = await admin.from("settings").select("value").eq("key", "weekly_reward_timer").maybeSingle();
    const last = data?.value ? new Date(data.value) : new Date(0);
    const next = new Date(last);
    next.setDate(last.getDate() + ((7 - last.getDay()) % 7 || 7));
    next.setHours(0, 0, 0, 0);
    if (Date.now() < next.getTime()) return { reset: false, value: data?.value };
    const value = new Date().toISOString();
    await admin.from("settings").update({ value }).eq("key", "weekly_reward_timer");
    return { reset: true, value };
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const fn = actions[body?.action];
    if (!fn) return json({ error: "Unknown action" }, 400);
    const ctx = await caller(req);
    const result = await fn(ctx, body);
    return json({ ok: true, ...(result as object) });
  } catch (e: any) {
    const status = e instanceof Refuse ? e.status : 500;
    if (status === 500) console.error("[reader-actions]", e?.message);
    return json({ error: e?.message || "Something went wrong" }, status);
  }
});
