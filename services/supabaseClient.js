import { createClient } from '@supabase/supabase-js';
import { reportRequestFailed, reportRequestOk, setReachabilityProbe } from '../hooks/useOnline';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

/*
 * Offline-aware fetch for every Supabase request.
 *  · reports real reachability to the app's connection monitor
 *    (hooks/useOnline): the first failed request flips the app into offline
 *    mode even when the phone claims to be "connected" (Wi-Fi without
 *    internet, captive portals, dead mobile data); a successful one flips it
 *    back.
 *  · a 20s timeout on database/auth calls so screens never hang forever on a
 *    dead connection (uploads and edge functions keep their own pace).
 */
const REQUEST_TIMEOUT_MS = 20000;

const offlineAwareFetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const long = url.includes('/storage/v1/') || url.includes('/functions/v1/');
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = controller && !long
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS)
    : null;
  if (controller && init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener?.('abort', () => controller.abort());
  }
  // Database calls (/rest/v1) always go as the app's server key. Without this,
  // supabase-js swaps in the signed-in user's token, and the user role can no
  // longer write server-only tables. Auth, storage and edge functions keep the
  // user's token so they still know who is calling.
  // (Temporary: Phase 3 replaces this with per-user rules + edge functions.)
  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input?.headers : undefined) || {});
    headers.set('Authorization', `Bearer ${supabaseKey}`);
    headers.set('apikey', supabaseKey);
    init = { ...init, headers };
  }
  try {
    const res = await fetch(input, controller ? { ...init, signal: controller.signal } : init);
    reportRequestOk();
    return res;
  } catch (err) {
    // A caller cancelling its own request is not a connectivity problem.
    if (!timedOut && init.signal?.aborted) throw err;
    reportRequestFailed();
    throw timedOut ? new TypeError('Network request failed (timeout)') : err;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// Lightweight "are we back?" check used while offline.
setReachabilityProbe(async () => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = controller ? setTimeout(() => controller.abort(), 5000) : null;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseKey },
      signal: controller?.signal,
    });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    if (t) clearTimeout(t);
  }
});

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Prevent Supabase from handling redirects
  },
  global: { fetch: offlineAwareFetch },
});
