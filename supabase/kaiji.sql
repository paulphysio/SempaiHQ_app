-- ============================================================================
-- KAIJI: clean database setup. Paste ALL of this into Supabase > SQL Editor > Run.
-- It first deletes any earlier Kaiji tables and functions (test data only), then rebuilds them.
-- ============================================================================

drop table if exists public.kaiji_picks, public.kaiji_rounds, public.kaiji_deposits, public.kaiji_matches cascade;
drop function if exists public.kaiji_join_or_create(uuid, text, bigint, text, timestamptz);
drop function if exists public.kaiji_join_or_create(text, text, bigint, text, timestamptz);
drop function if exists public.kaiji_apply_round(uuid, int, jsonb, jsonb, int, int, int, text, text, text, boolean, text, text, uuid, timestamptz);
drop function if exists public.kaiji_apply_round(uuid, int, jsonb, jsonb, int, int, int, text, text, text, boolean, text, text, text, timestamptz);

create extension if not exists pgcrypto;

create table public.kaiji_matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'normal',
  status text not null default 'waiting'
    check (status in ('waiting','active','settling','settled','settle_failed')),
  wager bigint not null check (wager > 0),          -- token base units (6 decimals)
  mint text not null,
  wallet_a text not null,                           -- the wallet that signed the deposit = the player
  wallet_b text,
  token_a text not null,                            -- sha256 of player A's secret (also put on-chain as a memo)
  token_b text,
  hand_a jsonb not null default '{"R":4,"P":4,"S":4}',
  hand_b jsonb not null default '{"R":4,"P":4,"S":4}',
  wins_a int not null default 0,
  wins_b int not null default 0,
  round int not null default 1,
  locked_a boolean not null default false,          -- "has locked a card" is public, the card is not
  locked_b boolean not null default false,
  idle_rounds int not null default 0,
  round_deadline timestamptz,
  winner text check (winner in ('a','b')),
  outcome text check (outcome in ('win','draw','void','cancelled')),
  settle_sig text,
  payout_started_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kaiji_rounds (
  match_id uuid not null references public.kaiji_matches(id) on delete cascade,
  round int not null,
  card_a text,
  card_b text,
  result text not null check (result in ('a','b','tie','idle')),
  forfeit boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (match_id, round)
);

create table public.kaiji_picks (
  match_id uuid not null references public.kaiji_matches(id) on delete cascade,
  round int not null,
  side text not null check (side in ('a','b')),
  card text not null check (card in ('R','P','S')),
  created_at timestamptz not null default now(),
  primary key (match_id, round, side)
);

create table public.kaiji_deposits (
  sig text primary key,                              -- each deposit signature can be used once, ever
  wallet text not null,
  amount bigint not null,
  match_id uuid,
  refund_sig text,
  refund_error text,
  created_at timestamptz not null default now()
);

create index kaiji_matches_status_idx on public.kaiji_matches (status, created_at);
create index kaiji_matches_token_a_idx on public.kaiji_matches (token_a);
create index kaiji_matches_token_b_idx on public.kaiji_matches (token_b);
create index kaiji_matches_wallet_a_idx on public.kaiji_matches (wallet_a);
create index kaiji_matches_wallet_b_idx on public.kaiji_matches (wallet_b);
-- a wallet can only be waiting in, or playing, one match at a time as player A (the function checks player B)
create unique index kaiji_open_wallet_a on public.kaiji_matches (wallet_a) where status in ('waiting','active');

-- Row level security on with NO policies: the app can never read or write these tables directly.
-- Only the edge function (service role) can.
alter table public.kaiji_matches enable row level security;
alter table public.kaiji_rounds enable row level security;
alter table public.kaiji_picks enable row level security;
alter table public.kaiji_deposits enable row level security;

create function public.kaiji_join_or_create(
  p_wallet text, p_token text, p_wager bigint, p_mint text, p_deadline timestamptz
) returns public.kaiji_matches
language plpgsql security definer set search_path = public as $$
declare m public.kaiji_matches;
begin
  select * into m from public.kaiji_matches
   where status = 'waiting' and wager = p_wager and mint = p_mint and wallet_a <> p_wallet
   order by created_at
   limit 1
   for update skip locked;

  if found then
    update public.kaiji_matches
       set wallet_b = p_wallet, token_b = p_token, status = 'active',
           round_deadline = p_deadline, updated_at = now()
     where id = m.id
     returning * into m;
  else
    insert into public.kaiji_matches (wager, mint, wallet_a, token_a)
    values (p_wager, p_mint, p_wallet, p_token)
    returning * into m;
  end if;
  return m;
end $$;

create function public.kaiji_apply_round(
  p_match uuid, p_round int,
  p_hand_a jsonb, p_hand_b jsonb, p_wins_a int, p_wins_b int, p_idle int,
  p_card_a text, p_card_b text, p_result text, p_forfeit boolean,
  p_status text, p_outcome text, p_winner text, p_next_deadline timestamptz
) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.kaiji_matches
     set hand_a = p_hand_a, hand_b = p_hand_b, wins_a = p_wins_a, wins_b = p_wins_b,
         idle_rounds = p_idle, round = p_round + 1, locked_a = false, locked_b = false,
         status = p_status, outcome = p_outcome, winner = p_winner,
         round_deadline = p_next_deadline, updated_at = now()
   where id = p_match and round = p_round and status = 'active';
  get diagnostics n = row_count;
  if n = 0 then return false; end if;

  insert into public.kaiji_rounds (match_id, round, card_a, card_b, result, forfeit)
  values (p_match, p_round, p_card_a, p_card_b, p_result, p_forfeit);
  return true;
end $$;

revoke all on function public.kaiji_join_or_create(text, text, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.kaiji_apply_round(uuid, int, jsonb, jsonb, int, int, int, text, text, text, boolean, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.kaiji_join_or_create(text, text, bigint, text, timestamptz) to service_role;
grant execute on function public.kaiji_apply_round(uuid, int, jsonb, jsonb, int, int, int, text, text, text, boolean, text, text, text, timestamptz) to service_role;
