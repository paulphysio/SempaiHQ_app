# Bazaar v2: deploy guide + remaining screen edits

Replace these files wholesale (already in this folder):
- `migrations/20261112_bazaar_v2.sql`  (use INSTEAD of the old migration)
- `supabase/functions/_shared/{auth,verify}.ts`  (new)
- `supabase/functions/{purchase-bazaar-book,request-bazaar-refund}/index.ts`  (replace)
- `supabase/functions/{resolve-bazaar-refund,get-bazaar-book-url}/index.ts`  (new)
- `utils/bazaar.js`, `screens/BazaarBookScreen.js`  (replace)

Then apply the three small edits below.

## 1. `screens/UploadBookScreen.js`  (4 edits)

a) Path (own-folder rule needs `<userId>/` first):
```diff
-      const filePath = `books/${user.id}/${timestamp}-${safeName}`;
+      const filePath = `${user.id}/${timestamp}-${safeName}`;
```
b) Delete this line entirely (the bucket is private now, there is no public URL):
```js
      const fileUrl = supabase.storage.from('bazaar-books').getPublicUrl(filePath).data.publicUrl;
```
c) Covers go to the public covers bucket. In the `if (cover) { ... }` block:
```diff
-        const coverPath = `covers/${user.id}/${timestamp}-cover.jpg`;
+        const coverPath = `${user.id}/${timestamp}-cover.jpg`;
         const { error: coverError } = await supabase.storage
-          .from('bazaar-books')
+          .from('bazaar-covers')
           .upload(coverPath, cover.arrayBuffer, { contentType: 'image/jpeg', upsert: false });
         if (!coverError) {
-          coverUrl = supabase.storage.from('bazaar-books').getPublicUrl(coverPath).data.publicUrl;
+          coverUrl = supabase.storage.from('bazaar-covers').getPublicUrl(coverPath).data.publicUrl;
```
d) In the `bazaar_books` insert: `file_url: fileUrl,`  ->  `file_path: filePath,`

e) Button was not actually disabled when no mode is selected:
```diff
-          disabled={uploading}
+          disabled={uploading || (!ownRights && !allowLending)}
```

## 2. `screens/BazaarScreen.js`  (1 edit)
In `renderBook`, the last branch of the left-hand badge ternary renders a duplicate file-type badge.
Replace that third branch:
```diff
-          ) : (
-            <View style={styles.typeBadge}>
-              <Text style={styles.typeText}>{item.file_type}</Text>
-            </View>
-          )}
+          ) : (
+            <View />
+          )}
```
(Leave the right-hand file-type badge after it as is.)

## 3. `screens/BazaarDashboardScreen.js`  (3 edits)

a) Add import: `import { resolveRefund } from '../utils/bazaar';`

b) Replace everything from the comment `// Refund requests involving me ...` through the
`setRefunds(involved.map(...));` call with:
```js
      // Refund requests: scoped to my books + my own purchases (admins see all)
      const myPurchaseIds = new Set();
      if (bookIds.length > 0) {
        const { data: bookPurchases } = await supabase.from('bazaar_purchases').select('id').in('book_id', bookIds);
        (bookPurchases || []).forEach((p) => myPurchaseIds.add(p.id));
      }
      const { data: myBuys } = await supabase
        .from('bazaar_purchases')
        .select('id')
        .or(`buyer_id.eq.${userData.id},buyer_wallet.eq.${userData.wallet_address}`);
      (myBuys || []).forEach((p) => myPurchaseIds.add(p.id));

      let refundQuery = supabase
        .from('bazaar_refund_requests')
        .select('id, purchase_id, requester_role, reason, status, created_at, purchase:bazaar_purchases(book_id, book:bazaar_books(title))')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!userData.isSuperuser) {
        refundQuery = refundQuery.in(
          'purchase_id',
          myPurchaseIds.size ? [...myPurchaseIds] : ['00000000-0000-0000-0000-000000000000']
        );
      }
      const { data: refundRows } = await refundQuery;
      setRefunds(
        (refundRows || []).map((r) => {
          const p = Array.isArray(r.purchase) ? r.purchase[0] : r.purchase;
          const b = Array.isArray(p?.book) ? p.book[0] : p?.book;
          return { ...r, bookTitle: b?.title || 'A book' };
        })
      );
```

c) Add this handler above `renderRefunds`, and the buttons block inside each refund row (right after the status pill `</View>`):
```js
  const handleResolve = (refundId, action) => {
    const approve = action === 'approve';
    Alert.alert(
      approve ? 'Approve refund?' : 'Reject refund?',
      approve ? 'Access is revoked. You must send the on-chain refund manually.' : 'The buyer keeps access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approve ? 'Approve' : 'Reject',
          style: approve ? 'destructive' : 'default',
          onPress: async () => {
            const res = await resolveRefund(refundId, action);
            Alert.alert(res.ok ? 'Done' : 'Error', res.data?.message || res.data?.error || '');
            load();
          },
        },
      ]
    );
  };
```
```jsx
            {isAdmin && r.status === 'pending' && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.tab, { borderColor: BAZAAR_COLORS.success }]} onPress={() => handleResolve(r.id, 'approve')}>
                  <Text style={[styles.tabText, { color: BAZAAR_COLORS.success }]}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, { borderColor: BAZAAR_COLORS.danger }]} onPress={() => handleResolve(r.id, 'reject')}>
                  <Text style={[styles.tabText, { color: BAZAAR_COLORS.danger }]}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
```

## Deploy order (do all of it together)
1. Check the folder policy assumption: `select count(*) filter (where a.id is not null) as matched, count(*) as total from users u left join auth.users a on a.id = u.id;`
   `matched` must equal `total` for users who will upload (uploads are limited to `<auth uid>/...`).
2. Run `20261112_bazaar_v2.sql` in the SQL editor.
   THEN run `20261112_app_rls_policies.sql` — the bazaar tables (and
   reading_time_sessions / pioneer_creators) have RLS enabled and need these
   policies or the app can't read/write them with the anon key.
   (Functions are single-file now: paste each `index.ts` into the dashboard, no
   `_shared/` imports.)
3. `supabase functions deploy purchase-bazaar-book request-bazaar-refund resolve-bazaar-refund get-bazaar-book-url`
   (keep JWT verification ON, don't pass `--no-verify-jwt`). Optional: `supabase secrets set SOLANA_RPC_URL=...`
4. Ship the app update. App builds WITHOUT the memo can no longer buy (server requires it), so release the app
   with the functions, not after.
5. Test with tiny real payments: upload a PDF, buy it with USDC from a second wallet, then SOL, then lend (SMP),
   read each, request a refund, approve/reject it from an admin account.

## Tests
`node --experimental-strip-types --experimental-detect-module tests/verify.test.mjs`
