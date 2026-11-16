-- ════════════════════════════════════════════════════════════════════════
-- PHASE 0 · PART A — emergency lockdown (safe to run any time)
--
-- Neither the mobile app (service role) nor the current website (anon key)
-- uses anything this part restricts, so it can run before the website deploy.
--
--  1. Role guard on users      → only the server or a signed-in superuser can
--                                change isSuperuser / isWriter / isArtist
--  2. Mint & reset functions   → server only (award_*, weekly points, resets)
--  3. money_events             → only the server can post transactions
--  4. get_my_wallet_key()      → signed-in owners read their own wallet key
--                                (needed by the new website before PART B)
--
-- All-or-nothing: wrapped in one transaction.
-- Rollback: migrations/20261120_phase0_rollback.sql
-- ════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. role guard ──────────────────────────────────────────────────────────
-- Runs as the caller (SECURITY INVOKER), so current_user is the API role:
-- 'service_role' for server code, 'anon' / 'authenticated' for apps and
-- browsers, 'postgres' for SQL editor / cron / SECURITY DEFINER functions.
-- Unauthorised role changes are silently kept at their old values (instead of
-- raising) so existing upserts that resend isWriter:false don't start failing
-- — and can no longer demote or promote anyone.
create or replace function public.guard_user_roles()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_admin boolean := false;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  select coalesce(u."isSuperuser", false) into is_admin
  from public.users u
  where u.id = auth.uid();

  if coalesce(is_admin, false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new."isSuperuser" := false;
    new."isWriter"    := false;
    new."isArtist"    := false;
  else
    new."isSuperuser" := old."isSuperuser";
    new."isWriter"    := old."isWriter";
    new."isArtist"    := old."isArtist";
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_roles on public.users;
create trigger guard_user_roles
  before insert or update on public.users
  for each row execute function public.guard_user_roles();

-- ── 2. server-only functions ───────────────────────────────────────────────
-- weekly_points_reset_trigger() calls reset_weekly_points(). As a trigger it
-- runs as whoever caused it, so after the lock below it would fail; running
-- it with the owner's rights keeps it working. (Trigger functions can't be
-- called directly, so this opens nothing.)
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'weekly_points_reset_trigger'
  ) then
    alter function public.weekly_points_reset_trigger() security definer;
    alter function public.weekly_points_reset_trigger() set search_path = public;
  end if;
end $$;

do $$
declare
  targets text[] := array[
    'award_amethyst', 'award_points', 'increment_amethyst_balance',
    'update_amethyst_balance', 'increment_weekly_points',
    'reset_weekly_points', 'recalculate_leaderboard_points',
    'call_edge_function'
  ];
  r record;
  blockers text;
begin
  -- Safety: if any OTHER function (e.g. a trigger) calls one of these as the
  -- caller, locking it would break that function. Stop instead of guessing,
  -- and name every such function at once.
  select string_agg(distinct p.proname, ', ') into blockers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.proname <> all (targets)
    and not p.prosecdef
    and exists (select 1 from unnest(targets) t where p.prosrc ilike '%' || t || '(%');
  if blockers is not null then
    raise exception 'PART A stopped: these functions call a function being locked: %. Nothing was changed — send this message to Claude.', blockers;
  end if;

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (targets)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ── 3. money_events: no more public inserts ────────────────────────────────
-- (public read stays — the feed shows it; all real writers use the service role)
drop policy if exists money_events_insert on public.money_events;

-- ── 4. owner-only wallet key ───────────────────────────────────────────────
create or replace function public.get_my_wallet_key(p_address text default null)
returns table (address text, private_key text)
language sql
stable
security definer
set search_path = public
as $$
  select w.address::text, w.private_key::text
  from public.user_wallets w
  where auth.uid() is not null
    and w.user_id = auth.uid()
    and w.private_key is not null
    and (p_address is null or w.address = p_address)
  order by w.created_at desc nulls last
$$;

revoke all on function public.get_my_wallet_key(text) from public, anon;
grant execute on function public.get_my_wallet_key(text) to authenticated, service_role;

commit;
