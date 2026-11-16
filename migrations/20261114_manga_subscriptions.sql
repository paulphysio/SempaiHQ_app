-- Manga subscriptions + paywall security fix
-- 1) manga_subscriptions: $5/30d or $3/21d access to a whole manga series + artist chat
-- 2) Close the free-access holes: manga_pages image URLs and self-granted unlocks

-- ── 1. Subscriptions ──────────────────────────────────────────────────────────
create table if not exists public.manga_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  manga_id    uuid not null references public.manga(id) on delete cascade,
  plan        text not null check (plan in ('monthly', 'days21')),
  amount_usd  numeric(10,2) not null,
  currency    text not null check (currency in ('SOL', 'USDC')),
  tx_sig      text not null unique,
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_manga_subs_user_manga
  on public.manga_subscriptions (user_id, manga_id, expires_at desc);
create index if not exists idx_manga_subs_expiry
  on public.manga_subscriptions (expires_at);

-- Service-role only: rows are written by the subscribe-manga edge function
-- after on-chain payment confirms. No client grants.
revoke all on public.manga_subscriptions from anon, authenticated;
grant all on public.manga_subscriptions to service_role;

-- ── 2. Close leaks ────────────────────────────────────────────────────────────
-- manga_pages: keep catalog columns readable (page count, ordering) but hide
-- image_url, which points into what is now a private bucket anyway.
revoke select on public.manga_pages from anon, authenticated;
grant select (id, chapter_id, page_number) on public.manga_pages to anon, authenticated;

-- Unlock/payment records must be written server-side after on-chain
-- verification (record-manga-payment / subscribe-manga edge functions).
revoke insert on public.unlocked_manga_chapters from anon, authenticated;
revoke insert, update on public.user_payments from anon, authenticated;

-- ── 3. Private page buckets ───────────────────────────────────────────────────
-- Pages are now served as short-lived signed URLs by the
-- manga-chapter-pages edge function after an access check.
update storage.buckets set public = false where id in ('manga-images', 'manga-pages');
