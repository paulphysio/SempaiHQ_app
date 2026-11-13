# Kaiji Game Implementation Guide

## Overview
Kaiji is a Rock-Paper-Scissors gambling game built on Solana devnet. Players wager tokens, and the winner takes 90% of the pot (10% fee).

## Architecture
- **Frontend**: React Native (Expo) with embedded wallet
- **Backend**: Supabase Edge Functions (Deno) + PostgreSQL
- **Blockchain**: Solana devnet with Helius RPC
- **Identity**: Wallet-based (no Supabase Auth required)

## File Structure
```
SempaiHQ_app/
├── screens/KaijiScreen.js           # Main game UI
├── services/
│   ├── kaijiApi.js                 # API client for edge function
│   ├── kaijiMapping.js             # Helper functions
│   └── kaijiGuard.js               # Wallet change guard
├── supabase/
│   ├── migrations/20261103_kaiji.sql   # Database schema
│   └── functions/
│       └── kaiji/
│           ├── function-single-file.ts  # Edge function (combined)
│           ├── index.ts                # Original split version
│           ├── engine.ts               # Game state management
│           ├── solana.ts               # Blockchain operations
│           └── logic.ts                 # Game rules
├── scripts/
│   ├── devnet-setup.js              # One-time devnet setup
│   ├── kaiji-sweep.js               # Cron job for timeouts/refunds
│   ├── check-kaiji-matches.js       # Debugging tool
│   └── mint-tokens.js               # Mint test tokens
└── assets/kaiji/
    ├── card-back-swirl.png
    ├── card-back-sempai.png
    ├── card-face-rock.png
    ├── card-face-paper.png
    └── card-face-scissors.png
```

## Database Schema

### Tables
- `kaiji_matches` - Match state and results
- `kaiji_rounds` - Round-by-round history
- `kaiji_picks` - Player card selections
- `kaiji_deposits` - Deposit transactions and refunds

### Functions
- `kaiji_join_or_create` - Join existing match or create new one
- `kaiji_apply_round` - Apply a round result

## Environment Variables

### Supabase Edge Function Secrets (Supabase Dashboard → Edge Functions → kaiji → Secrets)

```env
# Required
KAIJI_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
KAIJI_MINT=3B15ujBwPycAkt7JkAaXUpzNgaCPWwW6x7ymBiXnkJV4
KAIJI_DECIMALS=6
FEE_WALLET=your-wallet-address
ESCROW_SECRET_KEY=[64-number-array]
MIN_WAGER=1000000
MAX_WAGER=100000000
SWEEP_SECRET=random-secret-string

# Optional
PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
KAIJI_ALLOWED_WALLETS=wallet1,wallet2,wallet3  # Leave empty to allow all wallets
```

### Project .env (for the app)
```env
# Existing variables (do not change for Kaiji)
EXPO_PUBLIC_SOLANA_NETWORK=https://mainnet.helius-rpc.com
SOLANA_API_KEY=your-helius-api-key
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Setup Steps

### 1. One-Time Devnet Setup

```bash
node scripts/devnet-setup.js <testWalletA> <testWalletB>
```

This creates:
- Test token mint
- Escrow wallet (funded with SOL)
- Test wallets (funded with 1000 tokens each)
- `supabase/.env.kaiji` with secrets

### 2. Database Migration

Run the SQL from `supabase/migrations/20261103_kaiji.sql` in Supabase SQL Editor.

### 3. Deploy Edge Function

Copy code from `supabase/functions/kaiji/function-single-file.ts` and paste into Supabase Dashboard → Edge Functions → kaiji.

### 4. Set Secrets

Add secrets from `supabase/.env.kaiji` to Supabase Dashboard → Edge Functions → kaiji → Secrets.

### 5. Add Card Images

Place PNG images in `assets/kaiji/`:
- card-back-swirl.png
- card-back-sempai.png
- card-face-rock.png
- card-face-paper.png
- card-face-scissors.png

### 6. Run Sweep Cron (for automatic refunds)

```bash
SWEEP_SECRET=your-sweep-secret node scripts/kaiji-sweep.js
```

Keep this running in background while testing.

## Code Files

### screens/KaijiScreen.js
**Location:** `screens/KaijiScreen.js` (~1400 lines)

This is the main game UI component. Due to its size, see the actual file at `screens/KaijiScreen.js`.

Key features:
- Landscape orientation lock
- AI practice mode (easy/medium difficulty)
- Online mode with real wagers
- Animated card reveals and effects
- Wallet integration via EmbeddedWalletContext
- Real-time match polling
- Timer-based round system

### services/kaijiApi.js
```javascript
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token';
import { supabase } from './supabaseClient';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const SESSION_KEY = 'kaiji_session_v1';

