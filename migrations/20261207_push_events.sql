-- ════════════════════════════════════════════════════════════════════════
-- Phone notifications for everything that happens on SempaiHQ.
--
-- Database triggers catch each event the moment it is saved (whatever app
-- version saved it) and hand it to the `push-events` edge function, which
-- decides who hears about it, adds it to their in-app bell and sends the
-- phone notification — respecting each person's notification settings.
--
--   private_messages  → the recipient                          (messages)
--   messages          → the person you replied to in Community (community)
--   feed_posts        → your followers (max 1 an hour per author) (social)
--   feed_post_likes   → the post's author (grouped)            (social)
--   feed_comments     → the post's author / the comment you replied to (social)
--   feed_follows      → the person followed                    (social)
--   bazaar_books      → everyone: new book in the Bazaar        (bazaar)
--   bazaar_purchases  → the book's author: you made a sale     (money)
--   manga / novels    → everyone: new title                    (releases)
--   kaiji_matches     → Kaiji players: a game is open; both players: result (kaiji)
--
-- The trigger authenticates to the function with a random secret generated
-- right here (nobody has to copy a key anywhere). Only the service role can
-- read it. A failed call never blocks the insert.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
create extension if not exists pg_net with schema extensions;

-- ── config: function URL + shared secret ──────────────────────────────────
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  url text not null,
  secret text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
insert into public.push_config (id, url, secret)
values (1, 'https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/push-events', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

-- ── per-person settings (written through reader-actions) ──────────────────
create table if not exists public.notification_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,   -- { "messages": false, … } — missing = on
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
revoke all on public.notification_prefs from anon, authenticated;

-- ── once-only / throttle markers ──────────────────────────────────────────
create table if not exists public.push_log (
  key text primary key,
  created_at timestamptz not null default now()
);
create index if not exists push_log_created_idx on public.push_log (created_at);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

-- ── in-app bell rows can now carry where to go when tapped ────────────────
alter table public.notifications add column if not exists data jsonb;
alter table public.notifications add column if not exists actor_id uuid;

-- ── the trigger ───────────────────────────────────────────────────────────
create or replace function public.push_event() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  cfg public.push_config;
  rec jsonb;
begin
  select * into cfg from public.push_config where id = 1;
  if cfg.url is null then return new; end if;
  -- never ship whole chapters or book bodies
  rec := to_jsonb(new) - 'chaptercontents' - 'chaptertitles' - 'advance_chapters' - 'summary' - 'description'
                       - 'token_a' - 'token_b' - 'ip_attestation' - 'file_path';
  perform net.http_post(
    url := cfg.url,
    body := jsonb_build_object('table', tg_table_name, 'op', tg_op, 'record', rec,
                               'old', case when tg_op = 'UPDATE' then jsonb_build_object('status', to_jsonb(old)->'status') else null end),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'push_event(%): %', tg_table_name, sqlerrm;
  return new;
end $$;
revoke all on function public.push_event() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['private_messages', 'messages', 'feed_posts', 'feed_post_likes', 'feed_comments',
                           'feed_follows', 'bazaar_books', 'bazaar_purchases', 'manga', 'novels']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists push_event_ins on public.%I', t);
      execute format('create trigger push_event_ins after insert on public.%I for each row execute function public.push_event()', t);
    end if;
  end loop;
end $$;

-- Kaiji: a new open game, and a match that just finished
drop trigger if exists push_event_ins on public.kaiji_matches;
create trigger push_event_ins after insert on public.kaiji_matches
  for each row when (new.status = 'waiting' and new.tourney_id is null)
  execute function public.push_event();
drop trigger if exists push_event_settled on public.kaiji_matches;
create trigger push_event_settled after update of status on public.kaiji_matches
  for each row when (new.status = 'settled' and old.status is distinct from 'settled' and new.tourney_id is null)
  execute function public.push_event();
