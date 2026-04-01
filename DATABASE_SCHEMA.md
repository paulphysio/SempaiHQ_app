# Database Schema

## Tables

### airdrop_transactions
- id (uuid)
- user_id (uuid)
- transaction_signature (text)
- amount (numeric)
- created_at (timestamp with time zone)

### android_downloads
- id (uuid)
- version (text)
- download_url (text)
- created_at (timestamp with time zone)

### announcements
- id (uuid)
- user_id (uuid)
- title (text)
- message (text)
- audience (text)
- is_superuser_announcement (boolean)
- release_date (timestamp with time zone)
- created_at (timestamp with time zone)

### banned_devices
- id (uuid)
- device_hash (text)
- reason (text)
- banned_at (timestamp with time zone)

### chapter_payments
- id (uuid)
- wallet_address (text)
- novel_id (uuid)
- chapter_number (integer)
- amount (bigint)
- currency (text)
- transaction_id (text)
- payment_type (text)
- decimals (integer)
- paid_at (timestamp with time zone)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)

### chapter_queue
- id (uuid)
- novel_id (uuid)
- chapter_number (integer)
- is_advance (boolean)
- status (text)
- release_date (timestamp with time zone)
- created_at (timestamp with time zone)

### chapter_ratings
- id (uuid)
- user_id (uuid)
- content_id (uuid)
- content_type (text)
- chapter_number (integer)
- rating (integer)
- created_at (timestamp with time zone)

### comments
- id (uuid)
- user_id (uuid)
- novel_id (uuid)
- chapter (text)
- chapter_id (text)
- content (text)
- author (text)
- username (text)
- parent_id (uuid)
- is_rewarded (boolean)
- created_at (timestamp with time zone)

### creator_applications
- id (uuid)
- user_id (uuid)
- name (text)
- email (text)
- role (text)
- reason (text)
- submission_link (text)
- application_status (text)
- created_at (timestamp with time zone)

### gifs
- id (bigint)
- title (character varying)
- url (text)
- tags (ARRAY)
- created_at (timestamp with time zone)

### kaito_leaderboard_rewards
- id (bigint)
- top_players_count (integer)
- players_rewarded (integer)
- total_amount_distributed (bigint)
- distribution_details (jsonb)
- distributed_at (timestamp with time zone)
- created_at (timestamp with time zone)

### manga
- id (uuid)
- user_id (uuid)
- title (text)
- author (text)
- summary (text)
- cover_image (text)
- tags (ARRAY)
- status (text)
- viewers_count (integer)
- is_visible (boolean)
- show_in_home (boolean)
- created_at (timestamp with time zone)

### manga_chapters
- id (uuid)
- manga_id (uuid)
- chapter_number (integer)
- title (text)
- price (numeric)
- is_premium (boolean)
- average_rating (numeric)
- ratings_count (integer)
- created_at (timestamp with time zone)

### manga_comments
- id (uuid)
- user_id (uuid)
- manga_id (uuid)
- chapter_id (uuid)
- content (text)
- username (text)
- parent_id (uuid)
- is_rewarded (boolean)
- created_at (timestamp with time zone)

### manga_detail_comments
- id (uuid)
- user_id (uuid)
- manga_id (uuid)
- content (text)
- username (text)
- parent_id (uuid)
- is_rewarded (boolean)
- created_at (timestamp with time zone)

### manga_interactions
- id (uuid)
- user_id (uuid)
- manga_id (uuid)
- read_count (integer)
- last_read_at (timestamp without time zone)

### manga_pages
- id (uuid)
- chapter_id (uuid)
- page_number (integer)
- image_url (text)

### messages
- id (uuid)
- user_id (uuid)
- wallet_address (text)
- recipient_wallet_address (text)
- content (text)
- media_url (text)
- parent_id (uuid)
- created_at (timestamp with time zone)

### nfts
- id (smallint)
- name (text)
- symbol (text)
- price (bigint)
- minted (boolean)
- url (text)
- keypair (text)

### notifications
- id (uuid)
- user_id (uuid)
- type (text)
- message (text)
- novel_id (uuid)
- manga_id (uuid)
- comment_id (uuid)
- chat_id (uuid)
- sender_wallet_address (text)
- recipient_wallet_address (text)
- novel_title (text)
- chapter (text)
- is_read (boolean)
- created_at (timestamp with time zone)

### novel_interactions
- id (uuid)
- user_id (uuid)
- novel_id (uuid)
- wallet_address (text)
- read_count (integer)
- last_read_at (timestamp without time zone)

### novels
- id (uuid)
- user_id (uuid)
- title (text)
- summary (text)
- image (text)
- chaptertitles (jsonb)
- chaptercontents (jsonb)
- advance_chapters (jsonb)
- tags (ARRAY)
- viewers_count (integer)
- is_visible (boolean)
- show_in_home (boolean)

### pending_withdrawals
- id (uuid)
- user_id (uuid)
- amount (numeric)
- transaction_id (text)
- status (text)
- idempotence_key (text)
- last_valid_blockheight (bigint)
- createdat (timestamp with time zone)

