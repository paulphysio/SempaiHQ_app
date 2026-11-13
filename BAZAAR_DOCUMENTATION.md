# Sempai HQ Bazaar — Complete Documentation

> **⚠️ v2 SECURITY UPDATE (applied after this doc was written)**
> The Bazaar was hardened after an external security review. **The code in this document's
> Appendix reflects v1 and is superseded.** The authoritative, current files are:
>
> - `migrations/20261112_bazaar_v2.sql` (replaces `20261112_bazaar.sql`)
> - `supabase/functions/_shared/auth.ts` + `_shared/verify.ts` (new shared modules)
> - `supabase/functions/{purchase-bazaar-book,request-bazaar-refund,resolve-bazaar-refund,get-bazaar-book-url}/index.ts` (4 functions — deploy ALL together)
> - `utils/bazaar.js`, `screens/BazaarBookScreen.js` (replaced)
> - `screens/{UploadBookScreen,BazaarScreen,BazaarDashboardScreen}.js` (patched)
>
> Key v2 changes vs v1:
> - Book files moved to a **private** `bazaar-books` bucket; covers to public `bazaar-covers`.
>   Files are served only via `get-bazaar-book-url`, which issues a 10-minute signed URL
>   to the author or a verified buyer.
> - Every payment carries an **on-chain memo** `bazaar:{bookId}:{purchase|lend}` — a payment
>   for one book can no longer be replayed on another, and a lend can't be used as a sale.
> - The server fetches the **SOL/USD price itself** (Jupiter → CoinGecko fallback) instead of
>   trusting client-claimed amounts; SOL payments verified within 5% tolerance.
> - Login JWTs are verified via **Supabase Auth** (`auth.getUser`), not decoded unsigned.
> - The paying wallet must match the signed-in user's `users.wallet_address`.
> - App **retries purchase recording** after payment and shows "Retry recording" — it never
>   reports failure once money has moved.
> - New admin-only `resolve-bazaar-refund`: approve → revokes access (`refunded`),
>   reject → restores (`completed`). Refund role `admin` is now recorded correctly.
> - Upload paths are `<userId>/file` (own-folder storage policy); prices come from the book
>   row; authors can read their own books; duplicate badge and Publish-button state fixed.
>
> **Deploy order & remaining manual steps:** see `BAZAAR_V2_DEPLOY.md`.
> **Breaking change:** app builds without the memo can no longer purchase — ship app +
> functions together. First real purchase should be tested with USDC.

---

## v1 Documentation (historical — see warnings above)

**Version:** 1.0 (MVP + lending)
**Date:** November 12, 2026
**Status:** Superseded by v2 — kept for history

---

## Table of Contents

