// @ts-nocheck - Deno edge function helper
// Send Expo push notifications to SempaiHQ users, honouring their notification settings.
//
// category: messages | community | social | releases | bazaar | kaiji | money | announcements
// (null = always delivered, e.g. security notices). A person mutes a category with
// notification_prefs.prefs[category] = false; anything missing counts as on.

const EXPO = 'https://exp.host/--/api/v2/push/send';
const VALID = /^Expo(nent)?PushToken\[/;

export const CATEGORIES = ['messages', 'community', 'social', 'releases', 'bazaar', 'kaiji', 'money', 'announcements'];

const uniq = (a: any[]) => [...new Set(a.filter(Boolean))];

/** The ids in `userIds` that have NOT muted `category`. */
export async function allowed(admin: any, userIds: string[], category: string | null) {
  const ids = uniq(userIds);
  if (!category || !ids.length) return ids;
  const muted = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from('notification_prefs').select('user_id, prefs').in('user_id', ids.slice(i, i + 200));
    for (const r of data || []) if (r?.prefs?.[category] === false) muted.add(r.user_id);
  }
  return ids.filter((id) => !muted.has(id));
}

export async function sendPush(
  admin: any,
  userIds: string[],
  msg: { title: string; body: string; data?: Record<string, unknown>; category?: string | null; collapseId?: string },
) {
  const targets = await allowed(admin, userIds, msg.category ?? null);
  if (!targets.length) return { sent: 0 };

  const tokens: string[] = [];
  for (let i = 0; i < targets.length; i += 200) {
    const { data } = await admin.from('users').select('push_token').in('id', targets.slice(i, i + 200));
    for (const u of data || []) if (typeof u.push_token === 'string' && VALID.test(u.push_token)) tokens.push(u.push_token);
  }
  const list = uniq(tokens);
  if (!list.length) return { sent: 0 };

  const messages = list.map((to) => ({
    to,
    sound: 'default',
    title: String(msg.title).slice(0, 80),
    body: String(msg.body).slice(0, 180),
    data: { ...(msg.data || {}), category: msg.category ?? null },
    channelId: 'reading-updates', // the app's high-importance Android channel (exists on every install)
    priority: 'high',
    ...(msg.collapseId ? { collapseId: msg.collapseId } : {}),
  }));

  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const r = await fetch(EXPO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      const j = await r.json().catch(() => ({}));
      (j?.data || []).forEach((t: any, k: number) => {
        if (t?.status === 'ok') sent += 1;
        else if (t?.details?.error === 'DeviceNotRegistered') dead.push(batch[k].to);
      });
    } catch (e) {
      console.warn('[push] batch failed:', (e as Error)?.message);
    }
  }
  if (dead.length) await admin.from('users').update({ push_token: null }).in('push_token', dead);
  return { sent };
}

/** Add rows to people's in-app notification bell. */
export async function addToBell(admin: any, userIds: string[], row: Record<string, unknown>) {
  const ids = uniq(userIds);
  for (let i = 0; i < ids.length; i += 500) {
    const { error } = await admin.from('notifications').insert(ids.slice(i, i + 500).map((user_id) => ({ user_id, is_read: false, ...row })));
    if (error) console.warn('[push] bell insert:', error.message);
  }
}
