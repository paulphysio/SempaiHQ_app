-- Feed System Database Schema
-- Social feed functionality for mobile app

-- Feed posts table
CREATE TABLE IF NOT EXISTS feed_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    novel_id UUID REFERENCES novels(id) ON DELETE SET NULL,
    manga_id UUID REFERENCES manga(id) ON DELETE SET NULL,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feed likes table
CREATE TABLE IF NOT EXISTS feed_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Feed comments table
CREATE TABLE IF NOT EXISTS feed_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES feed_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feed shares table
CREATE TABLE IF NOT EXISTS feed_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id ON feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_novel_id ON feed_posts(novel_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_manga_id ON feed_posts(manga_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_likes_post_id ON feed_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_user_id ON feed_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post_id ON feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user_id ON feed_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_parent_id ON feed_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_feed_shares_post_id ON feed_shares(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_shares_user_id ON feed_shares(user_id);

-- Add updated_at trigger for feed_posts
CREATE OR REPLACE FUNCTION update_feed_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feed_posts_updated_at
    BEFORE UPDATE ON feed_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_feed_posts_updated_at();

-- Add updated_at trigger for feed_comments
CREATE TRIGGER trigger_update_feed_comments_updated_at
    BEFORE UPDATE ON feed_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_feed_posts_updated_at();
