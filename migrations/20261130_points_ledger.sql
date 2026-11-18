-- ════════════════════════════════════════════════════════════════════════
-- POINTS THAT ADD UP — a points history (ledger) instead of a number that
-- keeps getting wiped.
--
-- Before: users.weekly_points was OVERWRITTEN every hour by
-- recalculate_leaderboard_points() (= 100 × novels read in 14 days, everyone
-- else 0), and reset on Mondays. Points from manga, comments, unlocks and
-- referrals vanished within the hour; manga reading never counted.
--
-- Now:
--   · every award is one row in points_ledger (who, how many, why, when)
--   · weekly / monthly / all-time = sums over that history (weeks start
--     Monday, UTC) — nothing is ever reset
--   · reading earns points for novels AND manga: 100 points the first time
--     you read each chapter (max 100 chapters a day), via record_chapter_read()
--   · a reader's first manga chapter also adds 1 to that manga's read count
--   · users.weekly_points / users.total_points_read stay as quick caches
--     (this week / all time) so older screens keep showing the right numbers
--
-- Safe to re-run. Rollback notes at the bottom.
-- ════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. history tables ─────────────────────────────────────────────────────
create table if not exists public.points_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  points     integer not null,
  source     text not null,              -- chapter_read, activity, comment_reward, chapter_unlock, referral, carried_over …
  ref        text,                       -- makes an award happen at most once (e.g. one chapter)
  created_at timestamptz not null default now()
);
create index if not exists points_ledger_user_time on public.points_ledger (user_id, created_at);
create index if not exists points_ledger_time on public.points_ledger (created_at);
create unique index if not exists points_ledger_once on public.points_ledger (source, ref) where ref is not null;

create table if not exists public.chapter_reads (
  user_id      uuid not null,
  content_type text not null check (content_type in ('novel', 'manga')),
  content_id   uuid not null,
  chapter_key  text not null,
  read_at      timestamptz not null default now(),
  primary key (user_id, content_type, content_id, chapter_key)
);
create index if not exists chapter_reads_user_time on public.chapter_reads (user_id, read_at);

alter table public.points_ledger enable row level security;
alter table public.chapter_reads enable row level security;
drop policy if exists "points_ledger: own" on public.points_ledger;
create policy "points_ledger: own" on public.points_ledger for select to authenticated using (user_id = auth.uid());
drop policy if exists "chapter_reads: own" on public.chapter_reads;
create policy "chapter_reads: own" on public.chapter_reads for select to authenticated using (user_id = auth.uid());
revoke all on public.points_ledger, public.chapter_reads from anon;
revoke insert, update, delete, truncate on public.points_ledger, public.chapter_reads from authenticated;
grant select on public.points_ledger, public.chapter_reads to authenticated;

-- ── 2. period helpers ─────────────────────────────────────────────────────
create or replace function public.points_period_start(p_period text) returns timestamptz
language sql stable as $$
  select case lower(coalesce(p_period, 'all'))
    when 'week'  then date_trunc('week',  (now() at time zone 'utc')) at time zone 'utc'
    when 'month' then date_trunc('month', (now() at time zone 'utc')) at time zone 'utc'
    else '-infinity'::timestamptz end
$$;

