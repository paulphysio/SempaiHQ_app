-- ════════════════════════════════════════════════════════════════════════
-- Reading history for Bazaar books (PDF / EPUB).
-- reading_progress already keeps "continue reading" for novels and manga;
-- it now accepts Bazaar books too:
--   content_type  = 'bazaar', content_id = the book
--   chapter_key   = exact spot (EPUB location) or 'page:12' (PDF)
--   chapter_number= chapter (EPUB) or page (PDF), scroll_pct = % of the book
-- Each person still only sees and writes their own rows. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reading_progress'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%content_type%'
  loop
    execute format('alter table public.reading_progress drop constraint %I', c);
  end loop;
end $$;

alter table public.reading_progress
  add constraint reading_progress_content_type_check
  check (content_type in ('novel', 'manga', 'bazaar'));

commit;
