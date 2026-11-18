-- Undo 20261125_private_user_columns_B_lock.sql: makes ALL users columns readable again
-- (emails public again — only if something important broke).
-- The three helper functions are left in place; they're harmless.
begin;
grant select on public.users to anon, authenticated;
commit;
