// Import serve from a stable Deno version
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
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
      result = await decrypt(data, KEYPAIR_ENCRYPTION_SECRET);
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
      result: result ? `${result.slice(0, 10)}...` : "undefined"
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
