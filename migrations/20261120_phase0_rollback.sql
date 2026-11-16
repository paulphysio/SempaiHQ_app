-- ════════════════════════════════════════════════════════════════════════
-- PHASE 0 rollback — restores the previous (open) behaviour.
-- Use only if something breaks; run the section for the part you want undone.
-- ════════════════════════════════════════════════════════════════════════

-- ── undo PART B ────────────────────────────────────────────────────────────
begin;
drop policy if exists "user_wallets: read rows"      on public.user_wallets;
drop policy if exists "user_wallets: anon insert"    on public.user_wallets;
drop policy if exists "user_wallets: insert own key" on public.user_wallets;
alter table public.user_wallets disable row level security;
grant all on public.user_wallets to anon, authenticated;
commit;

-- ── undo PART A ────────────────────────────────────────────────────────────
begin;
drop trigger if exists guard_user_roles on public.users;
drop function if exists public.guard_user_roles();

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array['award_amethyst','award_points','increment_amethyst_balance',
        'update_amethyst_balance','increment_weekly_points','reset_weekly_points',
        'recalculate_leaderboard_points','call_edge_function'])
  loop
    execute format('grant execute on function %s to public, anon, authenticated', r.sig);
  end loop;
end $$;

create policy money_events_insert on public.money_events
  for insert to anon, authenticated with check (true);

-- weekly_points_reset_trigger back to running as the caller
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'weekly_points_reset_trigger') then
    alter function public.weekly_points_reset_trigger() security invoker;
  end if;
end $$;

-- get_my_wallet_key() is harmless (owner-only); left in place.
commit;
