-- ════════════════════════════════════════════════════════════════════════
-- PHASE 0 · PART B — wallet private keys
--
-- Run ONLY after the new website is live (it reads keys through
-- get_my_wallet_key() from PART A). The mobile app uses the service role and
-- is unaffected.
--
--  · private_key can no longer be read with the public key (column privilege)
--  · rows stay readable (address / user_id) — the website looks wallets up by
--    address, and external-wallet signups depend on that
--  · inserts: anyone may register an external wallet (no key); a key can only
--    be stored on your own row; updates/deletes are server-only (stops
--    re-pointing a wallet to another account or overwriting its key)
-- ════════════════════════════════════════════════════════════════════════
begin;

alter table public.user_wallets enable row level security;

drop policy if exists "user_wallets: read rows"       on public.user_wallets;
drop policy if exists "user_wallets: anon insert"     on public.user_wallets;
drop policy if exists "user_wallets: insert own key"  on public.user_wallets;

create policy "user_wallets: read rows"
  on public.user_wallets for select
  to anon, authenticated
  using (true);                       -- columns are restricted below

create policy "user_wallets: anon insert"
  on public.user_wallets for insert
  to anon
  with check (private_key is null);   -- external wallets only

create policy "user_wallets: insert own key"
  on public.user_wallets for insert
  to authenticated
  with check (private_key is null or user_id = auth.uid());

-- No update / delete policies → only the service role can change rows.

revoke all on public.user_wallets from anon, authenticated;
grant select (id, user_id, address, created_at) on public.user_wallets to anon, authenticated;
grant insert (user_id, address, private_key)    on public.user_wallets to anon, authenticated;

commit;
