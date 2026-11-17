import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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

const SIGNED_URL_TTL_SECONDS = 600; // 10 minutes

serve(async (req) => {
  try {
    console.log("[get-bazaar-book-url] Request received");

    const auth = await authenticate(req);
    if (auth.error) return auth.error;
    const user = auth.user!;

    const { bookId } = await req.json();
    if (!bookId) return json({ error: "bookId is required" }, 400);

    const { data: book, error: bookError } = await supabaseAdmin
      .from("bazaar_books")
      .select("id, author_id, file_path, status")
      .eq("id", bookId)
      .maybeSingle();
    if (bookError) throw new Error(bookError.message);
    if (!book) return json({ error: "Book not found" }, 404);
    if (book.status !== "active") return json({ error: "Book is not available" }, 400);
    if (!book.file_path) return json({ error: "Book file is missing" }, 500);

    // The author can always read their own book.
    let allowed = book.author_id === user.id;

    // Otherwise the user needs a purchase/lend that hasn't been refunded.
    if (!allowed) {
      const { data: purchase } = await supabaseAdmin
        .from("bazaar_purchases")
        .select("id")
        .eq("book_id", book.id)
        .or(`buyer_id.eq.${user.id},buyer_wallet.eq.${user.wallet_address || "none"}`)
        .neq("status", "refunded")
        .limit(1)
        .maybeSingle();
      allowed = !!purchase;
    }
    if (!allowed) return json({ error: "You don't have access to this book" }, 403);

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("bazaar-books")
      .createSignedUrl(book.file_path, SIGNED_URL_TTL_SECONDS);
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message || "Could not create download URL");
    }

    return json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
  } catch (error: any) {
    console.error("[get-bazaar-book-url] Error:", error.message);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