async function call(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('kaiji', { body: { action, ...payload } });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch (e) {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function loadSession() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
const saveSession = (s) => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s));
export const clearSession = () => SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const newSecret = () => toHex(Crypto.getRandomBytes(32));
const sha256Hex = (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);

const configCache = {};
export async function getKaijiConfig(walletAddress = '') {
  if (!configCache[walletAddress]) configCache[walletAddress] = await call('config', { wallet: walletAddress });
  return configCache[walletAddress];
}

export const toBaseUnits = (tokens, decimals) => BigInt(Math.round(tokens * 10 ** decimals));
export const fromBaseUnits = (units, decimals) => Number(units) / 10 ** decimals;

export async function depositAndJoin({ wallet, signTransactionOnly, wagerTokens }) {
  const owner = new PublicKey(wallet.publicKey);
  const cfg = await getKaijiConfig(owner.toBase58());
  if (!cfg.allowed) throw new Error('not_allowed');
  const amount = toBaseUnits(wagerTokens, cfg.decimals);
  if (amount < BigInt(cfg.minWager) || amount > BigInt(cfg.maxWager)) throw new Error('wager_out_of_range');

  const secret = newSecret();
  const commitment = await sha256Hex(secret);
  await saveSession({ secret, matchId: null });

  const mint = new PublicKey(cfg.mint);
  const escrow = new PublicKey(cfg.escrow);
  const tx = new Transaction().add(
    createTransferInstruction(
      getAssociatedTokenAddressSync(mint, owner),
      getAssociatedTokenAddressSync(mint, escrow),
      owner,
      amount
    ),
    new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM_ID, data: Buffer.from(`kaiji:${commitment}`, 'utf8') })
  );
  const connection = new Connection(cfg.rpcUrl, 'confirmed');
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  const signedBase64 = await signTransactionOnly(tx);
  const signature = await connection.sendRawTransaction(Buffer.from(signedBase64, 'base64'), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  const { match, side } = await call('join', { signature, wager: amount.toString(), secret });
  await saveSession({ secret, matchId: match.id });
  return { match, side };
}

export async function resumeMatch() {
  const s = await loadSession();
  if (!s?.secret) return null;
  try {
    const state = await call('state', { secret: s.secret, matchId: s.matchId || undefined });
    if (!state.match) {
      await clearSession();
      return null;
    }
    return state;
  } catch (e) {
    return null;
  }
}

export const getMatchState = async (matchId) => call('state', { secret: await secretOrThrow(), matchId });
export const submitPick = async (matchId, card) => (await call('pick', { secret: await secretOrThrow(), matchId, card })).match;
export const cancelWaiting = async (matchId) => (await call('cancel', { secret: await secretOrThrow(), matchId })).match;

async function secretOrThrow() {
  const s = await loadSession();
  if (!s?.secret) throw new Error('no_session');
  return s.secret;
}

export function watchMatch(matchId, { onState, onError, intervalMs = 1500 }) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const state = await getMatchState(matchId);
      if (!stopped) onState?.(state);
    } catch (e) {
      if (!stopped) onError?.(e);
    }
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
```

### services/kaijiMapping.js
```javascript
export const OPEN_STATUSES = ['waiting', 'active', 'settling', 'settle_failed'];
export const isOpen = (m) => !!m && OPEN_STATUSES.includes(m.status);
export const isFinished = (m) => !!m && ['settling', 'settle_failed', 'settled'].includes(m.status);

export const shortAddr = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');

