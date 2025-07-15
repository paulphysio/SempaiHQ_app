-- Migration for weekly rewards system
-- Ensures the rewards_log table has the correct structure

-- Check if rewards_log table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rewards_log') THEN
        CREATE TABLE public.rewards_log (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            amount_distributed DOUBLE PRECISION NOT NULL,
            total_points INTEGER NOT NULL,
            reward_per_point DOUBLE PRECISION NOT NULL,
            distributed_at TIMESTAMP WITH TIME ZONE NOT NULL
        );

        -- Add comment to the table
        COMMENT ON TABLE public.rewards_log IS 'Records of weekly reward distributions';
    END IF;
END
$$;

-- Add RLS policies for rewards_log
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Allow admins to manage rewards_log" ON public.rewards_log;
    DROP POLICY IF EXISTS "Allow users to view rewards_log" ON public.rewards_log;
    
    -- Enable RLS on rewards_log
    ALTER TABLE public.rewards_log ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY "Allow admins to manage rewards_log" 
    ON public.rewards_log 
    FOR ALL 
    TO authenticated 
    USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users."isSuperuser" = true
    ));
    
    CREATE POLICY "Allow users to view rewards_log" 
    ON public.rewards_log 
    FOR SELECT 
    TO authenticated 
    USING (true);
END
$$;

-- Ensure wallet_balances table has proper timestamps
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'wallet_balances' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.wallet_balances 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'wallet_balances' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.wallet_balances 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END
$$; 