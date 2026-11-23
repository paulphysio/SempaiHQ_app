-- ════════════════════════════════════════════════════════════════════════
-- Chat, rebuilt.
--  · Private messages are tied to ACCOUNTS (sender_id / recipient_id), not
--    just wallets, so conversations survive wallet changes. Old messages are
--    matched to their accounts below.
--  · Security fix: the recipient could edit the sender's message. Now only
--    the sender edits / deletes; the recipient can only mark it read.
--  · Read receipts (read_at), "edited" (edited_at), an inbox function with
--    unread counts, picture storage, and live delivery.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

-- ── private messages: account ids ────────────────────────────────────────
alter table public.private_messages add column if not exists sender_id uuid references public.users(id) on delete set null;
alter table public.private_messages add column if not exists recipient_id uuid references public.users(id) on delete set null;
alter table public.private_messages add column if not exists read_at timestamptz;
alter table public.private_messages add column if not exists edited_at timestamptz;
alter table public.private_messages add column if not exists media_url text;
alter table public.private_messages add column if not exists parent_id uuid;
alter table public.private_messages alter column sender_wallet drop not null;
alter table public.private_messages alter column recipient_wallet drop not null;

update public.private_messages p set sender_id = u.id
  from public.users u where p.sender_id is null and p.sender_wallet is not null and u.wallet_address = p.sender_wallet;
update public.private_messages p set sender_id = w.user_id
  from public.user_wallets w where p.sender_id is null and p.sender_wallet is not null and w.address = p.sender_wallet;
update public.private_messages p set recipient_id = u.id
  from public.users u where p.recipient_id is null and p.recipient_wallet is not null and u.wallet_address = p.recipient_wallet;
update public.private_messages p set recipient_id = w.user_id
  from public.user_wallets w where p.recipient_id is null and p.recipient_wallet is not null and w.address = p.recipient_wallet;

-- messages marked read the old way count as read
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'private_messages' and column_name = 'status') then
    execute $q$update public.private_messages set read_at = coalesce(read_at, created_at) where status = 'read'$q$;
  end if;
end $$;

create index if not exists private_messages_pair_idx on public.private_messages (sender_id, recipient_id, created_at desc);
create index if not exists private_messages_unread_idx on public.private_messages (recipient_id, read_at);

-- fill in who / where on every new message; the sender is always the caller
create or replace function public.chat_dm_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.sender_id := auth.uid(); end if;
  if new.recipient_id is null and new.recipient_wallet is not null then
    select id into new.recipient_id from users where wallet_address = new.recipient_wallet limit 1;
    if new.recipient_id is null then
      select user_id into new.recipient_id from user_wallets where address = new.recipient_wallet limit 1;
    end if;
  end if;
  if new.sender_wallet is null then select wallet_address into new.sender_wallet from users where id = new.sender_id; end if;
  if new.recipient_wallet is null then select wallet_address into new.recipient_wallet from users where id = new.recipient_id; end if;
  new.read_at := null;
  new.edited_at := null;
  return new;
end $$;
drop trigger if exists chat_dm_before_insert on public.private_messages;
create trigger chat_dm_before_insert before insert on public.private_messages
  for each row execute function public.chat_dm_before_insert();

-- only the sender can change a message; the recipient can only mark it read
create or replace function public.chat_dm_before_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if; -- server (e.g. moving history to a new wallet)
  new.sender_id := old.sender_id;
  new.recipient_id := old.recipient_id;
  new.created_at := old.created_at;
  if auth.uid() is distinct from old.sender_id then
    new.content := old.content;
    new.media_url := old.media_url;
    new.parent_id := old.parent_id;
    new.edited_at := old.edited_at;
    new.sender_wallet := old.sender_wallet;
    new.recipient_wallet := old.recipient_wallet;
  elsif new.content is distinct from old.content then
    new.edited_at := now();
  end if;
  return new;
end $$;
drop trigger if exists chat_dm_before_update on public.private_messages;
create trigger chat_dm_before_update before update on public.private_messages
  for each row execute function public.chat_dm_before_update();

alter table public.private_messages enable row level security;
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'private_messages' loop
    execute format('drop policy if exists %I on public.private_messages', r.policyname);
  end loop;
end $$;
create policy "dm: my conversations" on public.private_messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid()
         or sender_wallet in (select public.my_wallets()) or recipient_wallet in (select public.my_wallets()));
create policy "dm: send as me" on public.private_messages for insert to authenticated
  with check (sender_id = auth.uid() and recipient_id is not null and recipient_id <> auth.uid());
create policy "dm: sender edits, recipient marks read" on public.private_messages for update to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid())
  with check (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "dm: sender deletes" on public.private_messages for delete to authenticated
  using (sender_id = auth.uid());
revoke all on public.private_messages from anon;
grant select, insert, update, delete on public.private_messages to authenticated;

-- ── community (group) chat ───────────────────────────────────────────────
alter table public.messages add column if not exists edited_at timestamptz;
create or replace function public.chat_group_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.user_id := auth.uid(); end if;
    if new.wallet_address is null then select wallet_address into new.wallet_address from users where id = new.user_id; end if;
    new.edited_at := null;
  elsif new.content is distinct from old.content and auth.uid() is not null then
    new.edited_at := now();
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists chat_group_before_write on public.messages;
create trigger chat_group_before_write before insert or update on public.messages
  for each row execute function public.chat_group_before_write();

-- ── inbox: one row per conversation, newest first ────────────────────────
create or replace function public.chat_inbox()
returns table (other_id uuid, other_name text, other_image text, last_content text, last_media text,
               last_at timestamptz, last_from_me boolean, unread integer)
language sql stable security definer set search_path = public as $$
  with mine as (
    select p.*, case when p.sender_id = auth.uid() then p.recipient_id else p.sender_id end as other
    from private_messages p
    where auth.uid() is not null and (p.sender_id = auth.uid() or p.recipient_id = auth.uid())
  ), last as (
    select distinct on (other) other, content, media_url, created_at, (sender_id = auth.uid()) as from_me
    from mine where other is not null
    order by other, created_at desc
  ), unread as (
    select sender_id as other, count(*)::integer as n
    from private_messages
    where recipient_id = auth.uid() and read_at is null
    group by sender_id
  )
  select l.other, u.name, u.image, l.content, l.media_url, l.created_at, l.from_me, coalesce(un.n, 0)
  from last l
  join users u on u.id = l.other
  left join unread un on un.other = l.other
  order by l.created_at desc
  limit 200;
$$;
revoke all on function public.chat_inbox() from public, anon;
grant execute on function public.chat_inbox() to authenticated;

create or replace function public.chat_mark_read(p_other uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update private_messages set read_at = now()
   where recipient_id = auth.uid() and sender_id = p_other and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.chat_mark_read(uuid) from public, anon;
grant execute on function public.chat_mark_read(uuid) to authenticated;

-- ── pictures ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
drop policy if exists "chat media: upload own folder" on storage.objects;
create policy "chat media: upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

commit;

-- ── live delivery (separate: harmless if already set up) ─────────────────
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.messages'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.private_messages'; exception when others then null; end;
end $$;
