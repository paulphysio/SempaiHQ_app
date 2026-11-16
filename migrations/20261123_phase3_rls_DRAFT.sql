-- ════════════════════════════════════════════════════════════════════════
-- PHASE 3 · ROW RULES — DRAFT, DO NOT RUN YET
--
-- Every table gets rules based on WHO is signed in (auth.uid()), so the app
-- can stop using the server key. Today the app still sends the server key,
-- which skips these rules — so they only start protecting anything at the
-- Phase 3 switch-over, when they run together with:
--   · the app update that uses the reader's own sign-in (no server key)
--   · the edge functions for money/trust actions (see PHASE 3 plan)
--   · rotating the server key
--
-- Rule shapes used below:
--   public  — everyone reads; signed-in owner writes their own rows
--   private — only the owner reads and writes
--   creator — everyone reads; the novel/manga's creator writes
--   server  — everyone (or owner) reads; ONLY the server writes
--
-- Admins (users.isSuperuser) can moderate (update/delete) public content.
-- Test on a copy of the database before running in production.
-- ════════════════════════════════════════════════════════════════════════
begin;

-- ── helpers (owner-rights, read-only, safe to expose) ─────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select u."isSuperuser" from public.users u where u.id = auth.uid()), false)
$$;

create or replace function public.my_wallets() returns setof text
language sql stable security definer set search_path = public as $$
  select u.wallet_address from public.users u where u.id = auth.uid() and u.wallet_address is not null
  union
  select w.address from public.user_wallets w where w.user_id = auth.uid()
$$;

create or replace function public.owns_novel(p_novel uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.novels n where n.id = p_novel and n.user_id = auth.uid())
$$;

create or replace function public.owns_manga(p_manga uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.manga m where m.id = p_manga and m.user_id = auth.uid())
$$;

create or replace function public.owns_manga_chapter(p_chapter uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.manga_chapters c join public.manga m on m.id = c.manga_id
                 where c.id = p_chapter and m.user_id = auth.uid())
$$;

grant execute on function public.is_admin(), public.my_wallets(), public.owns_novel(uuid),
  public.owns_manga(uuid), public.owns_manga_chapter(uuid) to anon, authenticated;

-- small helper to (re)create a policy
create or replace function pg_temp.pol(t text, name text, cmd text, roles text, using_ text, check_ text)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I', name, t);
  execute format('create policy %I on public.%I for %s to %s%s%s', name, t, cmd, roles,
    case when using_ is null then '' else ' using (' || using_ || ')' end,
    case when check_ is null then '' else ' with check (' || check_ || ')' end);
end $$;

-- ── public: everyone reads, owner writes (user_id) ────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'comments', 'manga_comments', 'manga_detail_comments', 'chapter_ratings',
    'feed_posts', 'feed_comments', 'feed_post_likes', 'feed_comment_likes', 'feed_shares',
    'polls', 'votes', 'hoard_items', 'writer_profiles', 'messages'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    perform pg_temp.pol(t, t || ': read',   'select', 'anon, authenticated', 'true', null);
    perform pg_temp.pol(t, t || ': add own', 'insert', 'authenticated', null, 'user_id = auth.uid()');
    perform pg_temp.pol(t, t || ': edit own', 'update', 'authenticated',
      'user_id = auth.uid() or public.is_admin()', 'user_id = auth.uid() or public.is_admin()');
    perform pg_temp.pol(t, t || ': remove own', 'delete', 'authenticated', 'user_id = auth.uid() or public.is_admin()', null);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
end $$;

-- feed_follows: the follower owns the row
alter table public.feed_follows enable row level security;
select pg_temp.pol('feed_follows', 'feed_follows: read', 'select', 'anon, authenticated', 'true', null);
select pg_temp.pol('feed_follows', 'feed_follows: follow', 'insert', 'authenticated', null, 'follower_id = auth.uid()');
select pg_temp.pol('feed_follows', 'feed_follows: unfollow', 'delete', 'authenticated', 'follower_id = auth.uid()', null);
grant select on public.feed_follows to anon, authenticated;
grant insert, delete on public.feed_follows to authenticated;
revoke insert, update, delete on public.feed_follows from anon;

