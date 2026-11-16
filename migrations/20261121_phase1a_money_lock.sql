-- ════════════════════════════════════════════════════════════════════════
-- PHASE 1 · MONEY LOCK — only the server can change money.
--
-- After this, balances, withdrawals, payments, unlocks, rewards and the
-- airdrop "already claimed" flag can only be written by the server key
-- (mobile app, edge functions, website /api routes using supabaseAdmin).
-- Everyone can still READ these tables exactly as before.
--
-- users: public writes are limited to profile columns. Money columns
-- (balance, weekly_points, benefactor totals, amethyst_count, …) become
-- server-only. Role columns stay guarded by the guard_user_roles trigger.
--
-- Mobile app: unaffected (server key).
-- Website: browser-side money writes stop (web reading rewards, web welcome
-- bonus, balance cache, web comment rewards). Run only AFTER the website
-- deploy that moves paid web unlocks to the app.
--
-- All-or-nothing. Rollback: 20261121_phase1a_money_lock_rollback.sql
-- ════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. money tables: read-only for the public ─────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'wallet_balances', 'pending_withdrawals', 'withdrawals', 'money_events',
    'wallet_events', 'amethyst_balances', 'airdrop_transactions', 'user_activity',
    'chapter_payments', 'user_payments', 'unlocked_story_chapters',
    'unlocked_manga_chapters', 'benefactor_early_access', 'settings',
    'kaito_leaderboard_rewards', 'rewards_log', 'referrals'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
      execute format('grant select on public.%I to anon, authenticated', t);
      raise notice 'locked: %', t;
    else
      raise notice 'skipped (no such table): %', t;
    end if;
  end loop;
end $$;

-- ── 2. users: profile columns only ─────────────────────────────────────────
revoke insert, update, delete, truncate on public.users from anon, authenticated;
grant select on public.users to anon, authenticated;

-- creating an account (website wallet sign-up / Google upsert)
grant insert (id, name, email, image, wallet_address, has_updated_profile,
              referral_code, referred_by, "isWriter", "isArtist", "isSuperuser")
  on public.users to anon, authenticated;

-- editing a profile (role columns are still forced back by guard_user_roles
-- unless the caller is a signed-in superuser)
grant update (name, email, image, wallet_address, has_updated_profile,
              referral_code, referred_by, x_account, x_verified_at,
              push_token, onesignal_user_id, autopay_enabled,
              "isWriter", "isArtist", "isSuperuser")
  on public.users to anon, authenticated;

-- NOT granted (server only): balance, weekly_points, last_reward_time,
-- weekly_points_reset, total_points_read, amethyst_count, is_benefactor,
-- benefactor_since, benefactor_level, total_benefactor_payments,
-- current_writer_subscription, current_writer_subscription_expires,
-- email_verified, x_oauth_token — and DELETE.

-- New users get an amethyst_balances row from this trigger. It runs as the
-- caller, so once that table is server-only a website sign-up would fail —
-- run it with the owner's rights instead (trigger functions can't be called
-- directly, so this opens nothing).
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'create_amethyst_balance_entry') then
    alter function public.create_amethyst_balance_entry() security definer;
    alter function public.create_amethyst_balance_entry() set search_path = public;
  end if;
end $$;

-- ── 3. server-only tables the website never writes ────────────────────────
-- Only the mobile app (server key) and edge functions write these, so the
-- public loses nothing. Reads stay as they are.
do $$
declare
  t text;
begin
  foreach t in array array[
    'amethyst_inventory', 'android_downloads', 'badges', 'banned_devices',
    'benefactor_announcements', 'challenge_attempts', 'chapter_queue',
    'comprehension_challenges', 'creator_schedule_tracking', 'feed_likes',
    'feed_post_views', 'nfts', 'platform_settings', 'points_history',
    'reading_reputation', 'reading_sessions', 'reputation_stakes', 'slash_events',
    'subscriptions', 'token_burns', 'weekly_leaderboard', 'withdrawal_requests',
    'bazaar_books', 'bazaar_purchases', 'bazaar_read_sessions',
    'bazaar_refund_requests', 'creator_tips', 'kaiji_deposits', 'kaiji_matches',
    'kaiji_picks', 'kaiji_rounds', 'kaiji_sol_share', 'kaiji_sol_swaps',
    'pioneer_creators', 'reading_progress', 'reading_time_sessions'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
      raise notice 'server-only: %', t;
    end if;
  end loop;
end $$;

-- ── 4. nobody can wipe the catalogue ───────────────────────────────────────
-- (creators delete titles from the app; the website no longer can)
do $$
declare
  t text;
begin
  foreach t in array array['novels', 'manga', 'manga_chapters'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke delete, truncate on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 5. clean up the attacker's fake withdrawal requests ───────────────────
update public.pending_withdrawals
   set status = 'rejected'
 where status = 'pending'
   and user_id in ('7d5de716-89f0-4b99-95f1-9f4ee7535d3a',
                   '37617ebc-c66e-49e4-9b07-e00e781aa990');

commit;
