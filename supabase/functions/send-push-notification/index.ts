// @ts-nocheck - Deno edge function with Deno-specific imports
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

serve(async (req) => {
  try {
    console.log("[send-push-notification] Request received");

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { userIds, title, body, data } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response("userIds is required and must be a non-empty array", { status: 400 });
    }

    if (!title || !body) {
      return new Response("title and body are required", { status: 400 });
    }

    console.log("[send-push-notification] Fetching push tokens for", userIds.length, "users");

    // Fetch push tokens for the specified users
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, push_token")
      .in("id", userIds);

    if (usersError) {
      console.error("[send-push-notification] Error fetching users:", usersError);
      return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500 });
    }

    if (!users || users.length === 0) {
      console.log("[send-push-notification] No users found");
      return new Response(JSON.stringify({ success: true, message: "No users to notify" }), { status: 200 });
    }

    // Filter users with valid push tokens
    const pushTokens = users
      .filter((user: any) => user.push_token)
      .map((user: any) => user.push_token);

    console.log("[send-push-notification] Found", pushTokens.length, "valid push tokens");

    if (pushTokens.length === 0) {
      console.log("[send-push-notification] No valid push tokens found");
      return new Response(JSON.stringify({ success: true, message: "No valid push tokens" }), { status: 200 });
    }

    // Send push notifications via Expo Push API
    const expoApiUrl = "https://exp.host/--/api/v2/push/send";
    const messages = pushTokens.map((pushToken: string) => ({
      to: pushToken,
      sound: "default",
      title,
      body,
      data: data || {},
    }));

    console.log("[send-push-notification] Sending notifications to Expo Push API");

    const response = await fetch(expoApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log("[send-push-notification] Expo Push API response:", result);

    if (!response.ok) {
      console.error("[send-push-notification] Expo Push API error:", result);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to send notification",
        details: result
      }), { status: 500 });
    }

    console.log("[send-push-notification] Push notifications sent successfully");
    return new Response(JSON.stringify({
      success: true,
      message: "Notifications sent successfully",
      count: pushTokens.length
    }), { status: 200 });

  } catch (error: any) {
    console.error("[send-push-notification] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500 }
    );
  }
});
