-- ════════════════════════════════════════════════════════════════════════
-- Lock the last 6 tables that anyone (public key) could still CHANGE.
-- Found 2026-11-18 by a harmless write test (PATCH on a row that doesn't exist).
-- Safe to re-run. Undo: 20261124_lock_last_open_tables_ROLLBACK.sql
-- Needs public.owns_novel() and public.is_admin() from the Phase 3 file.
-- ════════════════════════════════════════════════════════════════════════
begin;

-- snapshot what's there now (for the rollback)
create table if not exists public._p4_backup_policies as
  select * from pg_policies where false;
create table if not exists public._p4_backup_rls (tablename text, rls boolean);
insert into public._p4_backup_policies
  select * from pg_policies where schemaname = 'public' and tablename = any (array[
    'novel_chapters','marketplace_listings','writer_applications','session_receipts','rate_limits','rock_paper_scissors'])
  and not exists (select 1 from public._p4_backup_policies);
insert into public._p4_backup_rls
  select c.relname, c.relrowsecurity from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relname = any (array[
    'novel_chapters','marketplace_listings','writer_applications','session_receipts','rate_limits','rock_paper_scissors'])
  and not exists (select 1 from public._p4_backup_rls);
revoke all on public._p4_backup_policies, public._p4_backup_rls from anon, authenticated;

-- drop older rules on these tables so nothing forgotten stays open
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies
           where schemaname = 'public' and tablename = any (array[
             'novel_chapters','marketplace_listings','writer_applications','session_receipts','rate_limits','rock_paper_scissors'])
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 1. novel_chapters (author's notes): everyone reads, only the novel's creator writes
alter table public.novel_chapters enable row level security;
create policy "novel_chapters: read" on public.novel_chapters for select to anon, authenticated using (true);
create policy "novel_chapters: creator adds" on public.novel_chapters for insert to authenticated
  with check (public.owns_novel(novel_id) or public.is_admin());
create policy "novel_chapters: creator edits" on public.novel_chapters for update to authenticated
  using (public.owns_novel(novel_id) or public.is_admin())
  with check (public.owns_novel(novel_id) or public.is_admin());
create policy "novel_chapters: creator removes" on public.novel_chapters for delete to authenticated
  using (public.owns_novel(novel_id) or public.is_admin());
grant select on public.novel_chapters to anon, authenticated;
grant insert, update, delete on public.novel_chapters to authenticated;
revoke insert, update, delete, truncate on public.novel_chapters from anon;

-- 2. marketplace_listings: everyone reads, only the seller edits/removes their own
--    (new listings are created by the website server after checking the item owner)
alter table public.marketplace_listings enable row level security;
create policy "marketplace_listings: read" on public.marketplace_listings for select to anon, authenticated using (true);
create policy "marketplace_listings: seller edits" on public.marketplace_listings for update to authenticated
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());
create policy "marketplace_listings: seller removes" on public.marketplace_listings for delete to authenticated
  using (seller_id = auth.uid() or public.is_admin());
grant select on public.marketplace_listings to anon, authenticated;
revoke insert, truncate on public.marketplace_listings from anon, authenticated;
revoke update, delete on public.marketplace_listings from anon;
grant update, delete on public.marketplace_listings to authenticated;

-- 3. writer_applications: the applicant (and admins) can read theirs; only the server writes
alter table public.writer_applications enable row level security;
create policy "writer_applications: own" on public.writer_applications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke all on public.writer_applications from anon;
revoke insert, update, delete, truncate on public.writer_applications from authenticated;
grant select on public.writer_applications to authenticated;

-- 4–6. server only (no public access at all)
do $$
declare t text;
begin
  foreach t in array array['session_receipts', 'rate_limits', 'rock_paper_scissors'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;

-- Check (should list all 6 with rls = true):
-- select relname, relrowsecurity as rls from pg_class
-- where relnamespace = 'public'::regnamespace and relname in
-- ('novel_chapters','marketplace_listings','writer_applications','session_receipts','rate_limits','rock_paper_scissors');
