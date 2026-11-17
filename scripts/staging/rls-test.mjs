// ════════════════════════════════════════════════════════════════════════
// Phase 3 rule tests — runs ONLY against the TEST project.
//
//   node scripts/staging/rls-test.mjs          (add --keep to leave test data)
//
// Needs scripts/staging/.env.staging.local with:
//   STAGING_URL=https://<test-ref>.supabase.co
//   STAGING_ANON_KEY=...
//   STAGING_SERVICE_KEY=...
//
// Creates Alice (reader), Bob (writer), Carol (admin) and their content, then
// checks every allowed action works and every attack is refused.
// ════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@solana/web3.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.join(here, '.env.staging.local'), 'utf8').split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const { STAGING_URL: URL_, STAGING_ANON_KEY: ANON, STAGING_SERVICE_KEY: SERVICE } = env;
if (!URL_ || !ANON || !SERVICE) throw new Error('Fill STAGING_URL, STAGING_ANON_KEY, STAGING_SERVICE_KEY in .env.staging.local');
if (URL_.includes('xqeimsncmnqsiowftdmz')) throw new Error('STAGING_URL is PRODUCTION — refusing to run.');

const KEEP = process.argv.includes('--keep');
const run = Date.now().toString(36);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SERVICE, opts);
const anon = createClient(URL_, ANON, opts);

