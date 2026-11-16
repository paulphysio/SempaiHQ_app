-- KAIJI patch. Safe to run on top of kaiji.sql + kaiji_sol_share. Idempotent. Does NOT drop anything.

-- ---------------------------------------------------------------------------------------------
-- A) SOL swap bookkeeping: one swap in flight at a time, with durable state between every step.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.kaiji_sol_swaps (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'claimed' check (status in ('claimed','sent','swapped','done','released')),
  total numeric(78,0) not null default 0,         -- SKR base units being swapped (sum of claimed shares)
  lease_until timestamptz,                         -- only the holder of a live lease may act on this swap
  swap_sig text,                                   -- stored BEFORE broadcast, so a crash can never lose it
  swap_last_valid bigint,                          -- block height after which swap_sig can no longer land
  min_out numeric(78,0),                           -- guaranteed minimum lamports from Jupiter (otherAmountThreshold)
  forward_sig text,
  forward_last_valid bigint,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kaiji_sol_swaps enable row level security;
-- at most ONE open swap, ever (the database enforces it, not just the code)
create unique index if not exists kaiji_one_open_swap on public.kaiji_sol_swaps ((true)) where status in ('claimed','sent','swapped');

alter table public.kaiji_sol_share add column if not exists swap_id uuid references public.kaiji_sol_swaps(id);
create index if not exists kaiji_sol_share_swap_idx on public.kaiji_sol_share (swap_id);

-- Returns the swap this caller now owns (new, or an open one whose lease expired), or NULL (nothing to do / someone else owns it).
create or replace function public.kaiji_acquire_sol_swap(p_min numeric, p_lease_secs int default 120)
returns public.kaiji_sol_swaps
language plpgsql security definer set search_path = public as $$
declare s public.kaiji_sol_swaps; tot numeric;
begin
  perform pg_advisory_xact_lock(hashtext('kaiji_sol_swap'));   -- serialise all claimers
  select * into s from public.kaiji_sol_swaps where status in ('claimed','sent','swapped') order by created_at limit 1;
  if found then
    if s.lease_until is not null and s.lease_until > now() then return null; end if;   -- someone is working on it
    update public.kaiji_sol_swaps set lease_until = now() + make_interval(secs => p_lease_secs), updated_at = now()
     where id = s.id returning * into s;
    return s;                                                                           -- resume an abandoned swap
  end if;
  select coalesce(sum(amount), 0) into tot from public.kaiji_sol_share where swapped = false and swap_id is null;
  if tot < p_min then return null; end if;
  insert into public.kaiji_sol_swaps (lease_until) values (now() + make_interval(secs => p_lease_secs)) returning * into s;
  update public.kaiji_sol_share set swap_id = s.id where swapped = false and swap_id is null;
  select coalesce(sum(amount), 0) into tot from public.kaiji_sol_share where swap_id = s.id;
  update public.kaiji_sol_swaps set total = tot where id = s.id returning * into s;
  return s;
end $$;

-- Only legal when the swap definitely did not (and can no longer) land.
create or replace function public.kaiji_release_sol_swap(p_swap uuid, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.kaiji_sol_swaps set status = 'released', lease_until = null, error = p_reason, updated_at = now()
   where id = p_swap and status in ('claimed','sent');
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  update public.kaiji_sol_share set swap_id = null where swap_id = p_swap and swapped = false;
  return true;
end $$;

create or replace function public.kaiji_finish_sol_swap(p_swap uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.kaiji_sol_swaps set status = 'done', lease_until = null, updated_at = now()
   where id = p_swap and status = 'swapped';
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  update public.kaiji_sol_share set swapped = true where swap_id = p_swap;
  return true;
end $$;

-- ---------------------------------------------------------------------------------------------
-- B) Deposit refunds must be claimed atomically (stops double refunds / refund-while-playing).
-- ---------------------------------------------------------------------------------------------
alter table public.kaiji_deposits add column if not exists refund_claimed_at timestamptz;

create or replace function public.kaiji_claim_deposit_refund(p_sig text, p_stale_before timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.kaiji_deposits set refund_claimed_at = now(), refund_error = null
   where sig = p_sig and match_id is null and refund_sig is null
     and (refund_claimed_at is null or refund_claimed_at < p_stale_before);
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ---------------------------------------------------------------------------------------------
-- C) kaiji_claim_settlement: the edge function calls it, but it is NOT in kaiji.sql. Created only if absent,
--    so an existing (working) version is never overwritten. Semantics inferred from settleMatch().
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'kaiji_claim_settlement') then
    execute $f$
      create function public.kaiji_claim_settlement(p_match uuid, p_stale_before timestamptz)
      returns setof public.kaiji_matches
      language sql security definer set search_path = public as $b$
        update public.kaiji_matches
           set status = 'settling', payout_started_at = now(), updated_at = now()
         where id = p_match
           and status in ('settling','settle_failed')
           and (payout_started_at is null or payout_started_at < p_stale_before)
        returning *;
      $b$
    $f$;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- D) Lock the new functions down to the service role (the edge function). Anon/authenticated can never call them.
-- ---------------------------------------------------------------------------------------------
revoke all on function public.kaiji_acquire_sol_swap(numeric, int) from public, anon, authenticated;
revoke all on function public.kaiji_release_sol_swap(uuid, text) from public, anon, authenticated;
revoke all on function public.kaiji_finish_sol_swap(uuid) from public, anon, authenticated;
revoke all on function public.kaiji_claim_deposit_refund(text, timestamptz) from public, anon, authenticated;
revoke all on function public.kaiji_claim_settlement(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.kaiji_acquire_sol_swap(numeric, int) to service_role;
grant execute on function public.kaiji_release_sol_swap(uuid, text) to service_role;
grant execute on function public.kaiji_finish_sol_swap(uuid) to service_role;
grant execute on function public.kaiji_claim_deposit_refund(text, timestamptz) to service_role;
grant execute on function public.kaiji_claim_settlement(uuid, timestamptz) to service_role;
