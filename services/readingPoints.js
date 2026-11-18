import { useEffect } from 'react';
import { supabase } from './supabaseClient';
import { toast } from '../components/Toast';

/*
 * Reading points: after a reader has stayed on a chapter for a little while,
 * tell the server they read it. The server awards 100 points the FIRST time
 * each chapter is read (max 100 chapters a day) and counts a reader once per
 * manga for its read count. Repeat reads are ignored server-side.
 */
const READ_AFTER_MS = 20000;
const sentThisSession = new Set();

export async function recordChapterRead(contentType, contentId, chapterKey) {
  const key = `${contentType}:${contentId}:${chapterKey}`;
  if (!contentId || chapterKey == null || sentThisSession.has(key)) return null;
  sentThisSession.add(key);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { sentThisSession.delete(key); return null; }
    const { data, error } = await supabase.rpc('record_chapter_read', {
      p_content_type: contentType,
      p_content_id: contentId,
      p_chapter_key: String(chapterKey),
    });
    if (error) { sentThisSession.delete(key); return null; }
    if (data?.points > 0) toast.success(`+${data.points} points for reading`);
    return data;
  } catch {
    sentThisSession.delete(key);
    return null;
  }
}

/** Records the read once the reader has been on this chapter for ~20s. */
export function useChapterReadPoints({ contentType, contentId, chapterKey, enabled }) {
  useEffect(() => {
    if (!enabled || !contentId || chapterKey == null) return undefined;
    const t = setTimeout(() => { recordChapterRead(contentType, contentId, chapterKey); }, READ_AFTER_MS);
    return () => clearTimeout(t);
  }, [contentType, contentId, chapterKey, enabled]);
}
