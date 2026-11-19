import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { withCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) || ""
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

serve(withCors(async (req) => {
  try {
    console.log("[request-bazaar-refund] Request received");

    const auth = await authenticate(req);
    if (auth.error) return auth.error;
    const requester = auth.user!;

    const { purchaseId, reason } = await req.json();
    if (!purchaseId) return json({ error: "purchaseId is required" }, 400);

    // Fetch purchase + book
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("bazaar_purchases")
      .select("id, book_id, buyer_id, buyer_wallet, status")
      .eq("id", purchaseId)
      .maybeSingle();
    if (purchaseError) throw new Error(purchaseError.message);
    if (!purchase) return json({ error: "Purchase not found" }, 404);

    const { data: book } = await supabaseAdmin
      .from("bazaar_books")
      .select("author_id")
      .eq("id", purchase.book_id)
      .maybeSingle();
    if (!book) return json({ error: "Book not found" }, 404);

    // Determine role: buyer, author, or admin
    let role: "buyer" | "author" | "admin" | null = null;
    if (purchase.buyer_id === requester.id || (purchase.buyer_wallet && purchase.buyer_wallet === requester.wallet_address)) {
      role = "buyer";
    } else if (book.author_id === requester.id) {
      role = "author";
    } else if (requester.isSuperuser) {
      role = "admin";
    }
    if (!role) return json({ error: "Not authorized to request a refund for this purchase" }, 403);

    if (purchase.status === "refunded") {
      return json({ error: "This purchase was already refunded" }, 400);
    }

    // Insert refund request (unique partial index blocks duplicate pending)
    const { data: refund, error: insertError } = await supabaseAdmin
      .from("bazaar_refund_requests")
      .insert({
        purchase_id: purchase.id,
        requested_by: requester.id,
        requester_role: role,
        reason: reason || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return json({ error: "A refund request is already pending for this purchase" }, 409);
      }
      throw new Error(insertError.message);
    }

    // Mark purchase as refund_pending so UI can reflect it
    await supabaseAdmin
      .from("bazaar_purchases")
      .update({ status: "refund_pending" })
      .eq("id", purchase.id)
      .eq("status", "completed");

    console.log(`[refund] Request ${refund.id} opened for purchase ${purchase.id} by ${requester.id} (${role})`);
    return json({ success: true, refundId: refund.id });
  } catch (error: any) {
    console.error("[request-bazaar-refund] Error:", error.message);
    return json({ error: error.message || "Internal server error" }, 500);
  }
}));
