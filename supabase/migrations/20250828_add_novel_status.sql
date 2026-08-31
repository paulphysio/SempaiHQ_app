-- Add status column to novels table for Ongoing/Completed tags
ALTER TABLE novels 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ongoing';

-- Add constraint to ensure only valid status values
ALTER TABLE novels 
ADD CONSTRAINT novels_status_check 
CHECK (status IN ('ongoing', 'completed'));

-- Update existing novels to have 'ongoing' status by default
UPDATE novels 
SET status = 'ongoing' 
WHERE status IS NULL;
