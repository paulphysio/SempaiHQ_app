import { createClient } from '@supabase/supabase-js';
import { reportRequestFailed, reportRequestOk, setReachabilityProbe } from '../hooks/useOnline';

/*
 * Two modes:
 *  · Production (today): the app's own key; database calls forced to it.
 *  · Reader mode (Phase 3 switch-over): the PUBLIC key + the reader's sign-in,
 *    so the database's row rules decide what each reader may do. Turned on by
 *    a staging build (eas.json profile "staging"), which also points the app
 *    at the test project. Production builds don't set these and are unchanged.
 */
const STAGING_URL = process.env.EXPO_PUBLIC_STAGING_SUPABASE_URL || '';
const STAGING_ANON_KEY = process.env.EXPO_PUBLIC_STAGING_SUPABASE_ANON_KEY || '';
export const USER_AUTH_MODE = !!STAGING_URL;

/*
 * Live "reader mode" switch (Phase 3 testing). Controlled from the database:
 *   settings.key = 'reader_mode', value = 'off' | 'all' | comma-separated
 *   account ids or emails (e.g. 'me@gmail.com').
 * When on for the signed-in person, their database calls carry THEIR sign-in
 * (so the row rules apply to them); everyone else is unaffected. Turning it
 * off takes effect on the next app open — no update needed.
 */
let readerMode = USER_AUTH_MODE;
export const isReaderMode = () => readerMode;
export async function refreshReaderMode(user) {
  if (USER_AUTH_MODE) return true;
  if (!user || user.isGuest || !user.id) { readerMode = false; return false; }
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'reader_mode').maybeSingle();
    const value = String(data?.value || 'off').trim().toLowerCase();
    const me = [String(user.id).toLowerCase(), String(user.email || '').toLowerCase()];
    readerMode = value === 'all' || value.split(',').map((s) => s.trim()).some((s) => s && me.includes(s));
  } catch {
    // keep the current mode if the check can't run (e.g. offline)
  }
  return readerMode;
}

/*
 * Test pricing: accounts listed in settings.test_pricing (comma-separated
 * emails or account ids) pay $0.0025 per chapter instead of $0.025. The
 * unlock-chapter server function applies the same list, so test payments
 * are accepted only for those accounts.
 */
const REAL_CHAPTER_USD = 0.025;
const TEST_CHAPTER_USD = 0.0025;
let testPricing = false;
export const chapterUsdCost = () => (testPricing ? TEST_CHAPTER_USD : REAL_CHAPTER_USD);
export async function refreshTestPricing(user) {
  if (!user || user.isGuest || !user.id) { testPricing = false; return false; }
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'test_pricing').maybeSingle();
    const list = String(data?.value || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    const me = [String(user.id).toLowerCase(), String(user.email || '').toLowerCase()];
    testPricing = list.some((x) => me.includes(x));
  } catch {}
  return testPricing;
}

const supabaseUrl = USER_AUTH_MODE ? STAGING_URL : (process.env.SUPABASE_URL || '');
const supabaseKey = USER_AUTH_MODE
  ? STAGING_ANON_KEY
  : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '');

/** Project address and edge-function base — use these instead of hard-coding. */
export const SUPABASE_URL = supabaseUrl;
export const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;

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
  // (Temporary: Phase 3 replaces this with per-user rules + edge functions —
  // reader mode skips it.)
  if (!readerMode && url.includes('/rest/v1/')) {
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
