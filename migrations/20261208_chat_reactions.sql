-- ════════════════════════════════════════════════════════════════════════
-- Emoji reactions on chat messages (private chats and Community).
--   · One reaction per person per message (picking another emoji replaces it,
--     picking the same one removes it).
--   · You can only react to — and see reactions on — messages you can see:
--     Community messages are public to signed-in people; a private message
--     only to its sender and recipient.
--   · Live: added to the realtime publication so reactions appear instantly.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.chat_reactions (
  scope text not null check (scope in ('dm', 'group')),
  message_id text not null,
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (scope, message_id, user_id)
);
create index if not exists chat_reactions_msg_idx on public.chat_reactions (scope, message_id);

-- can the signed-in person see this message?
create or replace function public.chat_can_see(p_scope text, p_message text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_scope = 'group' then exists (select 1 from messages m where m.id::text = p_message)
    when p_scope = 'dm' then exists (
      select 1 from private_messages m
       where m.id::text = p_message and (m.sender_id = auth.uid() or m.recipient_id = auth.uid()))
    else false end
$$;
revoke all on function public.chat_can_see(text, text) from public, anon;
grant execute on function public.chat_can_see(text, text) to authenticated;

alter table public.chat_reactions enable row level security;
drop policy if exists "reactions: see on visible messages" on public.chat_reactions;
drop policy if exists "reactions: add my own" on public.chat_reactions;
drop policy if exists "reactions: change my own" on public.chat_reactions;
drop policy if exists "reactions: remove my own" on public.chat_reactions;
create policy "reactions: see on visible messages" on public.chat_reactions for select to authenticated
  using (public.chat_can_see(scope, message_id));
create policy "reactions: add my own" on public.chat_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.chat_can_see(scope, message_id));
create policy "reactions: change my own" on public.chat_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.chat_can_see(scope, message_id));
create policy "reactions: remove my own" on public.chat_reactions for delete to authenticated
  using (user_id = auth.uid());
revoke all on public.chat_reactions from anon;
grant select, insert, update, delete on public.chat_reactions to authenticated;

-- deletes need the old row's keys for realtime listeners
alter table public.chat_reactions replica identity full;
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.chat_reactions'; exception when others then null; end;
end $$;

-- phone notification to the message's author (push-events function; needs 20261207_push_events.sql)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'push_event') then
    execute 'drop trigger if exists push_event_ins on public.chat_reactions';
    execute 'create trigger push_event_ins after insert or update of emoji on public.chat_reactions for each row execute function public.push_event()';
  end if;
end $$;

commit;
