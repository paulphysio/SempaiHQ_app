-- Create user_activity table
CREATE TABLE IF NOT EXISTS public.user_activity (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_login TIMESTAMP WITH TIME ZONE,
    tokens_claimed INTEGER DEFAULT 0,
    last_claim_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON public.user_activity(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own activity"
    ON public.user_activity
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
    ON public.user_activity
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
    ON public.user_activity
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_activity_updated_at
    BEFORE UPDATE ON public.user_activity
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 