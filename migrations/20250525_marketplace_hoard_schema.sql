-- Marketplace and Hoard Database Schema
-- NFT marketplace and collection system for mobile app

-- Hoard/NFT collection table
CREATE TABLE IF NOT EXISTS hoard_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nft_mint_address TEXT NOT NULL UNIQUE,
    nft_name TEXT NOT NULL,
    nft_description TEXT,
    nft_image_url TEXT,
    collection_name TEXT,
    rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_listed BOOLEAN DEFAULT FALSE,
    listing_price_smp BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace listings table
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nft_mint_address TEXT NOT NULL,
    nft_name TEXT NOT NULL,
    nft_image_url TEXT,
    price_smp BIGINT NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common',
    status VARCHAR(20) DEFAULT 'active', -- active, sold, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sold_at TIMESTAMP WITH TIME ZONE,
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Marketplace transactions table
CREATE TABLE IF NOT EXISTS marketplace_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nft_mint_address TEXT NOT NULL,
    price_smp BIGINT NOT NULL,
    transaction_signature TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Hoard achievements table
CREATE TABLE IF NOT EXISTS hoard_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    total_nfts_collected INTEGER DEFAULT 0,
    total_value_smp BIGINT DEFAULT 0,
    rarest_rarity VARCHAR(20),
    largest_collection_name TEXT,
    collection_count INTEGER DEFAULT 0,
    last_achievement_unlocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_hoard_items_user_id ON hoard_items(user_id);
CREATE INDEX IF NOT EXISTS idx_hoard_items_nft_mint ON hoard_items(nft_mint_address);
CREATE INDEX IF NOT EXISTS idx_hoard_items_rarity ON hoard_items(rarity);
CREATE INDEX IF NOT EXISTS idx_hoard_items_is_listed ON hoard_items(is_listed);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_id ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_rarity ON marketplace_listings(rarity);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_price ON marketplace_listings(price_smp);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_seller_id ON marketplace_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_buyer_id ON marketplace_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_status ON marketplace_transactions(status);
CREATE INDEX IF NOT EXISTS idx_hoard_achievements_user_id ON hoard_achievements(user_id);

-- Add updated_at trigger for hoard_items
CREATE OR REPLACE FUNCTION update_hoard_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hoard_items_updated_at
    BEFORE UPDATE ON hoard_items
    FOR EACH ROW
    EXECUTE FUNCTION update_hoard_items_updated_at();

-- Add updated_at trigger for marketplace_listings
CREATE TRIGGER trigger_update_marketplace_listings_updated_at
    BEFORE UPDATE ON marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_hoard_items_updated_at();

-- Add updated_at trigger for hoard_achievements
CREATE TRIGGER trigger_update_hoard_achievements_updated_at
    BEFORE UPDATE ON hoard_achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_hoard_items_updated_at();
