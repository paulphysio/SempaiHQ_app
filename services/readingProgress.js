import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import { isOnlineNow } from '../hooks/useOnline';
import { isErrorNetworkError } from './offlineCache';

/*
 * Reading positions — offline-first.
 *  · every save lands on the device instantly, then syncs to the server
 *  · saves made offline are queued and pushed on the next successful call
 *  · reads merge server + device and keep whichever is newer
 * So "Continue reading" and "Resume 42%" work with or without a connection.
 */
const LOCAL = (userId) => `sempai_progress:${userId}`;
const PENDING = (userId) => `sempai_progress_pending:${userId}`;
const keyOf = (type, id) => `${type}:${id}`;
const newer = (a, b) => (new Date(a?.updated_at || 0) >= new Date(b?.updated_at || 0) ? a : b);

const readJSON = async (k, fallback) => {
  try {
    return JSON.parse((await AsyncStorage.getItem(k)) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJSON = async (k, v) => {
  try {
    await AsyncStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* non-critical */
  }
};

const upsertRemote = async (row) => {
  const { error } = await supabase
    .from('reading_progress')
    .upsert(row, { onConflict: 'user_id,content_type,content_id' });
  if (error) throw error;
};

/** Push positions saved while offline. */
const flushPending = async (userId) => {
  const pending = await readJSON(PENDING(userId), {});
  const keys = Object.keys(pending);
  if (!keys.length || isOnlineNow() === false) return;
  const left = { ...pending };
  for (const k of keys) {
    try {
      await upsertRemote(pending[k]);
      delete left[k];
    } catch (e) {
      if (isErrorNetworkError(e)) break; // still offline — try later
      delete left[k]; // bad row: drop it rather than retry forever
    }
  }
  await writeJSON(PENDING(userId), left);
};

// Saves the user's last-read position for a novel or manga.
// scrollPct is 0-100 through the current chapter.
export const saveReadingProgress = async ({ userId, contentType, contentId, chapterKey, chapterNumber, scrollPct }) => {
  if (!userId || !contentId || chapterKey === undefined || chapterKey === null) return;
  const row = {
    user_id: userId,
    content_type: contentType,
    content_id: contentId,
    chapter_key: String(chapterKey),
    chapter_number: chapterNumber ?? null,
    scroll_pct: Math.max(0, Math.min(100, Math.round((scrollPct || 0) * 10) / 10)),
    updated_at: new Date().toISOString(),
  };
  const k = keyOf(contentType, contentId);

  // 1) device first — instant and offline-proof
  const local = await readJSON(LOCAL(userId), {});
  local[k] = row;
  await writeJSON(LOCAL(userId), local);

  // 2) then the server (or the queue)
  const queue = async () => {
    const pending = await readJSON(PENDING(userId), {});
    pending[k] = row;
    await writeJSON(PENDING(userId), pending);
  };
  if (isOnlineNow() === false) {
    await queue();
    return;
  }
  try {
    await upsertRemote(row);
    flushPending(userId);
  } catch (e) {
    if (isErrorNetworkError(e)) await queue();
    else console.warn('[ReadingProgress] save failed:', e?.message);
  }
};

// Returns the progress row for one piece of content, or null.
export const getContentReadingProgress = async (userId, contentType, contentId) => {
  if (!userId || !contentId) return null;
  const local = (await readJSON(LOCAL(userId), {}))[keyOf(contentType, contentId)] || null;
  if (isOnlineNow() === false) return local;
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('content_type, content_id, chapter_key, chapter_number, scroll_pct, updated_at')
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .maybeSingle();
    if (error) throw error;
    flushPending(userId);
    if (!data) return local;
    return local ? newer(local, data) : data;
  } catch (e) {
    if (!isErrorNetworkError(e)) console.warn('[ReadingProgress] fetch failed:', e?.message);
    return local;
  }
};

// Returns all of a user's progress rows, most recently updated first.
export const getAllReadingProgress = async (userId) => {
  if (!userId) return [];
  const local = await readJSON(LOCAL(userId), {});
  const sortRows = (rows) => rows.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  if (isOnlineNow() === false) return sortRows(Object.values(local));
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('content_type, content_id, chapter_key, chapter_number, scroll_pct, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    // Merge server + device (newest wins) and refresh the device copy.
    const merged = { ...local };
    (data || []).forEach((r) => {
      const k = keyOf(r.content_type, r.content_id);
      merged[k] = merged[k] ? newer(merged[k], r) : r;
    });
    await writeJSON(LOCAL(userId), merged);
    flushPending(userId);
    return sortRows(Object.values(merged));
  } catch (e) {
    if (!isErrorNetworkError(e)) console.warn('[ReadingProgress] list failed:', e?.message);
    return sortRows(Object.values(local));
  }
};

// Convenience for library grids: { 'novel:<id>': row, 'manga:<id>': row }
export const getReadingProgressMap = async (userId) => {
  const rows = await getAllReadingProgress(userId);
  const map = {};
  for (const row of rows) map[`${row.content_type}:${row.content_id}`] = row;
  return map;
};
