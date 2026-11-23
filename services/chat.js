import { supabase } from './supabaseClient';
import { readImageBytes } from '../utils/imageUpload';

/*
 * Chat data. Everything runs as the signed-in person; the database decides
 * who can read / write (migrations/20261205_chat.sql).
 *   Community = public.messages (everyone)
 *   Private   = public.private_messages between two accounts
 */
export const PAGE = 40;
const PEOPLE = 'id, name, image, isWriter, isArtist';

export async function myId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

export async function fetchPeople(ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) return {};
  const { data } = await supabase.from('users').select(PEOPLE).in('id', list);
  return Object.fromEntries((data || []).map((u) => [u.id, u]));
}

export async function searchPeople(q, me) {
  const term = (q || '').trim();
  if (term.length < 2) return [];
  const { data } = await supabase
    .from('users')
    .select(PEOPLE)
    .ilike('name', `%${term.replace(/[%_]/g, '')}%`)
    .limit(20);
  return (data || []).filter((u) => u.id !== me);
}

/** Conversation list: [{ other_id, other_name, other_image, last_content, last_media, last_at, last_from_me, unread }] */
export async function fetchInbox() {
  const { data, error } = await supabase.rpc('chat_inbox');
  if (error) throw error;
  return data || [];
}

/** Last community message (for the pinned Community row). */
export async function fetchCommunityPreview() {
  const { data } = await supabase
    .from('messages')
    .select('content, media_url, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

const norm = (m, kind) => ({
  id: m.id,
  kind,
  authorId: kind === 'group' ? m.user_id : m.sender_id,
  recipientId: kind === 'dm' ? m.recipient_id : null,
  content: m.content || '',
  media: m.media_url || null,
  parentId: m.parent_id || null,
  createdAt: m.created_at,
  editedAt: m.edited_at || null,
  readAt: m.read_at || null,
});

/** Older-first page of messages. before = createdAt of the oldest one shown. */
export async function fetchMessages(chat, { before = null, me = null } = {}) {
  let q;
  if (chat.type === 'group') {
    q = supabase.from('messages').select('id, user_id, content, media_url, parent_id, created_at, edited_at');
  } else {
    q = supabase
      .from('private_messages')
      .select('id, sender_id, recipient_id, content, media_url, parent_id, created_at, edited_at, read_at')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${chat.userId}),and(sender_id.eq.${chat.userId},recipient_id.eq.${me})`);
  }
  q = q.order('created_at', { ascending: false }).limit(PAGE);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((m) => norm(m, chat.type)).reverse();
}

export async function sendMessage(chat, { content, media = null, parentId = null }) {
  const body = { content: (content || '').trim() || null, media_url: media, parent_id: parentId };
  const res = chat.type === 'group'
    ? await supabase.from('messages').insert(body).select('id, user_id, content, media_url, parent_id, created_at, edited_at').single()
    : await supabase
        .from('private_messages')
        .insert({ ...body, recipient_id: chat.userId })
        .select('id, sender_id, recipient_id, content, media_url, parent_id, created_at, edited_at, read_at')
        .single();
  if (res.error) throw res.error;
  return norm(res.data, chat.type);
}

export async function editMessage(chat, id, content) {
  const table = chat.type === 'group' ? 'messages' : 'private_messages';
  const { error } = await supabase.from(table).update({ content: content.trim() }).eq('id', id);
  if (error) throw error;
}

export async function deleteMessage(chat, id) {
  const table = chat.type === 'group' ? 'messages' : 'private_messages';
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function markRead(otherId) {
  if (!otherId) return;
  try { await supabase.rpc('chat_mark_read', { p_other: otherId }); } catch { /* best effort */ }
}

/** Uploads a shrunk photo ({ uri }) and returns its public link. */
export async function uploadPhoto(me, photo) {
  const path = `${me}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('chat-media')
    .upload(path, await readImageBytes(photo.uri), { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
}

export async function searchGifs(q) {
  let query = supabase.from('gifs').select('id, url, title').limit(30);
  if (q?.trim()) query = query.ilike('title', `%${q.trim()}%`);
  const { data } = await query;
  return (data || []).filter((g) => g.url);
}

/*
 * Live updates for one conversation: new / edited / deleted messages, plus
 * "typing…" (a broadcast nobody stores). Returns { stop, typing() }.
 */
export function watchChat(chat, me, { onInsert, onUpdate, onDelete, onTyping }) {
  const key = chat.type === 'group' ? 'group' : [me, chat.userId].sort().join(':');
  const table = chat.type === 'group' ? 'messages' : 'private_messages';
  const mine = (row) => chat.type === 'group'
    || (row.sender_id === me && row.recipient_id === chat.userId)
    || (row.sender_id === chat.userId && row.recipient_id === me);
  const ch = supabase
    .channel(`chat:${key}:${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (p) => { if (mine(p.new)) onInsert?.(norm(p.new, chat.type)); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, (p) => { if (mine(p.new)) onUpdate?.(norm(p.new, chat.type)); })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) => { if (p.old?.id) onDelete?.(p.old.id); })
    .subscribe();
  const typingCh = supabase.channel(`typing:${key}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'typing' }, (p) => onTyping?.(p.payload?.userId))
    .subscribe();
  let last = 0;
  return {
    typing: () => {
      const now = Date.now();
      if (now - last < 2500) return;
      last = now;
      typingCh.send({ type: 'broadcast', event: 'typing', payload: { userId: me } }).catch(() => {});
    },
    stop: () => { supabase.removeChannel(ch); supabase.removeChannel(typingCh); },
  };
}
