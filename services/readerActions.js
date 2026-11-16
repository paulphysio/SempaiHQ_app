import { supabase } from './supabaseClient';

/**
 * Call the reader-actions edge function (supabase/functions/reader-actions).
 * Things that give points, access or notify other people are decided on the
 * server — the app only asks. Never throws: returns { ok, error, status, ...data }.
 */
export async function readerAction(action, params = {}) {
  try {
    const { data, error } = await supabase.functions.invoke('reader-actions', {
      body: { action, ...params },
    });
    if (error) {
      let message = error.message || 'Request failed';
      let status = 0;
      try {
        const res = error.context;
        status = res?.status || 0;
        const body = await res?.json?.();
        if (body?.error) message = body.error;
      } catch {}
      return { ok: false, error: message, status };
    }
    return { ok: true, ...(data || {}) };
  } catch (e) {
    return { ok: false, error: e?.message || String(e), status: 0 };
  }
}