export function viewOf(m, side) {
  const a = side === 'a';
  return {
    hand: a ? m.hand_a : m.hand_b,
    oppHand: a ? m.hand_b : m.hand_a,
    wins: a ? m.wins_a : m.wins_b,
    oppWins: a ? m.wins_b : m.wins_a,
    lockedMe: a ? m.locked_a : m.locked_b,
    lockedOpp: a ? m.locked_b : m.locked_a,
    myWallet: a ? m.wallet_a : m.wallet_b,
    oppWallet: a ? m.wallet_b : m.wallet_a,
  };
}

export function roundForMe(r, side) {
  const a = side === 'a';
  const res = r.result === 'tie' || r.result === 'idle' ? r.result : r.result === side ? 'win' : 'lose';
  return { round: r.round, myCard: a ? r.card_a : r.card_b, oppCard: a ? r.card_b : r.card_a, res, forfeit: !!r.forfeit };
}

export function roundMessage(v, names, oppName) {
  if (v.res === 'idle') return 'Nobody locked in. Round skipped.';
  if (v.forfeit && !v.myCard) return 'You did not lock in. Round forfeited.';
  if (v.forfeit && !v.oppCard) return `${oppName} timed out. The round is yours.`;
  if (v.res === 'tie') return 'Tie. Both cards are gone. Replay the round.';
  return v.res === 'win'
    ? `${names[v.myCard]} beats ${names[v.oppCard]}. You take the round.`
    : `${names[v.oppCard]} beats ${names[v.myCard]}. ${oppName} takes the round.`;
}

const fmt = (units, decimals) => {
  const n = Number(units) / 10 ** decimals;
  return `${Math.round(n * 100) / 100}`;
};

export function endInfo(m, side, cfg) {
  const wager = BigInt(m.wager);
  const pool = wager * 2n;
  const fee = (pool * BigInt(cfg.feeBps)) / 10000n;
  const payout = pool - fee;
  const paid = m.status === 'settled';
  const tail = paid ? 'Payout sent.' : m.status === 'settle_failed' ? 'Payout is delayed and will be retried.' : 'Sending payout…';

  if (m.outcome === 'win') {
    if (m.winner === side) return { kind: 'win', sub: `You won ${fmt(payout, cfg.decimals)} SKR after the 10% fee. ${tail}` };
    return { kind: 'lose', sub: `You lost ${fmt(wager, cfg.decimals)} SKR.` };
  }
  if (m.outcome === 'cancelled') return { kind: 'draw', sub: `No opponent was found. Your ${fmt(wager, cfg.decimals)} SKR is refunded. ${tail}` };
  if (m.outcome === 'void') return { kind: 'draw', sub: `Match voided because nobody played. Wagers are refunded. ${tail}` };
  return { kind: 'draw', sub: `It is a draw. Wagers are refunded. ${tail}` };
}
```

### services/kaijiGuard.js
```javascript
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { resumeMatch } from './kaijiApi';
import { isOpen, viewOf, shortAddr } from './kaijiMapping';

const TOURNEY_KEY = 'kaiji_tourney_v1';

export async function markTourneyActive(active) {
  try {
    if (active) await SecureStore.setItemAsync(TOURNEY_KEY, '1');
    else await SecureStore.deleteItemAsync(TOURNEY_KEY);
  } catch (e) {}
}

