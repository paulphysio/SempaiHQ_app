-- ════════════════════════════════════════════════════════════════════════
-- Make the Google sign-in id the ONE user id.
--
-- Older accounts have a users-row id that differs from their sign-in id
-- (auth.users.id). That broke wallet upgrades, wallet unlocking and Bazaar
-- uploads for them. This moves each such profile — and everything that
-- points at it (wallets, payments, unlocks, comments, books, badges …) — to
-- the sign-in id.
--
-- Run PART 1 first (read-only) and look at the result. Then run PART 2.
-- PART 2 is one transaction: it either all happens or nothing does.
-- Undo: PART 3 (uses the saved mapping).
-- ════════════════════════════════════════════════════════════════════════


-- ── PART 1 · PREVIEW (changes nothing) ───────────────────────────────────
-- status = 'will fix'  → moved by PART 2
--          'skip: …'   → left alone (needs a human decision; see reason)
with a as (
  select lower(email) as email, min(id::text)::uuid as auth_id, count(*) as n
  from auth.users where email is not null group by lower(email)
), u as (
  select lower(email) as email, count(*) as n from public.users where email is not null group by lower(email)
)
select pu.id as old_id, a.auth_id as new_id, pu.name, pu.email, pu.wallet_address,
  case
    when a.n > 1 then 'skip: two sign-in accounts share this email'
    when u.n > 1 then 'skip: two profiles share this email (one may already use the sign-in id)'
    when exists (select 1 from public.users x where x.id = a.auth_id) then 'skip: a profile with the sign-in id already exists'
    else 'will fix'
  end as status
from public.users pu
join a on a.email = lower(pu.email)
join u on u.email = lower(pu.email)
where pu.id <> a.auth_id
order by status, pu.name;


-- ── PART 1b · PREVIEW: what PART 2 would touch (changes nothing) ────────
-- Run this block on its own. One row per column that holds user ids:
--   old_refs  = rows that will be moved to the sign-in id
--   new_refs  = rows ALREADY under the sign-in id for these same people
--               (if new_refs > 0 on a table that allows one row per person,
--                PART 2 could clash there — send me this result first)
create or replace function pg_temp.uid_fix_preview()
returns table (tbl text, col text, old_refs bigint, new_refs bigint)
language plpgsql as $fn$
declare r record; o bigint; n bigint;
begin
  create temp table if not exists mp as
  with a as (select lower(email) as email, min(id::text)::uuid as auth_id, count(*) as n
             from auth.users where email is not null group by lower(email)),
       u as (select lower(email) as email, count(*) as n from public.users where email is not null group by lower(email))
  select pu.id as old_id, a.auth_id as new_id from public.users pu
  join a on a.email = lower(pu.email) join u on u.email = lower(pu.email)
  where pu.id <> a.auth_id and a.n = 1 and u.n = 1
    and not exists (select 1 from public.users x where x.id = a.auth_id);
  for r in
    select c.table_name::text as t, c.column_name::text as cn, c.data_type::text as typ
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.table_name <> '_uid_fix_map'
      and c.table_name not like '_p3_backup%' and c.table_name not like '_p4_backup%'
      and not (c.table_name = 'users' and c.column_name = 'id')
      and (c.data_type = 'uuid' or (c.data_type in ('text','character varying')
           and c.column_name ~ '(^|_)(id|uid)$|_by$|^(user|author|seller|buyer|creator|writer|artist|owner|sender|receiver|recipient|follower|following|referrer|inviter|admin)'))
  loop
    if r.typ = 'uuid' then
      execute format('select count(*) from public.%I x join mp on x.%I = mp.old_id', r.t, r.cn) into o;
      execute format('select count(*) from public.%I x join mp on x.%I = mp.new_id', r.t, r.cn) into n;
    else
      execute format('select count(*) from public.%I x join mp on x.%I = mp.old_id::text', r.t, r.cn) into o;
      execute format('select count(*) from public.%I x join mp on x.%I = mp.new_id::text', r.t, r.cn) into n;
    end if;
    if o > 0 or n > 0 then tbl := r.t; col := r.cn; old_refs := o; new_refs := n; return next; end if;
  end loop;
end $fn$;
select * from pg_temp.uid_fix_preview() order by new_refs desc, old_refs desc;


-- ── PART 2 · FIX ─────────────────────────────────────────────────────────
begin;

