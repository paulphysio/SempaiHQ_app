-- Public money-activity feed for DAO Governance (DexScreener-style live feed).
-- Every verified money movement in the ecosystem inserts one row here.
-- Reads are public (it's a transparency feed); writes are service-role only
-- from edge functions. Client-side swap/send events go through direct insert
-- (the app already holds the service key) or can be added via edge functions later.

create table if not exists public.money_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,            -- chapter_unlock, manga_unlock, bazaar_purchase, bazaar_lend, bazaar_refund,
                                       -- badge_subscription, kaiji_deposit, kaiji_payout, kaiji_refund, kaiji_sol_swap,
                                       -- withdrawal, token_send, jupiter_swap
  direction text not null default 'in', -- 'in' | 'out' | 'swap'
  asset text not null,                  -- SOL | USDC | SMP | SKR | AMETHYST | JUP
  amount numeric,                       -- human-readable units
  usd_value numeric,                    -- approx USD when known
  wallet text,                          -- acting user's wallet (shortened in UI)
  counterparty text,                    -- other side: author / treasury / recipient / winner
  user_id uuid,
  title text not null,                  -- e.g. 'Chapter 12 unlock', 'Bazaar: The Silent Coast'
  detail text,                          -- extra context
  tx_sig text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists money_events_created_idx on public.money_events (created_at desc);
create index if not exists money_events_type_idx on public.money_events (event_type);
create index if not exists money_events_tx_idx on public.money_events (tx_sig);

alter table public.money_events enable row level security;

-- Public read: the feed is meant to be transparent like an explorer/DexScreener.
drop policy if exists money_events_public_read on public.money_events;
create policy money_events_public_read on public.money_events
  for select to anon, authenticated
  using (true);

-- Inserts/updates/deletes: service role only (edge functions + trusted client paths).
-- No insert policy for anon/authenticated = denied by default.

-- Realtime: push new feed rows to subscribed clients instantly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'money_events'
  ) then
    alter publication supabase_realtime add table public.money_events;
  end if;
end $$;