### platform_settings
- key (text)
- value (text)
- updated_at (timestamp with time zone)

### players
- id (uuid)
- name (text)
- wallet_address (text)
- avatar (text)
- trait (text)
- level (integer)
- xp (integer)
- health (integer)
- max_health (integer)
- gold (integer)
- stats (jsonb)
- skills (jsonb)
- equipment (jsonb)
- inventory (jsonb)
- inventory_slots (integer)
- recipes (jsonb)
- rare_items (jsonb)
- quests (jsonb)
- guild (jsonb)
- daily_tasks (jsonb)
- weekly_tasks (jsonb)
- last_login (timestamp with time zone)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)

### polls
- id (uuid)
- user_id (uuid)
- question (text)
- options (ARRAY)
- created_at (timestamp with time zone)
- expires_at (timestamp with time zone)

### private_messages
- id (uuid)
- sender_wallet (text)
- recipient_wallet (text)
- content (text)
- media_url (text)
- parent_id (uuid)
- status (text)
- created_at (timestamp with time zone)

### rate_limits
- ip (text)
- count (integer)
- last_reset (timestamp with time zone)

### referrals
- id (uuid)
- inviter_id (uuid)
- invitee_id (uuid)
- reward_claimed (boolean)
- created_at (timestamp without time zone)

### rewards_log
- id (uuid)
- total_points (integer)
- reward_per_point (double precision)
- amount_distributed (double precision)
- distributed_at (timestamp with time zone)

### rock_paper_scissors
- id (uuid)
- player1_wallet (text)
- player2_wallet (text)
- player1_choice (text)
- player2_choice (text)
- stake_amount (numeric)
- winner (text)
- status (text)

### settings
- key (text)
- value (text)

### subscriptions
- id (uuid)
- user_id (uuid)
- plan (text)
- transaction_signature (text)
- expires_at (timestamp with time zone)
- created_at (timestamp without time zone)

### support_requests
- id (uuid)
- name (text)
- email (text)
- subject (text)
- message (text)
- created_at (timestamp with time zone)

### unlocked_manga_chapters
- id (uuid)
- user_id (uuid)
- manga_id (uuid)
- chapter_id (uuid)
- unlocked_at (timestamp with time zone)
- expires_at (timestamp with time zone)
- payment_amount (numeric)
- payment_currency (text)
- transaction_id (text)
- created_at (timestamp with time zone)

### unlocked_story_chapters
- id (uuid)
- user_id (uuid)
- story_id (uuid)
- purchase_start_chapter (integer)
- chapter_unlocked_till (integer)
- chapters_unlocked_count (integer)
- chapters_purchased (integer)
- subscription_type (text)
- payment_amount (numeric)
- payment_currency (text)
- transaction_id (text)
- expires_at (timestamp without time zone)
- created_at (timestamp without time zone)

### user_activity
- user_id (uuid)
- has_claimed_airdrop (boolean)
- last_claim_timestamp (timestamp with time zone)
- created_at (timestamp with time zone)

### user_payments
- id (uuid)
- user_wallet (text)
- manga_id (text)
- chapter_id (text)
- payment_amount (double precision)
- payment_currency (text)
- transaction_id (text)
- paid_at (timestamp with time zone)

### user_wallets
- id (uuid)
- user_id (uuid)
- address (text)
- private_key (text)
- created_at (timestamp with time zone)

### users
- id (uuid)
- name (text)
- email (text)
- email_verified (timestamp without time zone)
- wallet_address (text)
- referral_code (text)
- referred_by (text)
- balance (numeric)
- weekly_points (numeric)
- last_reward_time (timestamp without time zone)
- image (text)
- isWriter (boolean)
- isArtist (boolean)
- isSuperuser (boolean)
- has_updated_profile (boolean)
- x_account (text)
- x_oauth_token (text)
- x_verified_at (timestamp with time zone)

### votes
- id (uuid)
- poll_id (uuid)
- user_id (uuid)
- choice (text)

### wallet_balances
- user_id (uuid)
- wallet_address (text)
- currency (text)
- chain (text)
- amount (numeric)
- decimals (integer)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)

### wallet_events
- id (uuid)
- source_user_id (uuid)
- destination_user_id (uuid)
- event_type (text)
- source_transaction_signature (text)
- destination_transaction_signature (text)
- source_currency (text)
- destination_currency (text)
- source_chain (text)
- destination_chain (text)
- amount_change (integer)
- event_details (text)
- wallet_address (text)
- timestamp (timestamp without time zone)

### writer_announcements
- id (uuid)
- writer_id (uuid)
- novel_id (uuid)
- title (text)
- message (text)
- release_date (timestamp without time zone)
- created_at (timestamp without time zone)

### writer_applications
- id (uuid)
- user_id (uuid)
- name (text)
- email (text)
- reason (text)
- submission_link (text)
- application_status (text)
- submitted_at (timestamp with time zone)

### writer_profiles
- user_id (uuid)
- bio (text)
- twitter (text)
- discord (text)
- website (text)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)