// ── people ────────────────────────────────────────────────────────────────
async function person(name, extra = {}) {
  const email = `${name}.${run}@test.sempaihq.dev`;
  const password = `T3st!${run}${name}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`create ${name}: ${error.message}`);
  const id = data.user.id;
  const wallet = Keypair.generate().publicKey.toBase58();
  const { error: uErr } = await admin.from('users').upsert({ id, email, name: `${name}-${run}`, wallet_address: wallet, ...extra });
  if (uErr) throw new Error(`users row ${name}: ${uErr.message}`);
  const client = createClient(URL_, ANON, opts);
  const { data: s, error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw new Error(`sign in ${name}: ${sErr.message}`);
  return { name, id, email, wallet, client, token: s.session.access_token };
}

// ── checks ────────────────────────────────────────────────────────────────
const results = [];
const ok = (r) => !r.error && (r.data === undefined || r.data === null || !Array.isArray(r.data) || r.data.length > 0);
async function check(area, label, expectAllowed, fn) {
  let r;
  try { r = await fn(); } catch (e) { r = { error: { message: e.message } }; }
  const allowed = ok(r);
  const pass = allowed === expectAllowed;
  results.push({ area, label, expect: expectAllowed ? 'allowed' : 'refused', got: allowed ? 'allowed' : 'refused', pass,
    note: r.error?.message?.slice(0, 90) || '' });
}
const fn = async (who, action, params = {}) => {
  const res = await fetch(`${URL_}/functions/v1/reader-actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${who?.token || ANON}` },
    body: JSON.stringify({ action, ...params }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok && !body.error ? { data: body } : { error: { message: `${res.status} ${body.error || ''}` } };
};
const seed = async (table, row) => {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) { console.warn(`  (seed ${table} failed: ${error.message})`); return null; }
  return data;
};

// ── run ───────────────────────────────────────────────────────────────────
console.log(`\nPhase 3 rule tests on ${URL_} (run ${run})\n`);
const alice = await person('alice');
const bob = await person('bob', { isWriter: true, isArtist: true });
const carol = await person('carol', { isSuperuser: true });
const created = { users: [alice, bob, carol] };

const novel = await seed('novels', { title: `Test novel ${run}`, user_id: bob.id, summary: 'test', chaptertitles: ['One', 'Two'], chaptercontents: { 1: 'a', 2: 'b' } });
const manga = await seed('manga', { title: `Test manga ${run}`, user_id: bob.id });
const mch = manga && await seed('manga_chapters', { manga_id: manga.id, chapter_number: 1, title: 'MC1' });
const mpage = mch && await seed('manga_pages', { chapter_id: mch.id, page_number: 1, image_url: 'https://example.com/p1.png' });
const bobComment = novel && await seed('comments', { novel_id: novel.id, user_id: bob.id, username: 'bob', content: 'bob comment' });
const bobNote = await seed('notifications', { user_id: bob.id, type: 'test', message: 'for bob', is_read: false });
const pm = await seed('private_messages', { sender_wallet: bob.wallet, recipient_wallet: carol.wallet, content: 'secret' });
await seed('reading_progress', { user_id: bob.id, content_type: 'novel', content_id: novel?.id || 'x', chapter_key: '1', chapter_number: 1, scroll_pct: 10 });
await seed('wallet_balances', { user_id: alice.id, wallet_address: alice.wallet, chain: 'SOL', currency: 'SMP', amount: 100, decimals: 0 });
await seed('user_wallets', { user_id: alice.id, address: alice.wallet, private_key: 'encrypted-test-key-alice' });
await seed('user_wallets', { user_id: bob.id, address: bob.wallet, private_key: 'encrypted-test-key-bob' });
const A = alice.client, B = bob.client, C = carol.client;

// novels / manga (creator content)
await check('Novels', 'anyone can read novels', true, () => anon.from('novels').select('id').eq('id', novel?.id));
await check('Novels', 'reader edits a writer\'s novel', false, () => A.from('novels').update({ title: 'hacked' }).eq('id', novel?.id).select());
await check('Novels', 'writer edits own novel', true, () => B.from('novels').update({ summary: 'edited' }).eq('id', novel?.id).select());
await check('Novels', 'admin edits any novel', true, () => C.from('novels').update({ summary: 'moderated' }).eq('id', novel?.id).select());
await check('Novels', 'reader deletes a writer\'s novel', false, () => A.from('novels').delete().eq('id', novel?.id).select());
await check('Novels', 'reader creates a novel in a writer\'s name', false, () => A.from('novels').insert({ title: 'fake', user_id: bob.id }).select());
await check('Novels', 'public (no sign-in) edits a novel', false, () => anon.from('novels').update({ title: 'x' }).eq('id', novel?.id).select());
await check('Manga', 'reader adds a chapter to a writer\'s manga', false, () => A.from('manga_chapters').insert({ manga_id: manga?.id, chapter_number: 9, title: 'x' }).select());
await check('Manga', 'artist adds a chapter to own manga', true, () => B.from('manga_chapters').insert({ manga_id: manga?.id, chapter_number: 2, title: 'MC2' }).select());
await check('Manga', 'public reads paid manga pages directly', false, () => anon.from('manga_pages').select('id').eq('id', mpage?.id));
await check('Manga', 'artist manages own pages', true, () => B.from('manga_pages').update({ page_number: 1 }).eq('id', mpage?.id).select());
await check('Manga', 'reader deletes a writer\'s manga (direct)', false, () => A.from('manga').delete().eq('id', manga?.id).select());

// comments
await check('Comments', 'reader posts own comment', true, () => A.from('comments').insert({ novel_id: novel?.id, user_id: alice.id, username: 'alice', content: 'nice' }).select());
await check('Comments', 'reader posts as someone else', false, () => A.from('comments').insert({ novel_id: novel?.id, user_id: bob.id, username: 'bob', content: 'fake' }).select());
await check('Comments', 'reader edits someone else\'s comment', false, () => A.from('comments').update({ content: 'hacked' }).eq('id', bobComment?.id).select());
await check('Comments', 'admin removes any comment', true, () => C.from('comments').update({ content: '[moderated]' }).eq('id', bobComment?.id).select());

// money & balances
await check('Money', 'reader reads balances', true, () => A.from('wallet_balances').select('amount').eq('user_id', alice.id));
await check('Money', 'reader raises own balance', false, () => A.from('wallet_balances').update({ amount: 999999 }).eq('user_id', alice.id).select());
await check('Money', 'reader creates a balance row', false, () => A.from('wallet_balances').insert({ user_id: alice.id, wallet_address: alice.wallet, chain: 'X', currency: 'SMP', amount: 1 }).select());
await check('Money', 'reader records a fake chapter payment', false, () => A.from('chapter_payments').insert({ wallet_address: alice.wallet, novel_id: novel?.id, chapter_number: 2, payment_type: 'SINGLE', currency: 'SMP', amount: 0, transaction_id: `fake-${run}` }).select());
await check('Money', 'reader grants self a writer subscription', false, () => A.from('writer_subscriptions').insert({ benefactor_wallet: alice.wallet, writer_id: bob.id, plan_type: 'gold', chapters_unlocked: 999, chapters_remaining: 999, is_active: true }).select());
await check('Money', 'reader awards self a badge', false, () => A.from('user_badges').insert({ user_id: alice.id, badge_id: '00000000-0000-0000-0000-000000000000' }).select());
await check('Money', 'reader changes app settings', false, () => A.from('settings').update({ value: 'x' }).eq('key', 'weekly_reward_timer').select());
await check('Money', 'reader calls award_points', false, () => A.rpc('award_points', { p_user_id: alice.id, p_points: 1000, p_points_type: 'x', p_reference_id: 'x', p_metadata: {} }));

// users / profile
await check('Profile', 'reader edits own name', true, () => A.from('users').update({ name: `alice2-${run}` }).eq('id', alice.id).select());
await check('Profile', 'reader edits own balance column', false, () => A.from('users').update({ balance: 999999 }).eq('id', alice.id).select());
await check('Profile', 'reader edits own weekly points', false, () => A.from('users').update({ weekly_points: 999999 }).eq('id', alice.id).select());
await check('Profile', 'reader edits someone else\'s profile', false, () => A.from('users').update({ name: 'hacked' }).eq('id', bob.id).select());
await check('Profile', 'reader deletes a user', false, () => A.from('users').delete().eq('id', bob.id).select());
{
  await A.from('users').update({ isSuperuser: true }).eq('id', alice.id);
  const { data } = await admin.from('users').select('isSuperuser').eq('id', alice.id).single();
  results.push({ area: 'Profile', label: 'reader makes self admin', expect: 'refused', got: data?.isSuperuser ? 'allowed' : 'refused', pass: !data?.isSuperuser, note: '' });
}

// wallets
await check('Wallets', 'public reads stored keys', false, () => anon.from('user_wallets').select('private_key').limit(1));
await check('Wallets', 'reader reads stored keys directly', false, () => A.from('user_wallets').select('private_key').eq('user_id', alice.id));
{
  const { data, error } = await A.rpc('get_my_wallet_key', {});
  const own = !error && Array.isArray(data) && data.length > 0 && data.every((r) => r.address === alice.wallet);
  results.push({ area: 'Wallets', label: 'reader gets OWN key via owner-only route', expect: 'allowed', got: own ? 'allowed' : 'refused', pass: own, note: error?.message || '' });
}
await check('Wallets', 'reader saves a wallet for someone else', false, () => A.from('user_wallets').insert({ user_id: bob.id, address: Keypair.generate().publicKey.toBase58(), private_key: 'x' }).select('id'));

// private data
await check('Private', 'reader reads someone else\'s notifications', false, () => A.from('notifications').select('id').eq('id', bobNote?.id));
await check('Private', 'reader sends a notification directly', false, () => A.from('notifications').insert({ user_id: bob.id, type: 'x', message: 'spam' }).select());
await check('Private', 'writer reads own notifications', true, () => B.from('notifications').select('id').eq('id', bobNote?.id));
await check('Private', 'reader reads others\' private messages', false, () => A.from('private_messages').select('id').eq('id', pm?.id));
await check('Private', 'reader sends a DM as own wallet', true, () => A.from('private_messages').insert({ sender_wallet: alice.wallet, recipient_wallet: bob.wallet, content: 'hi' }).select());
await check('Private', 'reader sends a DM as someone else', false, () => A.from('private_messages').insert({ sender_wallet: bob.wallet, recipient_wallet: carol.wallet, content: 'fake' }).select());
await check('Private', 'reader reads others\' reading progress', false, () => A.from('reading_progress').select('id').eq('user_id', bob.id));
await check('Private', 'reader saves own reading progress', true, () => A.from('reading_progress').insert({ user_id: alice.id, content_type: 'novel', content_id: novel?.id || 'x', chapter_key: '1', chapter_number: 1, scroll_pct: 50 }).select());

// creator/admin tools
await check('Tools', 'reader adds a GIF', false, () => A.from('gifs').insert({ title: 'x', url: 'https://example.com/x.gif' }).select());
await check('Tools', 'admin adds a GIF', true, () => C.from('gifs').insert({ title: `t-${run}`, url: 'https://example.com/t.gif' }).select());
await check('Tools', 'author uploads a Bazaar book with 100% share', false, () => A.from('bazaar_books').insert({ author_id: alice.id, title: 'x', price_usd: 1, author_share_pct: 100, lend_price_smp: 12500, status: 'active' }).select());
await check('Tools', 'author uploads a Bazaar book at official terms', true, () => A.from('bazaar_books').insert({ author_id: alice.id, title: `bk-${run}`, price_usd: 1, author_share_pct: 70, lend_price_smp: 12500, status: 'active' }).select());
await check('Tools', 'public sends a support request', true, () => anon.from('support_requests').insert({ name: 'x', email: 'x@x.x', subject: 's', message: 'm' }));
await check('Tools', 'reader reads support requests', false, () => A.from('support_requests').select('id').limit(1));
await check('Tools', 'reader approves own creator application', false, () => A.from('creator_applications').update({ application_status: 'approved' }).eq('user_id', alice.id).select());

// server actions (reader-actions edge function)
await check('Server', 'public (no sign-in) claims a referral bonus', false, () => fn(null, 'referral_bonus'));
{
  const { data: c } = await A.from('comments').insert({ novel_id: novel?.id, user_id: alice.id, username: 'alice', content: 'great chapter' }).select().single();
  await check('Server', 'reader earns points for own comment', true, () => fn(alice, 'comment_reward', { table: 'comments', commentId: c?.id }));
  await check('Server', 'reader claims points for someone else\'s comment', false, () => fn(alice, 'comment_reward', { table: 'comments', commentId: bobComment?.id }));
}
await check('Server', 'first free ad unlock today', true, () => fn(alice, 'ad_unlock', { novelId: novel?.id, chapterNumber: 2, walletAddress: alice.wallet }));
await check('Server', 'second free ad unlock same day', false, () => fn(alice, 'ad_unlock', { novelId: novel?.id, chapterNumber: 2, walletAddress: alice.wallet }));
await check('Server', 'reader notifies a writer\'s readers', false, () => fn(alice, 'notify_readers', { kind: 'novel', contentId: novel?.id, message: 'spam' }));
await check('Server', 'writer notifies own readers', true, () => fn(bob, 'notify_readers', { kind: 'novel', contentId: novel?.id, title: 'New chapter', body: 'Ch 2 is out', type: 'new_chapter' }));
await check('Server', 'reader deletes a writer\'s manga (server)', false, () => fn(alice, 'delete_title', { kind: 'manga', id: manga?.id }));
await check('Server', 'reader applies as writer (instant)', true, () => fn(alice, 'apply_creator', { role: 'writer', name: 'alice', email: alice.email, reason: 'I write' }));
await check('Server', 'writer deletes own manga (server)', true, () => fn(bob, 'delete_title', { kind: 'manga', id: manga?.id }));

// ── report ────────────────────────────────────────────────────────────────
let lastArea = '';
for (const r of results) {
  if (r.area !== lastArea) { console.log(`\n${r.area}`); lastArea = r.area; }
  console.log(`  ${r.pass ? '✓' : '✗ WRONG'}  ${r.label.padEnd(52)} expected ${r.expect.padEnd(7)} got ${r.got}${!r.pass && r.note ? `  (${r.note})` : ''}`);
}
const bad = results.filter((r) => !r.pass);
console.log(`\n${results.length - bad.length}/${results.length} behave correctly${bad.length ? ` — ${bad.length} WRONG (see ✗ above)` : ' ✓'}\n`);

if (!KEEP) {
  for (const p of created.users) await admin.auth.admin.deleteUser(p.id).catch(() => {});
  console.log('Test accounts removed (run with --keep to leave them).');
}
process.exit(bad.length ? 1 : 0);
