import { supabase } from './supabaseClient';

// Fire-and-forget insert into the public money_events feed (DAO Governance).
// Never throws — a feed failure must not break payments.
export async function logMoneyEvent(row) {
  try {
    const { error } = await supabase.from('money_events').insert(row);
    if (error) console.warn('[money_events] insert error:', error.message, error.code);
    else console.log('[money_events] logged:', row.event_type, row.tx_sig);
  } catch (e) {
    console.warn('[money_events] client insert failed:', e?.message);
  }
}
