-- ════════════════════════════════════════════════════════════════════════
-- Bazaar limited editions
--   $1 book → only 100 copies     $3 book → only 50 copies
-- A "copy" is any reader who holds the book (bought or borrowed). A refunded
-- copy goes back on the shelf. Existing books become $1 / 100-copy editions
-- (their past sales count). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

alter table public.bazaar_books add column if not exists max_copies integer;
-- Older app versions and the website upload without it: they only sell $1,
-- so the default is the $1 edition.
alter table public.bazaar_books alter column max_copies set default 100;

update public.bazaar_books
set max_copies = case when price_usd = 3 then 50 else 100 end
where max_copies is null or max_copies <> case when price_usd = 3 then 50 else 100 end;

-- Authors pick a tier when uploading; the copy limit always follows the price.
drop policy if exists "bazaar_books: author uploads" on public.bazaar_books;
create policy "bazaar_books: author uploads" on public.bazaar_books
  for insert to authenticated
  with check (author_id in (select public.my_account_ids())
    and price_usd in (1, 3)
    and max_copies = case when price_usd = 3 then 50 else 100 end
    and author_share_pct = 70 and lend_price_smp = 12500);

-- Copies taken / left for one or more books (anyone can see this; it only
-- returns counts, never who bought).
create or replace function public.bazaar_copies(p_book_ids uuid[])
returns table (book_id uuid, max_copies integer, taken integer, left_count integer)
language sql stable security definer set search_path = public as $$
  select b.id,
         b.max_copies,
         coalesce(p.n, 0)::integer,
         greatest(coalesce(b.max_copies, 100) - coalesce(p.n, 0), 0)::integer
  from bazaar_books b
  left join (
    select bp.book_id, count(distinct bp.buyer_id) as n
    from bazaar_purchases bp
    where bp.book_id = any (p_book_ids) and bp.status <> 'refunded'
    group by bp.book_id
  ) p on p.book_id = b.id
  where b.id = any (p_book_ids);
$$;
revoke all on function public.bazaar_copies(uuid[]) from public;
grant execute on function public.bazaar_copies(uuid[]) to anon, authenticated;

commit;

-- Check (run after): every book has its limit, and counts come back.
--   select id, title, price_usd, max_copies from public.bazaar_books;
--   select * from public.bazaar_copies(array(select id from public.bazaar_books));
