-- ════════════════════════════════════════════════════════════════════════
-- get_my_wallet_key: also find the wallet of OLDER accounts whose users-row id
-- is different from their Google sign-in id (rows made before ids were synced).
-- Without this, those users never get the "move to a safer wallet" prompt,
-- can't move funds off their old wallet, and can't find their secure wallet
-- on a new phone.
-- The fallback uses my_user_id_by_email() (Part A): it only matches the
-- caller's OWN sign-in email, and only when exactly one account has it.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════
begin;

create or replace function public.get_my_wallet_key(p_address text default null)
returns table (address text, private_key text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select coalesce(
      (select u.id from public.users u where u.id = auth.uid()),
      public.my_user_id_by_email()
    ) as id
  )
  select w.address::text, w.private_key::text
  from public.user_wallets w, me
  where auth.uid() is not null
    and me.id is not null
    and w.user_id in (auth.uid(), me.id)
    and w.private_key is not null
    and (p_address is null or w.address = p_address)
$$;

revoke all on function public.get_my_wallet_key(text) from public, anon;
grant execute on function public.get_my_wallet_key(text) to authenticated;

commit;
