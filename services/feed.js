import { supabase } from './supabaseClient';
import { readImageBytes } from '../utils/imageUpload';

/*
 * Crazy Corner data. Everything runs as the signed-in person (the database
 * rules check it), and the like / reply / repost counts are kept by the
 * database (migrations/20261202_crazy_corner.sql).
 */
export const FEED_PAGE = 20;
export const POST_MAX = 280;
export const MAX_IMAGES = 4;
export const SITE_URL = 'https://sempaihq.com';

const POST_FIELDS =
  'id, user_id, content, image_url, image_urls, gif_url, likes_count, comments_count, shares_count, created_at, ' +
  'author:users(id, name, image, isWriter, isArtist)';
const REPLY_FIELDS = 'id, post_id, user_id, content, likes_count, created_at, author:users(id, name, image, isWriter, isArtist)';

/** The signed-in person's id, or null for guests / expired sessions. */
export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

export async function fetchMe(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('users').select('id, name, image, isWriter, isArtist').eq('id', userId).maybeSingle();
  return data || null;
}

/** A page of posts, newest first. `before` = created_at of the last post shown. */
export async function fetchPosts({ before = null, authorIds = null } = {}) {
  let q = supabase.from('feed_posts').select(POST_FIELDS).order('created_at', { ascending: false }).limit(FEED_PAGE);
  if (before) q = q.lt('created_at', before);
  if (authorIds) {
    if (!authorIds.length) return [];
    q = q.in('user_id', authorIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchPost(postId) {
  const { data, error } = await supabase.from('feed_posts').select(POST_FIELDS).eq('id', postId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Which of these posts I liked / reposted. */
export async function fetchMyMarks(userId, postIds) {
  if (!userId || !postIds.length) return { liked: {}, reposted: {} };
  const [likes, shares] = await Promise.all([
    supabase.from('feed_post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
    supabase.from('feed_shares').select('post_id').eq('user_id', userId).in('post_id', postIds),
  ]);
  const toMap = (rows) => Object.fromEntries((rows || []).map((r) => [r.post_id, true]));
  return { liked: toMap(likes.data), reposted: toMap(shares.data) };
}

export async function fetchFollowing(userId) {
  if (!userId) return [];
  const { data } = await supabase.from('feed_follows').select('following_id').eq('follower_id', userId);
  return (data || []).map((r) => r.following_id);
}

const ignoreDuplicate = (error) => (error && error.code !== '23505' ? error : null);

export async function setLiked(userId, postId, on) {
  const { error } = on
    ? await supabase.from('feed_post_likes').insert({ post_id: postId, user_id: userId })
    : await supabase.from('feed_post_likes').delete().eq('post_id', postId).eq('user_id', userId);
  const e = ignoreDuplicate(error);
  if (e) throw e;
}

export async function setReposted(userId, postId, on) {
  const { error } = on
    ? await supabase.from('feed_shares').insert({ post_id: postId, user_id: userId })
    : await supabase.from('feed_shares').delete().eq('post_id', postId).eq('user_id', userId);
  const e = ignoreDuplicate(error);
  if (e) throw e;
}

export async function setFollowing(userId, otherId, on) {
  const { error } = on
    ? await supabase.from('feed_follows').insert({ follower_id: userId, following_id: otherId })
    : await supabase.from('feed_follows').delete().eq('follower_id', userId).eq('following_id', otherId);
  const e = ignoreDuplicate(error);
  if (e) throw e;
}

/** Uploads already-shrunk photos ({uri}) and creates the post. */
export async function createPost(userId, { content, images = [] }) {
  const urls = [];
  for (let i = 0; i < images.length; i++) {
    const path = `${userId}/${Date.now()}-${i}.jpg`;
    const { error } = await supabase.storage
      .from('feed-images')
      .upload(path, await readImageBytes(images[i].uri), { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error(`Picture upload failed: ${error.message}`);
    urls.push(supabase.storage.from('feed-images').getPublicUrl(path).data.publicUrl);
  }
  const { data, error } = await supabase
    .from('feed_posts')
    .insert({ user_id: userId, content: content.trim(), image_urls: urls.length ? urls : null })
    .select(POST_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(postId) {
  const { error } = await supabase.from('feed_posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function fetchReplies(postId) {
  const { data, error } = await supabase.from('feed_comments').select(REPLY_FIELDS).eq('post_id', postId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addReply(userId, postId, content) {
  const { data, error } = await supabase
    .from('feed_comments')
    .insert({ post_id: postId, user_id: userId, content: content.trim() })
    .select(REPLY_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReply(replyId) {
  const { error } = await supabase.from('feed_comments').delete().eq('id', replyId);
  if (error) throw error;
}

/** Pictures of a post, old (image_url) and new (image_urls) style. */
export const postImages = (p) => {
  const list = Array.isArray(p?.image_urls) ? p.image_urls.filter(Boolean) : [];
  if (!list.length && p?.image_url) list.push(p.image_url);
  if (p?.gif_url) list.push(p.gif_url);
  return list.slice(0, MAX_IMAGES);
};

/*
 * Posting to X without X's paid API: X's own "share" page opens with the text
 * filled in (in the X app if installed) and the person taps Post there.
 */
export function xShareUrl(text, url = `${SITE_URL}/feed`) {
  const room = 280 - 24 - 1; // X counts any link as 23–24 characters
  const body = text.length > room ? `${text.slice(0, room - 1).trimEnd()}…` : text;
  return `https://x.com/intent/post?text=${encodeURIComponent(body)}&url=${encodeURIComponent(url)}`;
}

/** Display name: real name, or a short wallet when the name is a wallet. */
export const displayName = (u) => {
  const n = (u?.name || '').trim();
  if (!n) return 'Reader';
  return n.length > 30 && !/\s/.test(n) ? `${n.slice(0, 4)}…${n.slice(-4)}` : n;
};

/** X-style time: now · 5m · 3h · 2d · Nov 5 · Nov 5, 2025 */
export function shortTime(iso) {
  const d = new Date(iso);
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const base = `${months[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

export const compactCount = (n) => {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 1e6) return `${(v / 1000).toFixed(v < 1e4 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
};
