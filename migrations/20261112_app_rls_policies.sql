-- Bazaar v2 RLS policies — REQUIRED after 20261112_bazaar_v2.sql.
-- The bazaar tables have RLS enabled; without these policies the app cannot
-- read anything with the anon key. Edge functions use the service role and
-- bypass RLS entirely, so writes/verification are unaffected.
--
-- Identity note: policies resolve the caller through public.users.email ==
-- auth.jwt()->>'email' (same convention as the edge functions), NOT auth.uid(),
-- because users.id may differ from the Supabase Auth user id.

-- ---------- bazaar_books ----------
-- Anyone can browse active books. Authors can also see their own non-active rows.
DROP POLICY IF EXISTS "bazaar books: public read" ON bazaar_books;
CREATE POLICY "bazaar books: public read" ON bazaar_books
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR author_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
  );

-- Authors can insert/update their own books. (Uploads still go through the
-- app; the row insert uses the anon key + user session.)
DROP POLICY IF EXISTS "bazaar books: authors insert own" ON bazaar_books;
CREATE POLICY "bazaar books: authors insert own" ON bazaar_books
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
  );

DROP POLICY IF EXISTS "bazaar books: authors update own" ON bazaar_books;
CREATE POLICY "bazaar books: authors update own" ON bazaar_books
  FOR UPDATE TO authenticated
  USING (
    author_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
  )
  WITH CHECK (
    author_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
  );

-- No DELETE policy: removal goes through status='removed', not row deletion.

-- ---------- bazaar_purchases ----------
-- Buyers see their own purchases; authors see purchases of their own books.
DROP POLICY IF EXISTS "bazaar purchases: read own or own book sales" ON bazaar_purchases;
CREATE POLICY "bazaar purchases: read own or own book sales" ON bazaar_purchases
  FOR SELECT TO authenticated
  USING (
    buyer_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR book_id IN (
      SELECT id FROM bazaar_books
      WHERE author_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
    )
  );

-- No INSERT/UPDATE/DELETE for clients: purchases are only written by the
-- purchase-bazaar-book edge function (service role). Refund status changes
-- likewise go through edge functions.

-- ---------- bazaar_refund_requests ----------
-- Requesters see their own requests; buyers/authors of the purchase see it too
-- (dashboard shows refund status on the book page).
DROP POLICY IF EXISTS "bazaar refunds: read related" ON bazaar_refund_requests;
CREATE POLICY "bazaar refunds: read related" ON bazaar_refund_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR purchase_id IN (
      SELECT p.id FROM bazaar_purchases p
      WHERE p.buyer_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
         OR p.book_id IN (
           SELECT id FROM bazaar_books
           WHERE author_id = (SELECT id FROM users WHERE email = auth.jwt()->>'email' LIMIT 1)
         )
    )
  );

-- No client writes: refund requests are created by request-bazaar-refund and
-- resolved by resolve-bazaar-refund (both service role).

-- ---------- reading_time_sessions ----------
-- Owner-only: users read/write only their own reading sessions.
-- (useReadingTimer.js does direct insert/select/update/delete.)
alter table reading_time_sessions enable row level security;

drop policy if exists "reading sessions: owner all" on reading_time_sessions;
create policy "reading sessions: owner all" on reading_time_sessions
  for all to authenticated
  using (user_id = (select id from users where email = auth.jwt()->>'email' limit 1))
  with check (user_id = (select id from users where email = auth.jwt()->>'email' limit 1));

-- ---------- pioneer_creators ----------
-- Users read only their own pioneer relationships (BadgesScreen).
-- Rows are written exclusively by edge functions (service role).
alter table pioneer_creators enable row level security;

drop policy if exists "pioneer creators: read own" on pioneer_creators;
create policy "pioneer creators: read own" on pioneer_creators
  for select to authenticated
  using (user_id = (select id from users where email = auth.jwt()->>'email' limit 1));

-- ---------- Intentionally NO policies ----------
-- kaiji_deposits, kaiji_matches, kaiji_picks, kaiji_rounds, withdrawals:
-- accessed only by edge functions via the service role (which bypasses RLS).
-- With RLS enabled and zero policies, anon/authenticated clients cannot
-- read or write them at all — that is the desired state.
