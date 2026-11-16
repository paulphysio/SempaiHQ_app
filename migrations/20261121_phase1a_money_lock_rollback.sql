-- Undo PHASE 1 · MONEY LOCK (restores the previous open grants).
-- The attacker's withdrawal rows stay 'rejected'.
begin;

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
      execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    end if;
  end loop;
end $$;

grant select, insert, update, delete on public.users to anon, authenticated;

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
    'pioneer_creators', 'reading_progress', 'reading_time_sessions',
    'novels', 'manga', 'manga_chapters'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant insert, update, delete on public.%I to anon, authenticated', t);
    end if;
  end loop;
end $$;

-- the trigger keeps owner rights (harmless); to fully undo:
-- alter function public.create_amethyst_balance_entry() security invoker;

commit;
