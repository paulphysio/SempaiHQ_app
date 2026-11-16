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

    // Server only: pushes go out through reader-actions (which checks who may
    // notify whom). Without this, anyone with the public key could push any
    // message to every user's phone.
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let isServer = !!supabaseAdminKey && token === supabaseAdminKey;
    if (!isServer && token) {
      try {
        const part = token.split(".")[1] || "";
        const role = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")
          .padEnd(Math.ceil(part.length / 4) * 4, "=")))?.role;
        if (role === "service_role") {
          const probe = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: token, Authorization: `Bearer ${token}` } });
          isServer = probe.status === 200;
        }
      } catch { /* not a server token */ }
    }
    if (!isServer) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const { userIds, title, body, data } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response("userIds is required and must be a non-empty array", { status: 400 });
    }

    if (!title || !body) {
      return new Response("title and body are required", { status: 400 });
    }

    console.log("[send-push-notification] Fetching push tokens for", userIds.length, "users");

    // Fetch push tokens for the specified users — chunked because .in() with
    // thousands of IDs exceeds the PostgREST URL length limit.
    const CHUNK = 200;
    const users: any[] = [];
    for (let i = 0; i < userIds.length; i += CHUNK) {
      const { data: chunk, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, push_token")
        .in("id", userIds.slice(i, i + CHUNK));
      if (usersError) {
        console.error("[send-push-notification] Error fetching users:", usersError);
        return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500 });
      }
      if (chunk) users.push(...chunk);
    }

    // (A second `if (usersError)` check used to sit here, outside the loop where
    // `usersError` is scoped. It threw "usersError is not defined" on every
    // call, so no push notification was ever sent.)

    if (!users || users.length === 0) {
      console.log("[send-push-notification] No users found");
      return new Response(JSON.stringify({ success: true, message: "No users to notify" }), { status: 200 });
    }

    // Valid tokens only, de-duplicated (one device can be linked to several rows).
    const pushTokens = [...new Set(
      users
        .map((user: any) => user.push_token)
        .filter((t: any) => typeof t === "string" && /^Expo(nent)?PushToken\[/.test(t))
    )];

    console.log("[send-push-notification] Found", pushTokens.length, "valid push tokens");

    if (pushTokens.length === 0) {
      console.log("[send-push-notification] No valid push tokens found");
      return new Response(JSON.stringify({ success: true, message: "No valid push tokens" }), { status: 200 });
    }

    // Send push notifications via Expo Push API — batched (Expo recommends
    // keeping request bodies small; huge payloads can time out).
    const expoApiUrl = "https://exp.host/--/api/v2/push/send";
    const messages = pushTokens.map((pushToken: string) => ({
      to: pushToken,
      sound: "default",
      title,
      body,
      data: data || {},
      // Android: the app's MAX-importance channel (heads-up banner, custom
      // sound, vibration, status-bar icon) and wake the device immediately.
      channelId: "reading-updates",
      priority: "high",
    }));

    console.log("[send-push-notification] Sending notifications to Expo Push API");

    let tickets: any[] = [];
    let expoOk = true;
    let lastError: any = null;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      try {
        const response = await fetch(expoApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(batch),
        });
        const result = await response.json();
        console.log("[send-push-notification] Expo Push API batch response:", result?.data?.length ?? result);
        if (!response.ok) {
          expoOk = false;
          lastError = result;
          console.error("[send-push-notification] Expo Push API error:", result);
        } else if (Array.isArray(result?.data)) {
          tickets.push(...result.data);
        }
      } catch (batchError: any) {
        expoOk = false;
        lastError = batchError?.message || batchError;
        console.error("[send-push-notification] Expo batch fetch failed:", batchError);
      }
    }

    if (!expoOk) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to send notification",
        details: lastError
      }), { status: 500 });
    }

    // Expo answers per message. "DeviceNotRegistered" means the app was
    // uninstalled or the token rotated — clear it so we stop sending to it.
    const deadTokens: string[] = [];
    const ticketErrors: any[] = [];
    tickets.forEach((ticket: any, i: number) => {
      if (ticket?.status === "error") {
        ticketErrors.push(ticket?.details?.error || ticket?.message);
        if (ticket?.details?.error === "DeviceNotRegistered") deadTokens.push(messages[i]?.to);
      }
    });
    if (deadTokens.length) {
      const { error: clearError } = await supabaseAdmin
        .from("users")
        .update({ push_token: null })
        .in("push_token", deadTokens.filter(Boolean));
      if (clearError) console.error("[send-push-notification] Failed to clear dead tokens:", clearError);
      else console.log("[send-push-notification] Cleared", deadTokens.length, "dead tokens");
    }

    const delivered = tickets.filter((t: any) => t?.status === "ok").length;
    console.log("[send-push-notification] Sent:", delivered, "ok,", ticketErrors.length, "failed");
    return new Response(JSON.stringify({
      success: true,
      message: "Notifications sent",
      count: pushTokens.length,
      delivered,
      failed: ticketErrors.length,
      errors: ticketErrors.slice(0, 5),
    }), { status: 200 });

  } catch (error: any) {
    console.error("[send-push-notification] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500 }
    );
  }
});
