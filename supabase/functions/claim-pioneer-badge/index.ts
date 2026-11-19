import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { withCors } from "../_shared/cors.ts";
import { decodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

// Who is calling — VERIFIED by Supabase Auth (an unverified token can be forged).
async function verifiedClaims(token: string | undefined): Promise<{ sub?: string; email?: string }> {
  if (!token) return {};
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return {};
  return { sub: data.user.id, email: data.user.email ?? undefined };
}

// Grants the Pioneer badge when the caller has just made their first-ever
// unlock/payment to a creator. Called by the app after a successful manga
// chapter unlock; user_badges/badges are service-role-only tables.
serve(withCors(async (req) => {
  try {
    const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jwt) {
      return Response.json({ error: "Authorization header missing" }, { status: 403 });
    }

    const jwtBody = await verifiedClaims(jwt);
    if (typeof jwtBody?.email !== "string") {
      return Response.json({ error: "JWT missing email" }, { status: 400 });
    }

    const { mangaId, signature } = await req.json();
    if (!mangaId || !signature) {
      return Response.json({ error: "Missing required fields (mangaId, signature)" }, { status: 400 });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", jwtBody.email)
      .maybeSingle();
    if (!userData) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const { data: manga } = await supabaseAdmin
      .from("manga")
      .select("id, user_id")
      .eq("id", mangaId)
      .maybeSingle();
    if (!manga) {
      return Response.json({ error: "Manga not found" }, { status: 404 });
    }

    // All manga ids belonging to this creator
    const { data: creatorManga } = await supabaseAdmin
      .from("manga")
      .select("id")
      .eq("user_id", manga.user_id);
    const creatorMangaIds = (creatorManga || []).map((m: any) => m.id);

    // Any prior unlock by this user to this creator's manga (excluding the
    // unlock record we just wrote for this transaction)?
    const { data: priorUnlocks } = await supabaseAdmin
      .from("unlocked_manga_chapters")
      .select("id")
      .eq("user_id", userData.id)
      .in("manga_id", creatorMangaIds)
      .neq("transaction_id", signature)
      .limit(1);

    let isPioneer = false;
    if (!priorUnlocks || priorUnlocks.length === 0) {
      // Ensure a pioneer badge definition exists
      let badgeId: string | null = null;
      const { data: existingBadge } = await supabaseAdmin
        .from("badges")
        .select("id")
        .eq("type", "pioneer")
        .limit(1)
        .maybeSingle();
      badgeId = existingBadge?.id ?? null;

      if (!badgeId) {
        const { data: newBadge, error: badgeInsertError } = await supabaseAdmin
          .from("badges")
          .insert({
            name: "Pioneer",
            description: "First supporter of a creator on Sempai HQ",
            type: "pioneer",
            price: 0,
          })
          .select("id")
          .single();
        if (badgeInsertError) throw badgeInsertError;
        badgeId = newBadge.id;
      }

      // Grant the badge if the user doesn't already own it
      const { data: owned } = await supabaseAdmin
        .from("user_badges")
        .select("id")
        .eq("user_id", userData.id)
        .eq("badge_id", badgeId)
        .maybeSingle();

      if (!owned) {
        const { error: grantError } = await supabaseAdmin
          .from("user_badges")
          .insert({
            user_id: userData.id,
            badge_id: badgeId,
            acquired_at: new Date().toISOString(),
          });
        if (grantError) throw grantError;
      }
      isPioneer = true;

      // Also insert into pioneer_creators table to track the relationship
      const { error: pioneerError } = await supabaseAdmin
        .from("pioneer_creators")
        .insert({
          user_id: userData.id,
          creator_id: manga.user_id,
          first_payment_at: new Date().toISOString(),
        });
      if (pioneerError && !pioneerError.message.includes('duplicate key')) {
        console.warn("[claim-pioneer-badge] Pioneer creators insert failed:", pioneerError.message);
      }
    }

    return Response.json({ success: true, isPioneer });
  } catch (error: any) {
    console.error("[claim-pioneer-badge] Error:", error?.message);
    return Response.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}));
