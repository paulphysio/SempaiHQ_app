// deno-lint-ignore-file no-explicit-any
// manga-chapter-pages: returns short-lived signed URLs for a chapter's pages,
// but only after verifying the caller actually has access (subscription,
// chapter unlock, or recorded payment). Non-premium chapters are free.
// Self-contained: paste whole file into Supabase Edge Functions.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour
const PREVIEW_PAGES = 5; // free preview: first N pages of the first chapter

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

function throwOnError({ data, error }: { data: any; error: any }) {
  if (error) throw new Error(error?.message || "database error");
  return data;
}

// Extract {bucket, path} from a Supabase storage public URL.
// Returns null for external URLs (returned to the client unchanged).
function parseStorageUrl(imageUrl: string): { bucket: string; path: string } | null {
  const m = imageUrl.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?.*)?$/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

async function resolveUserId(req: Request, bodyWallet?: string): Promise<string | null> {
  // Prefer Supabase Auth JWT (email -> users.id), fall back to wallet address.
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (jwt) {
    try {
      const jwtBody = JSON.parse(new TextDecoder().decode(decodeBase64(jwt.split(".")[1])));
      if (typeof jwtBody?.email === "string") {
        const { data } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", jwtBody.email)
          .maybeSingle();
        if (data?.id) return data.id;
      }
    } catch (_) { /* fall through to wallet */ }
  }
  if (bodyWallet) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("wallet_address", bodyWallet)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

async function hasAccess(userId: string | null, mangaId: string, chapterId: string): Promise<boolean> {
  if (!userId) return false;
  const now = new Date().toISOString();

  // Active series subscription covers every chapter
  const { data: subs } = await supabaseAdmin
    .from("manga_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("manga_id", mangaId)
    .gt("expires_at", now)
    .limit(1);
  if (subs?.length) return true;

  // Per-chapter or whole-series unlock
  const { data: unlocks } = await supabaseAdmin
    .from("unlocked_manga_chapters")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("manga_id", mangaId)
    .or(`chapter_id.eq.${chapterId},chapter_id.is.null`)
    .limit(5);
  if (unlocks?.some((u: any) => !u.expires_at || u.expires_at > now)) return true;

  // Legacy recorded payment for this chapter
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, wallet_address")
    .eq("id", userId)
    .maybeSingle();
  if (!userRow) return false;

  // The manga author can always preview their own pages
  const { data: mangaRow } = await supabaseAdmin
    .from("manga")
    .select("user_id")
    .eq("id", mangaId)
    .maybeSingle();
  if (mangaRow?.user_id === userRow.id) return true;

  if (userRow?.wallet_address) {
    const { data: payments } = await supabaseAdmin
      .from("user_payments")
      .select("id")
      .eq("user_wallet", userRow.wallet_address)
      .eq("manga_id", mangaId)
      .eq("chapter_id", chapterId)
      .limit(1);
    if (payments?.length) return true;
  }
  return false;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
    }
    const body = await req.json();
    const { chapterId, walletAddress } = body as { chapterId: string; walletAddress?: string };
    if (!chapterId) {
      return new Response(JSON.stringify({ error: "chapterId required" }), { status: 400 });
    }

    const chapter = await supabaseAdmin
      .from("manga_chapters")
      .select("id, manga_id, is_premium")
      .eq("id", chapterId)
      .maybeSingle()
      .then(throwOnError);
    if (!chapter) return new Response(JSON.stringify({ error: "Chapter not found" }), { status: 404 });

    // All manga is premium: every chapter requires a subscription, chapter
    // unlock, or recorded payment. Exception: the first chapter of a series
    // returns a short preview so readers can try before buying.
    const userId = await resolveUserId(req, walletAddress);
    let allowed = await hasAccess(userId, chapter.manga_id, chapterId);
    let preview = false;

    if (!allowed) {
      const { data: firstChapter } = await supabaseAdmin
        .from("manga_chapters")
        .select("id")
        .eq("manga_id", chapter.manga_id)
        .order("chapter_number", { ascending: true })
        .limit(1)
        .maybeSingle();
      preview = firstChapter?.id === chapterId;
    }

    if (!allowed && !preview) {
      return new Response(JSON.stringify({ error: "This chapter requires an active subscription or unlock.", locked: true }), { status: 402 });
    }

    let pages = await supabaseAdmin
      .from("manga_pages")
      .select("page_number, image_url")
      .eq("chapter_id", chapterId)
      .order("page_number", { ascending: true })
      .then(throwOnError);

    if (preview) pages = (pages || []).slice(0, PREVIEW_PAGES);

    const result = await Promise.all(
      (pages || []).map(async (p: any) => {
        const parsed = parseStorageUrl(p.image_url || "");
        if (!parsed) return { page_number: p.page_number, image_url: p.image_url };
        const { data, error } = await supabaseAdmin.storage
          .from(parsed.bucket)
          .createSignedUrl(parsed.path, SIGNED_URL_TTL_SECONDS);
        if (error || !data?.signedUrl) {
          console.warn("[manga-chapter-pages] sign failed:", parsed.bucket, parsed.path, error?.message);
          return { page_number: p.page_number, image_url: null };
        }
        return { page_number: p.page_number, image_url: data.signedUrl };
      })
    );

    return new Response(JSON.stringify({ pages: result.filter((p: any) => p.image_url), preview }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[manga-chapter-pages] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), { status: 500 });
  }
});
