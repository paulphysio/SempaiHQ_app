import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { reportRequestFailed, reportRequestOk, setReachabilityProbe } from '../hooks/useOnline';

/*
 * The app uses ONLY the public (anon) key. Each signed-in reader's requests
 * carry their own sign-in, so the database's row rules decide what they may
 * do; money and trust actions go through edge functions. (The server key used
 * to ship inside the app — anyone could extract it. It no longer appears in
 * the app at all.)
 *
 * A staging build (eas.json profile "staging") points the app at a test
 * project instead.
 */
const STAGING_URL = process.env.EXPO_PUBLIC_STAGING_SUPABASE_URL || '';
const STAGING_ANON_KEY = process.env.EXPO_PUBLIC_STAGING_SUPABASE_ANON_KEY || '';
export const USER_AUTH_MODE = true;

// Kept for compatibility with callers from the test-switch period.
export const isReaderMode = () => true;
export async function refreshReaderMode() { return true; }

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

const supabaseUrl = STAGING_URL || process.env.SUPABASE_URL || '';
const supabaseKey = STAGING_URL ? STAGING_ANON_KEY : (process.env.SUPABASE_KEY || ''); // public key only

/** Project address and edge-function base — use these instead of hard-coding. */
export const SUPABASE_URL = supabaseUrl;
export const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY (public key) environment variables');
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
    // Web: Google sign-in returns to the page with a one-time code (PKCE)
    // that supabase-js exchanges for the session. Phones sign in natively.
    detectSessionInUrl: Platform.OS === 'web',
    flowType: Platform.OS === 'web' ? 'pkce' : 'implicit',
  },
  global: { fetch: offlineAwareFetch },
});
