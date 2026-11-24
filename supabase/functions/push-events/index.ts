// @ts-nocheck - Deno edge function
// push-events: called by the database (trigger public.push_event, see
// migrations/20261207_push_events.sql) whenever something notification-worthy is saved.
// Works out who should hear about it, adds it to their in-app bell and sends the phone push.
//
// Auth: the x-push-secret header must match public.push_config.secret (generated inside the
// database; only the service role can read it). Deploy with --no-verify-jwt: the database
// trigger has no user JWT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.1';
import { sendPush, addToBell } from '../_shared/push.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  (Deno.env.get('SB_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!,
);

let secretCache: string | null = null;
async function secret() {
  if (secretCache) return secretCache;
  const { data } = await admin.from('push_config').select('secret').eq('id', 1).maybeSingle();
  secretCache = data?.secret || null;
  return secretCache;
}

const clip = (s: unknown, n: number) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function person(id: string | null) {
  if (!id) return null;
  const { data } = await admin.from('users').select('id, name, wallet_address').eq('id', id).maybeSingle();
  return data;
}
const nameOf = (u: any) => (u?.name && !BASE58.test(u.name) ? clip(u.name, 40) : 'Someone');

async function userIdsForWallets(wallets: string[]) {
  const ws = [...new Set(wallets.filter(Boolean))];
  if (!ws.length) return [];
  const ids = new Set<string>();
  const { data: a } = await admin.from('users').select('id').in('wallet_address', ws);
  (a || []).forEach((r: any) => ids.add(r.id));
  const { data: b } = await admin.from('user_wallets').select('user_id').in('address', ws);
  (b || []).forEach((r: any) => r.user_id && ids.add(r.user_id));
  return [...ids];
}

/** true the first time `key` is seen (a once-only / throttle marker). */
async function once(key: string) {
  const { error } = await admin.from('push_log').insert({ key });
  return !error;
}
/** true while fewer than `max` markers with this prefix exist (a simple daily/hourly cap). */
async function slot(prefix: string, max: number) {
  for (let k = 0; k < max; k += 1) if (await once(`${prefix}:${k}`)) return true;
  return false;
}
const bucket = (minutes: number) => Math.floor(Date.now() / (minutes * 60_000));

async function everyone(exclude: string | null) {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin.from('users').select('id').not('push_token', 'is', null).range(from, from + 999);
    ids.push(...(data || []).map((r: any) => r.id));
    if (!data || data.length < 1000) break;
  }
  return ids.filter((id) => id !== exclude);
}