1. [Overview](#1-overview)
2. [Business Rules](#2-business-rules)
3. [Architecture](#3-architecture)
4. [Database Schema](#4-database-schema)
5. [Edge Functions](#5-edge-functions)
6. [Client Screens](#6-client-screens)
7. [Shared Utilities & Styles](#7-shared-utilities--styles)
8. [Payment Flows (Step by Step)](#8-payment-flows-step-by-step)
9. [On-Chain Verification](#9-on-chain-verification)
10. [Revenue & Refund Model](#10-revenue--refund-model)
11. [Complete File List](#11-complete-file-list)
12. [Deployment Checklist](#12-deployment-checklist)
13. [Known Limitations & Security Notes](#13-known-limitations--security-notes)
14. [EPUB Reader Fix (related work)](#14-epub-reader-fix-related-work)

---

## 1. Overview

The **Bazaar** is a paid book marketplace inside the Sempai HQ mobile app. Authors upload EPUB or PDF files; other users pay to unlock permanent read access. Two monetization modes exist per book:

| Mode | Price | Currency | Who gets paid |
|---|---|---|---|
| **Sell (purchase)** | $1.00 flat | USDC or SOL | 70% author wallet / 30% Sempai HQ — split on-chain at purchase |
| **Lend (borrow)** | 12,500 SMP flat | SMP only | 100% Sempai HQ wallet |

Both modes can be enabled on the same book. Books uploaded **without** an ownership claim can only be listed for lending.

Access granted by either payment is **permanent** (one-time unlock, stored as a `bazaar_purchases` row).

---

## 2. Business Rules

### Upload rules
- Anyone with a connected wallet account can upload.
- File types: `.epub` or `.pdf`, max 50 MB (client-enforced) / 100 MB (bucket limit).
- Two checkboxes at upload:
  1. **"I own or control the rights"** → enables `sale_enabled` + `ownership_confirmed`
  2. **"Allow borrowing for 12,500 SMP"** → enables `lending_enabled`
- At least one must be selected. The choice is recorded in `terms_accepted_at` + `ip_attestation` (paper trail for disputes).

### Purchase rules
- **Sale** requires `sale_enabled = true` AND `ownership_confirmed = true` (enforced server-side).
- **Lend** requires `lending_enabled = true` (enforced server-side).
- Currencies are strict: sale = SOL/USDC only, lend = SMP only.
- The backend **verifies every payment on-chain** before recording it — a client-supplied signature alone is never trusted.

### Refund rules
- Buyers and authors can open a refund request from the book page (buyers) or dashboard (both).
- Requests are **manual**: they create a `bazaar_refund_requests` row with `status = 'pending'` and mark the purchase `refund_pending`. No automatic on-chain refund occurs — resolution is handled off-platform/by admin.
- Only one pending request per purchase (enforced by a partial unique index).

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native App                        │
│  BazaarScreen → BazaarBookScreen → EPUBReader / Pdf        │
│  UploadBookScreen → Supabase Storage (bazaar-books)        │
│  BazaarDashboardScreen (author stats, refunds, admin)      │
└──────────────┬──────────────────────────────┬───────────────┘
               │ Supabase client (anon key)   │ Edge functions (JWT)
               ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│   Supabase Postgres      │   │   Edge Functions (Deno)          │
│  bazaar_books            │   │  purchase-bazaar-book            │
│  bazaar_purchases        │   │  request-bazaar-refund           │
│  bazaar_refund_requests  │   │  → RPC verification (Helius/     │
│  storage: bazaar-books   │   │    mainnet) before recording     │
└──────────────────────────┘   └──────────────────────────────────┘
               │
               ▼
        Solana Mainnet
   (SPL transfers: USDC 70/30, SOL 70/30, SMP 100% HQ)
```

**Key design decision:** unlike `unlock-chapter` (which trusts a client-submitted signature), the bazaar purchase function performs real on-chain verification of amount, recipients, and success before writing to the database.

---

## 4. Database Schema

File: `migrations/20261112_bazaar.sql`

### `bazaar_books`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `uuid_generate_v4()` |
| `author_id` | UUID → `users.id` | CASCADE delete |
| `title`, `author_name`, `description` | TEXT | |
| `cover_url`, `file_url`, `file_name` | TEXT | public Supabase Storage URLs |
| `file_type` | VARCHAR(10) | CHECK `epub`/`pdf` |
| `file_size` | BIGINT | bytes |
| `price_usd` | NUMERIC(10,2) | default `1.00` |
| `author_share_pct` | INT | default `70`, CHECK 0–100 |
| `ownership_confirmed` | BOOLEAN | gates sale |
| `sale_enabled` | BOOLEAN | default false |
| `lending_enabled` | BOOLEAN | default true |
| `lend_price_smp` | NUMERIC(20,0) | default `12500` |
| `status` | VARCHAR(20) | `active`/`paused`/`removed` |
| `terms_accepted_at` | TIMESTAMPTZ | consent timestamp |
| `ip_attestation` | TEXT | human-readable rights statement |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Indexes: `author_id`, `status`, `created_at DESC`.

### `bazaar_purchases`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `book_id` | UUID → `bazaar_books.id` | CASCADE |
| `buyer_id` | UUID → `users.id` | SET NULL |
| `buyer_wallet` | TEXT | |
| `access_type` | VARCHAR(10) | `purchase` (sale) / `lend` |
| `currency` | VARCHAR(10) | CHECK `SOL`/`USDC`/`SMP` |
| `price_usd` | NUMERIC(10,2) | `0` for lends |
| `author_share_pct` | INT | snapshot at purchase |
| `author_amount` | NUMERIC(20,8) | verified on-chain amount to author (0 for lends) |
| `platform_amount` | NUMERIC(20,8) | verified on-chain amount to HQ |
| `tx_signature` | TEXT UNIQUE | idempotency key |
| `verification_status` | VARCHAR(20) | `verified`/`unverified` |
| `status` | VARCHAR(20) | `completed`/`refund_pending`/`refunded`/`disputed` |
| `created_at` | TIMESTAMPTZ | |

### `bazaar_refund_requests`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `purchase_id` | UUID → `bazaar_purchases.id` | CASCADE |
| `requested_by` | UUID → `users.id` | |
| `requester_role` | VARCHAR(10) | `buyer`/`author` |
| `reason`, `resolution_note` | TEXT | |
| `status` | VARCHAR(20) | `pending`/`approved`/`rejected` |
| `resolved_by`, `resolved_at` | | admin resolution fields (manual for now) |

**Constraint:** partial unique index `idx_bazaar_refunds_pending_unique` on `purchase_id WHERE status='pending'` — one open request per purchase.

### Storage bucket
`bazaar-books` — **public** bucket, 100 MB file limit, MIME whitelist: `application/pdf`, `application/epub+zip`, `application/octet-stream`, `image/jpeg`, `image/png`, `image/webp`.
Paths: `books/{userId}/{timestamp}-{filename}` and `covers/{userId}/{timestamp}-cover.jpg`.

> ⚠️ Public bucket = anyone with the URL can download the file. The paywall is enforced client-side + purchase records. See §13.

---

## 5. Edge Functions

Both live in `supabase/functions/` and follow the same auth pattern as `unlock-chapter`: JWT → decode email → look up `users` row → service-role DB access.

### `purchase-bazaar-book/index.ts`

**Request body**
```json
{
  "bookId": "uuid",
  "currency": "SOL | USDC | SMP",
  "accessType": "purchase | lend",
  "signature": "base58 tx signature",
  "walletAddress": "buyer wallet",
  "authorAmount": 0,          // claimed split, base units
  "platformAmount": 0         // claimed split, base units
}
```

**Flow**
1. JWT auth → buyer `users` row.
2. Idempotency: existing `tx_signature` → return success immediately.
3. Load book; enforce `status='active'`, `sale_enabled && ownership_confirmed` (purchase) or `lending_enabled` (lend).
4. `getTransaction` via JSON-RPC (`jsonParsed`, versioned tx support), 4 retries × 2 s for propagation lag. RPC URL resolution order: `SOLANA_RPC_URL` → `HELIUS_RPC_URL` → `KAIJI_RPC_URL` → public mainnet.
5. Reject if `meta.err` set or fee payer ≠ `walletAddress`.
6. Verify payments (see §9).
7. Insert `bazaar_purchases` with **verified** amounts. Handles 23505 race → returns existing.

### `request-bazaar-refund/index.ts`

**Request body:** `{ "purchaseId": "uuid", "reason": "optional text" }`

**Flow**
1. JWT auth → requester.
2. Role check: buyer (`buyer_id`/`buyer_wallet` match), author (`book.author_id`), or `isSuperuser` admin.
3. Reject if already `refunded`.
4. Insert pending `bazaar_refund_requests` (unique index blocks duplicates → HTTP 409).
5. Set purchase `status='refund_pending'` (only if currently `completed`).

---

## 6. Client Screens

### `screens/BazaarScreen.js` — Browse
- Grid (2-col) of `status='active'` books, newest first.
- Card shows cover (or book icon), title, author, price badge (`$1.00` for sale / gold `LEND` badge), file-type badge.
- Header actions: upload (cloud icon) → `UploadBook`, dashboard (stats icon) → `BazaarDashboard`.
- Pull-to-refresh.

### `screens/BazaarBookScreen.js` — Detail / Pay / Read / Refund
- Loads book + author wallet + current user + latest purchase (`buyer_id` OR `buyer_wallet` match).
- **Not purchased & `sale_enabled`:** "Buy — $1.00" card with USDC/SOL toggle (live SOL price via Jupiter `lite-api.jup.ag/price/v3`), "Pay & Unlock" button.
- **Not purchased & `lending_enabled`:** "Borrow — 12,500 SMP" card, "Pay SMP & Borrow" button.
- **Purchased:** "Read Book" button + "Request Refund" (modal with reason TextInput).
- **Author viewing own book:** "Your book" panel → dashboard link.
- **Reader mode:**
  - PDF → `react-native-pdf` pointed at the public `file_url` (remote, cached).
  - EPUB → `FileSystem.downloadAsync` to cache → `EPUBReader` component.
- Refund modal → `request-bazaar-refund` edge function.

### `screens/UploadBookScreen.js` — Publish
- Cover picker (`expo-image-picker`, 2:3 crop) → base64 → `Uint8Array`.
- Book picker (`expo-document-picker`, pdf/epub) with 50 MB client cap.
- Fields: title (required), author name (prefilled from `users.name`), description.
- "How the Bazaar works" explainer card.
- **Two checkboxes** (see §2) → `ownership_confirmed`, `sale_enabled`, `lending_enabled`, `lend_price_smp`.
- Uploads file → `bazaar-books/books/{uid}/{ts}-{name}`, cover → `bazaar-books/covers/{uid}/{ts}-cover.jpg`, then inserts `bazaar_books` row with consent fields.

### `screens/BazaarDashboardScreen.js` — Author/Admin
Tabs: **Overview** (total sales, borrows, gross, est. 70% earnings), **My Books** (per-book sales/borrows/gross/earnings + status), **Refunds** (requests where user is buyer or author, with role + reason + status), **All Sales** (`isSuperuser` only — last 50 purchases platform-wide).
- Lends are counted separately and contribute **$0** to author earnings.

### Navigation
- `App.js`: imports + `Stack.Screen` entries — `Bazaar`, `BazaarBook`, `UploadBook`, `BazaarDashboard`.
- `GlobalSidebar.js`: new "Bazaar" section (store icon) with Bazaar / Upload Book / My Bazaar.

---

## 7. Shared Utilities & Styles

### `utils/bazaar.js`
- Constants: `BAZAAR_FUNCTIONS_BASE`, `BAZAAR_HQ_WALLET` (`71fLWcS…sgfZzD`), `BAZAAR_BOOK_PRICE_USD=1.0`, `BAZAAR_AUTHOR_SHARE_PCT=70`, `BAZAAR_LEND_PRICE_SMP=12500`, `bazaarConnection` (Helius RPC).
- `splitAmountWithResidual(amount, ratios)` — floor-split with remainder to last party.
- `fetchSolPriceUsd()` — Jupiter price v3 for SOL.
- `bookPriceInBaseUnits(currency, solPriceUsd)` — USDC→1,000,000; SMP→12,500,000,000; SOL→`1/solPrice` lamports.
- `createBazaarPaymentTransaction()` — sale tx: SOL → 2 `SystemProgram.transfer`s; USDC → ATA checks + `createAssociatedTokenAccountInstruction` for missing author/HQ ATAs + 2 `createTransferInstruction`s.
- `createBazaarLendTransaction()` — SMP transfer of full amount to HQ ATA (+ ATA creation if missing); returns `authorAmount: 0`.
- `callBazaarFunction(fn, body)` — POST with user's Supabase JWT via `safeFetch`.

### `styles/BazaarStyles.js`
- `BAZAAR_COLORS` palette matching the app dark theme (`#0B0B14` bg, `#FF5733` accent, gold for lend).
- Full StyleSheet: cards, detail, pay card, currency picker, form inputs, checkbox, dashboard stats/tabs/list items.

---

## 8. Payment Flows (Step by Step)

### Sale — USDC
1. User taps "Pay & Unlock" → `bookPriceInBaseUnits('USDC')` = 1,000,000.
2. `createBazaarPaymentTransaction` builds: [create author USDC ATA if missing] [create HQ USDC ATA if missing] [transfer 700,000 → author ATA] [transfer 300,000 → HQ ATA].
3. Blockhash + feePayer set → `signAndSendTransaction` (embedded wallet auto-signs) → `confirmTransaction` ×3 retries.
4. `purchase-bazaar-book` called with signature + claimed amounts → on-chain verification → DB row.

### Sale — SOL
Same flow; two `SystemProgram.transfer`s of `floor(total×0.7)` to author wallet and remainder to HQ wallet. Amount = `1 / solPrice` SOL in lamports.

### Lend — SMP
1. "Pay SMP & Borrow" → amount = 12,500 × 10⁶ = 12,500,000,000 base units.
2. Tx: [create HQ SMP ATA if missing] [transfer full amount → HQ ATA].
3. Same sign/confirm/record flow with `accessType:'lend'`, `currency:'SMP'`.

### Refund request
Book page (buyer) → modal reason → `request-bazaar-refund` → pending row + purchase `refund_pending` → visible in dashboard Refunds tab.

---

## 9. On-Chain Verification

`purchase-bazaar-book` uses `getTransaction` with `encoding: "jsonParsed"` and `maxSupportedTransactionVersion: 0` (supports versioned txs).

| Check | Method |
|---|---|
| Tx exists & succeeded | `meta.err == null`, 4 retries for propagation |
| Right payer | `accountKeys[0].pubkey === walletAddress` |
| **SOL split** | Sum `parsed.type==='transfer'` lamports to author & HQ across top-level + inner instructions; must match claimed amounts within 1% |
| **USDC split** | `preTokenBalances`/`postTokenBalances` **deltas** per account (fixes pre-existing balance bug) for USDC mint owned by author & HQ; must be ≥99% of expected 70%/30% and match claim within 1% |
| **SMP lend** | Post-minus-pre delta of SMP mint owned by HQ ≥ 99% of `lend_price_smp × 10⁶` |

Verified amounts (not claimed amounts) are stored in `author_amount`/`platform_amount`.

---

## 10. Revenue & Refund Model

- **Sales:** split happens atomically in the purchase transaction — author is paid *before* the purchase is even recorded. There is **no escrow**.
- **Lends:** 100% to HQ at purchase time.
- **Refunds:** request-only, manual resolution. If a refund is approved, funds must be returned manually (dashboard shows `author_amount`/`platform_amount` for reference). `status` transitions: `completed` → `refund_pending` → `refunded`/`disputed`.
- **Author earnings estimate** = `price_usd × author_share_pct / 100` per non-refunded `purchase` row (lends excluded).

---

## 11. Complete File List

### Created — Bazaar feature
| File | Purpose |
|---|---|
| `migrations/20261112_bazaar.sql` | 3 tables, indexes, storage bucket |
| `supabase/functions/purchase-bazaar-book/index.ts` | Purchase/lend recording + on-chain verification |
| `supabase/functions/request-bazaar-refund/index.ts` | Refund request intake |
| `utils/bazaar.js` | Payment tx builders, pricing, edge-function caller |
| `styles/BazaarStyles.js` | Bazaar design system |
| `screens/BazaarScreen.js` | Book grid browse |
| `screens/BazaarBookScreen.js` | Detail, pay, read, refund |
| `screens/UploadBookScreen.js` | Publish flow + consent checkboxes |
| `screens/BazaarDashboardScreen.js` | Author stats, refunds, admin sales |
| `BAZAAR_DOCUMENTATION.md` | This file |

### Edited — Bazaar feature
| File | Change |
|---|---|
| `App.js` | 4 screen imports + `Stack.Screen` registrations |
| `components/GlobalSidebar.js` | New "Bazaar" nav section |

### Created/edited — EPUB reader (related session work)
| File | Change |
|---|---|
| `components/EPUBReader.js` | **Rewritten** — real epub.js-in-WebView rendering (was placeholder) |
| `styles/ReaderStyles.js` | Added `loadingOverlay` style |
| `screens/ReaderScreen.js` | `useSafeAreaInsets` + bottom padding so GlobalBottomNav doesn't cover reader controls |

---

## 12. Deployment Checklist

1. **Run migration** `migrations/20261112_bazaar.sql` in the Supabase SQL editor (creates tables, indexes, `bazaar-books` bucket).
2. **Deploy functions:**
   ```bash
   supabase functions deploy purchase-bazaar-book
   supabase functions deploy request-bazaar-refund
   ```
3. **Optional env secret** for faster/more reliable RPC: `supabase secrets set SOLANA_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"` (falls back to `HELIUS_RPC_URL` → `KAIJI_RPC_URL` → public mainnet RPC).
4. **Verify** the app picks up the new sidebar section after reload.
5. **Test path:** upload a small PDF as author → view in Bazaar → pay $1 USDC from a second wallet → confirm purchase row + on-chain split → read → request refund → check dashboard.

---

## 13. Known Limitations & Security Notes

- **Public file bucket** — book files are accessible to anyone with the URL. Paywall is client-side. For stronger protection, move files to a private bucket and issue short-lived signed URLs only after verified purchase (v2).
- **Refunds are manual** — no automatic on-chain refund transaction exists yet. Approving a refund currently requires a manual transfer; the `resolved_by`/`resolved_at` fields are ready for an admin resolution endpoint.
- **SOL verification tolerance** — claimed split amounts are checked within 1%; a crafted tx could theoretically deviate slightly. USDC verification is stricter (≥99% of expected floor amounts).
- **Price is fixed** — `price_usd` defaults to $1.00 and `lend_price_smp` to 12,500 but are per-book DB columns, so future pricing experiments need no code change.
- **12,500 SMP ≈ $0.0004** at current prices (~$3×10⁻⁸) — confirm this is the intended borrow fee.
- **No RLS** — consistent with the project's current security model (RLS disabled project-wide); all writes go through the app or service-role functions.
- **EPUB reading requires internet** (epub.js + JSZip load from CDN inside the WebView).

---

## 14. EPUB Reader Fix (Related Work)

The in-app Reader (`ReaderScreen` → `EPUBReader`) previously rendered a placeholder. It now:

- Reads the `.epub` as base64 and injects it into a `react-native-webview` in 512 KB chunks.
- Loads **JSZip 3.1.5 → epub.js 0.3.93** from jsdelivr inside the WebView (JSZip must load first — epub.js 0.3.x doesn't bundle it).
- Renders paginated, dark-themed (`#0B0B14`/`#FF5733`) chapters with real TOC → bottom-sheet chapter list, prev/next controls, and position tracking via `relocated` events.
- `ReaderScreen` reserves bottom space (`max(insets.bottom,8) + 96`) so the floating `GlobalBottomNav` doesn't cover the controls — applies to both EPUB and PDF readers.

**Bazaar reuse:** purchased EPUBs are downloaded to cache and opened in this same `EPUBReader`; PDFs render remotely via `react-native-pdf`.

---

# Appendix: Full Source Code

All files created or edited for the Bazaar feature and the EPUB reader fix, verbatim.


## `migrations/20261112_bazaar.sql`

````
-- Bazaar: paid EPUB/PDF book marketplace
-- Authors upload books; readers pay $1 (SOL or USDC) for one-time unlock.
-- Revenue split: 70% author / 30% Sempai HQ (configurable per book).

-- Books table
CREATE TABLE IF NOT EXISTS bazaar_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author_name TEXT,
    description TEXT,
    cover_url TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('epub', 'pdf')),
    file_size BIGINT,
    price_usd NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    author_share_pct INTEGER NOT NULL DEFAULT 70 CHECK (author_share_pct >= 0 AND author_share_pct <= 100),
    -- Listing modes: sale ($1, requires ownership) and/or lending (12,500 SMP to platform)
    ownership_confirmed BOOLEAN NOT NULL DEFAULT false,
    sale_enabled BOOLEAN NOT NULL DEFAULT false,
    lending_enabled BOOLEAN NOT NULL DEFAULT true,
    lend_price_smp NUMERIC(20, 0) NOT NULL DEFAULT 12500,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed')),
    -- Author consent / IP attestation captured at upload time
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    ip_attestation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bazaar_books_author ON bazaar_books(author_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_books_status ON bazaar_books(status);
CREATE INDEX IF NOT EXISTS idx_bazaar_books_created ON bazaar_books(created_at DESC);

-- Purchases table (one row per successful payment)
CREATE TABLE IF NOT EXISTS bazaar_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES bazaar_books(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    buyer_wallet TEXT,
    access_type VARCHAR(10) NOT NULL DEFAULT 'purchase' CHECK (access_type IN ('purchase', 'lend')),
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('SOL', 'USDC', 'SMP')),
    price_usd NUMERIC(10, 2) NOT NULL,
    author_share_pct INTEGER NOT NULL,
    author_amount NUMERIC(20, 8),   -- amount sent to author (token units)
    platform_amount NUMERIC(20, 8), -- amount kept by platform (token units)
    tx_signature TEXT NOT NULL UNIQUE,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'unverified')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refund_pending', 'refunded', 'disputed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bazaar_purchases_book ON bazaar_purchases(book_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_purchases_buyer ON bazaar_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_purchases_wallet ON bazaar_purchases(buyer_wallet);

-- Refund requests (buyer or author can open; admin resolves)
CREATE TABLE IF NOT EXISTS bazaar_refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES bazaar_purchases(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    requester_role VARCHAR(10) NOT NULL CHECK (requester_role IN ('buyer', 'author')),
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    resolution_note TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_bazaar_refunds_purchase ON bazaar_refund_requests(purchase_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_refunds_status ON bazaar_refund_requests(status);

-- Prevent duplicate pending refund requests per purchase
CREATE UNIQUE INDEX IF NOT EXISTS idx_bazaar_refunds_pending_unique
    ON bazaar_refund_requests(purchase_id)
    WHERE status = 'pending';

-- Public storage bucket for book files and covers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bazaar-books',
    'bazaar-books',
    true,
    104857600, -- 100MB max
    ARRAY['application/pdf', 'application/epub+zip', 'application/octet-stream', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

````

## `supabase/functions/purchase-bazaar-book/index.ts`

````
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Constants
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SMP_MINT = "SMP1xiPwpMiLPpnJtdEmsDGSL9fR1rvat6NFGznKPor";
const HQ_WALLET = "71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD";
const BOOK_PRICE_USD = 1.0;
const SMP_DECIMALS = 6;

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

const RPC_URL =
  Deno.env.get("SOLANA_RPC_URL") ||
  Deno.env.get("HELIUS_RPC_URL") ||
  Deno.env.get("KAIJI_RPC_URL") ||
  "https://api.mainnet-beta.solana.com";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function rpcCall(method: string, params: any[]) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  return data.result;
}

// Fetch a confirmed transaction, retrying briefly for propagation lag.
async function getTransaction(signature: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const tx = await rpcCall("getTransaction", [
        signature,
        {
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        },
      ]);
      if (tx) return tx;
    } catch (e) {
      console.warn(`[purchase] getTransaction attempt ${attempt} failed:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

// Sum SOL lamports transferred to a given destination across all
// (top-level + inner) parsed system-transfer instructions.
function sumSolTo(tx: any, destination: string): number {
  let total = 0;
  const msgs: any[] = [];
  const top = tx?.transaction?.message?.instructions || [];
  msgs.push(...top);
  const inner = tx?.meta?.innerInstructions || [];
  for (const group of inner) {
    msgs.push(...(group.instructions || []));
  }
  for (const ix of msgs) {
    const p = ix?.parsed;
    if (p && p.type === "transfer" && p.info?.destination === destination) {
      total += Number(p.info.lamports || 0);
    }
  }
  return total;
}

// Sum USDC base units RECEIVED by a wallet in this tx. Uses pre/post token
// balance deltas per account so pre-existing balances don't skew the result.
function sumTokenTo(tx: any, mint: string, owner: string): number {
  const pre = new Map<string, number>();
  for (const b of tx?.meta?.preTokenBalances || []) {
    if (b?.mint === mint) {
      pre.set(String(b.accountIndex), Number(b?.uiTokenAmount?.amount || 0));
    }
  }
  let total = 0;
  for (const b of tx?.meta?.postTokenBalances || []) {
    if (b?.mint !== mint || b?.owner !== owner) continue;
    const before = pre.get(String(b.accountIndex)) || 0;
    const after = Number(b?.uiTokenAmount?.amount || 0);
    const delta = after - before;
    if (delta > 0) total += delta;
  }
  return total;
}

serve(async (req) => {
  try {
    console.log("[purchase-bazaar-book] Request received");

    const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jwt) return json({ error: "Authorization header missing" }, 401);

    const jwtBody = JSON.parse(new TextDecoder().decode(decodeBase64(jwt.split(".")[1])));
    if (typeof jwtBody?.email !== "string") {
      return json({ error: "JWT missing email" }, 401);
    }

    const { bookId, currency, signature, walletAddress, authorAmount, platformAmount, accessType } =
      await req.json();

    if (!bookId || !currency || !signature || !walletAddress) {
      return json(
        { error: "Missing required fields (bookId, currency, signature, walletAddress)" },
        400
      );
    }
    const type: "purchase" | "lend" = accessType === "lend" ? "lend" : "purchase";
    if (type === "purchase" && !["SOL", "USDC"].includes(currency)) {
      return json({ error: "Purchase currency must be SOL or USDC" }, 400);
    }
    if (type === "lend" && currency !== "SMP") {
      return json({ error: "Lending currency must be SMP" }, 400);
    }

    // Resolve buyer
    const { data: buyer, error: buyerError } = await supabaseAdmin
      .from("users")
      .select("id, wallet_address")
      .eq("email", jwtBody.email)
      .maybeSingle();
    if (buyerError) throw new Error(buyerError.message);
    if (!buyer) return json({ error: "User not found" }, 404);

    // Idempotency: same signature already recorded
    const { data: existing } = await supabaseAdmin
      .from("bazaar_purchases")
      .select("id, book_id")
      .eq("tx_signature", signature)
      .maybeSingle();
    if (existing) {
      return json({ success: true, purchaseId: existing.id, message: "Already recorded" });
    }

    // Fetch book + author wallet
    const { data: book, error: bookError } = await supabaseAdmin
      .from("bazaar_books")
      .select("id, author_id, title, status, price_usd, author_share_pct, ownership_confirmed, sale_enabled, lending_enabled, lend_price_smp")
      .eq("id", bookId)
      .maybeSingle();
    if (bookError) throw new Error(bookError.message);
    if (!book) return json({ error: "Book not found" }, 404);
    if (book.status !== "active") return json({ error: "Book is not available" }, 400);

    // Enforce listing mode rules
    if (type === "purchase" && !(book.sale_enabled && book.ownership_confirmed)) {
      return json({ error: "This book is not for sale" }, 400);
    }
    if (type === "lend" && !book.lending_enabled) {
      return json({ error: "This book is not available for lending" }, 400);
    }

    const { data: author } = await supabaseAdmin
      .from("users")
      .select("wallet_address, name")
      .eq("id", book.author_id)
      .maybeSingle();
    if (!author?.wallet_address) {
      return json({ error: "Author wallet not found" }, 500);
    }

    // Verify the transaction on-chain
    const tx = await getTransaction(signature);
    if (!tx) {
      return json({ error: "Transaction not found on-chain yet. Try again in a few seconds." }, 503);
    }
    if (tx?.meta?.err) {
      return json({ error: "Transaction failed on-chain" }, 400);
    }

    // Verify fee payer matches the claimed wallet
    const feePayer = tx?.transaction?.message?.accountKeys?.[0]?.pubkey
      ?? tx?.transaction?.message?.accountKeys?.[0];
    if (feePayer !== walletAddress) {
      return json({ error: "Transaction fee payer does not match wallet" }, 400);
    }

    // Verify revenue split landed where it should
    let verifiedAuthor = 0;
    let verifiedPlatform = 0;
    let verificationStatus: "verified" | "unverified" = "unverified";

    if (currency === "SOL") {
      const authorLamports = sumSolTo(tx, author.wallet_address);
      const hqLamports = sumSolTo(tx, HQ_WALLET);
      const claimedAuthor = Number(authorAmount || 0);
      const claimedPlatform = Number(platformAmount || 0);
      // Accept if on-chain amounts are within 1% of claimed (rounding)
      const ok =
        authorLamports > 0 && hqLamports > 0 &&
        Math.abs(authorLamports - claimedAuthor) <= Math.max(1, claimedAuthor * 0.01) &&
        Math.abs(hqLamports - claimedPlatform) <= Math.max(1, claimedPlatform * 0.01);
      if (ok) {
        verifiedAuthor = authorLamports / 1e9;
        verifiedPlatform = hqLamports / 1e9;
        verificationStatus = "verified";
      }
    } else if (currency === "USDC") {
      // USDC base units (6 decimals)
      const authorUnits = sumTokenTo(tx, USDC_MINT, author.wallet_address);
      const hqUnits = sumTokenTo(tx, USDC_MINT, HQ_WALLET);
      const claimedAuthor = Number(authorAmount || 0);
      const claimedPlatform = Number(platformAmount || 0);
      const ok =
        authorUnits >= Math.floor(BOOK_PRICE_USD * book.author_share_pct / 100 * 1e6 * 0.99) &&
        hqUnits >= Math.floor(BOOK_PRICE_USD * (100 - book.author_share_pct) / 100 * 1e6 * 0.99) &&
        (claimedAuthor === 0 || Math.abs(authorUnits - claimedAuthor) <= Math.max(1, claimedAuthor * 0.01)) &&
        (claimedPlatform === 0 || Math.abs(hqUnits - claimedPlatform) <= Math.max(1, claimedPlatform * 0.01));
      if (ok) {
        verifiedAuthor = authorUnits / 1e6;
        verifiedPlatform = hqUnits / 1e6;
        verificationStatus = "verified";
      }
    } else if (currency === "SMP") {
      // Lending: full amount goes to HQ wallet, nothing to author.
      const expectedUnits = Math.floor(Number(book.lend_price_smp) * 10 ** SMP_DECIMALS);
      const hqUnits = sumTokenTo(tx, SMP_MINT, HQ_WALLET);
      const ok = hqUnits >= Math.floor(expectedUnits * 0.99);
      if (ok) {
        verifiedAuthor = 0;
        verifiedPlatform = hqUnits / 10 ** SMP_DECIMALS;
        verificationStatus = "verified";
      }
    }

    if (verificationStatus === "unverified") {
      console.warn("[purchase] Split verification failed", {
        signature,
        currency,
        claimed: { authorAmount, platformAmount },
      });
      return json(
        { error: type === "lend"
            ? "Lending payment could not be verified. Make sure the full SMP amount reached the platform wallet."
            : "Payment split could not be verified on-chain. Make sure the full $1 was sent (70% author / 30% HQ)." },
        400
      );
    }

    // Record purchase
    const { data: purchase, error: insertError } = await supabaseAdmin
      .from("bazaar_purchases")
      .insert({
        book_id: book.id,
        buyer_id: buyer.id,
        buyer_wallet: walletAddress,
        access_type: type,
        currency,
        price_usd: type === "lend" ? 0 : BOOK_PRICE_USD,
        author_share_pct: book.author_share_pct,
        author_amount: verifiedAuthor,
        platform_amount: verifiedPlatform,
        tx_signature: signature,
        verification_status: verificationStatus,
        status: "completed",
      })
      .select("id")
      .single();

    if (insertError) {
      // Race: another request recorded it first
      if (insertError.code === "23505") {
        const { data: dup } = await supabaseAdmin
          .from("bazaar_purchases")
          .select("id")
          .eq("tx_signature", signature)
          .single();
        return json({ success: true, purchaseId: dup?.id, message: "Already recorded" });
      }
      throw new Error(insertError.message);
    }

    console.log(`[purchase] Book ${book.id} purchased by ${buyer.id} (${currency}) sig=${signature}`);
    return json({ success: true, purchaseId: purchase.id });
  } catch (error: any) {
    console.error("[purchase-bazaar-book] Error:", error.message);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});

````

## `supabase/functions/request-bazaar-refund/index.ts`

````
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  try {
    console.log("[request-bazaar-refund] Request received");

    const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jwt) return json({ error: "Authorization header missing" }, 401);

    const jwtBody = JSON.parse(new TextDecoder().decode(decodeBase64(jwt.split(".")[1])));
    if (typeof jwtBody?.email !== "string") {
      return json({ error: "JWT missing email" }, 401);
    }

    const { purchaseId, reason } = await req.json();
    if (!purchaseId) return json({ error: "purchaseId is required" }, 400);

    // Resolve requester
    const { data: requester, error: requesterError } = await supabaseAdmin
      .from("users")
      .select("id, wallet_address, isSuperuser")
      .eq("email", jwtBody.email)
      .maybeSingle();
    if (requesterError) throw new Error(requesterError.message);
    if (!requester) return json({ error: "User not found" }, 404);

    // Fetch purchase + book
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("bazaar_purchases")
      .select("id, book_id, buyer_id, buyer_wallet, status")
      .eq("id", purchaseId)
      .maybeSingle();
    if (purchaseError) throw new Error(purchaseError.message);
    if (!purchase) return json({ error: "Purchase not found" }, 404);

    const { data: book } = await supabaseAdmin
      .from("bazaar_books")
      .select("author_id")
      .eq("id", purchase.book_id)
      .maybeSingle();
    if (!book) return json({ error: "Book not found" }, 404);

    // Determine role: buyer, author, or admin
    let role: "buyer" | "author" | null = null;
    if (purchase.buyer_id === requester.id || purchase.buyer_wallet === requester.wallet_address) {
      role = "buyer";
    } else if (book.author_id === requester.id) {
      role = "author";
    } else if (requester.isSuperuser) {
      role = "buyer"; // admin can open on behalf; recorded as buyer role
    }
    if (!role) return json({ error: "Not authorized to request a refund for this purchase" }, 403);

    if (purchase.status === "refunded") {
      return json({ error: "This purchase was already refunded" }, 400);
    }

    // Insert refund request (unique partial index blocks duplicate pending)
    const { data: refund, error: insertError } = await supabaseAdmin
      .from("bazaar_refund_requests")
      .insert({
        purchase_id: purchase.id,
        requested_by: requester.id,
        requester_role: role,
        reason: reason || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return json({ error: "A refund request is already pending for this purchase" }, 409);
      }
      throw new Error(insertError.message);
    }

    // Mark purchase as refund_pending so UI can reflect it
    await supabaseAdmin
      .from("bazaar_purchases")
      .update({ status: "refund_pending" })
      .eq("id", purchase.id)
      .eq("status", "completed");

    console.log(`[refund] Request ${refund.id} opened for purchase ${purchase.id} by ${requester.id} (${role})`);
    return json({ success: true, refundId: refund.id });
  } catch (error: any) {
    console.error("[request-bazaar-refund] Error:", error.message);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});

````

## `utils/bazaar.js`

````
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import { RPC_URL, USDC_MINT_ADDRESS, SMP_MINT_ADDRESS, SMP_DECIMALS } from '../constants';
import { supabase } from '../services/supabaseClient';
import { safeFetch } from './urlValidation';

export const BAZAAR_FUNCTIONS_BASE = 'https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1';
export const BAZAAR_HQ_WALLET = new PublicKey('71fLWcS1rvkfyYZvBjHUwHZQbcenk5Bdj2ebXBsgfZzD');
export const BAZAAR_BOOK_PRICE_USD = 1.0;
export const BAZAAR_AUTHOR_SHARE_PCT = 70;
export const BAZAAR_LEND_PRICE_SMP = 12500;
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export const bazaarConnection = new Connection(RPC_URL, 'confirmed', {
  confirmTransactionInitialTimeout: 60000,
});

export function splitAmountWithResidual(amount, ratios) {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  const r = [];
  let runningTotal = 0;
  for (let i = 0; i < ratios.length - 1; i++) {
    r[i] = Math.floor((amount * ratios[i]) / totalRatio);
    runningTotal += r[i];
  }
  r[ratios.length - 1] = amount - runningTotal;
  return r;
}

// Live SOL price in USD via Jupiter price API (same source as ChapterScreen)
export async function fetchSolPriceUsd() {
  try {
    const res = await safeFetch(
      `https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.[SOL_MINT]?.usdPrice || null;
  } catch (e) {
    console.error('[bazaar] fetchSolPriceUsd failed:', e.message);
    return null;
  }
}

// Amount in smallest units for a $1 book (or 12,500 SMP for lending).
// USDC/SMP have 6 decimals, SOL has 9.
export function bookPriceInBaseUnits(currency, solPriceUsd) {
  if (currency === 'USDC') {
    return Math.round(BAZAAR_BOOK_PRICE_USD * 1e6); // 1,000,000
  }
  if (currency === 'SMP') {
    return Math.round(BAZAAR_LEND_PRICE_SMP * 10 ** SMP_DECIMALS);
  }
  if (!solPriceUsd) throw new Error('SOL price unavailable');
  return Math.round((BAZAAR_BOOK_PRICE_USD / solPriceUsd) * 1e9);
}

// Build the split payment transaction: 70% author / 30% HQ.
// paymentMint null => SOL transfer; otherwise SPL transfer (USDC).
export async function createBazaarPaymentTransaction({
  currency,
  paymentAmount,
  userPublicKey,
  authorPublicKey,
}) {
  const [authorAmount, platformAmount] = splitAmountWithResidual(paymentAmount, [
    BAZAAR_AUTHOR_SHARE_PCT,
    100 - BAZAAR_AUTHOR_SHARE_PCT,
  ]);
  const instructions = [];

  if (currency === 'SOL') {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: authorPublicKey,
        lamports: authorAmount,
      }),
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: BAZAAR_HQ_WALLET,
        lamports: platformAmount,
      })
    );
  } else {
    const mint = USDC_MINT_ADDRESS;
    const userAta = getAssociatedTokenAddressSync(mint, userPublicKey);
    const authorAta = getAssociatedTokenAddressSync(mint, authorPublicKey);
    const hqAta = getAssociatedTokenAddressSync(mint, BAZAAR_HQ_WALLET, true);

    const [userAtaInfo, authorAtaInfo, hqAtaInfo] = await bazaarConnection.getMultipleAccountsInfo([
      userAta,
      authorAta,
      hqAta,
    ]);
    if (!userAtaInfo) {
      throw new Error('You do not have a USDC token account.');
    }

    if (!authorAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          authorAta,
          authorPublicKey,
          mint
        )
      );
    }
    if (!hqAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          hqAta,
          BAZAAR_HQ_WALLET,
          mint
        )
      );
    }

    instructions.push(
      createTransferInstruction(userAta, authorAta, userPublicKey, authorAmount),
      createTransferInstruction(userAta, hqAta, userPublicKey, platformAmount)
    );
  }

  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = userPublicKey;
  return { tx, authorAmount, platformAmount };
}

// Lending payment: full 12,500 SMP goes to the platform wallet (no author split).
export async function createBazaarLendTransaction({ paymentAmount, userPublicKey }) {
  const mint = SMP_MINT_ADDRESS;
  const userAta = getAssociatedTokenAddressSync(mint, userPublicKey);
  const hqAta = getAssociatedTokenAddressSync(mint, BAZAAR_HQ_WALLET, true);

  const [userAtaInfo, hqAtaInfo] = await bazaarConnection.getMultipleAccountsInfo([userAta, hqAta]);
  if (!userAtaInfo) {
    throw new Error('You do not have an SMP token account.');
  }

  const instructions = [];
  if (!hqAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(userPublicKey, hqAta, BAZAAR_HQ_WALLET, mint)
    );
  }
  instructions.push(createTransferInstruction(userAta, hqAta, userPublicKey, paymentAmount));

  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = userPublicKey;
  return { tx, authorAmount: 0, platformAmount: paymentAmount };
}

// Call a Supabase edge function with the user's JWT.
export async function callBazaarFunction(fnName, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated. Please sign in again.');

  const res = await safeFetch(`${BAZAAR_FUNCTIONS_BASE}/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

````

## `styles/BazaarStyles.js`

````
import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export const BAZAAR_COLORS = {
  bg: '#0B0B14',
  bgElevated: '#111219',
  bgCard: '#15161F',
  bgCardAlt: '#1A1B26',
  accent: '#FF5733',
  accentDeep: '#F36316',
  accentSoft: 'rgba(255, 87, 51, 0.12)',
  textPrimary: '#FFFFFF',
  textSecondary: '#C9C9D1',
  textMuted: '#8A8A99',
  border: 'rgba(255, 255, 255, 0.08)',
  success: '#34C759',
  danger: '#FF453A',
  gold: '#FFD700',
};

export const BAZAAR_SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28 };
export const BAZAAR_FONT = 'Yoruka';
export const BAZAAR_CARD_WIDTH = CARD_WIDTH;

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BAZAAR_COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BAZAAR_SPACE.l,
    paddingVertical: BAZAAR_SPACE.m,
    backgroundColor: BAZAAR_COLORS.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: BAZAAR_COLORS.border,
  },
  headerTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 20,
    fontWeight: '700',
    color: BAZAAR_COLORS.textPrimary,
  },
  iconButton: {
    padding: BAZAAR_SPACE.s,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: BAZAAR_SPACE.xl,
  },
  mutedText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    color: BAZAAR_COLORS.textMuted,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    color: BAZAAR_COLORS.danger,
    textAlign: 'center',
    marginTop: BAZAAR_SPACE.m,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BAZAAR_COLORS.accent,
    paddingVertical: BAZAAR_SPACE.m,
    paddingHorizontal: BAZAAR_SPACE.xl,
    borderRadius: 12,
    marginTop: BAZAAR_SPACE.l,
    gap: BAZAAR_SPACE.s,
  },
  primaryButtonText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    paddingVertical: BAZAAR_SPACE.m,
    paddingHorizontal: BAZAAR_SPACE.xl,
    borderRadius: 12,
    marginTop: BAZAAR_SPACE.m,
    gap: BAZAAR_SPACE.s,
  },
  secondaryButtonText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    fontWeight: '600',
    color: BAZAAR_COLORS.textPrimary,
  },
  card: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    overflow: 'hidden',
    width: CARD_WIDTH,
  },
  cardCover: {
    width: '100%',
    aspectRatio: 0.7,
    backgroundColor: BAZAAR_COLORS.bgCardAlt,
  },
  cardCoverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    padding: BAZAAR_SPACE.m,
  },
  cardTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 14,
    fontWeight: '600',
    color: BAZAAR_COLORS.textPrimary,
  },
  cardAuthor: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    color: BAZAAR_COLORS.textMuted,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: BAZAAR_SPACE.s,
  },
  priceBadge: {
    backgroundColor: BAZAAR_COLORS.accentSoft,
    paddingHorizontal: BAZAAR_SPACE.s,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priceText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: BAZAAR_COLORS.accent,
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: BAZAAR_SPACE.s,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 10,
    fontWeight: '700',
    color: BAZAAR_COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  // Detail screen
  detailScroll: {
    flex: 1,
  },
  detailCover: {
    width: '100%',
    aspectRatio: 0.75,
    backgroundColor: BAZAAR_COLORS.bgCardAlt,
  },
  detailBody: {
    padding: BAZAAR_SPACE.l,
  },
  detailTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 24,
    fontWeight: '800',
    color: BAZAAR_COLORS.textPrimary,
  },
  detailAuthor: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    color: BAZAAR_COLORS.textSecondary,
    marginTop: BAZAAR_SPACE.xs,
  },
  detailDescription: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    lineHeight: 22,
    color: BAZAAR_COLORS.textSecondary,
    marginTop: BAZAAR_SPACE.l,
  },
  payCard: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    padding: BAZAAR_SPACE.l,
    margin: BAZAAR_SPACE.l,
  },
  payTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 17,
    fontWeight: '700',
    color: BAZAAR_COLORS.textPrimary,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: BAZAAR_SPACE.m,
    marginTop: BAZAAR_SPACE.m,
  },
  currencyOption: {
    flex: 1,
    paddingVertical: BAZAAR_SPACE.m,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    alignItems: 'center',
    backgroundColor: BAZAAR_COLORS.bgCardAlt,
  },
  currencyOptionActive: {
    borderColor: BAZAAR_COLORS.accent,
    backgroundColor: BAZAAR_COLORS.accentSoft,
  },
  currencyOptionText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: BAZAAR_COLORS.textSecondary,
  },
  currencyOptionActiveText: {
    color: BAZAAR_COLORS.accent,
  },
  splitNote: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    color: BAZAAR_COLORS.textMuted,
    marginTop: BAZAAR_SPACE.m,
    lineHeight: 18,
  },
  // Forms
  input: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: BAZAAR_SPACE.m,
    paddingVertical: BAZAAR_SPACE.m,
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    color: BAZAAR_COLORS.textPrimary,
    marginTop: BAZAAR_SPACE.s,
  },
  label: {
    fontFamily: BAZAAR_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: BAZAAR_COLORS.textSecondary,
    marginTop: BAZAAR_SPACE.m,
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: BAZAAR_SPACE.l,
    marginTop: BAZAAR_SPACE.s,
    gap: BAZAAR_SPACE.m,
  },
  filePickerText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 14,
    color: BAZAAR_COLORS.textSecondary,
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BAZAAR_SPACE.s,
    marginTop: BAZAAR_SPACE.m,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BAZAAR_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: BAZAAR_COLORS.accent,
    borderColor: BAZAAR_COLORS.accent,
  },
  checkboxLabel: {
    fontFamily: BAZAAR_FONT,
    fontSize: 13,
    color: BAZAAR_COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  // Dashboard
  statCard: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    padding: BAZAAR_SPACE.l,
    marginBottom: BAZAAR_SPACE.m,
  },
  statValue: {
    fontFamily: BAZAAR_FONT,
    fontSize: 26,
    fontWeight: '800',
    color: BAZAAR_COLORS.textPrimary,
  },
  statLabel: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    color: BAZAAR_COLORS.textMuted,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    gap: BAZAAR_SPACE.m,
  },
  statCardHalf: {
    flex: 1,
  },
  listItem: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    padding: BAZAAR_SPACE.m,
    marginBottom: BAZAAR_SPACE.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAZAAR_SPACE.m,
  },
  listItemTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    fontWeight: '600',
    color: BAZAAR_COLORS.textPrimary,
  },
  listItemSub: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    color: BAZAAR_COLORS.textMuted,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: BAZAAR_SPACE.s,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: BAZAAR_SPACE.xs,
  },
  statusPillText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 11,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    gap: BAZAAR_SPACE.s,
    paddingHorizontal: BAZAAR_SPACE.l,
    paddingVertical: BAZAAR_SPACE.m,
  },
  tab: {
    paddingHorizontal: BAZAAR_SPACE.m,
    paddingVertical: BAZAAR_SPACE.s,
    borderRadius: 10,
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
  },
  tabActive: {
    backgroundColor: BAZAAR_COLORS.accentSoft,
    borderColor: BAZAAR_COLORS.accent,
  },
  tabText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: BAZAAR_COLORS.textSecondary,
  },
  tabTextActive: {
    color: BAZAAR_COLORS.accent,
  },
});

````

## `screens/BazaarScreen.js`

````
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import styles, { BAZAAR_COLORS } from '../styles/BazaarStyles';

const BazaarScreen = () => {
  const navigation = useNavigation();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBooks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bazaar_books')
        .select('id, title, author_name, cover_url, file_type, price_usd, sale_enabled, lending_enabled, lend_price_smp, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBooks(data || []);
    } catch (err) {
      console.error('[Bazaar] Failed to load books:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const renderBook = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('BazaarBook', { bookId: item.id })}
    >
      {item.cover_url ? (
        <Image source={{ uri: item.cover_url }} style={styles.cardCover} resizeMode="cover" />
      ) : (
        <View style={[styles.cardCover, styles.cardCoverPlaceholder]}>
          <Ionicons name="book" size={36} color={BAZAAR_COLORS.textMuted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cardAuthor} numberOfLines={1}>
          {item.author_name || 'Unknown author'}
        </Text>
        <View style={styles.cardFooter}>
          {item.sale_enabled ? (
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>${Number(item.price_usd).toFixed(2)}</Text>
            </View>
          ) : item.lending_enabled ? (
            <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
              <Text style={[styles.typeText, { color: '#FFD700' }]}>LEND</Text>
            </View>
          ) : (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{item.file_type}</Text>
            </View>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{item.file_type}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bazaar</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BAZAAR_COLORS.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bazaar</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('UploadBook')}
          accessibilityLabel="Upload a book"
        >
          <Ionicons name="cloud-upload-outline" size={24} color={BAZAAR_COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('BazaarDashboard')}
          accessibilityLabel="My bazaar dashboard"
        >
          <Ionicons name="stats-chart-outline" size={24} color={BAZAAR_COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {books.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="book-outline" size={56} color={BAZAAR_COLORS.textMuted} />
          <Text style={[styles.mutedText, { marginTop: 16 }]}>
            No books in the bazaar yet.{"\n"}Be the first to upload one.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('UploadBook')}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Upload a Book</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          renderItem={renderBook}
          numColumns={2}
          columnWrapperStyle={{ gap: 16, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadBooks();
              }}
              tintColor={BAZAAR_COLORS.accent}
            />
          }
        />
      )}
    </View>
  );
};

export default BazaarScreen;

````

## `screens/BazaarBookScreen.js`

````
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import Pdf from 'react-native-pdf';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import EPUBReader from '../components/EPUBReader';
import styles, { BAZAAR_COLORS } from '../styles/BazaarStyles';
import {
  BAZAAR_BOOK_PRICE_USD,
  BAZAAR_AUTHOR_SHARE_PCT,
  BAZAAR_LEND_PRICE_SMP,
  bazaarConnection,
  bookPriceInBaseUnits,
  callBazaarFunction,
  createBazaarLendTransaction,
  createBazaarPaymentTransaction,
  fetchSolPriceUsd,
} from '../utils/bazaar';

const BazaarBookScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { bookId } = route.params || {};
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey;
  const signAndSendTransaction = walletContext?.signAndSendTransaction;

  const [book, setBook] = useState(null);
  const [authorWallet, setAuthorWallet] = useState(null);
  const [user, setUser] = useState(null);
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currency, setCurrency] = useState('USDC');
  const [solPrice, setSolPrice] = useState(null);
  const [paying, setPaying] = useState(false);

  const [reading, setReading] = useState(false);
  const [epubFile, setEpubFile] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const [refundModal, setRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundSending, setRefundSending] = useState(false);

  const loadBook = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: bookData, error: bookError } = await supabase
        .from('bazaar_books')
        .select('*')
        .eq('id', bookId)
        .maybeSingle();
      if (bookError) throw bookError;
      if (!bookData) throw new Error('Book not found');
      setBook(bookData);

      // Author wallet for payments
      const { data: authorData } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', bookData.author_id)
        .maybeSingle();
      setAuthorWallet(authorData?.wallet_address || null);

      // Current user
      if (activePublicKey) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, name, wallet_address')
          .eq('wallet_address', activePublicKey.toString())
          .maybeSingle();
        setUser(userData || null);

        // Existing purchase?
        const { data: purchases } = await supabase
          .from('bazaar_purchases')
          .select('id, status, created_at')
          .eq('book_id', bookId)
          .or(`buyer_id.eq.${userData?.id || '00000000-0000-0000-0000-000000000000'},buyer_wallet.eq.${activePublicKey.toString()}`)
          .order('created_at', { ascending: false })
          .limit(1);
        setPurchase(purchases?.[0] || null);
      } else {
        setUser(null);
        setPurchase(null);
      }
    } catch (err) {
      console.error('[BazaarBook] Load error:', err.message);
      setError(err.message || 'Failed to load book');
    } finally {
      setLoading(false);
    }
  }, [bookId, activePublicKey]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  useEffect(() => {
    fetchSolPriceUsd().then((p) => p && setSolPrice(p));
  }, []);

  const isAuthor = user && book && user.id === book.author_id;
  const hasAccess = !!purchase && purchase.status !== 'refunded';

  const solAmount = solPrice ? BAZAAR_BOOK_PRICE_USD / solPrice : null;

  const handlePay = async (accessType = 'purchase') => {
    if (!isWalletConnected || !activePublicKey || !signAndSendTransaction) {
      Alert.alert('Wallet required', 'Please connect your wallet to make a purchase.');
      return;
    }
    if (accessType === 'purchase' && !authorWallet) {
      Alert.alert('Error', 'This book has no author wallet configured.');
      return;
    }
    if (accessType === 'purchase' && currency === 'SOL' && !solPrice) {
      Alert.alert('Pricing unavailable', 'Could not fetch SOL price. Try USDC instead.');
      return;
    }

    setPaying(true);
    try {
      const paymentAmount = bookPriceInBaseUnits(accessType === 'lend' ? 'SMP' : currency, solPrice);

      const { tx, authorAmount, platformAmount } = accessType === 'lend'
        ? await createBazaarLendTransaction({
            paymentAmount,
            userPublicKey: activePublicKey,
          })
        : await createBazaarPaymentTransaction({
            currency,
            paymentAmount,
            userPublicKey: activePublicKey,
            authorPublicKey: new PublicKey(authorWallet),
          });

      const { blockhash, lastValidBlockHeight } = await bazaarConnection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = activePublicKey;

      const signature = await signAndSendTransaction(tx);

      // Confirm with retries
      let confirmation;
      let retries = 0;
      while (retries < 3) {
        try {
          confirmation = await bazaarConnection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed'
          );
          break;
        } catch (e) {
          retries++;
          if (retries >= 3) throw new Error('Transaction confirmation timed out. Check your wallet.');
          await new Promise((r) => setTimeout(r, 1000 * retries));
        }
      }
      if (confirmation?.value?.err) {
        throw new Error('Transaction failed on-chain.');
      }

      // Record purchase (server verifies the payment on-chain)
      const result = await callBazaarFunction('purchase-bazaar-book', {
        bookId,
        currency: accessType === 'lend' ? 'SMP' : currency,
        accessType,
        signature,
        walletAddress: activePublicKey.toString(),
        authorAmount,
        platformAmount,
      });

      if (!result.ok || result.data?.error) {
        // Payment went through but recording failed — still grant local access
        console.error('[BazaarBook] Record failed:', result.data?.error);
        Alert.alert(
          'Payment sent',
          'Your payment was sent but recording failed. Pull to refresh or contact support with signature: ' + signature
        );
      } else {
        Alert.alert('Unlocked', `Thanks for supporting ${book.author_name || 'the author'}!`);
      }

      await loadBook();
    } catch (err) {
      console.error('[BazaarBook] Payment error:', err.message);
      Alert.alert('Payment failed', err.message || 'Something went wrong.');
    } finally {
      setPaying(false);
    }
  };

  const handleRead = async () => {
    if (!book) return;
    if (book.file_type === 'pdf') {
      setReading(true);
      return;
    }
    // EPUB: download to cache, then open EPUBReader
    setDownloading(true);
    try {
      const fileName = book.file_name || `book-${book.id}.epub`;
      const localUri = `${FileSystem.cacheDirectory}bazaar-${book.id}-${Date.now()}.epub`;
      const dl = await FileSystem.downloadAsync(book.file_url, localUri);
      if (dl.status !== 200) throw new Error('Download failed');
      setEpubFile({ uri: dl.uri, name: fileName });
      setReading(true);
    } catch (err) {
      console.error('[BazaarBook] EPUB download error:', err.message);
      Alert.alert('Error', 'Failed to download book. Check your connection.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRefund = async () => {
    if (!purchase) return;
    setRefundSending(true);
    try {
      const result = await callBazaarFunction('request-bazaar-refund', {
        purchaseId: purchase.id,
        reason: refundReason.trim() || undefined,
      });
      if (!result.ok || result.data?.error) {
        Alert.alert('Refund request failed', result.data?.error || 'Try again later.');
      } else {
        Alert.alert('Request sent', 'Your refund request is pending review.');
        setRefundModal(false);
        setRefundReason('');
        await loadBook();
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefundSending(false);
    }
  };

  // ---------- Reader mode ----------
  if (reading && book) {
    if (book.file_type === 'epub' && epubFile) {
      return <EPUBReader file={epubFile} onBack={() => { setReading(false); setEpubFile(null); }} />;
    }
    return (
      <View style={{ flex: 1, backgroundColor: BAZAAR_COLORS.bg }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setReading(false)}>
            <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <Pdf
          source={{ uri: book.file_url, cache: true }}
          style={{ flex: 1, backgroundColor: '#fff' }}
          trustAllCerts={false}
        />
      </View>
    );
  }

  // ---------- Loading / error ----------
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BAZAAR_COLORS.accent} />
        </View>
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={BAZAAR_COLORS.danger} />
          <Text style={styles.errorText}>{error || 'Book not found'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Book</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.detailScroll}>
        {book.cover_url ? (
          <Image source={{ uri: book.cover_url }} style={styles.detailCover} resizeMode="cover" />
        ) : (
          <View style={[styles.detailCover, { justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="book" size={64} color={BAZAAR_COLORS.textMuted} />
          </View>
        )}

        <View style={styles.detailBody}>
          <Text style={styles.detailTitle}>{book.title}</Text>
          <Text style={styles.detailAuthor}>by {book.author_name || 'Unknown author'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{book.file_type.toUpperCase()}</Text>
            </View>
            {book.sale_enabled && (
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>${Number(book.price_usd).toFixed(2)} BUY</Text>
              </View>
            )}
            {book.lending_enabled && (
              <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
                <Text style={[styles.typeText, { color: BAZAAR_COLORS.gold }]}>LEND {Number(book.lend_price_smp || BAZAAR_LEND_PRICE_SMP).toLocaleString()} SMP</Text>
              </View>
            )}
          </View>

          {!!book.description && (
            <Text style={styles.detailDescription}>{book.description}</Text>
          )}
        </View>

        {/* Purchase / read panel */}
        <View style={styles.payCard}>
          {isAuthor ? (
            <>
              <Text style={styles.payTitle}>Your book</Text>
              <Text style={styles.splitNote}>
                You earn {BAZAAR_AUTHOR_SHARE_PCT}% of every sale. Manage sales and refunds from your Bazaar dashboard.
              </Text>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('BazaarDashboard')}
              >
                <Ionicons name="stats-chart-outline" size={18} color={BAZAAR_COLORS.textPrimary} />
                <Text style={styles.secondaryButtonText}>Open Dashboard</Text>
              </TouchableOpacity>
            </>
          ) : hasAccess ? (
            <>
              <Text style={styles.payTitle}>Unlocked</Text>
              <Text style={styles.splitNote}>
                You own this book. Enjoy the read.{"\n"}
                {purchase?.status === 'refund_pending' && 'A refund request is pending review.'}
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRead}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="book-outline" size={18} color="#fff" />
                    <Text style={styles.primaryButtonText}>Read Book</Text>
                  </>
                )}
              </TouchableOpacity>
              {purchase?.status === 'completed' && (
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setRefundModal(true)}>
                  <Ionicons name="return-up-back-outline" size={18} color={BAZAAR_COLORS.textPrimary} />
                  <Text style={styles.secondaryButtonText}>Request Refund</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {book.sale_enabled && (
                <>
                  <Text style={styles.payTitle}>Buy — ${BAZAAR_BOOK_PRICE_USD.toFixed(2)}</Text>
                  <Text style={styles.splitNote}>
                    One-time payment. {BAZAAR_AUTHOR_SHARE_PCT}% goes directly to the author,
                    the rest supports the platform. Pay with USDC or SOL.
                  </Text>

                  <View style={styles.currencyRow}>
                    {['USDC', 'SOL'].map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.currencyOption, currency === c && styles.currencyOptionActive]}
                        onPress={() => setCurrency(c)}
                      >
                        <Text style={[styles.currencyOptionText, currency === c && styles.currencyOptionActiveText]}>
                          {c === 'USDC' ? '$1.00 USDC' : solAmount ? `~${solAmount.toFixed(4)} SOL` : 'SOL'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, paying && { opacity: 0.6 }]}
                    onPress={() => handlePay('purchase')}
                    disabled={paying}
                  >
                    {paying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="lock-open-outline" size={18} color="#fff" />
                        <Text style={styles.primaryButtonText}>Pay & Unlock</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {book.lending_enabled && (
                <>
                  <Text style={[styles.payTitle, book.sale_enabled && { marginTop: 20 }]}>Borrow — {Number(book.lend_price_smp || BAZAAR_LEND_PRICE_SMP).toLocaleString()} SMP</Text>
                  <Text style={styles.splitNote}>
                    One-time SMP payment for permanent access. The full amount goes to the platform.
                  </Text>
                  <TouchableOpacity
                    style={[styles.secondaryButton, paying && { opacity: 0.6 }]}
                    onPress={() => handlePay('lend')}
                    disabled={paying}
                  >
                    {paying ? (
                      <ActivityIndicator color={BAZAAR_COLORS.textPrimary} />
                    ) : (
                      <>
                        <Ionicons name="key-outline" size={18} color={BAZAAR_COLORS.textPrimary} />
                        <Text style={styles.secondaryButtonText}>Pay {Number(book.lend_price_smp || BAZAAR_LEND_PRICE_SMP).toLocaleString()} SMP & Borrow</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {!book.sale_enabled && !book.lending_enabled && (
                <Text style={styles.splitNote}>This book is not currently available.</Text>
              )}

              {!isWalletConnected && (
                <Text style={[styles.splitNote, { marginTop: 10 }]}>
                  Connect your wallet to purchase.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Refund modal */}
      <Modal visible={refundModal} transparent animationType="fade" onRequestClose={() => setRefundModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.payCard, { margin: 0 }]}>
            <Text style={styles.payTitle}>Request a refund</Text>
            <Text style={styles.splitNote}>
              Tell us why you'd like a refund. Requests are reviewed manually.
            </Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Reason (optional)"
              placeholderTextColor={BAZAAR_COLORS.textMuted}
              multiline
              value={refundReason}
              onChangeText={setRefundReason}
            />
            <TouchableOpacity
              style={[styles.primaryButton, refundSending && { opacity: 0.6 }]}
              onPress={handleRefund}
              disabled={refundSending}
            >
              {refundSending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Submit Request</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setRefundModal(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default BazaarBookScreen;

````

## `screens/UploadBookScreen.js`

````
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import styles, { BAZAAR_COLORS } from '../styles/BazaarStyles';
import { BAZAAR_AUTHOR_SHARE_PCT, BAZAAR_BOOK_PRICE_USD, BAZAAR_LEND_PRICE_SMP } from '../utils/bazaar';

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

const base64ToArrayBuffer = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const UploadBookScreen = () => {
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const activePublicKey = wallet?.publicKey;

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState(null); // { uri, arrayBuffer, name }
  const [bookFile, setBookFile] = useState(null); // { uri, name, size, type }
  const [ownRights, setOwnRights] = useState(false);
  const [allowLending, setAllowLending] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      if (!activePublicKey) {
        setLoadingUser(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('users')
          .select('id, name, wallet_address')
          .eq('wallet_address', activePublicKey.toString())
          .maybeSingle();
        setUser(data || null);
        if (data?.name) setAuthorName(data.name);
      } catch (e) {
        console.error('[UploadBook] user fetch failed:', e.message);
      } finally {
        setLoadingUser(false);
      }
    };
    loadUser();
  }, [activePublicKey]);

  const pickCover = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to choose a cover image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [2, 3],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setCover({
        uri: asset.uri,
        arrayBuffer: base64ToArrayBuffer(base64),
        name: `cover-${Date.now()}.jpg`,
      });
    } catch (err) {
      console.error('[UploadBook] cover pick error:', err.message);
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  const pickBookFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/epub+zip', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = (asset.name || '').split('.').pop().toLowerCase();
      const type = ext === 'pdf' ? 'pdf' : ext === 'epub' ? 'epub' : null;
      if (!type) {
        Alert.alert('Unsupported file', 'Please choose a PDF or EPUB file.');
        return;
      }
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        Alert.alert('File too large', 'Books must be 50MB or smaller.');
        return;
      }
      setBookFile({ uri: asset.uri, name: asset.name, size: asset.size || 0, type });
    } catch (err) {
      console.error('[UploadBook] file pick error:', err.message);
      Alert.alert('Error', 'Failed to select file.');
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Connect your wallet and make sure your account exists.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a book title.');
      return;
    }
    if (!bookFile) {
      Alert.alert('Missing file', 'Please choose a PDF or EPUB file.');
      return;
    }
    if (!ownRights && !allowLending) {
      Alert.alert('Pick an option', 'Enable at least one: sell your book or allow lending.');
      return;
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const safeName = bookFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `books/${user.id}/${timestamp}-${safeName}`;

      // Upload book file
      const base64 = await FileSystem.readAsStringAsync(bookFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { error: fileError } = await supabase.storage
        .from('bazaar-books')
        .upload(filePath, base64ToArrayBuffer(base64), {
          contentType: bookFile.type === 'pdf' ? 'application/pdf' : 'application/epub+zip',
          upsert: false,
        });
      if (fileError) throw new Error(`File upload failed: ${fileError.message}`);
      const fileUrl = supabase.storage.from('bazaar-books').getPublicUrl(filePath).data.publicUrl;

      // Upload cover (optional)
      let coverUrl = null;
      if (cover) {
        const coverPath = `covers/${user.id}/${timestamp}-cover.jpg`;
        const { error: coverError } = await supabase.storage
          .from('bazaar-books')
          .upload(coverPath, cover.arrayBuffer, { contentType: 'image/jpeg', upsert: false });
        if (!coverError) {
          coverUrl = supabase.storage.from('bazaar-books').getPublicUrl(coverPath).data.publicUrl;
        }
      }

      // Insert book row with consent record
      const { error: insertError } = await supabase.from('bazaar_books').insert({
        author_id: user.id,
        title: title.trim(),
        author_name: authorName.trim() || user.name || 'Unknown',
        description: description.trim() || null,
        cover_url: coverUrl,
        file_url: fileUrl,
        file_name: bookFile.name,
        file_type: bookFile.type,
        file_size: bookFile.size,
        price_usd: BAZAAR_BOOK_PRICE_USD,
        author_share_pct: BAZAAR_AUTHOR_SHARE_PCT,
        ownership_confirmed: ownRights,
        sale_enabled: ownRights,
        lending_enabled: allowLending,
        lend_price_smp: BAZAAR_LEND_PRICE_SMP,
        status: 'active',
        terms_accepted_at: new Date().toISOString(),
        ip_attestation: ownRights
          ? `Author confirms they own or control the rights to "${title.trim()}" and grant Sempai HQ a non-exclusive license to distribute it in the Bazaar.`
          : `Uploader does not claim ownership of "${title.trim()}". Listed for lending only (${BAZAAR_LEND_PRICE_SMP} SMP to platform).`,
      });
      if (insertError) throw new Error(`Failed to save book: ${insertError.message}`);

      Alert.alert('Published', 'Your book is now live in the Bazaar!');
      navigation.goBack();
    } catch (err) {
      console.error('[UploadBook] Submit error:', err.message);
      Alert.alert('Upload failed', err.message || 'Something went wrong.');
    } finally {
      setUploading(false);
    }
  };

  if (loadingUser) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BAZAAR_COLORS.accent} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Book</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="wallet-outline" size={48} color={BAZAAR_COLORS.textMuted} />
          <Text style={styles.mutedText}>Connect your wallet to publish a book.</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Book</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Cover image (optional)</Text>
        <TouchableOpacity style={styles.filePicker} onPress={pickCover}>
          {cover ? (
            <Image source={{ uri: cover.uri }} style={{ width: 44, height: 66, borderRadius: 6 }} resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={28} color={BAZAAR_COLORS.textMuted} />
          )}
          <Text style={styles.filePickerText}>
            {cover ? 'Cover selected — tap to change' : 'Tap to choose a cover image'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Book file (PDF or EPUB, max 50MB)</Text>
        <TouchableOpacity style={styles.filePicker} onPress={pickBookFile}>
          <Ionicons
            name={bookFile?.type === 'pdf' ? 'document-text-outline' : 'book-outline'}
            size={28}
            color={bookFile ? BAZAAR_COLORS.accent : BAZAAR_COLORS.textMuted}
          />
          <Text style={styles.filePickerText} numberOfLines={2}>
            {bookFile ? `${bookFile.name} (${(bookFile.size / 1048576).toFixed(1)} MB)` : 'Tap to choose a PDF or EPUB file'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Book title"
          placeholderTextColor={BAZAAR_COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Author name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name or pen name"
          placeholderTextColor={BAZAAR_COLORS.textMuted}
          value={authorName}
          onChangeText={setAuthorName}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          placeholder="What is this book about?"
          placeholderTextColor={BAZAAR_COLORS.textMuted}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <View style={{ backgroundColor: BAZAAR_COLORS.bgCard, borderRadius: 14, borderWidth: 1, borderColor: BAZAAR_COLORS.border, padding: 16, marginTop: 20 }}>
          <Text style={styles.payTitle}>How the Bazaar works</Text>
          <Text style={styles.splitNote}>
            <Text style={{ color: BAZAAR_COLORS.accent, fontWeight: '700' }}>Sell</Text> — if you own the book, it can sell for ${BAZAAR_BOOK_PRICE_USD.toFixed(2)}.
            You receive {BAZAAR_AUTHOR_SHARE_PCT}% of every sale directly to your wallet.{"\n\n"}
            <Text style={{ color: BAZAAR_COLORS.gold, fontWeight: '700' }}>Lend</Text> — anyone can offer a book for borrowing at a flat {BAZAAR_LEND_PRICE_SMP.toLocaleString()} SMP.
            The full amount goes to the platform; you earn nothing from lends.{"\n\n"}
            If you don't own the book, only lending is allowed.
          </Text>
        </View>

        <TouchableOpacity style={styles.checkboxRow} onPress={() => setOwnRights(!ownRights)}>
          <View style={[styles.checkbox, ownRights && styles.checkboxChecked]}>
            {ownRights && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.checkboxLabel}>
            I own or control the rights to this book — enable selling it for ${BAZAAR_BOOK_PRICE_USD.toFixed(2)}
            ({BAZAAR_AUTHOR_SHARE_PCT}% to me).
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkboxRow} onPress={() => setAllowLending(!allowLending)}>
          <View style={[styles.checkbox, allowLending && styles.checkboxChecked]}>
            {allowLending && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.checkboxLabel}>
            Allow others to borrow this book for {BAZAAR_LEND_PRICE_SMP.toLocaleString()} SMP (one-time, permanent access).
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, ((!ownRights && !allowLending) || uploading) && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Publish to Bazaar</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default UploadBookScreen;

````

## `screens/BazaarDashboardScreen.js`

````
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import styles, { BAZAAR_COLORS } from '../styles/BazaarStyles';

const TABS = ['Overview', 'My Books', 'Refunds', 'All Sales'];

const BazaarDashboardScreen = () => {
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const activePublicKey = wallet?.publicKey;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [isAdmin, setIsAdmin] = useState(false);

  const [books, setBooks] = useState([]);
  const [salesByBook, setSalesByBook] = useState({});
  const [refunds, setRefunds] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);

  const load = useCallback(async () => {
    if (!activePublicKey) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, wallet_address, isSuperuser')
        .eq('wallet_address', activePublicKey.toString())
        .maybeSingle();
      setUser(userData || null);
      setIsAdmin(!!userData?.isSuperuser);
      if (!userData) return;

      // My books
      const { data: myBooks } = await supabase
        .from('bazaar_books')
        .select('id, title, cover_url, file_type, status, created_at')
        .eq('author_id', userData.id)
        .order('created_at', { ascending: false });
      const bookList = myBooks || [];
      setBooks(bookList);
      const bookIds = bookList.map((b) => b.id);

      // Sales per my book
      if (bookIds.length > 0) {
        const { data: purchases } = await supabase
          .from('bazaar_purchases')
          .select('id, book_id, price_usd, author_share_pct, currency, access_type, status, created_at')
          .in('book_id', bookIds);
        const map = {};
        (purchases || []).forEach((p) => {
          if (p.status === 'refunded') return;
          const cur = map[p.book_id] || { sales: 0, lends: 0, gross: 0, authorEarned: 0 };
          if (p.access_type === 'lend') {
            cur.lends += 1; // lends pay the platform, not the author
          } else {
            cur.sales += 1;
            cur.gross += Number(p.price_usd || 0);
            cur.authorEarned += Number(p.price_usd || 0) * (Number(p.author_share_pct || 70) / 100);
          }
          map[p.book_id] = cur;
        });
        setSalesByBook(map);
      } else {
        setSalesByBook({});
      }

      // Refund requests involving me (as author of the book or buyer)
      const { data: refundRows } = await supabase
        .from('bazaar_refund_requests')
        .select('id, purchase_id, requester_role, reason, status, created_at, purchase:bazaar_purchases(book_id, buyer_id, buyer_wallet)')
        .order('created_at', { ascending: false })
        .limit(100);
      const involved = (refundRows || []).filter((r) => {
        const p = Array.isArray(r.purchase) ? r.purchase[0] : r.purchase;
        if (!p) return false;
        const isMyBook = bookIds.includes(p.book_id);
        const isMyPurchase = p.buyer_id === userData.id || p.buyer_wallet === userData.wallet_address;
        return isMyBook || isMyPurchase;
      });
      // Attach book titles for my books
      const titleById = Object.fromEntries(bookList.map((b) => [b.id, b.title]));
      setRefunds(
        involved.map((r) => {
          const p = Array.isArray(r.purchase) ? r.purchase[0] : r.purchase;
          return { ...r, bookTitle: titleById[p?.book_id] || 'A book' };
        })
      );

      // Admin: all recent purchases
      if (userData.isSuperuser) {
        const { data: all } = await supabase
          .from('bazaar_purchases')
          .select('id, book_id, buyer_wallet, currency, access_type, price_usd, author_amount, platform_amount, status, created_at')
          .order('created_at', { ascending: false })
          .limit(50);
        setAllPurchases(all || []);
      }
    } catch (err) {
      console.error('[BazaarDashboard] Load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activePublicKey]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const totals = books.reduce(
    (acc, b) => {
      const s = salesByBook[b.id] || { sales: 0, lends: 0, gross: 0, authorEarned: 0 };
      acc.sales += s.sales;
      acc.lends += s.lends;
      acc.gross += s.gross;
      acc.earned += s.authorEarned;
      return acc;
    },
    { sales: 0, lends: 0, gross: 0, earned: 0 }
  );

  const statusColor = (s) =>
    s === 'completed'
      ? BAZAAR_COLORS.success
      : s === 'refunded'
      ? BAZAAR_COLORS.danger
      : s === 'refund_pending'
      ? BAZAAR_COLORS.gold
      : BAZAAR_COLORS.textMuted;

  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => t !== 'All Sales');

  const renderOverview = () => (
    <>
      <View style={styles.statRow}>
        <View style={[styles.statCard, styles.statCardHalf]}>
          <Text style={styles.statValue}>{totals.sales}</Text>
          <Text style={styles.statLabel}>Sales ({totals.lends} borrows)</Text>
        </View>
        <View style={[styles.statCard, styles.statCardHalf]}>
          <Text style={styles.statValue}>${totals.gross.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Gross revenue</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>${totals.earned.toFixed(2)}</Text>
        <Text style={styles.statLabel}>Your estimated earnings (70% share)</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.listItemSub}>
          Sales are paid on-chain at purchase time — the split already happened.{"\n\n"}
          Refund requests appear under the Refunds tab and are reviewed manually.
        </Text>
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('UploadBook')}>
        <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Upload Another Book</Text>
      </TouchableOpacity>
    </>
  );

  const renderMyBooks = () =>
    books.length === 0 ? (
      <View style={styles.centerContainer}>
        <Ionicons name="book-outline" size={48} color={BAZAAR_COLORS.textMuted} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>You haven't published any books yet.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('UploadBook')}>
          <Text style={styles.primaryButtonText}>Upload a Book</Text>
        </TouchableOpacity>
      </View>
    ) : (
      books.map((b) => {
        const s = salesByBook[b.id] || { sales: 0, lends: 0, gross: 0, authorEarned: 0 };
        return (
          <TouchableOpacity
            key={b.id}
            style={styles.listItem}
            onPress={() => navigation.navigate('BazaarBook', { bookId: b.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.listItemTitle} numberOfLines={1}>{b.title}</Text>
              <Text style={styles.listItemSub}>
                {s.sales} sale{s.sales === 1 ? '' : 's'}{s.lends > 0 ? ` · ${s.lends} borrow${s.lends === 1 ? '' : 's'}` : ''} · ${s.gross.toFixed(2)} gross · ${s.authorEarned.toFixed(2)} to you
              </Text>
              <View style={[styles.statusPill, { backgroundColor: b.status === 'active' ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.08)' }]}>
                <Text style={[styles.statusPillText, { color: b.status === 'active' ? BAZAAR_COLORS.success : BAZAAR_COLORS.textMuted }]}>
                  {b.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={BAZAAR_COLORS.textMuted} />
          </TouchableOpacity>
        );
      })
    );

  const renderRefunds = () =>
    refunds.length === 0 ? (
      <View style={styles.centerContainer}>
        <Ionicons name="checkmark-circle-outline" size={48} color={BAZAAR_COLORS.success} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>No refund requests.</Text>
      </View>
    ) : (
      refunds.map((r) => (
        <View key={r.id} style={styles.listItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.listItemTitle} numberOfLines={1}>{r.bookTitle}</Text>
            <Text style={styles.listItemSub}>
              {r.requester_role === 'buyer' ? 'Buyer' : 'Author'} request · {new Date(r.created_at).toLocaleDateString()}
            </Text>
            {!!r.reason && <Text style={styles.listItemSub} numberOfLines={2}>"{r.reason}"</Text>}
            <View style={[styles.statusPill, { backgroundColor: 'rgba(255,215,0,0.12)' }]}>
              <Text style={[styles.statusPillText, { color: statusColor(r.status) }]}>
                {r.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      ))
    );

  const renderAllSales = () =>
    allPurchases.length === 0 ? (
      <View style={styles.centerContainer}>
        <Ionicons name="receipt-outline" size={48} color={BAZAAR_COLORS.textMuted} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>No sales yet.</Text>
      </View>
    ) : (
      allPurchases.map((p) => (
        <View key={p.id} style={styles.listItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.listItemTitle} numberOfLines={1}>
              {p.access_type === 'lend' ? 'LEND' : 'SALE'} · {p.currency === 'SMP' ? `${Number(p.platform_amount || 0).toLocaleString()} SMP` : `$${(Number(p.price_usd) || 0).toFixed(2)}`}
            </Text>
            <Text style={styles.listItemSub} numberOfLines={1}>
              {(p.buyer_wallet || '').slice(0, 8)}… · {new Date(p.created_at).toLocaleDateString()}
            </Text>
            <Text style={styles.listItemSub}>
              author {p.author_amount ?? '—'} / platform {p.platform_amount ?? '—'}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[styles.statusPillText, { color: statusColor(p.status) }]}>
              {p.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
      ))
    );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BAZAAR_COLORS.accent} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bazaar Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="wallet-outline" size={48} color={BAZAAR_COLORS.textMuted} />
          <Text style={styles.mutedText}>Connect your wallet to view your bazaar dashboard.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={BAZAAR_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bazaar Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {visibleTabs.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={BAZAAR_COLORS.accent}
          />
        }
      >
        {tab === 'Overview' && renderOverview()}
        {tab === 'My Books' && renderMyBooks()}
        {tab === 'Refunds' && renderRefunds()}
        {tab === 'All Sales' && isAdmin && renderAllSales()}
      </ScrollView>
    </View>
  );
};

export default BazaarDashboardScreen;

````

## `App.js` (edited)

````
import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import { NavigationContainer, useNavigationContainerRef, useRoute } from '@react-navigation/native';
import { Platform, Alert, View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { EmbeddedWalletProvider } from './components/ConnectButtonEnhanced';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import Orientation from 'react-native-orientation-locker';
import { supabase } from './services/supabaseClient';
import { NavigationProvider, useNavigationHandler } from './context/NavigationContext';
import { NotificationEmitter } from './services/NotificationEmitter';
import HomeScreen from './screens/HomeScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import NovelDetailScreen from './screens/NovelDetailScreen';
import MangaDetailScreen from './screens/MangaDetailScreen';
import NovelsPageScreen from './screens/NovelsPageScreen';
import SwapScreen from './screens/SwapScreen';
import StatPageScreen from './screens/StatPageScreen';
import ChatScreen from './screens/ChatScreen';
import KaitoAdventureScreen from './screens/KaitoAdventureScreen';
import DAOGovernanceScreen from './screens/DAOGovernanceScreen';
import KeepItSimpleScreen from './screens/KeepItSimpleScreen';
import WalletImportScreen from './screens/WalletImportScreen';
import ApplyScreen from './screens/ApplyScreen';
import ChapterScreen from './screens/ChapterScreen';
import NovelSummaryScreen from './screens/NovelSummaryScreen';
import NovelDashboardScreen from './screens/NovelDashboardScreen';
import MangaDashboardScreen from './screens/MangaDashboardScreen';
import MangaPageScreen from './screens/MangaPageScreen';
import CreatorsProfileScreen from './screens/CreatorsProfileScreen';
import MangaChapterScreen from './screens/MangaChapterScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import SignIn from './components/SignIn';
import { GoogleAuthProvider } from './components/GoogleAuthProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SystemUiContext } from './context/SystemUiContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import WalletScreen from './screens/WalletScreen';
import GlobalNavbar from './components/GlobalNavbar';
import GlobalBottomNav from './components/GlobalBottomNav';
import GlobalSidebar from './components/GlobalSidebar';
import NavigationLoadingOverlay from './components/NavigationLoadingOverlay';
import FeedScreen from './screens/FeedScreen';
import RampScreen from './screens/RampScreen';
import MarketplaceScreen from './screens/MarketplaceScreen';
import MintScreen from './screens/MintScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import AdminScreen from './screens/AdminScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import TermsScreen from './screens/TermsScreen';
import SupportScreen from './screens/SupportScreen';
import ProfileScreen from './screens/ProfileScreen';
import DownloadScreen from './screens/DownloadScreen';
import KaitoLeaderboardScreen from './screens/KaitoLeaderboardScreen';
import AddGifScreen from './screens/AddGifScreen';
import BadgesScreen from './screens/BadgesScreen';
import CreatorDashboardScreen from './screens/CreatorDashboardScreen';
import KaijiScreen from './screens/KaijiScreen';
import InboxScreen from './screens/InboxScreen';
import ReaderScreen from './screens/ReaderScreen';
import BazaarScreen from './screens/BazaarScreen';
import BazaarBookScreen from './screens/BazaarBookScreen';
import UploadBookScreen from './screens/UploadBookScreen';
import BazaarDashboardScreen from './screens/BazaarDashboardScreen';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('[App] Notification received:', notification);
    return {
      shouldShowAlert: true, // Show in-app alert
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

const Stack = createStackNavigator();

// Create global text styles
const globalTextStyles = StyleSheet.create({
  default: {
    fontFamily: 'Yoruka',
    color: '#FFFFFF',
  },
  title: {
    fontFamily: 'Yoruka',
    fontSize: 24,
    color: '#FFFFFF',
  },
  subtitle: {
    fontFamily: 'Yoruka',
    fontSize: 18,
    color: '#CCCCCC',
  }
});

// Apply to all Text components
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = globalTextStyles.default;

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A18' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18 }}>
            Something went wrong: {this.state.error?.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
};

const MainApp = () => {
  const [isSystemUiVisible, setIsSystemUiVisible] = useState(false);
  const [isStatusBarHidden, setIsStatusBarHidden] = useState(true); // State for StatusBar visibility

  // Lock to portrait by default for all screens
  useEffect(() => {
    Orientation.lockToPortrait();
  }, []);

  return (
    <SafeAreaProvider>
      <SystemUiContext.Provider value={{ isSystemUiVisible, setIsSystemUiVisible }}>
        <ThemeProvider>
          <AuthProvider>
            <GoogleAuthProvider>
              <EmbeddedWalletProvider>
                <NavigationProvider>
                  <ErrorBoundary>
                    <AppContent setIsStatusBarHidden={setIsStatusBarHidden} />
                  </ErrorBoundary>
                </NavigationProvider>
              </EmbeddedWalletProvider>
            </GoogleAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </SystemUiContext.Provider>
      <StatusBar style="light" hidden={isStatusBarHidden} />
    </SafeAreaProvider>
  );
};

const AppContent = ({ setIsStatusBarHidden }) => {
  const { user, isLoading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationRef = useNavigationContainerRef();

  useNavigationHandler(() => {
    setShowWelcome(false);
  });

  // Track current route to hide bottom nav on KaitoAdventure
  useEffect(() => {
    const unsubscribe = navigationRef?.addListener('state', (e) => {
      const route = e.data.state?.routes[e.data.state.index];
      setCurrentRoute(route?.name);
      setIsNavigating(false);
    });
    return unsubscribe;
  }, [navigationRef]);

  // Add navigation listener for loading state
  useEffect(() => {
    const unsubscribe = navigationRef?.addListener('beforeRemove', () => {
      setIsNavigating(true);
    });
    return unsubscribe;
  }, [navigationRef]);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Promise.race([
          Font.loadAsync({
            Yoruka: require('./assets/fonts/Yoruka-1j9rL.ttf'),
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Font load timeout')), 10000)),
        ]);
        setFontsLoaded(true);
        console.log('Yoruka font loaded successfully');
      } catch (error) {
        console.error('Error loading Yoruka font:', error.message);
        Alert.alert(
          'Font Error',
          'Failed to load Yoruka font. Using system font as fallback.',
          [{ text: 'OK' }]
        );
        setFontsLoaded(true); // Proceed even if font fails
      }
    };
    loadFonts();
  }, []);

  // Request notification permissions and register push token with Firebase
  useEffect(() => {
    const setupNotifications = async () => {
      console.log('[App] Setting up notifications...');
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        console.log('[App] Notification permission status:', finalStatus);

        if (finalStatus !== 'granted') {
          console.warn('[App] Failed to get push token for push notification!');
          return;
        }

        // Get Expo push token with projectId (required for Firebase)
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        console.log('[App] EAS Project ID:', projectId);

        const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log('[App] Expo push token obtained:', pushToken.data);

        // Store push token in Supabase for the current user
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          console.log('[App] Storing push token for user:', session.user.id);
          const { error: tokenError } = await supabase
            .from('users')
            .update({ push_token: pushToken.data })
            .eq('id', session.user.id);

          if (tokenError) {
            console.error('[App] Error storing push token:', tokenError);
          } else {
            console.log('[App] Push token stored successfully');
          }
        }

        // Track last notification to prevent duplicates
        let lastNotificationId = null;

        // Listen for notification opens
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          console.log('[App] Notification response received:', response);
        });

        // Listen for notifications received in foreground
        const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
          console.log('[App] Notification received in foreground:', notification);
          
          // Check if this is a remote push notification (not a local one)
          if (notification.request.trigger && notification.request.trigger.type === 'push') {
            const notificationId = notification.request.identifier;
            
            // Prevent duplicate notifications
            if (notificationId !== lastNotificationId) {
              lastNotificationId = notificationId;
              
              // Schedule a local notification to show in Android notification bar
              Notifications.scheduleNotificationAsync({
                content: {
                  title: notification.request.content.title,
                  body: notification.request.content.body,
                  data: notification.request.content.data,
                  sound: 'notification_sound',
                },
                trigger: null, // Show immediately
              });
            }
          }
          
          // Show alert
          Alert.alert(
            notification.request.content.title,
            notification.request.content.body
          );
          NotificationEmitter.emit();
        });

        return () => {
          subscription.remove();
          foregroundSubscription.remove();
        };
      } catch (error) {
        console.error('[App] Error setting up notifications:', error);
      }
    };

    setupNotifications();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const initializeSystemUi = async () => {
        try {
          await NavigationBar.setBehaviorAsync('overlay-swipe');
          await NavigationBar.setVisibilityAsync('hidden');
          setIsStatusBarHidden(true); // Hide StatusBar
        } catch (error) {
          console.error('System UI initialization error:', error);
        }
      };
      initializeSystemUi();

      return () => {
        const cleanupSystemUi = async () => {
          try {
            await NavigationBar.setVisibilityAsync('visible');
            try {
              await NavigationBar.setBehaviorAsync('overlay');
            } catch (behaviorError) {
              console.warn('System UI behavior cleanup warning:', behaviorError);
            }
            setIsStatusBarHidden(false); // Show StatusBar
          } catch (error) {
            console.error('System UI cleanup error:', error);
          }
        };
        cleanupSystemUi();
      };
    }
  }, [setIsStatusBarHidden]);

  if (!fontsLoaded || isLoading) {
    return null; // Render nothing until fonts and auth are loaded
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <View style={{ flex: 1, backgroundColor: '#0A0A18' }}>
        {currentRoute !== 'Kaiji' && <GlobalNavbar />}
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#0A0A18' },
          }}
        >
        {showWelcome ? (
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{
              cardStyle: {
                backgroundColor: '#0A0A18',
              },
            }}
          />
        ) : !user ? (
          <Stack.Screen
            name="SignIn"
            component={SignIn}
            options={{
              cardStyle: {
                backgroundColor: '#0A0A18',
              },
            }}
          />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="NovelDetail" component={NovelDetailScreen} />
            <Stack.Screen name="MangaDetail" component={MangaDetailScreen} />
            <Stack.Screen name="NovelsPage" component={NovelsPageScreen} />
            <Stack.Screen name="Swap" component={SwapScreen} />
            <Stack.Screen name="Stats" component={StatPageScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="KaitoAdventure" component={KaitoAdventureScreen} />
            <Stack.Screen name="DAOGovernance" component={DAOGovernanceScreen} />
            <Stack.Screen name="KeepItSimple" component={KeepItSimpleScreen} />
            <Stack.Screen name="Apply" component={ApplyScreen} />
            <Stack.Screen name="Chapter" component={ChapterScreen} />
            <Stack.Screen name="NovelSummary" component={NovelSummaryScreen} />
            <Stack.Screen name="NovelDashboard" component={NovelDashboardScreen} />
            <Stack.Screen name="MangaDashboard" component={MangaDashboardScreen} />
            <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} />
            <Stack.Screen name="MangaPage" component={MangaPageScreen} />
            <Stack.Screen name="CreatorsProfile" component={CreatorsProfileScreen} />
            <Stack.Screen name="MangaChapter" component={MangaChapterScreen} />
            <Stack.Screen name="Wallet" component={WalletScreen} />
            <Stack.Screen name="Feed" component={FeedScreen} />
            <Stack.Screen name="Crazy Corner" component={FeedScreen} />
            <Stack.Screen name="FeedScreen" component={FeedScreen} />
            <Stack.Screen name="Ramp" component={RampScreen} />
            <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
            <Stack.Screen name="WalletImport" component={WalletImportScreen} />
            <Stack.Screen name="Mint" component={MintScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Download" component={DownloadScreen} />
            <Stack.Screen name="KaitoLeaderboard" component={KaitoLeaderboardScreen} />
            <Stack.Screen name="AddGif" component={AddGifScreen} />
            <Stack.Screen name="Badges" component={BadgesScreen} />
            <Stack.Screen name="Kaiji" component={KaijiScreen} />
            <Stack.Screen name="Inbox" component={InboxScreen} />
            <Stack.Screen name="Reader" component={ReaderScreen} />
            <Stack.Screen name="Bazaar" component={BazaarScreen} />
            <Stack.Screen name="BazaarBook" component={BazaarBookScreen} />
            <Stack.Screen name="UploadBook" component={UploadBookScreen} />
            <Stack.Screen name="BazaarDashboard" component={BazaarDashboardScreen} />
          </>
        )}
      </Stack.Navigator>
        {currentRoute !== 'KaitoAdventure' && currentRoute !== 'Kaiji' && (
          <GlobalBottomNav 
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            menuOpen={sidebarOpen}
          />
        )}
        <GlobalSidebar 
          isVisible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <NavigationLoadingOverlay visible={isNavigating} />
      </View>
    </NavigationContainer>
  );
};

export default MainApp;

````

## `components/GlobalSidebar.js` (edited)

````
import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Clipboard, ActivityIndicator, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useGoogleAuth } from './GoogleAuthProvider';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import {
  getGlobalSidebarStyles,
  SIDEBAR_ACCENT,
  SIDEBAR_CONNECTED,
} from '../styles/GlobalSidebarStyles';

const GlobalSidebar = ({ isVisible, onClose }) => {
  const navigation = useNavigation();
  const { session } = useGoogleAuth();
  const walletContext = useContext(EmbeddedWalletContext);
  const { isDark } = useTheme();
  const styles = getGlobalSidebarStyles(isDark);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const wallet = walletContext?.wallet;
  const disconnectWallet = walletContext?.disconnectWallet;
  const setShowModal = walletContext?.setShowModal;
  const isLoading = walletContext?.isLoading;

  const navGroups = [
    {
      title: wallet ? `${wallet.publicKey.toString().slice(0, 6)}...${wallet.publicKey.toString().slice(-4)}` : 'Connect',
      icon: 'wallet',
      isWallet: true,
      items: wallet
        ? [
            { name: 'Copy Address', action: 'copyAddress', icon: 'copy' },
            { name: 'Disconnect', action: 'disconnect', icon: 'sign-out-alt' },
          ]
        : [{ name: 'Connect Wallet', action: 'connect', icon: 'plug' }],
    },
    {
      title: 'Main',
      icon: 'home',
      items: [
        { name: 'Home', screen: 'Home', icon: 'home' },
        { name: 'Crazy Corner', screen: 'Feed', icon: 'newspaper' },
        { name: 'Profile', screen: 'Profile', icon: 'user' },
      ],
    },
    {
      title: 'Content',
      icon: 'book',
      items: [
        { name: 'Novel Dashboard', screen: 'NovelDashboard', icon: 'book-open' },
        { name: 'Manga Dashboard', screen: 'MangaDashboard', icon: 'images' },
        { name: 'Hoard', screen: 'NovelsPage', icon: 'book' },
        { name: 'Manga Hoard', screen: 'MangaPage', icon: 'images' },
      ],
    },
    {
      title: 'Nexus',
      icon: 'wallet',
      items: [
        { name: 'Swap', screen: 'Swap', icon: 'exchange-alt' },
        { name: 'Ramp', screen: 'Ramp', icon: 'credit-card' },
        { name: 'Import Wallet', screen: 'WalletImport', icon: 'wallet' },
        { name: 'Mint', screen: 'Mint', icon: 'coins' },
        { name: 'Marketplace', screen: 'Marketplace', icon: 'shopping-cart' },
      ],
    },
    {
      title: 'Community',
      icon: 'users',
      items: [
        { name: 'Chat', screen: 'Chat', icon: 'comments' },
        { name: 'Badges', screen: 'Badges', icon: 'award' },
        { name: 'Leaderboard', screen: 'Leaderboard', icon: 'trophy' },
        { name: 'Kaiji', screen: 'Kaiji', icon: 'language' },
      ],
    },
    {
      title: 'Admin',
      icon: 'cog',
      items: [
        { name: 'Admin', screen: 'Admin', icon: 'user-shield' },
      ],
    },
    {
      title: 'Info',
      icon: 'info-circle',
      items: [
        { name: 'Inbox', screen: 'Inbox', icon: 'envelope' },
        { name: 'Support', screen: 'Support', icon: 'life-ring' },
        { name: 'Terms', screen: 'Terms', icon: 'file-contract' },
        { name: 'Privacy Policy', screen: 'PrivacyPolicy', icon: 'shield-alt' },
      ],
    },
    {
      title: 'Bazaar',
      icon: 'store',
      items: [
        { name: 'Bazaar', screen: 'Bazaar', icon: 'book' },
        { name: 'Upload Book', screen: 'UploadBook', icon: 'cloud-upload-alt' },
        { name: 'My Bazaar', screen: 'BazaarDashboard', icon: 'chart-line' },
      ],
    },
    {
      title: 'Other',
      icon: 'ellipsis-h',
      items: [
        { name: 'Kaiji', screen: 'Kaiji', icon: 'language' },
        { name: 'Reader', screen: 'Reader', icon: 'book-reader' },
        { name: 'Apply', screen: 'Apply', icon: 'user-plus' },
        { name: 'Download', screen: 'Download', icon: 'download' },
        { name: 'Add Gif', screen: 'AddGif', icon: 'image' },
      ],
    },
  ];

  const toggleDropdown = (index) => {
    setActiveDropdown(activeDropdown === index ? null : index);
  };

  const handleWalletAction = (action) => {
    if (action === 'connect') {
      if (setShowModal) setShowModal(true);
    } else if (action === 'copyAddress' && wallet) {
      Clipboard.setString(wallet.publicKey.toString());
      Alert.alert('Copied', 'Wallet address copied to clipboard');
    } else if (action === 'disconnect') {
      if (disconnectWallet) disconnectWallet();
    }
    setActiveDropdown(null);
  };

  const navigateToScreen = (screenName) => {
    const screenMap = { 'Crazy Corner': 'Feed', Nexus: 'Wallet' };
    const actualScreenName = screenMap[screenName] || screenName;
    setIsNavigating(true);
    navigation.navigate(actualScreenName);
    setActiveDropdown(null);
    onClose();
    setTimeout(() => setIsNavigating(false), 500);
  };

  return (
    <>
      {isVisible && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={onClose}
          activeOpacity={0.7}
          accessible
          accessibilityLabel="Close menu"
        />
      )}
      <View style={[styles.sidebar, { transform: [{ translateX: isVisible ? 0 : 320 }] }]}>
        <View style={styles.sidebarContent}>
          <View style={styles.sidebarHeader}>
            <Image
              source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
              style={styles.sidebarLogo}
            />
            <Text style={styles.sidebarTitle}>Sempai HQ</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close menu">
              <FontAwesome5 name="times" size={13} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.navLinksContainer}>
            {navGroups.map((group, groupIndex) => (
              <View key={groupIndex} style={styles.navGroup}>
                <TouchableOpacity
                  style={[
                    styles.navGroupButton,
                    group.isWallet && wallet ? styles.walletButtonConnected : null,
                  ]}
                  onPress={() => toggleDropdown(groupIndex)}
                  activeOpacity={0.7}
                  disabled={group.isWallet && isLoading}
                >
                  <FontAwesome5
                    name={group.icon}
                    size={15}
                    color={group.isWallet && wallet ? SIDEBAR_CONNECTED(isDark) : SIDEBAR_ACCENT(isDark)}
                    style={styles.navIcon}
                  />
                  <Text
                    style={[
                      styles.navGroupText,
                      group.isWallet && wallet ? styles.walletConnectedText : null,
                    ]}
                  >
                    {group.title}
                  </Text>
                  <FontAwesome5
                    name={activeDropdown === groupIndex ? 'chevron-up' : 'chevron-down'}
                    size={11}
                    color={group.isWallet && wallet ? SIDEBAR_CONNECTED(isDark) : SIDEBAR_ACCENT(isDark)}
                    style={styles.dropdownIcon}
                  />
                </TouchableOpacity>

                {activeDropdown === groupIndex && (
                  <View style={styles.dropdown}>
                    {group.items.map((item, itemIndex) => (
                      <TouchableOpacity
                        key={`${groupIndex}-${item.name}-${itemIndex}`}
                        style={styles.dropdownItem}
                        onPress={() => (group.isWallet ? handleWalletAction(item.action) : navigateToScreen(item.screen))}
                        activeOpacity={0.7}
                        disabled={isNavigating || isLoading}
                      >
                        {isNavigating && !group.isWallet ? (
                          <ActivityIndicator size="small" color={SIDEBAR_ACCENT(isDark)} />
                        ) : (
                          <FontAwesome5 name={item.icon} size={13} color={SIDEBAR_ACCENT(isDark)} />
                        )}
                        <Text style={styles.dropdownItemText}>
                          {isNavigating && !group.isWallet ? 'Loading...' : item.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            <View style={{ height: 10 }} />
          </ScrollView>
        </View>
      </View>
    </>
  );
};

export default GlobalSidebar;
````

## `components/EPUBReader.js` (edited)

````
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Modal, FlatList } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles/ReaderStyles';

const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.1.5/dist/jszip.min.js';
const EPUBJS_CDN = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';
const CHUNK_SIZE = 512 * 1024; // base64 chars per injected chunk

const WEBVIEW_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="${JSZIP_CDN}"></script>
  <script src="${EPUBJS_CDN}"></script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #0B0B14;
      overflow: hidden;
    }
    #viewer {
      width: 100%;
      height: 100%;
    }
    #viewer iframe {
      background-color: #0B0B14 !important;
    }
    #status {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      text-align: center;
      color: #8A8AA3;
      font-family: sans-serif;
      font-size: 14px;
      transform: translateY(-50%);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="viewer"></div>
  <div id="status">Loading book...</div>
  <script>
    var book = null;
    var rendition = null;
    var tocFlat = [];
    var currentIndex = -1;
    var __chunks = [];

    function post(msg) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      } catch (e) {}
    }

    window.addChunk = function (s) {
      __chunks.push(s);
    };

    function b64ToBytes(b64) {
      var len = b64.length;
      var out = new Uint8Array(Math.floor(len * 3 / 4) + 3);
      var o = 0;
      for (var i = 0; i < len; i += 0x8000) {
        var bin = atob(b64.substr(i, 0x8000));
        for (var j = 0; j < bin.length; j++) {
          out[o++] = bin.charCodeAt(j);
        }
      }
      return out.subarray(0, o);
    }

    function flattenToc(items, depth, out) {
      (items || []).forEach(function (item) {
        out.push({ label: item.label || 'Untitled', href: item.href, depth: depth });
        if (item.subitems && item.subitems.length) {
          flattenToc(item.subitems, depth + 1, out);
        }
      });
      return out;
    }

    function findChapterIndex(href) {
      if (!href) return -1;
      var clean = href.split('#')[0];
      for (var i = 0; i < tocFlat.length; i++) {
        var h = (tocFlat[i].href || '').split('#')[0];
        if (h === clean) return i;
      }
      return -1;
    }

    function applyTheme() {
      rendition.themes.register('sempai', {
        'body': {
          'color': '#E8E6F0',
          'background': '#0B0B14',
          'padding': '0 16px',
          'font-family': 'serif',
          'line-height': '1.7'
        },
        'p': { 'margin': '0 0 0.9em 0' },
        'h1, h2, h3, h4': { 'color': '#FF5733', 'font-family': 'sans-serif' },
        'a': { 'color': '#FF8C42', 'text-decoration': 'none' }
      });
      rendition.themes.select('sempai');
    }

    window.finishLoad = function () {
      try {
        if (typeof JSZip === 'undefined') {
          post({ type: 'error', message: 'JSZip failed to load. Check your connection and retry.' });
          return;
        }
        if (typeof ePub !== 'function') {
          post({ type: 'error', message: 'EPUB engine failed to load. Check your connection and retry.' });
          return;
        }
        var joined = __chunks.join('');
        __chunks = null;
        var bytes = b64ToBytes(joined);
        post({ type: 'progress', message: 'Opening book...' });

        book = ePub(bytes.buffer);
        rendition = book.renderTo('viewer', {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none'
        });

        rendition.on('relocated', function (loc) {
          var idx = findChapterIndex(loc && loc.start && loc.start.href ? loc.start.href : (loc && loc.href));
          if (idx >= 0 && idx !== currentIndex) {
            currentIndex = idx;
            post({ type: 'chapter', index: idx });
          }
        });

        book.ready.then(function () {
          applyTheme();
          return book.locations.generate(1024);
        }).then(function () {
          tocFlat = flattenToc(book.navigation && book.navigation.toc, 0, []);
          if (tocFlat.length === 0) {
            // Fallback: build chapter list from spine
            var spineItems = [];
            book.spine.each(function (item) {
              spineItems.push({ label: item.label || item.idref || ('Section ' + spineItems.length), href: item.href });
            });
            tocFlat = spineItems;
          }
          post({ type: 'toc', chapters: tocFlat.map(function (c) { return { label: c.label, depth: c.depth || 0 }; }) });
          return rendition.display(tocFlat.length ? tocFlat[0].href : undefined);
        }).then(function () {
          var status = document.getElementById('status');
          if (status) status.style.display = 'none';
          post({ type: 'ready' });
        }).catch(function (err) {
          post({ type: 'error', message: 'Failed to render book: ' + (err && err.message ? err.message : err) });
        });
      } catch (e) {
        post({ type: 'error', message: 'Failed to load EPUB: ' + (e && e.message ? e.message : e) });
      }
    };

    window.displayChapter = function (i) {
      try {
        if (rendition && tocFlat[i]) {
          rendition.display(tocFlat[i].href);
        }
      } catch (e) {}
    };

    // Detect epub.js CDN load failure
    window.addEventListener('error', function (e) {
      var m = e && e.message ? String(e.message).toLowerCase() : '';
      if (m.indexOf('epub') !== -1 || m.indexOf('jszip') !== -1) {
        post({ type: 'error', message: 'Could not load EPUB engine. Check your connection and retry.' });
      }
    }, true);
  </script>
</body>
</html>
`;

const EPUBReader = ({ file, onBack }) => {
  const [fileLoading, setFileLoading] = useState(true);
  const [bookLoading, setBookLoading] = useState(false);
  const [statusText, setStatusText] = useState('Reading file...');
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [error, setError] = useState(null);
  const webViewRef = useRef(null);
  const fileB64Ref = useRef(null);
  const webViewReadyRef = useRef(false);
  const injectionStartedRef = useRef(false);

  useEffect(() => {
    loadEPUB();
    return () => {
      injectionStartedRef.current = false;
    };
  }, [file]);

  const loadEPUB = async () => {
    try {
      setFileLoading(true);
      setError(null);
      setStatusText('Reading file...');

      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      fileB64Ref.current = fileContent;
      setFileLoading(false);
      // If the WebView finished loading before the file read, kick off injection now
      if (webViewReadyRef.current) {
        startInjection();
      }
    } catch (err) {
      console.error('Error loading EPUB:', err);
      setError('Failed to read EPUB file. Please try a different file.');
      setFileLoading(false);
    }
  };

  const startInjection = () => {
    if (injectionStartedRef.current || !fileB64Ref.current) return;
    injectionStartedRef.current = true;
    setBookLoading(true);

    const b64 = fileB64Ref.current;
    fileB64Ref.current = null; // free memory

    // Reset any previous book state in the page
    webViewRef.current?.injectJavaScript('window.__chunks = []; true;');

    let i = 0;
    const injectNext = () => {
      if (i >= b64.length) {
        webViewRef.current?.injectJavaScript('window.finishLoad(); true;');
        return;
      }
      const chunk = b64.substring(i, i + CHUNK_SIZE);
      i += CHUNK_SIZE;
      webViewRef.current?.injectJavaScript(
        'window.addChunk(' + JSON.stringify(chunk) + '); true;'
      );
      // Let the WebView breathe between chunks
      setTimeout(injectNext, 0);
    };
    injectNext();
  };

  const handleWebViewLoad = () => {
    webViewReadyRef.current = true;
    startInjection();
  };

  const handlePreviousChapter = () => {
    if (currentChapter > 0) {
      const next = currentChapter - 1;
      setCurrentChapter(next);
      webViewRef.current?.injectJavaScript(
        'window.displayChapter(' + next + '); true;'
      );
    }
  };

  const handleNextChapter = () => {
    if (currentChapter < chapters.length - 1) {
      const next = currentChapter + 1;
      setCurrentChapter(next);
      webViewRef.current?.injectJavaScript(
        'window.displayChapter(' + next + '); true;'
      );
    }
  };

  const handleSelectChapter = (index) => {
    setTocOpen(false);
    setCurrentChapter(index);
    webViewRef.current?.injectJavaScript(
      'window.displayChapter(' + index + '); true;'
    );
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'toc') {
        setChapters(data.chapters || []);
      } else if (data.type === 'chapter') {
        setCurrentChapter(data.index);
      } else if (data.type === 'ready') {
        setBookLoading(false);
        setStatusText('');
      } else if (data.type === 'progress') {
        setStatusText(data.message || 'Loading...');
      } else if (data.type === 'error') {
        setError(data.message || 'Failed to load EPUB.');
        setBookLoading(false);
      }
    } catch (err) {
      // Ignore non-JSON messages
    }
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={styles.errorText.color} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.pickButton} onPress={onBack}>
          <Text style={styles.pickButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (fileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={styles.filePickerIcon.color} />
        <Text style={styles.loadingText}>{statusText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.readerContainer}>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.name}
        </Text>
        <View style={styles.fileTypeBadge}>
          <Text style={styles.fileTypeText}>EPUB</Text>
        </View>
      </View>

      <WebView
        ref={webViewRef}
        source={{ html: WEBVIEW_HTML }}
        style={styles.epubContainer}
        onMessage={handleWebViewMessage}
        onLoadEnd={handleWebViewLoad}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scalesPageToFit
        originWhitelist={['*']}
      />

      {bookLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={styles.filePickerIcon.color} />
          <Text style={styles.loadingText}>{statusText}</Text>
        </View>
      )}

      {chapters.length > 0 && !bookLoading && (
        <>
          <View style={styles.pageIndicator}>
            <TouchableOpacity onPress={() => setTocOpen(true)}>
              <Text style={styles.pageIndicatorText} numberOfLines={1}>
                {chapters[currentChapter]?.label || 'Chapter'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.navigationControls}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={handlePreviousChapter}
              disabled={currentChapter <= 0}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={currentChapter <= 0 ? styles.filePickerText.color : styles.filePickerIcon.color}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setTocOpen(true)}
            >
              <Ionicons name="list-outline" size={22} color={styles.filePickerIcon.color} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={handleNextChapter}
              disabled={currentChapter >= chapters.length - 1}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={currentChapter >= chapters.length - 1 ? styles.filePickerText.color : styles.filePickerIcon.color}
              />
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal
        visible={tocOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTocOpen(false)}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Contents</Text>
              <TouchableOpacity onPress={() => setTocOpen(false)}>
                <Ionicons name="close" size={24} color="#E8E6F0" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={chapters}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[localStyles.tocItem, index === currentChapter && localStyles.tocItemActive]}
                  onPress={() => handleSelectChapter(index)}
                >
                  <Text
                    style={[
                      localStyles.tocItemText,
                      (item.depth || 0) > 0 && { paddingLeft: 16 + (item.depth || 0) * 12 },
                      index === currentChapter && localStyles.tocItemTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const localStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16162A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A45',
  },
  modalTitle: {
    color: '#E8E6F0',
    fontSize: 18,
    fontWeight: '600',
  },
  tocItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A45',
  },
  tocItemActive: {
    backgroundColor: 'rgba(255,87,51,0.12)',
  },
  tocItemText: {
    color: '#C9C7E0',
    fontSize: 15,
  },
  tocItemTextActive: {
    color: '#FF5733',
    fontWeight: '600',
  },
});

export default EPUBReader;

````

## `styles/ReaderStyles.js` (edited)

````
import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Design tokens matching app aesthetics
const COLOR = {
  dark: {
    bg: '#0B0B14',
    bgElevated: '#111219',
    bgCard: '#15161F',
    bgCardAlt: '#1A1B26',
    accent: '#FF5733',
    accentDeep: '#F36316',
    accentGlow: 'rgba(255, 87, 51, 0.35)',
    accentSoft: 'rgba(255, 87, 51, 0.12)',
    sakura: '#E94560',
    gold: '#FFD700',
    textPrimary: '#FFFFFF',
    textSecondary: '#C9C9D1',
    textMuted: '#8A8A99',
    border: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(255, 87, 51, 0.35)',
    danger: '#FF6B6B',
    warning: '#FFC107',
  },
  light: {
    bg: '#FDFBD4',
    bgElevated: '#f5f0d0',
    bgCard: '#ffffff',
    bgCardAlt: '#f8f8e8',
    accent: '#3b82f6',
    accentDeep: '#2563eb',
    accentGlow: 'rgba(59, 130, 246, 0.35)',
    accentSoft: 'rgba(59, 130, 246, 0.12)',
    sakura: '#E94560',
    gold: '#f59e0b',
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#64748b',
    border: 'rgba(59, 130, 246, 0.15)',
    borderAccent: 'rgba(59, 130, 246, 0.35)',
    danger: '#ef4444',
    warning: '#f59e0b',
  },
};

const RADIUS = { sm: 6, md: 10, lg: 16, xl: 20, pill: 999 };
const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28 };
const FONT = 'Yoruka';

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 6,
};

const cardShadowLight = {
  shadowColor: 'rgba(0, 0, 0, 0.1)',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 4,
};

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.dark.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.m,
    backgroundColor: COLOR.dark.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.dark.border,
  },
  headerTitle: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '700',
    color: COLOR.dark.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACE.m,
  },
  iconButton: {
    padding: SPACE.s,
    borderRadius: RADIUS.sm,
  },
  filePickerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xxl,
  },
  filePickerCard: {
    width: width * 0.8,
    backgroundColor: COLOR.dark.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACE.xxl,
    alignItems: 'center',
    ...cardShadow,
  },
  filePickerIcon: {
    fontSize: 64,
    marginBottom: SPACE.l,
    color: COLOR.dark.accent,
  },
  filePickerTitle: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: '700',
    color: COLOR.dark.textPrimary,
    marginBottom: SPACE.s,
    textAlign: 'center',
  },
  filePickerSubtitle: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.textSecondary,
    marginBottom: SPACE.xl,
    textAlign: 'center',
  },
  pickButton: {
    backgroundColor: COLOR.dark.accent,
    paddingVertical: SPACE.m,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
    ...cardShadow,
  },
  pickButtonText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filePickerIcon: {
    fontSize: 64,
    marginBottom: SPACE.l,
    color: COLOR.dark.accent,
  },
  filePickerText: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.textSecondary,
  },
  readerContainer: {
    flex: 1,
    backgroundColor: COLOR.dark.bg,
  },
  pdfContainer: {
    flex: 1,
  },
  epubContainer: {
    flex: 1,
    backgroundColor: COLOR.dark.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.textSecondary,
    marginTop: SPACE.m,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLOR.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xl,
  },
  errorText: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.danger,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xl,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 18,
    color: COLOR.dark.textSecondary,
    textAlign: 'center',
  },
  fileInfo: {
    backgroundColor: COLOR.dark.bgCard,
    padding: SPACE.m,
    marginHorizontal: SPACE.l,
    marginTop: SPACE.m,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileName: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLOR.dark.textPrimary,
    flex: 1,
    marginRight: SPACE.m,
  },
  fileTypeBadge: {
    backgroundColor: COLOR.dark.accentSoft,
    paddingHorizontal: SPACE.s,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.sm,
  },
  fileTypeText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: COLOR.dark.accent,
    textTransform: 'uppercase',
  },
  progressBar: {
    height: 2,
    backgroundColor: COLOR.dark.border,
    marginTop: SPACE.m,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLOR.dark.accent,
  },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.s,
    backgroundColor: COLOR.dark.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.dark.border,
  },
  pageIndicatorText: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLOR.dark.textSecondary,
  },
  navigationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACE.m,
    backgroundColor: COLOR.dark.bgElevated,
    borderTopWidth: 1,
    borderTopColor: COLOR.dark.border,
  },
  navButton: {
    backgroundColor: COLOR.dark.bgCard,
    padding: SPACE.m,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.dark.border,
  },
  navButtonText: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLOR.dark.textPrimary,
  },
  chapterList: {
    flex: 1,
    backgroundColor: COLOR.dark.bg,
  },
  chapterItem: {
    padding: SPACE.m,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.dark.border,
  },
  chapterTitle: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.textPrimary,
  },
  chapterActive: {
    backgroundColor: COLOR.dark.accentSoft,
  },
  chapterActiveText: {
    color: COLOR.dark.accent,
  },
  tocContainer: {
    flex: 1,
    backgroundColor: COLOR.dark.bgCard,
  },
  tocItem: {
    padding: SPACE.m,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.dark.border,
  },
  tocTitle: {
    fontFamily: FONT,
    fontSize: 15,
    color: COLOR.dark.textPrimary,
  },
  tocActive: {
    backgroundColor: COLOR.dark.accentSoft,
  },
  tocActiveText: {
    color: COLOR.dark.accent,
  },
  settingsButton: {
    backgroundColor: COLOR.dark.bgCard,
    padding: SPACE.s,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLOR.dark.border,
  },
});

