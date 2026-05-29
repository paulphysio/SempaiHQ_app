-- Create ad_based_unlocks table to track daily ad-unlocked chapters
CREATE TABLE IF NOT EXISTS ad_based_unlocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  novel_id UUID NOT NULL REFERENCES novels(id),
  chapter_number INTEGER NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ad_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, chapter_number, DATE(ad_watched_at))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ad_based_unlocks_user_id ON ad_based_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_based_unlocks_user_date ON ad_based_unlocks(user_id, DATE(ad_watched_at));
CREATE INDEX IF NOT EXISTS idx_ad_based_unlocks_novel_chapter ON ad_based_unlocks(novel_id, chapter_number);
