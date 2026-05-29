-- PoRP Layer 1: Reading Session Proof Database Schema
-- Migration for reading sessions, receipts, and behavioral tracking

-- Reading sessions and behavioral tracking
CREATE TABLE IF NOT EXISTS reading_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    novel_id UUID REFERENCES novels(id),
    chapter_number INTEGER,
    device_hash VARCHAR(64),
    session_data JSONB, -- scroll patterns, timing, interactions
    entropy_score DECIMAL(3,2),
    time_on_page_seconds INTEGER,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, flagged
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Cryptographic session receipts
CREATE TABLE IF NOT EXISTS session_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES reading_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pages_read INTEGER[],
    time_on_pages INTEGER[],
    entropy_score DECIMAL(3,2),
    device_hash VARCHAR(64),
    server_signature TEXT, -- Ed25519 signature
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    used_for_claim BOOLEAN DEFAULT FALSE
);

-- Reading comprehension challenges
CREATE TABLE IF NOT EXISTS comprehension_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number INTEGER,
    question TEXT,
    options TEXT[], -- 4 options array
    correct_answer INTEGER,
    difficulty VARCHAR(10) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Challenge attempts
CREATE TABLE IF NOT EXISTS challenge_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES reading_sessions(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES comprehension_challenges(id) ON DELETE CASCADE,
    user_answer INTEGER,
    is_correct BOOLEAN,
    response_time_ms INTEGER,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reading reputation scoring
CREATE TABLE IF NOT EXISTS reading_reputation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    total_pages_read INTEGER DEFAULT 0,
    total_reading_time_seconds BIGINT DEFAULT 0,
    challenges_passed INTEGER DEFAULT 0,
    challenges_attempted INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 0, -- 0-1000+
    current_tier VARCHAR(20) DEFAULT 'seed', -- seed, reader, scholar, sage
    last_withdrawal_at TIMESTAMP WITH TIME ZONE,
    consecutive_failed_challenges INTEGER DEFAULT 0,
    flagged_for_review BOOLEAN DEFAULT FALSE,
    reward_multiplier DECIMAL(3,2) DEFAULT 1.0, -- 1.0 to 1.5
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reputation staking
CREATE TABLE IF NOT EXISTS reputation_stakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount_smp BIGINT NOT NULL,
    staked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    slashed_at TIMESTAMP WITH TIME ZONE,
    slash_reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    multiplier_applied DECIMAL(3,2) DEFAULT 1.0 -- 1.0 to 1.5
);

-- Withdrawal gating
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount_smp BIGINT NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, queued, processed, rejected
    cooldown_end_at TIMESTAMP WITH TIME ZONE,
    tier_at_request VARCHAR(20),
    receipt_ids UUID[] DEFAULT '{}',
    transaction_signature TEXT
);

-- Slash events for tracking
CREATE TABLE IF NOT EXISTS slash_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stake_id UUID REFERENCES reputation_stakes(id) ON DELETE CASCADE,
    amount_smp_slashed BIGINT NOT NULL,
    reason TEXT,
    slashed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_id ON reading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_novel_id ON reading_sessions(novel_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_status ON reading_sessions(status);
CREATE INDEX IF NOT EXISTS idx_session_receipts_user_id ON session_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_session_receipts_session_id ON session_receipts(session_id);
CREATE INDEX IF NOT EXISTS idx_comprehension_challenges_novel_id ON comprehension_challenges(novel_id);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_session_id ON challenge_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_reading_reputation_user_id ON reading_reputation(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_stakes_user_id ON reputation_stakes(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
