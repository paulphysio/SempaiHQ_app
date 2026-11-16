import { supabase } from './supabaseClient';

const TICK_MS = 1000; // accumulate seconds
const FLUSH_MS = 8000; // persist at most this often (plus on page turns, throttled)

// Tracks one reader session for a bazaar PDF/EPUB. Returns a no-op tracker when
// there is no signed-in user (RLS requires user_id to match the caller).
export function createBazaarReadTracker({ purchaseId = null, bookId, userId, walletAddress = null, fileType = null }) {
  const noop = { active: false, recordPage: () => {}, close: () => Promise.resolve() };
  if (!userId || !bookId) return noop;

  let sessionId = null;
  let closed = false;
  const pages = new Set();
  let maxPage = 0;
  let totalPages = null;
  let seconds = 0;
  let lastFlush = 0;
  let tick = null;
  let starting = false;

  const persist = async (force = false) => {
    if (!sessionId) return;
    const now = Date.now();
    if (!force && now - lastFlush < FLUSH_MS) return;
    lastFlush = now;
    try {
      const { error } = await supabase
        .from('bazaar_read_sessions')
        .update({
          pages_read: Array.from(pages).sort((a, b) => a - b),
          max_page: maxPage || null,
          total_pages: totalPages,
          seconds_spent: seconds,
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      if (error) console.warn('[bazaarReadTracker] persist failed:', error.message);
    } catch (e) {
      console.warn('[bazaarReadTracker] persist error:', e?.message);
    }
  };

  const start = async () => {
    if (starting || sessionId || closed) return;
    starting = true;
    try {
      const { data, error } = await supabase
        .from('bazaar_read_sessions')
        .insert({
          purchase_id: purchaseId,
          book_id: bookId,
          user_id: userId,
          wallet_address: walletAddress,
          file_type: fileType,
        })
        .select('id')
        .single();
      if (error) throw error;
      sessionId = data.id;
      // Flush the initial row state once the session id exists.
      await persist(true);
    } catch (e) {
      console.warn('[bazaarReadTracker] start failed:', e?.message);
    } finally {
      starting = false;
    }
  };

  void start();

  tick = setInterval(() => {
    seconds += 1;
    void persist();
  }, TICK_MS);

  return {
    active: true,
    // page: 1-based page/chapter index; total: total pages/chapters when known
    recordPage(page, total = null) {
      if (closed) return;
      const p = Math.floor(Number(page));
      if (!Number.isFinite(p) || p < 1) return;
      pages.add(p);
      if (p > maxPage) maxPage = p;
      const t = Math.floor(Number(total));
      if (Number.isFinite(t) && t > 0) totalPages = t;
      void persist();
    },
    async close() {
      if (closed) return;
      closed = true;
      clearInterval(tick);
      // If the insert is still in flight, let it finish then flush once.
      const deadline = Date.now() + 3000;
      while (starting && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await persist(true);
    },
  };
}
