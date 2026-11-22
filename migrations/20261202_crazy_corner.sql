-- ════════════════════════════════════════════════════════════════════════
-- Crazy Corner (the feed) — counts that are always right, and safe images.
--
-- 1. Like / reply / repost counts are kept by the database itself (they had
--    drifted: most posts showed 0 likes while having likes), and recounted
--    once now.
-- 2. Nobody can type their own counts: a post always starts at 0, and a
--    person editing their post can't change them.
-- 3. Up to 4 pictures per post (was 2).
-- 4. Pictures upload only into your own folder of the feed-images bucket.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. counts kept by the database ────────────────────────────────────────
create or replace function public.feed_recount_post(p_post uuid) returns void
language sql security definer set search_path = public as $$
  update feed_posts p set
    likes_count    = (select count(*) from feed_post_likes l where l.post_id = p.id),
    comments_count = (select count(*) from feed_comments  c where c.post_id = p.id),
    shares_count   = (select count(*) from feed_shares    s where s.post_id = p.id)
  where p.id = p_post;
$$;
revoke all on function public.feed_recount_post(uuid) from public, anon, authenticated;

create or replace function public.feed_count_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.feed_recount_post(coalesce(new.post_id, old.post_id));
  return null;
end $$;

drop trigger if exists feed_likes_count on public.feed_post_likes;
create trigger feed_likes_count after insert or delete on public.feed_post_likes
  for each row execute function public.feed_count_changed();
drop trigger if exists feed_comments_count on public.feed_comments;
create trigger feed_comments_count after insert or delete on public.feed_comments
  for each row execute function public.feed_count_changed();
drop trigger if exists feed_shares_count on public.feed_shares;
create trigger feed_shares_count after insert or delete on public.feed_shares
  for each row execute function public.feed_count_changed();

-- reply likes
create or replace function public.feed_comment_likes_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid := coalesce(new.comment_id, old.comment_id);
begin
  update feed_comments set likes_count = (select count(*) from feed_comment_likes where comment_id = cid) where id = cid;
  return null;
end $$;
drop trigger if exists feed_comment_likes_count on public.feed_comment_likes;
create trigger feed_comment_likes_count after insert or delete on public.feed_comment_likes
  for each row execute function public.feed_comment_likes_changed();

-- ── 2. counts can't be typed in by people ────────────────────────────────
-- pg_trigger_depth() = 1 means the change came straight from a person's
-- request; the count triggers above run one level deeper.
create or replace function public.feed_guard_counts() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if tg_op = 'INSERT' then
    new.likes_count := 0;
    if tg_table_name = 'feed_posts' then new.comments_count := 0; new.shares_count := 0; end if;
  else
    new.likes_count := old.likes_count;
    if tg_table_name = 'feed_posts' then new.comments_count := old.comments_count; new.shares_count := old.shares_count; end if;
  end if;
  return new;
end $$;
drop trigger if exists feed_posts_guard_counts on public.feed_posts;
create trigger feed_posts_guard_counts before insert or update on public.feed_posts
  for each row execute function public.feed_guard_counts();
drop trigger if exists feed_comments_guard_counts on public.feed_comments;
create trigger feed_comments_guard_counts before insert or update on public.feed_comments
  for each row execute function public.feed_guard_counts();

-- recount everything once (the guard would keep the old numbers, so it is
-- switched off just for this one fix-up)
alter table public.feed_posts disable trigger feed_posts_guard_counts;
alter table public.feed_comments disable trigger feed_comments_guard_counts;
update public.feed_posts p set
  likes_count    = (select count(*) from public.feed_post_likes l where l.post_id = p.id),
  comments_count = (select count(*) from public.feed_comments  c where c.post_id = p.id),
  shares_count   = (select count(*) from public.feed_shares    s where s.post_id = p.id);
update public.feed_comments c set
  likes_count = (select count(*) from public.feed_comment_likes l where l.comment_id = c.id);
alter table public.feed_posts enable trigger feed_posts_guard_counts;
alter table public.feed_comments enable trigger feed_comments_guard_counts;

-- ── 3. up to 4 pictures ───────────────────────────────────────────────────
alter table public.feed_posts drop constraint if exists check_max_images;
alter table public.feed_posts add constraint check_max_images
  check (image_urls is null or array_length(image_urls, 1) <= 4);

-- ── 4. pictures go in your own folder ────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-images', 'feed-images', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

drop policy if exists "Authenticated users can upload feed images" on storage.objects;
drop policy if exists "feed images: upload own folder" on storage.objects;
create policy "feed images: upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feed-images' and (storage.foldername(name))[1] = auth.uid()::text);

commit;

-- Check (run after): counts now match the real likes / replies / reposts.
--   select id, likes_count, comments_count, shares_count from public.feed_posts order by created_at desc;
