-- Bazaar v2: paid EPUB/PDF marketplace (sell $1 USDC/SOL 70/30, lend 12,500 SMP)
-- Book files live in a PRIVATE bucket and are served only via signed URLs
-- issued by the get-bazaar-book-url edge function after a verified purchase.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS bazaar_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author_name TEXT,
    description TEXT,
    cover_url TEXT,
    file_path TEXT NOT NULL,              -- path inside the private 'bazaar-books' bucket
    file_name TEXT,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('epub', 'pdf')),
    file_size BIGINT,
    price_usd NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    author_share_pct INTEGER NOT NULL DEFAULT 70 CHECK (author_share_pct >= 0 AND author_share_pct <= 100),
    ownership_confirmed BOOLEAN NOT NULL DEFAULT false,
    sale_enabled BOOLEAN NOT NULL DEFAULT false,
    lending_enabled BOOLEAN NOT NULL DEFAULT true,
    lend_price_smp NUMERIC(20, 0) NOT NULL DEFAULT 12500,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed')),
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    ip_attestation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (sale_enabled = false OR ownership_confirmed = true),
    CHECK (sale_enabled OR lending_enabled)
);
CREATE INDEX IF NOT EXISTS idx_bazaar_books_author ON bazaar_books(author_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_books_status ON bazaar_books(status);
CREATE INDEX IF NOT EXISTS idx_bazaar_books_created ON bazaar_books(created_at DESC);

CREATE TABLE IF NOT EXISTS bazaar_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES bazaar_books(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    buyer_wallet TEXT,
    access_type VARCHAR(10) NOT NULL DEFAULT 'purchase' CHECK (access_type IN ('purchase', 'lend')),
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('SOL', 'USDC', 'SMP')),
    price_usd NUMERIC(10, 2) NOT NULL,
    author_share_pct INTEGER NOT NULL,
    author_amount NUMERIC(20, 8),
    platform_amount NUMERIC(20, 8),
    tx_signature TEXT NOT NULL UNIQUE,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'unverified')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refund_pending', 'refunded', 'disputed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bazaar_purchases_book ON bazaar_purchases(book_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_purchases_buyer ON bazaar_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_purchases_wallet ON bazaar_purchases(buyer_wallet);

CREATE TABLE IF NOT EXISTS bazaar_refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES bazaar_purchases(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    requester_role VARCHAR(10) NOT NULL CHECK (requester_role IN ('buyer', 'author', 'admin')),
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    resolution_note TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_bazaar_refunds_purchase ON bazaar_refund_requests(purchase_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_refunds_status ON bazaar_refund_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bazaar_refunds_pending_unique
    ON bazaar_refund_requests(purchase_id) WHERE status = 'pending';

-- ---------- Storage ----------
-- Book files: PRIVATE. Covers: public (they are shown in the grid).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('bazaar-books', 'bazaar-books', false, 104857600,
     ARRAY['application/pdf', 'application/epub+zip', 'application/octet-stream']),
  ('bazaar-covers', 'bazaar-covers', true, 10485760,
     ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Your project has two catch-all policies ("Allow all uploads" = INSERT true,
-- "Allow all viewers" = SELECT true) that would expose EVERY bucket, including this
-- private one. Exclude bazaar-books from them; all other buckets behave as before.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Allow all viewers') THEN
    ALTER POLICY "Allow all viewers" ON storage.objects USING (bucket_id <> 'bazaar-books');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Allow all uploads') THEN
    ALTER POLICY "Allow all uploads" ON storage.objects WITH CHECK (bucket_id <> 'bazaar-books');
  END IF;
END $$;

-- Authors may upload only into their own folder: <user id>/<file>
DROP POLICY IF EXISTS "bazaar books: upload own folder" ON storage.objects;
CREATE POLICY "bazaar books: upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bazaar-books' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "bazaar covers: upload own folder" ON storage.objects;
CREATE POLICY "bazaar covers: upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bazaar-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
-- No SELECT policy on bazaar-books on purpose: reads happen only through signed URLs.
