import { supabase } from './supabaseClient';

// Saves the user's last-read position for a novel or manga.
// scrollPct is 0-100 through the current chapter. One row per user+content —
// reading a different chapter overwrites the previous position.
export const saveReadingProgress = async ({ userId, contentType, contentId, chapterKey, chapterNumber, scrollPct }) => {
  if (!userId || !contentId || chapterKey === undefined || chapterKey === null) return;
  try {
    const pct = Math.max(0, Math.min(100, Math.round((scrollPct || 0) * 10) / 10));
    const { error } = await supabase
      .from('reading_progress')
      .upsert(
        {
          user_id: userId,
          content_type: contentType,
          content_id: contentId,
          chapter_key: String(chapterKey),
          chapter_number: chapterNumber ?? null,
          scroll_pct: pct,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,content_type,content_id' }
      );
    if (error) console.warn('[ReadingProgress] save failed:', error.message);
  } catch (e) {
    console.warn('[ReadingProgress] save error:', e?.message);
  }
};

// Returns the progress row for one piece of content, or null.
export const getContentReadingProgress = async (userId, contentType, contentId) => {
  if (!userId || !contentId) return null;
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('content_type, content_id, chapter_key, chapter_number, scroll_pct, updated_at')
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .maybeSingle();
    if (error) {
      console.warn('[ReadingProgress] fetch failed:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[ReadingProgress] fetch error:', e?.message);
    return null;
  }
};

// Returns all of a user's progress rows, most recently updated first.
export const getAllReadingProgress = async (userId) => {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('content_type, content_id, chapter_key, chapter_number, scroll_pct, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) {
      console.warn('[ReadingProgress] list failed:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn('[ReadingProgress] list error:', e?.message);
    return [];
  }
};

// Convenience for library grids: { 'novel:<id>': row, 'manga:<id>': row }
export const getReadingProgressMap = async (userId) => {
  const rows = await getAllReadingProgress(userId);
  const map = {};
  for (const row of rows) map[`${row.content_type}:${row.content_id}`] = row;
  return map;
};