export async function confirmWalletChange() {
  try {
    if (await SecureStore.getItemAsync(TOURNEY_KEY)) {
      Alert.alert(
        'Tournament in progress',
        'You cannot switch wallets until your tournament ends. Prizes and card trades are tied to the wallet you entered with.',
        [{ text: 'OK' }]
      );
      return false;
    }
    const s = await resumeMatch();
    if (s && isOpen(s.match)) {
      const payoutWallet = shortAddr(viewOf(s.match, s.side).myWallet);
      return await new Promise((resolve) =>
        Alert.alert(
          'Match in progress',
          `A Kaiji match is open. Its payout goes to the wallet that made the deposit (${payoutWallet}). If you switch now you may not be able to collect it.`,
          [
            { text: 'Keep my wallet', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Switch anyway', style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        )
      );
    }
  } catch (e) {}
  return true;
}
```

### supabase/functions/kaiji/function-single-file.ts
**Location:** `supabase/functions/kaiji/function-single-file.ts` (~608 lines)

See the actual file for the complete edge function code. It combines:
- Game rules (logic.ts)
- Solana blockchain operations (solana.ts)
- Database management (engine.ts)
- HTTP handler (index.ts)

### scripts/devnet-setup.js
```javascript
const fs = require('fs');
const crypto = require('crypto');
const {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');

const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const DECIMALS = 6;
const FEE_WALLET_DEFAULT = 'your-fee-wallet-address';

function loadOrCreate(path) {
  if (fs.existsSync(path)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path, 'utf8'))));
  const kp = Keypair.generate();
  fs.writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  console.log('created', path);
  return kp;
}

async function ensureSol(conn, kp, minSol) {
  const bal = await conn.getBalance(kp.publicKey);
  if (bal >= minSol * LAMPORTS_PER_SOL) return;
  try {
    const sig = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
    const bh = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
    console.log('airdropped 2 SOL to', kp.publicKey.toBase58());
  } catch (e) {
    console.error('\nAirdrop failed (the devnet faucet is rate limited).');
    console.error('Send devnet SOL to', kp.publicKey.toBase58(), 'from https://faucet.solana.com and run this script again.\n');
    process.exit(1);
  }
}

async function main() {
  const [walletA, walletB, feeArg] = process.argv.slice(2);
  if (!walletA || !walletB) {
    console.error('usage: node scripts/devnet-setup.js <testWalletA> <testWalletB> [feeWallet]');
    process.exit(1);
  }
  const feeWallet = feeArg || FEE_WALLET_DEFAULT;
  const conn = new Connection(RPC, 'confirmed');

  const admin = loadOrCreate('devnet-admin.json');
  const escrow = loadOrCreate('escrow-keypair.json');
  await ensureSol(conn, admin, 1);

  const escrowBal = await conn.getBalance(escrow.publicKey);
  if (escrowBal < 0.3 * LAMPORTS_PER_SOL) {
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: escrow.publicKey, lamports: 0.5 * LAMPORTS_PER_SOL }),
    );
    await sendAndConfirmTransaction(conn, tx, [admin]);
    console.log('sent 0.5 SOL to escrow');
  }

  const mint = await createMint(conn, admin, admin.publicKey, null, DECIMALS);
  console.log('test token mint:', mint.toBase58());

  await getOrCreateAssociatedTokenAccount(conn, admin, mint, escrow.publicKey);
  for (const w of [walletA, walletB]) {
    const ata = await getOrCreateAssociatedTokenAccount(conn, admin, mint, new PublicKey(w));
    await mintTo(conn, admin, mint, ata.address, admin, 1000n * 10n ** BigInt(DECIMALS));
    console.log('minted 1000 test tokens to', w);
    const gas = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: new PublicKey(w), lamports: 0.05 * LAMPORTS_PER_SOL }),
    );
    await sendAndConfirmTransaction(conn, gas, [admin]);
    console.log('sent 0.05 devnet SOL to', w, '(for their deposit fees)');
  }

  const env = [
    `SOLANA_RPC_URL=${RPC}`,
    `PUBLIC_RPC_URL=${RPC}`,
    `KAIJI_MINT=${mint.toBase58()}`,
    `KAIJI_DECIMALS=${DECIMALS}`,
    `FEE_WALLET=${feeWallet}`,
    `ESCROW_SECRET_KEY=${JSON.stringify(Array.from(escrow.secretKey))}`,
    `SWEEP_SECRET=${crypto.randomBytes(24).toString('hex')}`,
    `MIN_WAGER=1000000`,
    `MAX_WAGER=100000000`,
    `KAIJI_ALLOWED_WALLETS=${walletA},${walletB}`,
    '',
  ].join('\n');
  fs.mkdirSync('supabase', { recursive: true });
  fs.writeFileSync('supabase/.env.kaiji', env);

  console.log('\nDone. Escrow wallet:', escrow.publicKey.toBase58());
  console.log('Next: supabase secrets set --env-file supabase/.env.kaiji');
  console.log('Then: supabase functions deploy kaiji');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### scripts/kaiji-sweep.js
