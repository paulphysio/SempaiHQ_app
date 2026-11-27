-- ════════════════════════════════════════════════════════════════════════
-- HQ Access Pass + new lending rules + monthly lending rewards.
--
--  HQ Access Pass ($1, paid in SOL / USDC / SMP at the live price, 30 days,
--  renewing stacks onto the current expiry). Required to:
--    · borrow Bazaar books — max 5 borrows per rolling 7 days; each borrow is a
--      7-day loan (12,500 SMP: 95% to the platform, 5% burned);
--    · enter Kaiji tournaments (which run Friday–Sunday).
--
--  Lending rewards: on the 1st of each month, 30% of the previous month's
--  lending fees go to the uploaders of the 3 most-borrowed books, split by
--  borrow count. Paid by the lending-rewards function (or left "pending" for an
--  admin when the treasury key isn't available).
--
-- Only server functions (service role) write these tables. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.hq_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wallet text not null,
  tx_signature text not null unique,
  currency text not null check (currency in ('SOL', 'USDC', 'SMP')),
  amount numeric not null,           -- tokens paid
  usd numeric not null default 1,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists hq_passes_user_idx on public.hq_passes (user_id, expires_at desc);
alter table public.hq_passes enable row level security;
revoke all on public.hq_passes from anon, authenticated;
grant select on public.hq_passes to authenticated;
drop policy if exists "hq pass: see my own" on public.hq_passes;
create policy "hq pass: see my own" on public.hq_passes for select to authenticated using (user_id = auth.uid());

-- When does this person's pass end? (null = no active pass)
create or replace function public.hq_pass_expiry(p_user uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(expires_at) from hq_passes where user_id = p_user and expires_at > now()
$$;
revoke all on function public.hq_pass_expiry(uuid) from public, anon;
grant execute on function public.hq_pass_expiry(uuid) to authenticated, service_role;

-- Loans end: a borrow is a 7-day loan (older borrows stay permanent: null).
alter table public.bazaar_purchases add column if not exists expires_at timestamptz;
create index if not exists bazaar_purchases_lend_idx on public.bazaar_purchases (buyer_id, access_type, created_at desc);

-- Monthly lending rewards (one row per top book per month).
create table if not exists public.lending_rewards (
  id uuid primary key default gen_random_uuid(),
  period text not null,                -- 'YYYY-MM' (the month the borrows happened)
  book_id uuid not null references public.bazaar_books(id) on delete cascade,
  rank int not null,
  recipient_id uuid references public.users(id) on delete set null,
  wallet text,
  borrows int not null,
  amount_smp numeric not null,         -- whole SMP
  pool_smp numeric not null,           -- the month's 30% pool
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'skipped')),
  tx_signature text,
  error text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (period, book_id)
);
alter table public.lending_rewards enable row level security;
revoke all on public.lending_rewards from anon, authenticated;
grant select on public.lending_rewards to authenticated;
drop policy if exists "lending rewards: public" on public.lending_rewards;
create policy "lending rewards: public" on public.lending_rewards for select to authenticated using (true);

-- The lending-rewards function runs on the 1st of each month (pg_cron + pg_net), authenticated by a
-- random secret generated here — nobody has to copy a key anywhere.
create table if not exists public.job_secrets (name text primary key, secret text not null);
alter table public.job_secrets enable row level security;
revoke all on public.job_secrets from anon, authenticated;
insert into public.job_secrets (name, secret) values ('lending-rewards', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('lending-rewards-monthly') where exists (select 1 from cron.job where jobname = 'lending-rewards-monthly');
    perform cron.schedule('lending-rewards-monthly', '15 0 1 * *', $job$
      select net.http_post(
        url := 'https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/lending-rewards',
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-job-secret', (select secret from public.job_secrets where name = 'lending-rewards'))
      )
    $job$);
  end if;
end $$;

commit;
