-- ════════════════════════════════════════════════════════════════════════
-- Kaiji challenges: "anyone want a match?"
-- A player opens a challenge (their wager is already in escrow, as for a
-- quick match). Other Kaiji players get a notification with the wager and the
-- challenger's win/loss record; the FIRST one to accept plays. It stays open
-- for a few minutes, then the wager is refunded automatically.
--
-- Only the kaiji edge function (service role) touches these tables, as before.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

alter table public.kaiji_matches add column if not exists challenge boolean not null default false;
alter table public.kaiji_matches add column if not exists expires_at timestamptz;
create index if not exists kaiji_matches_challenge_idx on public.kaiji_matches (status, challenge, expires_at);

-- Accept one specific challenge. Exactly one accepter can win the race: the
-- row is locked, and it must still be waiting, unexpired, and not your own.
-- Returns the match, or nothing when someone was faster / it expired.
create or replace function public.kaiji_take_challenge(
  p_match uuid, p_wallet text, p_token text, p_wager bigint, p_mint text, p_deadline timestamptz
) returns public.kaiji_matches
language plpgsql security definer set search_path = public as $$
declare m public.kaiji_matches;
begin
  select * into m from public.kaiji_matches
   where id = p_match and status = 'waiting' and challenge
     and wager = p_wager and mint = p_mint and wallet_a <> p_wallet
     and (expires_at is null or expires_at > now())
   for update skip locked;
  if not found then return null; end if;

  update public.kaiji_matches
     set wallet_b = p_wallet, token_b = p_token, status = 'active',
         round_deadline = p_deadline, updated_at = now()
   where id = m.id
   returning * into m;
  return m;
end $$;
revoke all on function public.kaiji_take_challenge(uuid, text, text, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.kaiji_take_challenge(uuid, text, text, bigint, text, timestamptz) to service_role;

-- Quick matches no longer grab an open challenge (a challenge waits for
-- someone who chose to accept it, at the wager they saw).
create or replace function public.kaiji_join_or_create(
  p_wallet text, p_token text, p_wager bigint, p_mint text, p_deadline timestamptz
) returns public.kaiji_matches
language plpgsql security definer set search_path = public as $$
declare m public.kaiji_matches;
begin
  select * into m from public.kaiji_matches
   where status = 'waiting' and not challenge and wager = p_wager and mint = p_mint and wallet_a <> p_wallet
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
revoke all on function public.kaiji_join_or_create(text, text, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.kaiji_join_or_create(text, text, bigint, text, timestamptz) to service_role;

commit;