-- ── private: only the owner reads and writes (user_id) ────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'reading_progress', 'reading_time_sessions', 'manga_interactions', 'feed_user_engagement'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    perform pg_temp.pol(t, t || ': own rows', 'all', 'authenticated', 'user_id = auth.uid()', 'user_id = auth.uid()');
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- notifications: you read/mark your own; creating them for others is server-only
alter table public.notifications enable row level security;
select pg_temp.pol('notifications', 'notifications: mine', 'select', 'authenticated',
  'user_id = auth.uid() or recipient_wallet_address in (select public.my_wallets())', null);
select pg_temp.pol('notifications', 'notifications: mark read', 'update', 'authenticated',
  'user_id = auth.uid() or recipient_wallet_address in (select public.my_wallets())',
  'user_id = auth.uid() or recipient_wallet_address in (select public.my_wallets())');
select pg_temp.pol('notifications', 'notifications: clear mine', 'delete', 'authenticated',
  'user_id = auth.uid() or recipient_wallet_address in (select public.my_wallets())', null);
revoke all on public.notifications from anon;
revoke insert on public.notifications from authenticated;
grant select, update, delete on public.notifications to authenticated;

-- private messages: sender or recipient (by wallet)
alter table public.private_messages enable row level security;
select pg_temp.pol('private_messages', 'private_messages: my conversations', 'select', 'authenticated',
  'sender_wallet in (select public.my_wallets()) or recipient_wallet in (select public.my_wallets())', null);
select pg_temp.pol('private_messages', 'private_messages: send as me', 'insert', 'authenticated', null,
  'sender_wallet in (select public.my_wallets())');
select pg_temp.pol('private_messages', 'private_messages: update mine', 'update', 'authenticated',
  'sender_wallet in (select public.my_wallets()) or recipient_wallet in (select public.my_wallets())',
  'sender_wallet in (select public.my_wallets()) or recipient_wallet in (select public.my_wallets())');
select pg_temp.pol('private_messages', 'private_messages: delete sent', 'delete', 'authenticated',
  'sender_wallet in (select public.my_wallets())', null);
revoke all on public.private_messages from anon;
grant select, insert, update, delete on public.private_messages to authenticated;

-- Kaito Adventure save: your own wallet's player (leaderboard stays public)
alter table public.players enable row level security;
select pg_temp.pol('players', 'players: read', 'select', 'anon, authenticated', 'true', null);
select pg_temp.pol('players', 'players: my save', 'insert', 'authenticated', null, 'wallet_address in (select public.my_wallets())');
select pg_temp.pol('players', 'players: update my save', 'update', 'authenticated',
  'wallet_address in (select public.my_wallets())', 'wallet_address in (select public.my_wallets())');
grant select on public.players to anon, authenticated;
grant insert, update on public.players to authenticated;
revoke insert, update, delete on public.players from anon;

-- ── creator content ────────────────────────────────────────────────────────
alter table public.novels enable row level security;
select pg_temp.pol('novels', 'novels: read', 'select', 'anon, authenticated', 'true', null);
select pg_temp.pol('novels', 'novels: writers add', 'insert', 'authenticated', null, 'user_id = auth.uid()');
select pg_temp.pol('novels', 'novels: writer edits', 'update', 'authenticated',
  'user_id = auth.uid() or public.is_admin()', 'user_id = auth.uid() or public.is_admin()');
select pg_temp.pol('novels', 'novels: writer deletes', 'delete', 'authenticated', 'user_id = auth.uid() or public.is_admin()', null);
grant select on public.novels to anon, authenticated;
grant insert, update, delete on public.novels to authenticated;
revoke insert, update, delete on public.novels from anon;

alter table public.manga enable row level security;
select pg_temp.pol('manga', 'manga: read', 'select', 'anon, authenticated', 'true', null);
select pg_temp.pol('manga', 'manga: artists add', 'insert', 'authenticated', null, 'user_id = auth.uid()');
select pg_temp.pol('manga', 'manga: artist edits', 'update', 'authenticated',
  'user_id = auth.uid() or public.is_admin()', 'user_id = auth.uid() or public.is_admin()');
select pg_temp.pol('manga', 'manga: artist deletes', 'delete', 'authenticated', 'user_id = auth.uid() or public.is_admin()', null);
grant select on public.manga to anon, authenticated;
grant insert, update, delete on public.manga to authenticated;
revoke insert, update, delete on public.manga from anon;

alter table public.manga_chapters enable row level security;
select pg_temp.pol('manga_chapters', 'manga_chapters: read', 'select', 'anon, authenticated', 'true', null);
select pg_temp.pol('manga_chapters', 'manga_chapters: artist writes', 'all', 'authenticated',
  'public.owns_manga(manga_id) or public.is_admin()', 'public.owns_manga(manga_id) or public.is_admin()');