-- 2a. Who moves (saved, so PART 3 can undo it)
create table if not exists public._uid_fix_map (
  old_id uuid primary key, new_id uuid unique not null, email text, fixed_at timestamptz default now()
);
revoke all on public._uid_fix_map from anon, authenticated;

create temp table m on commit drop as
with a as (
  select lower(email) as email, min(id::text)::uuid as auth_id, count(*) as n
  from auth.users where email is not null group by lower(email)
), u as (
  select lower(email) as email, count(*) as n from public.users where email is not null group by lower(email)
)
select pu.id as old_id, a.auth_id as new_id, pu.email
from public.users pu
join a on a.email = lower(pu.email)
join u on u.email = lower(pu.email)
where pu.id <> a.auth_id
  and a.n = 1 and u.n = 1
  and not exists (select 1 from public.users x where x.id = a.auth_id);

insert into public._uid_fix_map (old_id, new_id, email)
select old_id, new_id, email from m
on conflict (old_id) do nothing;

-- 2b. Every column that can hold a user id: uuid columns, plus text columns
--     whose name says they hold a person (user_id, author_id, referred_by …).
--     A random uuid only ever equals another uuid if it IS that user.
create temp table cols on commit drop as
select c.table_name::text as t, c.column_name::text as col, c.data_type::text as typ
from information_schema.columns c
join information_schema.tables tb
  on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
where c.table_schema = 'public'
  and c.table_name not in ('_uid_fix_map')
  and c.table_name not like '\_p3\_backup%' and c.table_name not like '\_p4\_backup%'
  and not (c.table_name = 'users' and c.column_name = 'id')
  and (
    c.data_type = 'uuid'
    or (c.data_type in ('text', 'character varying')
        and c.column_name ~ '(^|_)(id|uid)$|_by$|^(user|author|seller|buyer|creator|writer|artist|owner|sender|receiver|recipient|follower|following|referrer|inviter|admin)')
  );

-- 2c. Foreign keys that involve users or any of these columns: set aside,
--     re-added (and re-checked) at the end.
create temp table fks on commit drop as
select con.conrelid::regclass::text as tbl, con.conname::text as name, pg_get_constraintdef(con.oid) as def
from pg_constraint con
where con.contype = 'f'
  and (con.confrelid = 'public.users'::regclass
       or exists (select 1 from cols
                  where cols.t = (select relname from pg_class where oid = con.conrelid)
                    and cols.col = any (select attname from pg_attribute
                                        where attrelid = con.conrelid and attnum = any (con.conkey))));

do $$
declare r record;
begin
  for r in select * from fks loop
    execute format('alter table %s drop constraint %I', r.tbl, r.name);
  end loop;
end $$;

-- 2d. Move: the profile itself, then everything pointing at it.
--     (Triggers on these tables are paused so no notifications / guards fire.)
do $$
declare r record; moved bigint; total bigint := 0;
begin
  for r in select distinct t from cols union select 'users' loop
    execute format('alter table public.%I disable trigger user', r.t);
  end loop;

  update public.users u set id = m.new_id from m where u.id = m.old_id;
  get diagnostics moved = row_count;
  raise notice 'users: % profiles moved', moved;

  for r in select * from cols loop
    if r.typ = 'uuid' then
      execute format('update public.%I x set %I = m.new_id from m where x.%I = m.old_id', r.t, r.col, r.col);
    else
      execute format('update public.%I x set %I = m.new_id::text from m where x.%I = m.old_id::text', r.t, r.col, r.col);
    end if;
    get diagnostics moved = row_count;
    if moved > 0 then
      raise notice '%.%: % rows', r.t, r.col, moved;
      total := total + moved;
    end if;
  end loop;
  raise notice 'linked rows updated: %', total;

  for r in select distinct t from cols union select 'users' loop
    execute format('alter table public.%I enable trigger user', r.t);
  end loop;
end $$;

-- 2e. Put the foreign keys back (this re-checks every link — if anything
--     were left pointing at an old id, the whole fix is cancelled).
do $$
declare r record;
begin
  for r in select * from fks loop
    execute format('alter table %s add constraint %I %s', r.tbl, r.name, r.def);
  end loop;
end $$;

commit;


-- ── PART 3 · UNDO (only if needed) ───────────────────────────────────────
-- Same steps in reverse, using public._uid_fix_map:
--   replace "m" with:  (select new_id as old_id, old_id as new_id from public._uid_fix_map) m
-- Ask before running — it's simplest to have it prepared for the exact case.