// ─── handlers, one per table ────────────────────────────────────────────────
const handlers: Record<string, (r: any, old: any) => Promise<void>> = {
  // Private message → the recipient
  async private_messages(r) {
    if (!r.recipient_id || r.recipient_id === r.sender_id) return;
    if (!(await once(`dm:${r.id}`))) return; // the trigger can retry; never push the same message twice
    const from = await person(r.sender_id);
    const body = r.content ? clip(r.content, 160) : r.media_url ? '📷 Sent a photo' : 'New message';
    await sendPush(admin, [r.recipient_id], {
      title: nameOf(from),
      body,
      data: { type: 'dm', userId: r.sender_id },
      category: 'messages',
      collapseId: `dm-${r.sender_id}`,
    });
  },

  // Community chat → only the person you replied to
  async messages(r) {
    if (!r.parent_id) return;
    const { data: parent } = await admin.from('messages').select('user_id').eq('id', r.parent_id).maybeSingle();
    if (!parent?.user_id || parent.user_id === r.user_id) return;
    const from = await person(r.user_id);
    await sendPush(admin, [parent.user_id], {
      title: `${nameOf(from)} replied to you`,
      body: r.content ? clip(r.content, 160) : '📷 Photo',
      data: { type: 'community' },
      category: 'community',
    });
  },

  // New Crazy Corner post → followers (at most once an hour per author)
  async feed_posts(r) {
    if (!(await once(`post:${r.user_id}:${bucket(60)}`))) return;
    const { data } = await admin.from('feed_follows').select('follower_id').eq('following_id', r.user_id).limit(5000);
    const fans = (data || []).map((x: any) => x.follower_id).filter((id: string) => id !== r.user_id);
    if (!fans.length) return;
    const who = nameOf(await person(r.user_id));
    await sendPush(admin, fans, {
      title: `${who} posted in Crazy Corner`,
      body: clip(r.content, 160) || '📷 New photo',
      data: { type: 'feed_post', postId: r.id },
      category: 'social',
    });
  },

  // Like → the post's author, grouped: at most one push per post every 30 minutes
  async feed_post_likes(r) {
    const { data: post } = await admin.from('feed_posts').select('user_id, content, likes_count').eq('id', r.post_id).maybeSingle();
    if (!post?.user_id || post.user_id === r.user_id) return;
    if (!(await once(`like:${r.post_id}:${bucket(30)}`))) return;
    const who = nameOf(await person(r.user_id));
    const others = Math.max(0, Number(post.likes_count || 1) - 1);
    const title = others > 0 ? `${who} and ${others} other${others === 1 ? '' : 's'} liked your post` : `${who} liked your post`;
    await addToBell(admin, [post.user_id], { type: 'feed_like', message: `${title}: “${clip(post.content, 60)}”`, actor_id: r.user_id, data: { postId: r.post_id } });
    await sendPush(admin, [post.user_id], { title, body: clip(post.content, 120) || 'Your post', data: { type: 'feed_post', postId: r.post_id }, category: 'social', collapseId: `like-${r.post_id}` });
  },

  // Reply → the post's author, and the person whose reply was answered
  async feed_comments(r) {
    const { data: post } = await admin.from('feed_posts').select('user_id').eq('id', r.post_id).maybeSingle();
    const targets = new Set<string>();
    let parentAuthor: string | null = null;
    if (r.parent_comment_id) {
      const { data: parent } = await admin.from('feed_comments').select('user_id').eq('id', r.parent_comment_id).maybeSingle();
      parentAuthor = parent?.user_id ?? null;
    }
    if (post?.user_id) targets.add(post.user_id);
    if (parentAuthor) targets.add(parentAuthor);
    targets.delete(r.user_id);
    if (!targets.size) return;
    const who = nameOf(await person(r.user_id));
    for (const id of targets) {
      const title = id === parentAuthor ? `${who} replied to you` : `${who} replied to your post`;
      await addToBell(admin, [id], { type: 'feed_reply', message: `${title}: “${clip(r.content, 80)}”`, actor_id: r.user_id, data: { postId: r.post_id } });
      await sendPush(admin, [id], { title, body: clip(r.content, 160), data: { type: 'feed_post', postId: r.post_id }, category: 'social' });
    }
  },

  // Follow → the person followed (once per pair per day)
  async feed_follows(r) {
    if (!r.following_id || r.following_id === r.follower_id) return;
    if (!(await once(`follow:${r.follower_id}:${r.following_id}:${bucket(1440)}`))) return;
    const who = nameOf(await person(r.follower_id));
    await addToBell(admin, [r.following_id], { type: 'follow', message: `${who} started following you`, actor_id: r.follower_id, data: { userId: r.follower_id } });
    await sendPush(admin, [r.following_id], { title: 'New follower', body: `${who} started following you`, data: { type: 'profile', userId: r.follower_id }, category: 'social' });
  },

  // New Bazaar book → everyone (max 3 broadcasts a day per author)
  async bazaar_books(r) {
    if (r.status && r.status !== 'active') return;
    if (!(await once(`bazaar:${r.id}`))) return;
    if (!(await slot(`bazaar-author:${r.author_id}:${bucket(1440)}`, 3))) return; // max 3 announced uploads a day per author
    const who = clip(r.author_name, 40) || nameOf(await person(r.author_id));
    const targets = await everyone(r.author_id);
    const title = 'New in the Bazaar 📚';
    const body = `“${clip(r.title, 60)}” by ${who}`;
    await addToBell(admin, targets, { type: 'bazaar_new', message: `${body} is now in the Bazaar`, actor_id: r.author_id, data: { bookId: r.id } });
    await sendPush(admin, targets, { title, body, data: { type: 'bazaar_book', bookId: r.id }, category: 'bazaar' });
  },

  // Bazaar sale / loan → the book's author
  async bazaar_purchases(r) {
    const { data: book } = await admin.from('bazaar_books').select('author_id, title').eq('id', r.book_id).maybeSingle();
    if (!book?.author_id || book.author_id === r.buyer_id) return;
    const lend = r.access_type === 'lend';
    const amount = r.author_amount != null ? `${Number(r.author_amount)} ${r.currency}` : `$${r.price_usd}`;
    const title = lend ? 'Someone borrowed your book 📖' : 'You made a sale! 💸';
    const body = lend ? `“${clip(book.title, 60)}” was just borrowed.` : `“${clip(book.title, 60)}” sold — ${amount} is yours.`;
    await addToBell(admin, [book.author_id], { type: lend ? 'bazaar_lend' : 'bazaar_sale', message: body, data: { bookId: r.book_id } });
    await sendPush(admin, [book.author_id], { title, body, data: { type: 'bazaar_book', bookId: r.book_id }, category: 'money' });
  },

  // New manga / comic → everyone
  async manga(r) {
    if (!(await once(`manga:${r.id}`))) return;
    const who = clip(r.author, 40) || nameOf(await person(r.user_id));
    const targets = await everyone(r.user_id);
    const body = `“${clip(r.title, 60)}” by ${who}`;
    await addToBell(admin, targets, { type: 'new_manga', message: `New manga: ${body}`, manga_id: r.id, actor_id: r.user_id });
    await sendPush(admin, targets, { title: 'New manga just dropped 🎨', body, data: { type: 'new_manga', mangaId: r.id }, category: 'releases' });
  },

  // New novel → everyone
  async novels(r) {
    if (!(await once(`novel:${r.id}`))) return;
    const who = nameOf(await person(r.user_id));
    const targets = await everyone(r.user_id);
    const body = `“${clip(r.title, 60)}” by ${who}`;
    await addToBell(admin, targets, { type: 'new_novel', message: `New novel: ${body}`, novel_id: r.id, novel_title: clip(r.title, 120), actor_id: r.user_id });
    await sendPush(admin, targets, { title: 'New novel on SempaiHQ ✍️', body, data: { type: 'new_novel', novelId: r.id }, category: 'releases' });
  },

  // Kaiji: an open game → past Kaiji players; a finished match → both players
  async kaiji_matches(r, old) {
    if (r.status === 'waiting') {
      if (r.challenge) return; // challenges already notify through the kaiji function
      if (!(await once(`kaiji-open:${r.wallet_a}:${bucket(10)}`))) return;
      const { data } = await admin.from('kaiji_matches').select('wallet_a, wallet_b').order('created_at', { ascending: false }).limit(1000);
      const wallets = (data || []).flatMap((m: any) => [m.wallet_a, m.wallet_b]).filter((w: string) => w && w !== r.wallet_a);
      const [me] = await userIdsForWallets([r.wallet_a]);
      const targets = (await userIdsForWallets(wallets)).filter((id) => id !== me);
      if (!targets.length) return;
      const who = nameOf(await person(me));
      const stake = r.wager ? ` for ${Number(r.wager) / 1e6} SKR` : '';
      await sendPush(admin, targets, { title: '⚔️ A Kaiji game is open', body: `${who} is waiting for an opponent${stake}. Tap to play.`, data: { type: 'kaiji' }, category: 'kaiji', collapseId: 'kaiji-open' });
      return;
    }
    if (r.status === 'settled' && old?.status !== 'settled') {
      if (!(await once(`kaiji-done:${r.id}`))) return;
      const [a] = await userIdsForWallets([r.wallet_a]);
      const [b] = await userIdsForWallets([r.wallet_b]);
      const send = (id: string | undefined, title: string, body: string) =>
        id ? sendPush(admin, [id], { title, body, data: { type: 'kaiji' }, category: 'kaiji' }) : null;
      if (r.outcome === 'win') {
        const winner = r.winner === 'a' ? a : b;
        const loser = r.winner === 'a' ? b : a;
        const wName = nameOf(await person(winner));
        await send(winner, '🏆 You won at Kaiji!', 'Your winnings have been sent to your wallet.');
        await send(loser, 'Kaiji match over', `${wName} took this one. Rematch?`);
      } else if (r.outcome === 'draw') {
        await send(a, 'Kaiji: a draw', 'Your wager has been returned.');
        await send(b, 'Kaiji: a draw', 'Your wager has been returned.');
      }
    }
  },
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const s = await secret();
  if (!s || req.headers.get('x-push-secret') !== s) return new Response('Forbidden', { status: 403 });
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const h = handlers[body?.table];
  if (!h || !body?.record) return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  try {
    await h(body.record, body.old);
  } catch (e) {
    console.error('[push-events]', body.table, (e as Error)?.message);
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