grant select on public.manga_chapters to anon, authenticated;
grant insert, update, delete on public.manga_chapters to authenticated;
revoke insert, update, delete on public.manga_chapters from anon;

-- manga pages are paid content: served by the manga-chapter-pages function,
-- so nobody reads them directly; the artist manages their own pages.
alter table public.manga_pages enable row level security;
select pg_temp.pol('manga_pages', 'manga_pages: artist manages', 'all', 'authenticated',
  'public.owns_manga_chapter(chapter_id) or public.is_admin()',
  'public.owns_manga_chapter(chapter_id) or public.is_admin()');
revoke all on public.manga_pages from anon;
grant select, insert, update, delete on public.manga_pages to authenticated;

alter table public.writer_announcements enable row level security;
select pg_temp.pol('writer_announcements', 'writer_announcements: read', 'select', 'anon, authenticated', 'true', null);
select pg_temp.pol('writer_announcements', 'writer_announcements: writer posts', 'all', 'authenticated',
  'writer_id = auth.uid() or public.is_admin()', 'writer_id = auth.uid() or public.is_admin()');
grant select on public.writer_announcements to anon, authenticated;
grant insert, update, delete on public.writer_announcements to authenticated;
revoke insert, update, delete on public.writer_announcements from anon;

alter table public.announcements enable row level security;
select pg_temp.pol('announcements', 'announcements: read', 'select', 'anon, authenticated', 'true', null);
select pg_temp.pol('announcements', 'announcements: owner or admin', 'all', 'authenticated',
  '(user_id = auth.uid() and not coalesce(is_superuser_announcement, false)) or public.is_admin()',
  '(user_id = auth.uid() and not coalesce(is_superuser_announcement, false)) or public.is_admin()');
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
revoke insert, update, delete on public.announcements from anon;

-- ── applications: apply as yourself; admins review ───────────────────────
alter table public.creator_applications enable row level security;
select pg_temp.pol('creator_applications', 'creator_applications: mine or admin', 'select', 'authenticated',
  'user_id = auth.uid() or public.is_admin()', null);
select pg_temp.pol('creator_applications', 'creator_applications: apply', 'insert', 'authenticated', null, 'user_id = auth.uid()');
select pg_temp.pol('creator_applications', 'creator_applications: admin reviews', 'update', 'authenticated',
  'public.is_admin()', 'public.is_admin()');
revoke all on public.creator_applications from anon;
grant select, insert, update on public.creator_applications to authenticated;

-- support requests: anyone can send one; only admins read them
alter table public.support_requests enable row level security;
select pg_temp.pol('support_requests', 'support_requests: send', 'insert', 'anon, authenticated', null, 'true');
select pg_temp.pol('support_requests', 'support_requests: admins read', 'select', 'authenticated', 'public.is_admin()', null);
revoke all on public.support_requests from anon, authenticated;
grant insert on public.support_requests to anon, authenticated;
grant select on public.support_requests to authenticated;

-- ── users: everyone reads profiles; you edit your own (columns limited by the money lock) ──
alter table public.users enable row level security;
select pg_temp.pol('users', 'users: read profiles', 'select', 'anon, authenticated', 'true', null);
select pg_temp.pol('users', 'users: create my row', 'insert', 'authenticated', null, 'id = auth.uid()');
select pg_temp.pol('users', 'users: edit my row', 'update', 'authenticated',
  'id = auth.uid() or public.is_admin()', 'id = auth.uid() or public.is_admin()');
revoke insert, update on public.users from anon;

-- ── server-only (reads as today, writes only via edge functions) ──────────
-- Money/trust tables were made write-protected by the money lock; enabling
-- row security here with read-only rules finishes them.
do $$
declare t text;
begin
  foreach t in array array[
    'chapter_payments', 'ad_based_unlocks', 'user_badges', 'writer_subscriptions',
    'writer_access_log', 'gifs', 'challenge_attempts', 'settings', 'badges',
    'wallet_balances', 'wallet_events', 'amethyst_balances', 'unlocked_story_chapters',
    'unlocked_manga_chapters', 'user_payments', 'benefactor_early_access', 'novel_interactions'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    perform pg_temp.pol(t, t || ': read', 'select', 'anon, authenticated', 'true', null);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;
