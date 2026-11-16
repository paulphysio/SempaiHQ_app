import { readerAction } from './readerActions';

// Fire-and-forget entry in the public money_events feed (DAO Governance).
// The server (reader-actions → money_event) only logs it if `tx_sig` is a
// real transaction signed by one of the caller's own wallets.
// Never throws — a feed failure must not break payments.
export async function logMoneyEvent(row) {
  try {
    const res = await readerAction('money_event', row || {});
    if (!res.ok) console.warn('[money_events] not logged:', res.error);
  } catch (e) {
    console.warn('[money_events] failed:', e?.message);
  }
}
