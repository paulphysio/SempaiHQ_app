-- ════════════════════════════════════════════════════════════════════════
-- Kaiji Tourney Mode.
--   · 6 / 12 / 24 players, entry 25 / 50 / 100 SKR (held in the Kaiji escrow).
--   · Starts the moment it's full; if not full within 30 minutes everyone is
--     refunded. A player can leave (and get their entry back) before it starts.
--   · Knockout bracket with byes; semi-final losers play for 3rd place.
--   · Pot = all entries. 10% fee, then 60 / 30 / 10 to 1st / 2nd / 3rd.
-- Only the kaiji edge function (service role) reads or writes these tables.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.kaiji_tourneys (
  id uuid primary key default gen_random_uuid(),
  size int not null check (size in (6, 12, 24)),
  entry bigint not null check (entry > 0),            -- token base units per player
  mint text not null,
  status text not null default 'open'
    check (status in ('open', 'running', 'finished', 'paying', 'paid', 'pay_failed', 'cancelled')),
  round int not null default 0,                        -- current round (1 = first)
  rounds jsonb not null default '[]'::jsonb,           -- [{ round, players:[wallet…], byes:[wallet…] }]
  places jsonb,                                        -- { "1": wallet, "2": wallet, "3": wallet }
  payout_sig text,
  payout_started_at timestamptz,
  error text,
  expires_at timestamptz not null default now() + interval '30 minutes',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kaiji_tourneys_open_idx on public.kaiji_tourneys (status, size, entry, created_at);

create table if not exists public.kaiji_tourney_players (
  tourney_id uuid not null references public.kaiji_tourneys(id) on delete cascade,
  wallet text not null,
  token text not null,                                 -- sha256 of the player's secret (same scheme as matches)
  deposit_sig text not null unique,
  joined_at timestamptz not null default now(),
  left_at timestamptz,                                 -- left before the start
  refund_sig text,
  refund_error text,
  eliminated_round int,
  place int,
  primary key (tourney_id, wallet)
);
create index if not exists kaiji_tourney_players_wallet_idx on public.kaiji_tourney_players (wallet);

alter table public.kaiji_matches add column if not exists tourney_id uuid references public.kaiji_tourneys(id);
alter table public.kaiji_matches add column if not exists tourney_round int;
alter table public.kaiji_matches add column if not exists tourney_slot int;       -- position within the round
alter table public.kaiji_matches add column if not exists tourney_kind text;      -- 'main' | 'third'
alter table public.kaiji_matches add column if not exists replay_of uuid unique;  -- a drawn tourney match's replay (unique = never twice)
create index if not exists kaiji_matches_tourney_idx on public.kaiji_matches (tourney_id, tourney_round);

alter table public.kaiji_tourneys enable row level security;
alter table public.kaiji_tourney_players enable row level security;
revoke all on public.kaiji_tourneys from anon, authenticated;
revoke all on public.kaiji_tourney_players from anon, authenticated;

-- Take a seat in an open tourney of this size/entry (or open a new one).
-- Locks the tourney row so two joiners can never overfill it.
create or replace function public.kaiji_tourney_seat(
  p_wallet text, p_token text, p_sig text, p_size int, p_entry bigint, p_mint text
) returns table (tourney_id uuid, seats int, full_now boolean)
language plpgsql security definer set search_path = public as $$
declare t public.kaiji_tourneys; n int;
begin
  select * into t from kaiji_tourneys
   where status = 'open' and size = p_size and entry = p_entry and mint = p_mint and expires_at > now()
     and not exists (select 1 from kaiji_tourney_players x where x.tourney_id = kaiji_tourneys.id and x.wallet = p_wallet and x.left_at is null)
   order by created_at
   limit 1
   for update;
  if not found then
    insert into kaiji_tourneys (size, entry, mint) values (p_size, p_entry, p_mint) returning * into t;
  end if;
  insert into kaiji_tourney_players (tourney_id, wallet, token, deposit_sig)
  values (t.id, p_wallet, p_token, p_sig);
  select count(*) into n from kaiji_tourney_players where kaiji_tourney_players.tourney_id = t.id and left_at is null;
  if n >= t.size then
    update kaiji_tourneys set status = 'running', started_at = now(), updated_at = now() where id = t.id and status = 'open';
  end if;
  return query select t.id, n, n >= t.size;
end $$;
revoke all on function public.kaiji_tourney_seat(text, text, text, int, bigint, text) from public, anon, authenticated;
grant execute on function public.kaiji_tourney_seat(text, text, text, int, bigint, text) to service_role;

commit;
