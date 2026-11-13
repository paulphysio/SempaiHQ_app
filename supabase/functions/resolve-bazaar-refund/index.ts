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

const SIGNED_URL_TTL_SECONDS = 600; // 10 minutes

serve(async (req) => {
  try {
    console.log("[resolve-bazaar-refund] Request received");

    const auth = await authenticate(req);
    if (auth.error) return auth.error;
    const admin = auth.user!;
    if (!admin.isSuperuser) {
      return json({ error: "Admin access required" }, 403);
    }

    const { refundId, action, note } = await req.json();
    if (!refundId || !["approve", "reject"].includes(action)) {
      return json({ error: "refundId and action ('approve' | 'reject') are required" }, 400);
    }

    const { data: refund, error: refundError } = await supabaseAdmin
      .from("bazaar_refund_requests")
      .select("id, purchase_id, status")
      .eq("id", refundId)
      .maybeSingle();
    if (refundError) throw new Error(refundError.message);
    if (!refund) return json({ error: "Refund request not found" }, 404);
    if (refund.status !== "pending") {
      return json({ error: `Refund request is already ${refund.status}` }, 400);
    }

    const approve = action === "approve";

    const { error: updateRefundError } = await supabaseAdmin
      .from("bazaar_refund_requests")
      .update({
        status: approve ? "approved" : "rejected",
        resolution_note: note || null,
        resolved_by: admin.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", refund.id);
    if (updateRefundError) throw new Error(updateRefundError.message);

    // Approve revokes access; reject restores the purchase to completed.
    const { error: updatePurchaseError } = await supabaseAdmin
      .from("bazaar_purchases")
      .update({ status: approve ? "refunded" : "completed" })
      .eq("id", refund.purchase_id)
      .eq("status", "refund_pending");
    if (updatePurchaseError) throw new Error(updatePurchaseError.message);

    // NOTE: the on-chain refund transfer itself is manual — approving only
    // revokes access. Send funds back from the platform/author wallet yourself.
    console.log(`[refund] ${refund.id} ${approve ? "approved" : "rejected"} by ${admin.id}`);
    return json({ success: true, status: approve ? "approved" : "rejected" });
  } catch (error: any) {
    console.error("[resolve-bazaar-refund] Error:", error.message);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