```javascript
/**
 * Kaiji sweep cron job runner
 * Run this locally to process timeouts and refunds every 15 seconds
 *
 * Usage: node scripts/kaiji-sweep.js
 */

const SWEEP_SECRET = process.env.SWEEP_SECRET || 'your-sweep-secret-here';
const FUNCTION_URL = 'https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/kaiji';
const ANON_KEY = 'your-supabase-anon-key';

async function sweep() {
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'x-sweep-secret': SWEEP_SECRET,
      },
      body: JSON.stringify({ action: 'sweep' }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`[${new Date().toISOString()}] Sweep success:`, data);
    } else {
      console.error(`[${new Date().toISOString()}] Sweep failed:`, data);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Sweep error:`, error.message);
  }
}

// Run once then loop every 15 seconds
async function main() {
  console.log('Starting Kaiji sweep cron (every 15 seconds)...');
  console.log('Press Ctrl+C to stop\n');

  await sweep(); // Run immediately
  setInterval(sweep, 15000); // Then every 15 seconds
}

main();
```

### scripts/check-kaiji-matches.js
```javascript
const { createClient } = require('@supabase/supabase-js@2');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const wallet = process.argv[2];
  if (!wallet) {
    console.error('Usage: node scripts/check-kaiji-matches.js <walletAddress>');
    process.exit(1);
  }

  console.log(`Checking matches for wallet: ${wallet}\n`);

  // Check for open matches
  const { data: openMatches } = await supabase
    .from('kaiji_matches')
    .select('*')
    .or(`wallet_a.eq.${wallet},wallet_b.eq.${wallet}`)
    .in('status', ['waiting', 'active', 'settling', 'settle_failed']);

  if (openMatches && openMatches.length > 0) {
    console.log(`Found ${openMatches.length} open match(es):`);
    openMatches.forEach(m => {
      console.log(`  - ID: ${m.id}`);
      console.log(`    Status: ${m.status}`);
      console.log(`    Wager: ${m.wager}`);
      console.log(`    Created: ${m.created_at}`);
    });

    // Force cancel all waiting matches for this wallet (as player A)
    const { data: cancelled } = await supabase
      .from('kaiji_matches')
      .update({ status: 'settling', outcome: 'cancelled', updated_at: new Date().toISOString() })
      .eq('wallet_a', wallet)
      .eq('status', 'waiting')
      .select();

    if (cancelled && cancelled.length > 0) {
      console.log(`\nCancelled ${cancelled.length} waiting match(es). The sweep will refund them.`);
    }
  } else {
    console.log('No open matches found for this wallet.');
  }

  // Check recent deposits
  const { data: deposits } = await supabase
    .from('kaiji_deposits')
    .select('*')
    .eq('wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(5);

  if (deposits && deposits.length > 0) {
    console.log(`\nRecent deposits:`);
    deposits.forEach(d => {
      console.log(`  - Sig: ${d.sig.substring(0, 20)}...`);
      console.log(`    Amount: ${d.amount}`);
      console.log(`    Match: ${d.match_id || 'none'}`);
      console.log(`    Refund: ${d.refund_sig || 'pending'}`);
    });
  }
}

main().catch(console.error);
```

### scripts/mint-tokens.js
```javascript
const { Connection, PublicKey } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const fs = require('fs');

// Config
const MINT_ADDRESS = 'your-test-token-mint-address';
const DECIMALS = 6;
const AMOUNT = 1000; // tokens to mint
const RPC = 'https://api.devnet.solana.com';

async function main() {
  const [targetWallet] = process.argv.slice(2);
  if (!targetWallet) {
    console.error('Usage: node mint-tokens.js <targetWalletAddress>');
    process.exit(1);
  }

  // Load admin wallet
  const adminSecret = JSON.parse(fs.readFileSync('devnet-admin.json', 'utf8'));
  const admin = require('@solana/web3.js').Keypair.fromSecretKey(new Uint8Array(adminSecret));
  const conn = new Connection(RPC, 'confirmed');
  const mint = new PublicKey(MINT_ADDRESS);
  const target = new PublicKey(targetWallet);

  console.log(`Minting ${AMOUNT} tokens to ${targetWallet}...`);

  const ata = await getOrCreateAssociatedTokenAccount(conn, admin, mint, target);
  await mintTo(conn, admin, mint, ata.address, admin, BigInt(AMOUNT * 10 ** DECIMALS));

  console.log('Done!');
}

