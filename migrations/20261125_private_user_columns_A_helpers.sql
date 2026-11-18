-- ════════════════════════════════════════════════════════════════════════
-- PART A — safe to run NOW (adds 3 server helpers; changes nothing for users)
-- Needed by the new app + website before Part B hides private user columns.
-- ════════════════════════════════════════════════════════════════════════
begin;

-- 2. Old accounts whose row id predates Google sign-in: find MY row by MY
--    sign-in email, on the server. Returns nothing if 0 or 2+ rows match.
create or replace function public.my_user_id_by_email() returns uuid
language sql stable security definer set search_path = public as $$
  select case when count(*) = 1 then min(u.id::text)::uuid end
  from public.users u
  where auth.uid() is not null
    and coalesce(auth.jwt() ->> 'email', '') <> ''
    and lower(u.email) = lower(auth.jwt() ->> 'email')
$$;
revoke all on function public.my_user_id_by_email() from public, anon;
grant execute on function public.my_user_id_by_email() to authenticated;

-- 3. Website guard: is MY sign-in email already on ANOTHER account with a wallet?
--    Returns that wallet address (public anyway), never the email.
create or replace function public.email_linked_wallet_elsewhere() returns text
language sql stable security definer set search_path = public as $$
  select u.wallet_address
  from public.users u
  where auth.uid() is not null
    and coalesce(auth.jwt() ->> 'email', '') <> ''
    and lower(u.email) = lower(auth.jwt() ->> 'email')
    and u.id <> auth.uid()
    and u.wallet_address is not null
  limit 1
$$;
revoke all on function public.email_linked_wallet_elsewhere() from public, anon;
grant execute on function public.email_linked_wallet_elsewhere() to authenticated;

-- 4. Admin user list (with emails) — answers admins only
create or replace function public.admin_list_users(p_role text default null, p_limit int default 200)
returns table (id uuid, name text, email text, wallet_address text,
               "isWriter" boolean, "isArtist" boolean, "isSuperuser" boolean, weekly_points numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select u.id, u.name::text, u.email::text, u.wallet_address::text,
           coalesce(u."isWriter", false), coalesce(u."isArtist", false), coalesce(u."isSuperuser", false),
           coalesce(u.weekly_points, 0)::numeric
    from public.users u
    where p_role is null
       or (p_role = 'writer' and u."isWriter")
       or (p_role = 'artist' and u."isArtist")
    order by u.name nulls last
    limit greatest(1, least(coalesce(p_limit, 200), 2000));
end $$;
revoke all on function public.admin_list_users(text, int) from public, anon;
grant execute on function public.admin_list_users(text, int) to authenticated;

commit;
