-- ════════════════════════════════════════════════════════════════════════
-- UNDO the Phase 3 row rules — restores the snapshot the rules file took:
-- every rule, row-security switch and public/signed-in permission on the
-- public tables, plus function security modes, exactly as they were.
-- (The buggy 1-argument increment_novel_view stays deleted — nothing used it.)
-- All-or-nothing.
-- ════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public._p3_backup_policies') is null then
    raise exception 'No Phase 3 snapshot found - the rules file was never run, nothing to undo.';
  end if;
end $$;

-- 1. remove every current rule on public tables
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies
           where schemaname = 'public' and tablename not like '\_p3\_%'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2. row-security switches back as they were
do $$
declare r record;
begin
  for r in select b.tablename, b.rls_on from public._p3_backup_rls b
           where to_regclass('public.' || quote_ident(b.tablename)) is not null
  loop
    execute format('alter table public.%I %s row level security', r.tablename,
                   case when r.rls_on then 'enable' else 'disable' end);
  end loop;
end $$;

-- 3. the old rules back
do $$
declare r record; roles_txt text;
begin
  for r in select * from public._p3_backup_policies
           where to_regclass('public.' || quote_ident(tablename)) is not null
  loop
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ')
      into roles_txt from unnest(r.roles) x;
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      r.policyname, r.tablename, r.permissive, r.cmd, roles_txt,
      case when r.qual is null then '' else ' using (' || r.qual || ')' end,
      case when r.with_check is null then '' else ' with check (' || r.with_check || ')' end);
  end loop;
end $$;

-- 4. permissions back: clear, then re-grant table and column privileges
do $$
declare r record;
begin
  for r in select b.tablename from public._p3_backup_rls b
           where to_regclass('public.' || quote_ident(b.tablename)) is not null
  loop
    execute format('revoke all on public.%I from anon, authenticated', r.tablename);
  end loop;
  for r in select * from public._p3_backup_grants
           where to_regclass('public.' || quote_ident(table_name)) is not null
  loop
    execute format('grant %s on public.%I to %I', r.privilege_type, r.table_name, r.grantee);
  end loop;
  for r in select * from public._p3_backup_column_grants c
           where to_regclass('public.' || quote_ident(c.table_name)) is not null
             and not exists (select 1 from public._p3_backup_grants g
                             where g.table_name = c.table_name and g.grantee = c.grantee
                               and g.privilege_type = c.privilege_type)
  loop
    execute format('grant %s (%I) on public.%I to %I', r.privilege_type, r.column_name, r.table_name, r.grantee);
  end loop;
end $$;

-- 5. function security modes back
do $$
declare r record;
begin
  for r in select * from public._p3_backup_functions where to_regprocedure(sig) is not null loop
    execute format('alter function %s %s', r.sig, case when r.prosecdef then 'security definer' else 'security invoker' end);
  end loop;
end $$;

-- 6. forget the snapshot (so the rules file can be run fresh later)
drop table public._p3_backup_policies, public._p3_backup_rls, public._p3_backup_grants,
  public._p3_backup_column_grants, public._p3_backup_functions;

commit;
