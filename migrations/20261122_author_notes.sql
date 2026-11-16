-- ════════════════════════════════════════════════════════════════════════
-- Writer's notes on chapters (ChapterScreen "Author's note").
-- The app has always read/written public.novel_chapters, but the table was
-- never created — so notes never saved. Safe to run any time.
-- ════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.novel_chapters (
  novel_id       uuid        not null references public.novels(id) on delete cascade,
  chapter_number integer     not null,
  author_note    text,
  updated_at     timestamptz not null default now(),
  primary key (novel_id, chapter_number)
);

alter table public.novel_chapters enable row level security;

drop policy if exists "novel_chapters: anyone reads" on public.novel_chapters;
create policy "novel_chapters: anyone reads"
  on public.novel_chapters for select
  using (true);

-- only the novel's writer (signed in) may add or change its notes
drop policy if exists "novel_chapters: writer writes" on public.novel_chapters;
create policy "novel_chapters: writer writes"
  on public.novel_chapters for all to authenticated
  using      (exists (select 1 from public.novels n where n.id = novel_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.novels n where n.id = novel_id and n.user_id = auth.uid()));

grant select on public.novel_chapters to anon, authenticated;
grant insert, update, delete on public.novel_chapters to authenticated;

commit;