main().catch(console.error);
```

### supabase/migrations/20261103_kaiji.sql
```sql
-- Kaiji online matches (Normal Mode), wallet-based identity (no Supabase Auth user required).
-- All reads and writes go through the `kaiji` edge function (service role). Clients never touch these tables.
--
-- If you ran the earlier version of this migration, reset first (test data only):
-- drop table if exists public.kaiji_picks, public.kaiji_rounds, public.kaiji_deposits, public.kaiji_matches cascade;

create extension if not exists pgcrypto;

create table if not exists public.kaiji_matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'normal',
  status text not null default 'waiting'
    check (status in ('waiting','active','settling','settled','settle_failed')),
  wager bigint not null check (wager > 0),
  mint text not null,
  wallet_a text not null,
  wallet_b text,
  token_a text not null,
  token_b text,
  hand_a jsonb not null default '{"R":4,"P":4,"S":4}',
  hand_b jsonb not null default '{"R":4,"P":4,"S":4}',
  wins_a int not null default 0,
  wins_b int not null default 0,
  round int not null default 1,
  locked_a boolean not null default false,
  locked_b boolean not null default false,
  idle_rounds int not null default 0,
  round_deadline timestamptz,
  winner text check (winner in ('a','b')),
  outcome text check (outcome in ('win','draw','void','cancelled')),
  settle_sig text,
  payout_started_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kaiji_rounds (
  match_id uuid not null references public.kaiji_matches(id) on delete cascade,
  round int not null,
  card_a text,
  card_b text,
  result text not null check (result in ('a','b','tie','idle')),
  forfeit boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (match_id, round)
);

create table if not exists public.kaiji_picks (
  match_id uuid not null references public.kaiji_matches(id) on delete cascade,
  round int not null,
  side text not null check (side in ('a','b')),
  card text not null check (card in ('R','P','S')),
  created_at timestamptz not null default now(),
  primary key (match_id, round, side)
);

create table if not exists public.kaiji_deposits (
  sig text primary key,
  wallet text not null,
  amount bigint not null,
  match_id uuid,
  refund_sig text,
  refund_error text,
  created_at timestamptz not null default now()
);

create index if not exists kaiji_matches_status_idx on public.kaiji_matches (status, created_at);
create index if not exists kaiji_matches_token_a_idx on public.kaiji_matches (token_a);
create index if not exists kaiji_matches_token_b_idx on public.kaiji_matches (token_b);
create index if not exists kaiji_matches_wallet_a_idx on public.kaiji_matches (wallet_a);
create index if not exists kaiji_matches_wallet_b_idx on public.kaiji_matches (wallet_b);
create unique index if not exists kaiji_open_wallet_a on public.kaiji_matches (wallet_a) where status in ('waiting','active');

alter table public.kaiji_matches enable row level security;
alter table public.kaiji_rounds enable row level security;
alter table public.kaiji_picks enable row level security;
alter table public.kaiji_deposits enable row level security;

create or replace function public.kaiji_join_or_create(
  p_wallet text, p_token text, p_wager bigint, p_mint text, p_deadline timestamptz
) returns public.kaiji_matches
language plpgsql security definer set search_path = public as $$
declare m public.kaiji_matches;
begin
  select * into m from public.kaiji_matches
   where status = 'waiting' and wager = p_wager and mint = p_mint and wallet_a <> p_wallet
   order by created_at
   limit 1
   for update skip locked;

  if found then
    update public.kaiji_matches
       set wallet_b = p_wallet, token_b = p_token, status = 'active',
           round_deadline = p_deadline, updated_at = now()
     where id = m.id
     returning * into m;
  else
    insert into public.kaiji_matches (wager, mint, wallet_a, token_a)
    values (p_wager, p_mint, p_wallet, p_token)
    returning * into m;
  end if;
  return m;
