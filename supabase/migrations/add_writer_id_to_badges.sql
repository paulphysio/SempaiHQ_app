-- Add writer_id column to badges table
-- This allows badges to be associated with specific writers

-- Add writer_id column
ALTER TABLE badges 
ADD COLUMN writer_id UUID REFERENCES users(id);

-- Add index for faster queries
CREATE INDEX idx_badges_writer_id ON badges(writer_id);

-- Update existing badges to have writer_id (optional - set to null for now)
-- You can update specific badges later with: UPDATE badges SET writer_id = 'user_uuid' WHERE id = 'badge_uuid';
