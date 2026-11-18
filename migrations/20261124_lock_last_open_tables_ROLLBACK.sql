-- Undo 20261124_lock_last_open_tables.sql: puts the 6 tables back the way they were
-- (open again — only use if something important broke).
begin;

do $$
declare r record; t text;
begin
  foreach t in array array['novel_chapters','marketplace_listings','writer_applications',
                           'session_receipts','rate_limits','rock_paper_scissors'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    -- remove the new rules
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
    end loop;
    -- give back the old access
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;

  -- old rules
  for r in select * from public._p4_backup_policies loop
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      r.policyname, r.tablename, r.permissive, r.cmd, array_to_string(r.roles, ', '),
      case when r.qual is not null then ' using (' || r.qual || ')' else '' end,
      case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end);
  end loop;

  -- old on/off state of row security
  for r in select * from public._p4_backup_rls loop
    if r.rls then
      execute format('alter table public.%I enable row level security', r.tablename);
    else
      execute format('alter table public.%I disable row level security', r.tablename);
    end if;
  end loop;
end $$;

commit;
