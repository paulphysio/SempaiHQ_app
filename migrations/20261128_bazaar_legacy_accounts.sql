-- ════════════════════════════════════════════════════════════════════════
-- Bazaar uploads for OLDER accounts.
-- Some accounts have a users-row id that differs from their Google sign-in id
-- (rows made before ids were synced). Bazaar rules only accepted the sign-in
-- id, so those writers could never upload (storage folder + bazaar_books row).
--
-- my_account_ids(): the caller's own ids — their sign-in id, plus their older
-- row id when it's matched by THEIR OWN sign-in email (exactly one match;
-- see my_user_id_by_email from 20261125 Part A).
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

create or replace function public.my_account_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select auth.uid() where auth.uid() is not null
  union
  select public.my_user_id_by_email() where public.my_user_id_by_email() is not null
$$;
-- Guests read the Bazaar list too (the read rule calls this); for them it
-- returns nothing.
revoke all on function public.my_account_ids() from public;
grant execute on function public.my_account_ids() to anon, authenticated;

-- Storage: upload into your own folder (either of your ids)
drop policy if exists "bazaar books: upload own folder" on storage.objects;
create policy "bazaar books: upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bazaar-books'
    and (storage.foldername(name))[1] in (select id::text from public.my_account_ids() as id));

drop policy if exists "bazaar covers: upload own folder" on storage.objects;
create policy "bazaar covers: upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bazaar-covers'
    and (storage.foldername(name))[1] in (select id::text from public.my_account_ids() as id));

-- Listing: authors add their own books (fixed prices, as before)
drop policy if exists "bazaar_books: author uploads" on public.bazaar_books;
create policy "bazaar_books: author uploads" on public.bazaar_books
  for insert to authenticated
  with check (author_id in (select public.my_account_ids())
    and price_usd = 1 and author_share_pct = 70 and lend_price_smp = 12500);

drop policy if exists "bazaar_books: read" on public.bazaar_books;
create policy "bazaar_books: read" on public.bazaar_books
  for select to anon, authenticated
  using (status = 'active' or author_id in (select public.my_account_ids()) or public.is_admin());

commit;
