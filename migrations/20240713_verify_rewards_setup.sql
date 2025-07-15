-- Verification script for rewards system setup
-- Run this after applying the main migration to verify everything is working

-- Check if rewards_log table exists
SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'rewards_log'
) AS "rewards_log_table_exists";

-- Check if RLS is enabled on rewards_log
SELECT relname, relrowsecurity 
FROM pg_class
WHERE relname = 'rewards_log' 
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Check if RLS policies exist
SELECT polname, polcmd, polpermissive
FROM pg_policy
WHERE polrelid = 'public.rewards_log'::regclass;

-- Check if wallet_balances has timestamp columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'wallet_balances' 
AND column_name IN ('created_at', 'updated_at');

-- Verify isSuperuser column case in users table
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users' 
AND column_name ILIKE '%superuser%'; 