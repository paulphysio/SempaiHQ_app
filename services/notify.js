import { readerAction } from './readerActions';

/*
 * Reader notifications for creators — one implementation for novels and manga.
 *
 *   new chapter      → readers of that title
 *   announcement     → readers of that title
 *   new title        → everyone who reads ANY of that creator's titles
 *
 * The SERVER (reader-actions → notify_readers) works out who the readers are,
 * checks that the caller really is the title's creator, saves the in-app
 * notifications and sends the push. The phone can no longer message arbitrary
 * people.
 *
 * Call sites stay the same shape:
 *   notifyReaders({ userIds: getTitleReaderIds('novel', id), title, body, data, rowFor })
 * — getTitleReaderIds / getCreatorReaderIds now describe the AUDIENCE rather
 * than fetching ids.
 *
 * Every function here is best-effort and never throws: a notification hiccup
 * must not turn a successful publish into a "failed to save" error.
 */

/** Audience: readers of one title. */
export const getTitleReaderIds = async (kind, contentId) => ({ audience: 'title', kind, contentId });

/** Audience: everyone who reads anything by this creator (novels AND manga), except `excludeContentId`. */
export const getCreatorReaderIds = async (creatorId, { excludeContentId } = {}) =>
  ({ audience: 'creator', contentId: excludeContentId, creatorId });

/**
 * Notify an audience. `rowFor` is still accepted: it's used once to learn the
 * notification's type/message/chapter. Returns { notified }.
 */
export const notifyReaders = async ({ userIds, title, body, data, rowFor }) => {
  try {
    const target = (await userIds) || {};
    const sample = typeof rowFor === 'function' ? rowFor('') || {} : {};
    const kind = target.kind || (sample.manga_id ? 'manga' : 'novel');
    const contentId = target.contentId || sample.novel_id || sample.manga_id;
    if (!contentId) return { notified: 0 };

    const res = await readerAction('notify_readers', {
      kind,
      contentId,
      audience: target.audience === 'creator' ? 'creator' : 'title',
      title,
      body,
      message: sample.message,
      type: sample.type || data?.type,
      chapter: sample.chapter ?? undefined,
      data,
    });
    if (!res.ok) console.warn('[notify] failed:', res.error);
    return { notified: res.ok ? Number(res.notified) || 0 : 0 };
  } catch (err) {
    console.warn('[notify] failed:', err?.message || err);
    return { notified: 0 };
  }
};
