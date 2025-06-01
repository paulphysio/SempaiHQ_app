-- Create unlocked_story_chapters table
CREATE TABLE IF NOT EXISTS unlocked_story_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  story_id UUID NOT NULL REFERENCES novels(id),
  chapter_unlocked_till INTEGER NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_unlocked_story_chapters_user_id ON unlocked_story_chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_story_chapters_story_id ON unlocked_story_chapters(story_id); 