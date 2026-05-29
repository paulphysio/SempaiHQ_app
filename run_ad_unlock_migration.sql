-- Run this migration to add ad-based unlock functionality
-- Execute this in your Supabase SQL editor or via supabase CLI

-- Create ad_based_unlocks table to track daily ad-unlocked chapters
CREATE TABLE IF NOT EXISTS ad_based_unlocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  novel_id UUID NOT NULL REFERENCES novels(id),
  chapter_number INTEGER NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ad_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ad_watched_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, chapter_number, ad_watched_date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ad_based_unlocks_user_id ON ad_based_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_based_unlocks_user_date ON ad_based_unlocks(user_id, ad_watched_date);
CREATE INDEX IF NOT EXISTS idx_ad_based_unlocks_novel_chapter ON ad_based_unlocks(novel_id, chapter_number);

-- Create trigger function to automatically set ad_watched_date
CREATE OR REPLACE FUNCTION set_ad_watched_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ad_watched_date := CURRENT_DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set the date when inserting
CREATE TRIGGER trigger_set_ad_watched_date
BEFORE INSERT ON ad_based_unlocks
FOR EACH ROW
EXECUTE FUNCTION set_ad_watched_date();
