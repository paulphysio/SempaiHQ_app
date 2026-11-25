// Unread private messages for the Chats button badge. Live: a realtime subscription to this person's
// incoming messages, plus refreshes on screen change, app foreground and every 30 s as a fallback.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabaseClient';
import { myId } from './chat';

export async function unreadDmCount() {
  const me = await myId();
  if (!me) return 0;
  const { count, error } = await supabase
    .from('private_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', me)
    .is('read_at', null);
  return error ? 0 : count || 0;
}

/** `refreshKey` (e.g. the current route) triggers a recount when it changes. */
export function useUnreadDms(refreshKey) {
  const [count, setCount] = useState(0);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const n = await unreadDmCount();
      if (alive.current) setCount(n);
    } catch { /* keep the last count */ }
  }, []);

  useEffect(() => {
    alive.current = true;
    let channel = null;
    refresh();
    myId().then((me) => {
      if (!me || !alive.current) return;
      channel = supabase
        .channel(`dm-unread-${me}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'private_messages', filter: `recipient_id=eq.${me}` }, refresh)
        .subscribe();
    });
    const t = setInterval(refresh, 30000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const auth = supabase.auth.onAuthStateChange(() => refresh());
    return () => {
      alive.current = false;
      clearInterval(t);
      sub.remove();
      auth?.data?.subscription?.unsubscribe?.();
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  useEffect(() => { refresh(); }, [refreshKey, refresh]);
  return count;
}
