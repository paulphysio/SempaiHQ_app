-- Live unread badge: stream new notification rows to the app the moment
-- they are written, so the bottom-bar badge updates without a refresh.
-- Realtime respects the table's existing read rules, so each user only
-- receives their own rows (the app already reads them, so no policy change).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
