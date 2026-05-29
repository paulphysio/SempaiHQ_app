-- Run this migration to add benefactor early access functionality
-- Execute this in your Supabase SQL editor or via supabase CLI

-- Create benefactor_early_access table for $1 early access to 3 chapters
CREATE TABLE IF NOT EXISTS benefactor_early_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  benefactor_wallet TEXT NOT NULL,
  novel_id UUID NOT NULL REFERENCES novels(id),
  chapters_unlocked INTEGER DEFAULT 3,
  chapters_remaining INTEGER DEFAULT 3,
  payment_amount NUMERIC DEFAULT 1.00,
  payment_currency TEXT NOT NULL, -- SOL, USDC, SMP
  transaction_id TEXT NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(benefactor_wallet, novel_id)
);

-- Create benefactor_access_log to track which chapters were accessed
CREATE TABLE IF NOT EXISTS benefactor_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  benefactor_access_id UUID NOT NULL REFERENCES benefactor_early_access(id),
  novel_id UUID NOT NULL REFERENCES novels(id),
  chapter_number INTEGER NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(benefactor_access_id, chapter_number)
);

-- Create creator_schedule_tracking to ensure writers keep to schedule
CREATE TABLE IF NOT EXISTS creator_schedule_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID NOT NULL REFERENCES novels(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  scheduled_release_date TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_release_date TIMESTAMP WITH TIME ZONE,
  chapter_number INTEGER NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'released', 'delayed', 'cancelled')),
  delay_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create benefactor_announcements for benefactor-specific updates
CREATE TABLE IF NOT EXISTS benefactor_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID NOT NULL REFERENCES novels(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  announcement_type TEXT DEFAULT 'update' CHECK (announcement_type IN ('update', 'delay', 'release', 'special')),
  target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'benefactors_only')),
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_benefactor_early_access_wallet ON benefactor_early_access(benefactor_wallet);
CREATE INDEX IF NOT EXISTS idx_benefactor_early_access_novel ON benefactor_early_access(novel_id);
CREATE INDEX IF NOT EXISTS idx_benefactor_early_access_active ON benefactor_early_access(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_benefactor_access_log_access ON benefactor_access_log(benefactor_access_id);
CREATE INDEX IF NOT EXISTS idx_creator_schedule_novel ON creator_schedule_tracking(novel_id);
CREATE INDEX IF NOT EXISTS idx_creator_schedule_status ON creator_schedule_tracking(status, scheduled_release_date);
CREATE INDEX IF NOT EXISTS idx_benefactor_announcements_novel ON benefactor_announcements(novel_id, target_audience);
CREATE INDEX IF NOT EXISTS idx_benefactor_announcements_active ON benefactor_announcements(is_pinned, created_at);

-- Create function to automatically expire benefactor access after 14 days
CREATE OR REPLACE FUNCTION expire_benefactor_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Update benefactor access status if expired
  UPDATE benefactor_early_access 
  SET is_active = FALSE 
  WHERE id = NEW.id AND expires_at <= NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check expiration on access
CREATE TRIGGER trigger_check_benefactor_expiration
BEFORE INSERT ON benefactor_access_log
FOR EACH ROW
EXECUTE FUNCTION expire_benefactor_access();

-- Create function to update schedule tracking
CREATE OR REPLACE FUNCTION update_schedule_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  -- If status is being set to 'released', set actual_release_date
  IF NEW.status = 'released' AND OLD.status != 'released' THEN
    NEW.actual_release_date = NOW();
  END IF;
  
  -- If status is being set to 'delayed', ensure delay_reason is provided
  IF NEW.status = 'delayed' AND OLD.status != 'delayed' THEN
    IF NEW.delay_reason IS NULL OR NEW.delay_reason = '' THEN
      RAISE EXCEPTION 'Delay reason is required when status is set to delayed';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for schedule tracking updates
CREATE TRIGGER trigger_update_schedule_tracking
BEFORE UPDATE ON creator_schedule_tracking
FOR EACH ROW
EXECUTE FUNCTION update_schedule_tracking();
