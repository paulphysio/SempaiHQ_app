-- ════════════════════════════════════════════════════════════════════════
-- Hide private columns of public.users from the public key.
--   email, x_oauth_token (Twitter login token), push_token, onesignal_user_id
-- Everyone can still read public profile columns (name, image, wallet, roles…).
-- Writing is unchanged (you can still save your own email / push token).
--
-- PART B — RUN ONLY AFTER Part A, the app update (give it ~1 day to reach
-- everyone) and the website deploy. Safe to re-run. Undo: 20261125_private_user_columns_ROLLBACK.sql
--
-- NOTE for the future: a NEW column added to users will NOT be readable by
-- the app until it's added to the grant list below (re-run this file).
-- ════════════════════════════════════════════════════════════════════════
begin;

-- 1. Column-level read access: everything except the private columns
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'users'
    and column_name not in ('email', 'x_oauth_token', 'push_token', 'onesignal_user_id');

  execute 'revoke select on public.users from anon, authenticated';
  execute format('grant select (%s) on public.users to anon, authenticated', cols);
end $$;

commit;

-- Checks (run after):
-- 1) should FAIL with "permission denied" when run as the public role:
--    set role anon; select email from public.users limit 1; reset role;
-- 2) should work:
--    set role anon; select id, name, wallet_address from public.users limit 1; reset role;
