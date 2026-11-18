-- ════════════════════════════════════════════════════════════════════════
-- Spotlight picks: admins choose which novels / manga appear in the Home
-- Spotlight (and in what order). spotlight_rank = position (1, 2, 3…);
-- null = not in the spotlight. If nothing is picked, Home falls back to the
-- automatic choice (top featured titles), exactly as before.
--
-- Also: only admins (or the server) can CHANGE `featured` / `spotlight_rank`.
-- Until now a writer could mark their OWN novel as featured.
-- Safe to re-run. Undo at the bottom.
-- ════════════════════════════════════════════════════════════════════════
begin;

alter table public.novels add column if not exists spotlight_rank smallint;
alter table public.manga  add column if not exists spotlight_rank smallint;
create index if not exists novels_spotlight_rank_idx on public.novels (spotlight_rank) where spotlight_rank is not null;
create index if not exists manga_spotlight_rank_idx  on public.manga  (spotlight_rank) where spotlight_rank is not null;

-- Runs as the CALLER (security invoker) so current_user is the API role:
-- 'anon' / 'authenticated' for apps and browsers; server code, SQL editor and
-- cron are not limited. is_admin() itself is owner-rights.
create or replace function public.guard_curation_columns() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not coalesce(public.is_admin(), false) then
    if TG_OP = 'INSERT' then
      NEW.spotlight_rank := null;            -- new titles never jump into the spotlight
    else
      NEW.spotlight_rank := OLD.spotlight_rank;
      NEW.featured := OLD.featured;          -- featured is an admin decision
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists guard_curation_columns on public.novels;
create trigger guard_curation_columns before insert or update on public.novels
  for each row execute function public.guard_curation_columns();

drop trigger if exists guard_curation_columns on public.manga;
create trigger guard_curation_columns before insert or update on public.manga
  for each row execute function public.guard_curation_columns();

commit;

-- Undo:
-- drop trigger if exists guard_curation_columns on public.novels;
-- drop trigger if exists guard_curation_columns on public.manga;
-- drop function if exists public.guard_curation_columns();
-- alter table public.novels drop column if exists spotlight_rank;
-- alter table public.manga  drop column if exists spotlight_rank;
