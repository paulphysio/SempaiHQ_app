import { supabase } from './supabaseClient';
import { saveReadingProgress, getContentReadingProgress, getAllReadingProgress } from './readingProgress';

/*
 * Where you are in a Bazaar book — saved on the phone first, then to your
 * account (same offline-first store as novels and manga).
 *   EPUB: the exact spot (a CFI) + chapter      PDF: the page
 */
const TYPE = 'bazaar';

export async function myId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

/** pos: { kind: 'epub'|'pdf', cfi?, chapterIndex?, page?, pct (0..1) } */
export function saveBookPosition(userId, bookId, pos) {
  if (!userId || !bookId || !pos) return Promise.resolve();
  const isPdf = pos.kind === 'pdf';
  const key = isPdf ? `page:${pos.page || 1}` : pos.cfi;
  if (!key) return Promise.resolve();
  return saveReadingProgress({
    userId,
    contentType: TYPE,
    contentId: bookId,
    chapterKey: key,
    chapterNumber: isPdf ? pos.page || 1 : (pos.chapterIndex ?? 0) + 1,
    scrollPct: Math.max(0, Math.min(1, pos.pct || 0)) * 100,
  });
}

/** Parses a saved row → { kind, cfi?, page?, chapter, pct (0..100) } or null. */
export function parseBookRow(row) {
  if (!row?.chapter_key) return null;
  const pct = Number(row.scroll_pct) || 0;
  const m = String(row.chapter_key).match(/^page:(\d+)$/);
  if (m) return { kind: 'pdf', page: Number(m[1]), chapter: Number(m[1]), pct };
  return { kind: 'epub', cfi: row.chapter_key, chapter: row.chapter_number || 1, pct };
}

export async function getBookPosition(userId, bookId) {
  if (!userId || !bookId) return null;
  return parseBookRow(await getContentReadingProgress(userId, TYPE, bookId));
}

/** Short label: "Page 12 · 40%" / "Ch. 3 · 22%". */
export function positionLabel(pos) {
  if (!pos) return '';
  const where = pos.kind === 'pdf' ? `Page ${pos.page}` : `Ch. ${pos.chapter}`;
  return `${where} · ${Math.round(pos.pct)}%`;
}

/** Bazaar books in progress, newest first: [{ book, pos, updated_at }]. */
export async function getBooksInProgress(userId, limit = 10) {
  if (!userId) return [];
  const rows = (await getAllReadingProgress(userId)).filter((r) => r.content_type === TYPE);
  if (!rows.length) return [];
  const { data } = await supabase
    .from('bazaar_books')
    .select('id, title, author_name, cover_url, file_type, file_name')
    .in('id', rows.map((r) => r.content_id));
  const books = Object.fromEntries((data || []).map((b) => [b.id, b]));
  return rows
    .filter((r) => books[r.content_id])
    .map((r) => ({ book: books[r.content_id], pos: parseBookRow(r), updated_at: r.updated_at }))
    .filter((x) => x.pos && x.pos.pct < 99.5)
    .slice(0, limit);
}