````

## `screens/ReaderScreen.js` (edited)

````
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import PDFReader from '../components/PDFReader';
import EPUBReader from '../components/EPUBReader';
import styles from '../styles/ReaderStyles';

const { width, height } = Dimensions.get('window');

export default function ReaderScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTOC, setShowTOC] = useState(false);

  // Clear file when leaving screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        setFile(null);
        setFileType(null);
        setError(null);
      };
    }, [])
  );

  const pickFile = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/epub+zip', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      const fileUri = result.assets[0].uri;
      const fileName = result.assets[0].name;
      const fileSize = result.assets[0].size;

      // Determine file type from extension
      const extension = fileName.split('.').pop().toLowerCase();
      let type = null;

      if (extension === 'pdf') {
        type = 'pdf';
      } else if (extension === 'epub') {
        type = 'epub';
      } else {
        // Try to detect from mime type
        const mimeType = result.assets[0].mimeType || '';
        if (mimeType.includes('pdf')) {
          type = 'pdf';
        } else if (mimeType.includes('epub')) {
          type = 'epub';
        }
      }

      if (!type) {
        setError('Unsupported file type. Please select a PDF or EPUB file.');
        setLoading(false);
        return;
      }

      setFile({
        uri: fileUri,
        name: fileName,
        size: fileSize,
      });
      setFileType(type);
      setLoading(false);
    } catch (err) {
      console.error('Error picking file:', err);
      setError('Failed to open file. Please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (file) {
      setFile(null);
      setFileType(null);
    } else {
      navigation.goBack();
    }
  };

  const renderFilePicker = () => (
    <View style={styles.filePickerContainer}>
      <View style={styles.filePickerCard}>
        <Ionicons name="book-outline" size={64} color={styles.filePickerIcon.color} style={styles.filePickerIcon} />
        <Text style={styles.filePickerTitle}>Reader</Text>
        <Text style={styles.filePickerSubtitle}>
          Open PDF and EPUB files to read
        </Text>
        <TouchableOpacity style={styles.pickButton} onPress={pickFile} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="folder-open" size={20} color="#FFFFFF" />
              <Text style={styles.pickButtonText}>Open File</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReader = () => {
    if (fileType === 'pdf') {
      return <PDFReader file={file} onBack={handleBack} />;
    } else if (fileType === 'epub') {
      return <EPUBReader file={file} onBack={handleBack} />;
    }
    return null;
  };

  // Reserve space for the floating GlobalBottomNav (68px tall, sits
  // max(insets.bottom, 8) + 12px above the bottom edge) so reader content
  // and bottom controls aren't covered by it.
  const bottomNavClearance = Math.max(insets.bottom, 8) + 12 + 68 + 8;

  return (
    <View style={[styles.container, { paddingBottom: bottomNavClearance }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={styles.headerTitle.color} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reader</Text>
        {file && (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowTOC(true)}>
              <Ionicons name="list-outline" size={24} color={styles.headerTitle.color} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={styles.errorText.color} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.pickButton} onPress={() => setError(null)}>
            <Text style={styles.pickButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!file && !error && renderFilePicker()}
      {file && !error && renderReader()}
    </View>
  );
}

````
