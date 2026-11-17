// Import serve from a stable Deno version
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";
import bs58 from "https://esm.sh/bs58@5.0.0";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

/*
 * Access rules (Phase 0 lockdown):
 *  · encrypt — anyone (an encryption oracle reveals nothing)
 *  · decrypt — server callers (service role), or a signed-in user decrypting
 *    a key whose wallet address belongs to them. Ownership is proven from the
 *    plaintext itself: the ed25519 seed must derive the public key, and that
 *    address must be one of the caller's wallets.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const bearer = (req: Request) => (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();

const jwtRole = (token: string): string | null => {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(b64))?.role ?? null;
  } catch {
    return null;
  }
};

/** True only for a genuine service-role key. */
const isServiceCaller = async (token: string): Promise<boolean> => {
  if (!token) return false;
  if (SERVICE_KEY && token === SERVICE_KEY) return true;
  if (jwtRole(token) !== "service_role") return false;
  // Different encoding of the key: let the API confirm it (anon gets 401 here).
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: token, Authorization: `Bearer ${token}` } });
    return res.status === 200;
  } catch {
    return false;
  }
};

/** Address of a base58 (or JSON-array) 64-byte secret key, if it is genuine. */
const addressOfSecret = (plain: string): string | null => {
  try {
    const t = plain.trim();
    const sk = t.startsWith("[") ? Uint8Array.from(JSON.parse(t)) : bs58.decode(t);
    if (sk.length !== 64) return null;
    const pub = nacl.sign.keyPair.fromSeed(sk.slice(0, 32)).publicKey;
    for (let i = 0; i < 32; i++) if (pub[i] !== sk[32 + i]) return null;
    return bs58.encode(pub);
  } catch {
    return null;
  }
};

const walletsOf = async (userId: string): Promise<Set<string>> => {
  const owned = new Set<string>();
  const { data: rows } = await admin.from("user_wallets").select("address").eq("user_id", userId);
  (rows || []).forEach((r: any) => r?.address && owned.add(String(r.address)));
  return owned;
};
// Utility to convert between string, buffer, and hex
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b)=>b.toString(16).padStart(2, "0")).join("");
}
function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for(let i = 0; i < hex.length; i += 2){
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}
// Generate a key from a secret using SHA-256
async function generateKey(secret) {
  if (!secret) throw new Error("Secret is undefined");
  const keyMaterial = textEncoder.encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", keyMaterial);
  return crypto.subtle.importKey("raw", hash, {
    name: "AES-CBC"
  }, false, [
    "encrypt",
    "decrypt"
  ]);
}
// Encrypt data using AES-CBC
async function encrypt(data, secret) {
  if (!data || typeof data !== "string") throw new Error("Data must be a non-empty string");
  const key = await generateKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encodedData = textEncoder.encode(data);
  const encrypted = await crypto.subtle.encrypt({
    name: "AES-CBC",
    iv
  }, key, encodedData);
  const ivHex = bufferToHex(iv);
  const encryptedHex = bufferToHex(encrypted);
  return ivHex + encryptedHex;
}
// Decrypt data using AES-CBC
async function decrypt(data, secret) {
  if (!data || typeof data !== "string") throw new Error("Data must be a non-empty string");
  if (data.length < 32) throw new Error("Data too short for valid IV");
  const key = await generateKey(secret);
  const ivHex = data.slice(0, 32);
  const encryptedHex = data.slice(32);
  if (!encryptedHex) throw new Error("No encrypted data provided");
  const iv = hexToBuffer(ivHex);
  const encrypted = hexToBuffer(encryptedHex);
  try {
    const decrypted = await crypto.subtle.decrypt({
      name: "AES-CBC",
      iv
    }, key, encrypted);
    return textDecoder.decode(decrypted);
  } catch (err) {
    throw new Error(`Decryption failed: ${err.message}`);
  }
}
serve(async (req)=>{
  try {
    const KEYPAIR_ENCRYPTION_SECRET = Deno.env.get("KEYPAIR_ENCRYPTION_SECRET");
    if (!KEYPAIR_ENCRYPTION_SECRET) {
      console.error("[wallet-encryption] Missing KEYPAIR_ENCRYPTION_SECRET");
      return new Response(JSON.stringify({
        error: "Encryption secret not configured"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const { action, data } = await req.json();
    console.log("[wallet-encryption] Request:", {
      action,
      data: data ? `${data.slice(0, 10)}...` : "undefined"
    });
    if (!action || !data) {
      return new Response(JSON.stringify({
        error: "Missing action or data"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    let result;
    if (action === "encrypt") {
      result = await encrypt(data, KEYPAIR_ENCRYPTION_SECRET);
    } else if (action === "decrypt") {
      // ONLY a signed-in person, and ONLY for their own wallet. The server key
      // is NOT accepted any more: it ships inside the Android app, and
      // accepting it let anyone with the APK decrypt every stored wallet.
      const token = bearer(req);
      if (await isServiceCaller(token)) {
        console.warn("[wallet-encryption] Refused decrypt with the server key");
        return json({ error: "Sign in to unlock your wallet" }, 401);
      }
      const { data: auth } = await admin.auth.getUser(token);
      const userId = auth?.user?.id ?? null;
      if (!userId) return json({ error: "Sign in to unlock your wallet" }, 401);
      // Only sessions from a real Google sign-in (app: id_token, website:
      // oauth). Someone holding the old server key can create email-link or
      // password sessions for any user — those must never unlock a wallet.
      // (The token was verified by getUser above, so its claims are genuine.)
      try {
        const part = token.split(".")[1] || "";
        const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")
          .padEnd(Math.ceil(part.length / 4) * 4, "=")));
        const methods = (Array.isArray(claims?.amr) ? claims.amr : [])
          .map((a: any) => String(a?.method || a || "").toLowerCase());
        if (!methods.some((m: string) => m === "oauth" || m === "id_token")) {
          console.warn("[wallet-encryption] Refused decrypt: not a Google sign-in", { userId, methods });
          return json({ error: "Please sign in with Google to unlock your wallet" }, 401);
        }
      } catch {
        return json({ error: "Please sign in with Google to unlock your wallet" }, 401);
      }
      result = await decrypt(data, KEYPAIR_ENCRYPTION_SECRET);
      // Old format: the plaintext IS the key. New format (v2): the plaintext is
      // a vault locked with the user's own password — the server can't open
      // it; ownership is checked against the address it records.
      let address = addressOfSecret(result);
      if (!address) {
        try {
          const vault = JSON.parse(result);
          if (vault?.v === 2 && typeof vault.address === "string") address = vault.address;
        } catch { /* not a vault */ }
      }
      const owned = await walletsOf(userId);
      if (!address || !owned.has(address)) {
        console.warn("[wallet-encryption] Refused decrypt: key is not the caller's wallet", { userId });
        return json({ error: "This wallet does not belong to your account" }, 403);
      }
    } else {
      return new Response(JSON.stringify({
        error: "Invalid action"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    console.log("[wallet-encryption] Success:", {
      action,
      ok: !!result
    });
    return new Response(JSON.stringify({
      result
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[wallet-encryption] Error:", error.message);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
