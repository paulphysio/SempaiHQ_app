import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Offline-first writing drafts. Everything lives on the device (AsyncStorage),
 * so writers never lose work to a dropped connection, a crash or closing the
 * app. Every function is safe to call anywhere — failures are logged, never
 * thrown.
 *
 *   key  = draftKey({ novelId, chapterIndex })   e.g. "novel:abc:ch:new"
 *   saveDraft(key, { title, content })
 *   loadDraft(key) → { title, content, updatedAt } | null
 *   clearDraft(key)
 */
const PREFIX = 'sempai_draft:';
const INDEX = 'sempai_draft_index';

export const draftKey = ({ novelId, chapterIndex }) =>
  `novel:${novelId || 'new'}:ch:${chapterIndex === null || chapterIndex === undefined ? 'new' : chapterIndex}`;

const readIndex = async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem(INDEX)) || '[]');
  } catch {
    return [];
  }
};

export const saveDraft = async (key, { title = '', content = '' }) => {
  try {
    if (!title.trim() && !content.trim()) {
      await clearDraft(key);
      return null;
    }
    const draft = { title, content, updatedAt: Date.now() };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(draft));
    const index = await readIndex();
    if (!index.includes(key)) await AsyncStorage.setItem(INDEX, JSON.stringify([key, ...index].slice(0, 100)));
    return draft;
  } catch (e) {
    console.warn('[drafts] save failed:', e?.message || e);
    return null;
  }
};

export const loadDraft = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && (d.title || d.content) ? d : null;
  } catch (e) {
    console.warn('[drafts] load failed:', e?.message || e);
    return null;
  }
};

export const clearDraft = async (key) => {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
    const index = await readIndex();
    await AsyncStorage.setItem(INDEX, JSON.stringify(index.filter((k) => k !== key)));
  } catch (e) {
    console.warn('[drafts] clear failed:', e?.message || e);
  }
};

/** Writer preferences (text size, word goal) — also offline. */
const PREFS = 'sempai_writer_prefs';
export const loadWriterPrefs = async () => {
  try {
    return { fontSize: 17, goal: 2000, ...(JSON.parse((await AsyncStorage.getItem(PREFS)) || '{}')) };
  } catch {
    return { fontSize: 17, goal: 2000 };
  }
};
export const saveWriterPrefs = async (prefs) => {
  try {
    await AsyncStorage.setItem(PREFS, JSON.stringify(prefs));
  } catch {
    /* non-critical */
  }
};

export const timeSince = (ts) => {
  if (!ts) return '';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