-- ── 3. award (server-only) ────────────────────────────────────────────────
create or replace function public.award_points(p_user uuid, p_points integer, p_source text, p_ref text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  if p_user is null or coalesce(p_points, 0) = 0 then return false; end if;
  insert into points_ledger (user_id, points, source, ref)
  values (p_user, p_points, coalesce(nullif(p_source, ''), 'activity'), p_ref)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update users set
      weekly_points = coalesce((select sum(points) from points_ledger
                                where user_id = p_user and created_at >= points_period_start('week')), 0),
      total_points_read = coalesce((select sum(points) from points_ledger where user_id = p_user), 0)
    where id = p_user;
  end if;
  return n > 0;
end $;
revoke all on function public.award_points(uuid, integer, text, text) from public, anon, authenticated;

-- Every existing award (unlock-chapter, reader-actions, record-manga-payment …)
-- calls this — it now records history instead of a number that gets wiped.
create or replace function public.increment_weekly_points(user_id uuid, points integer)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_points(user_id, points, 'activity', null);
end $$;
revoke all on function public.increment_weekly_points(uuid, integer) from public, anon, authenticated;

-- ── 4. reading (called by the app after ~20s on a chapter) ────────────────
create or replace function public.record_chapter_read(p_content_type text, p_content_id uuid, p_chapter_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid;
  first_of_title boolean;
  today_count integer;
  awarded boolean := false;
  inserted integer;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if p_content_type not in ('novel', 'manga') or p_content_id is null or coalesce(p_chapter_key, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;
  select id into me from users where id = auth.uid();
  if me is null then me := public.my_user_id_by_email(); end if;
  if me is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;

  if p_content_type = 'novel' and not exists (select 1 from novels where id = p_content_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if p_content_type = 'manga' and not exists (select 1 from manga where id = p_content_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  first_of_title := not exists (select 1 from chapter_reads
    where user_id = me and content_type = p_content_type and content_id = p_content_id);

  insert into chapter_reads (user_id, content_type, content_id, chapter_key)
  values (me, p_content_type, p_content_id, left(p_chapter_key, 80))
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return jsonb_build_object('ok', true, 'new', false); end if;

  -- read count: a manga's count goes up once per reader (novels already
  -- count on their detail page)
  if first_of_title and p_content_type = 'manga' then
    update manga set viewers_count = coalesce(viewers_count, 0) + 1 where id = p_content_id;
  end if;

  select count(*) into today_count from chapter_reads
  where user_id = me and read_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if today_count <= 100 then
    awarded := public.award_points(me, 100, 'chapter_read',
      p_content_type || ':' || p_content_id || ':' || left(p_chapter_key, 80) || ':' || me);
  end if;
  return jsonb_build_object('ok', true, 'new', true, 'points', case when awarded then 100 else 0 end);
end $$;
revoke all on function public.record_chapter_read(text, uuid, text) from public, anon;
grant execute on function public.record_chapter_read(text, uuid, text) to authenticated;

-- ── 5. what people see ────────────────────────────────────────────────────
create or replace function public.get_my_points()
returns table (weekly bigint, monthly bigint, all_time bigint, weekly_rank bigint, chapters_this_week bigint)
language sql stable security definer set search_path = public as $$
  with me as (select coalesce((select id from users where id = auth.uid()), public.my_user_id_by_email()) as id),
  wk as (select user_id, sum(points) as p from points_ledger
         where created_at >= points_period_start('week') group by user_id)
  select
    coalesce((select sum(points) from points_ledger, me where user_id = me.id and created_at >= points_period_start('week')), 0)::bigint,
    coalesce((select sum(points) from points_ledger, me where user_id = me.id and created_at >= points_period_start('month')), 0)::bigint,
    coalesce((select sum(points) from points_ledger, me where user_id = me.id), 0)::bigint,
    (select count(*) + 1 from wk, me where wk.p > coalesce((select p from wk w2 where w2.user_id = me.id), 0))::bigint,
    (select count(*) from chapter_reads, me where user_id = me.id and read_at >= points_period_start('week'))::bigint
$$;
revoke all on function public.get_my_points() from public, anon;
grant execute on function public.get_my_points() to authenticated;

-- Leaderboard (same columns the app already reads; email is never returned)
drop function if exists public.get_leaderboard_data(text);
create function public.get_leaderboard_data(p_timeframe text default 'week')
returns table (user_id uuid, email text, name text, wallet_address text, image text,
               base_points bigint, amethyst_count bigint, effective_points bigint,
               chapters_read bigint, amethyst_bonus bigint)
language sql stable security definer set search_path = public as $$
  with since as (select public.points_period_start(case lower(coalesce(p_timeframe, 'week'))
                         when 'week' then 'week' when 'weekly' then 'week'
                         when 'month' then 'month' when 'monthly' then 'month' else 'all' end) as t),
  pts as (select l.user_id, sum(l.points)::bigint as p from points_ledger l, since
          where l.created_at >= since.t group by l.user_id having sum(l.points) > 0),
  reads as (select r.user_id, count(*)::bigint as n from chapter_reads r, since
            where r.read_at >= since.t group by r.user_id)
  select u.id, null::text, u.name::text, u.wallet_address::text, u.image::text,
         pts.p, coalesce(u.amethyst_count, 0)::bigint, pts.p,
         coalesce(reads.n, 0), 0::bigint
  from pts join users u on u.id = pts.user_id
  left join reads on reads.user_id = pts.user_id
  order by pts.p desc, u.name
  limit 100
$$;
revoke all on function public.get_leaderboard_data(text) from public;
grant execute on function public.get_leaderboard_data(text) to anon, authenticated;

-- ── 6. stop the wiping ────────────────────────────────────────────────────
-- Monday reset trigger(s) on users
do $$
declare r record;
begin
  for r in select tg.tgname from pg_trigger tg join pg_proc p on p.oid = tg.tgfoid
           where tg.tgrelid = 'public.users'::regclass and not tg.tgisinternal
             and p.proname = 'weekly_points_reset_trigger'
  loop
    execute format('drop trigger if exists %I on public.users', r.tgname);
  end loop;
end $$;

-- Kept as harmless names (the cron job / old function call them)
create or replace function public.reset_weekly_points() returns integer
language sql security definer set search_path = public as $$ select 0 $$;

-- Hourly job: now only refreshes the caches from the history (never wipes)
create or replace function public.recalculate_leaderboard_points() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with wk as (select user_id, sum(points) as p from points_ledger
              where created_at >= points_period_start('week') group by user_id),
       al as (select user_id, sum(points) as p from points_ledger group by user_id)
  update users u set
    weekly_points = coalesce(wk.p, 0),
    total_points_read = coalesce(al.p, 0)
  from al left join wk on wk.user_id = al.user_id
  where u.id = al.user_id
    and (u.weekly_points is distinct from coalesce(wk.p, 0) or u.total_points_read is distinct from coalesce(al.p, 0));
  get diagnostics n = row_count;
  -- anyone with no points this week shows 0 for the week (not last week's number)
  update users set weekly_points = 0
  where coalesce(weekly_points, 0) <> 0
    and id not in (select user_id from points_ledger where created_at >= points_period_start('week'));
  return n;
end $$;
revoke all on function public.recalculate_leaderboard_points() from public, anon, authenticated;

-- ── 7. fill the history from what already happened (dated, once) ─────────
-- a) novels read (the old rule: 100 per novel read), dated by last read
insert into points_ledger (user_id, points, source, ref, created_at)
select ni.user_id, 100, 'backfill_novel_read', 'ni:' || ni.id, coalesce(ni.last_read_at, now())
from novel_interactions ni
join users u on u.id = ni.user_id
on conflict do nothing;

-- b) comment rewards & referral bonuses (recorded in wallet_events)
insert into points_ledger (user_id, points, source, ref, created_at)
select we.destination_user_id, round(we.amount_change)::integer,
       case when we.event_details like 'comment_reward:%' then 'comment_reward' else 'referral' end,
       'we:' || we.id, coalesce(we.timestamp, now())
from wallet_events we
join users u on u.id = we.destination_user_id
where we.event_type = 'credit' and we.source_currency = 'Token'
  and (we.event_details like 'comment_reward:%' or we.event_details like 'referral%')
  and coalesce(we.amount_change, 0) > 0
on conflict do nothing;

-- c) paid chapter unlocks (100 single / 1000 bundle, as unlock-chapter awards)
insert into points_ledger (user_id, points, source, ref, created_at)
select owner.id, case when coalesce(cp.payment_type, 'SINGLE') = 'SINGLE' then 100 else 1000 end,
       'chapter_unlock', 'cp:' || cp.id, coalesce(cp.created_at, now())
from chapter_payments cp
join lateral (
  select u.id from users u where u.wallet_address = cp.wallet_address
  union
  select w.user_id from user_wallets w where w.address = cp.wallet_address
  limit 1
) owner on true
join users u2 on u2.id = owner.id
on conflict do nothing;

-- d) refresh the caches
select public.recalculate_leaderboard_points();

commit;

-- Check:
--   select source, count(*), sum(points) from public.points_ledger group by source order by 3 desc;
--   select * from public.get_leaderboard_data('week') limit 10;
--
-- Rollback (if ever needed): the history tables can stay; to restore the old
-- behaviour re-create increment_weekly_points / recalculate_leaderboard_points
-- from the definitions in the function inventory.
