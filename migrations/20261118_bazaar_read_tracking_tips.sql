-- Bazaar file read tracking (PDF/EPUB) + creator tips
-- Read sessions let admins see whether a buyer actually opened a book
-- before approving a refund. Tips record creator gratuities.

-- ---------- bazaar_read_sessions ----------
-- One row per reader session. pages_read is the set of 1-based page/chapter
-- indexes visited; seconds_spent accumulates while the reader is open.
CREATE TABLE IF NOT EXISTS public.bazaar_read_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES public.bazaar_purchases(id) ON DELETE CASCADE,
    book_id UUID REFERENCES public.bazaar_books(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    wallet_address TEXT,
    file_type TEXT,
    pages_read INTEGER[] NOT NULL DEFAULT '{}',
    max_page INTEGER,
    total_pages INTEGER,
    seconds_spent INTEGER NOT NULL DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bazaar_read_sessions_purchase ON public.bazaar_read_sessions(purchase_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_read_sessions_book ON public.bazaar_read_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_read_sessions_user ON public.bazaar_read_sessions(user_id);

ALTER TABLE public.bazaar_read_sessions ENABLE ROW LEVEL SECURITY;

-- Readers write only their own sessions.
DROP POLICY IF EXISTS "bazaar read sessions: owner all" ON public.bazaar_read_sessions;
CREATE POLICY "bazaar read sessions: owner all" ON public.bazaar_read_sessions
  FOR ALL TO authenticated
  USING (user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1))
  WITH CHECK (user_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1));

-- Admins read every session (refund review shows pages read + time spent).
DROP POLICY IF EXISTS "bazaar read sessions: admin read" ON public.bazaar_read_sessions;
CREATE POLICY "bazaar read sessions: admin read" ON public.bazaar_read_sessions
  FOR SELECT TO authenticated
  USING ((SELECT "isSuperuser" FROM users WHERE email = auth.jwt()->>'email' LIMIT 1) = true);

-- ---------- creator_tips ----------
CREATE TABLE IF NOT EXISTS public.creator_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    tipper_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    tipper_wallet TEXT,
    creator_wallet TEXT,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('SOL', 'USDC', 'SKR')),
    amount NUMERIC(20, 8) NOT NULL,
    tx_signature TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_creator_tips_creator ON public.creator_tips(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_tips_tipper ON public.creator_tips(tipper_id);

ALTER TABLE public.creator_tips ENABLE ROW LEVEL SECURITY;

-- Tippers record their own tips; creators and admins can read them.
DROP POLICY IF EXISTS "creator tips: insert own" ON public.creator_tips;
CREATE POLICY "creator tips: insert own" ON public.creator_tips
  FOR INSERT TO authenticated
  WITH CHECK (tipper_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1));

DROP POLICY IF EXISTS "creator tips: read related" ON public.creator_tips;
CREATE POLICY "creator tips: read related" ON public.creator_tips
  FOR SELECT TO authenticated
  USING (
    tipper_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR creator_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR (SELECT "isSuperuser" FROM users WHERE email = auth.jwt()->>'email' LIMIT 1) = true
  );

-- ---------- admin refund review ----------
-- The existing policies only let buyers/authors/requesters read refund
-- requests and purchases. Admins need read access to review them.
DROP POLICY IF EXISTS "bazaar refunds: admin read" ON public.bazaar_refund_requests;
CREATE POLICY "bazaar refunds: admin read" ON public.bazaar_refund_requests
  FOR SELECT TO authenticated
  USING ((SELECT "isSuperuser" FROM users WHERE email = auth.jwt()->>'email' LIMIT 1) = true);

DROP POLICY IF EXISTS "bazaar purchases: admin read" ON public.bazaar_purchases;
CREATE POLICY "bazaar purchases: admin read" ON public.bazaar_purchases
  FOR SELECT TO authenticated
  USING ((SELECT "isSuperuser" FROM users WHERE email = auth.jwt()->>'email' LIMIT 1) = true);