end $$;

create or replace function public.kaiji_apply_round(
  p_match uuid, p_round int,
  p_hand_a jsonb, p_hand_b jsonb, p_wins_a int, p_wins_b int, p_idle int,
  p_card_a text, p_card_b text, p_result text, p_forfeit boolean,
  p_status text, p_outcome text, p_winner text, p_next_deadline timestamptz
) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.kaiji_matches
     set hand_a = p_hand_a, hand_b = p_hand_b, wins_a = p_wins_a, wins_b = p_wins_b,
         idle_rounds = p_idle, round = p_round + 1, locked_a = false, locked_b = false,
         status = p_status, outcome = p_outcome, winner = p_winner,
         round_deadline = p_next_deadline, updated_at = now()
   where id = p_match and round = p_round and status = 'active';
  get diagnostics n = row_count;
  if n = 0 then return false; end if;

  insert into public.kaiji_rounds (match_id, round, card_a, card_b, result, forfeit)
  values (p_match, p_round, p_card_a, p_card_b, p_result, p_forfeit);
  return true;
end $$;

revoke all on function public.kaiji_join_or_create(text, text, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.kaiji_apply_round(uuid, int, jsonb, jsonb, int, int, int, text, text, text, boolean, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.kaiji_join_or_create(text, text, bigint, text, timestamptz) to service_role;
grant execute on function public.kaiji_apply_round(uuid, int, jsonb, jsonb, int, int, int, text, text, text, boolean, text, text, text, timestamptz) to service_role;
```

## Game Rules

- Each player starts with 4 Rock, 4 Paper, 4 Scissors cards
- First to 3 round wins (best of 5)
- 25 seconds to pick a card per round
- If nobody joins within 45 seconds → refund
- If neither player picks in a round → idle round (2 idle rounds voids match)
- Winner gets 90% of pot, 10% fee

## Troubleshooting

### "deposit_tx_not_found"
- Edge function is looking on wrong network
- Ensure `KAIJI_RPC_URL` is set to devnet
- Verify edge function code was updated in dashboard

### "already_in_match"
- You have a stuck match in database
- Run: `node scripts/check-kaiji-matches.js <your-wallet>`
- Or run sweep cron to clear old matches

### Devnet RPC down
- Use Helius devnet: `https://devnet.helius-rpc.com/?api-key=YOUR_KEY`
- Or Ankr: `https://rpc.ankr.com/solana_devnet`

### Sweep not working
- Ensure `SWEEP_SECRET` matches in script and Supabase secrets
- Check ANON_KEY is set in sweep script
- Verify edge function is deployed

## Current Status

✅ Complete:
- Edge function deployed with devnet RPC
- Database tables created
- Secrets configured
- Sweep cron implemented
- Cancel button in UI
- Token minting script
- Match debugging tools

⏳ Pending:
- Card images in `assets/kaiji/`
- Code pasted into empty files (KaijiScreen.js, kaijiApi.js, kaijiMapping.js, kaijiGuard.js)

## Security Notes

- **Never commit**: `devnet-admin.json`, `escrow-keypair.json`, `supabase/.env.kaiji`
- These are in `.gitignore`
- `ESCROW_SECRET_KEY` should only be in Supabase secrets, not in code
- `SWEEP_SECRET` protects the sweep endpoint from unauthorized calls

## Testing

### Mint additional tokens
```bash
node scripts/mint-tokens.js <wallet-address>
```

### Check stuck matches
```bash
node scripts/check-kaiji-matches.js <wallet-address>
```

### Manual cancel (via curl)
```bash
curl -X POST 'https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/kaiji' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"action":"config"}'
```

## Production Deployment

For mainnet deployment:
1. Use mainnet RPC URL in `KAIJI_RPC_URL`
2. Deploy production token mint
3. Use real SOL for escrow funding
4. Remove `KAIJI_ALLOWED_WALLETS` to open to all
5. Set proper `MIN_WAGER` and `MAX_WAGER`
6. Use production SWEEP_SECRET
7. Set up proper cron job on server (not local script)
