/*
 * Shows the "Secure my wallet" flow:
 *   · automatically, when a signed-in user's stored wallet is still in the
 *     old (server-only) format — those keys must be treated as stolen;
 *   · on demand, via openSecureWalletFlow('create' | 'restore' | 'upgrade').
 * "Not now" hides it until the next app open.
 */
import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { isV2 } from '../../services/walletVault';
import { SECURE_WALLET_EVENT } from '../ConnectButtonEnhanced';
import SecureWalletFlow from './SecureWalletFlow';

export default function WalletSecurityGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('create');
  const [dismissedFor, setDismissedFor] = useState(null);

  // On demand
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(SECURE_WALLET_EVENT, ({ mode: m } = {}) => {
      setMode(m || 'create');
      setOpen(true);
    });
    return () => sub.remove();
  }, []);

  // Automatic: old-format stored wallet → upgrade
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || user.isGuest || !user.id || dismissedFor === user.id) return;
      try {
        const { data: rows, error } = await supabase.rpc('get_my_wallet_key', {});
        if (cancelled || error || !Array.isArray(rows) || !rows.length) return;
        if (!isV2(rows[0].private_key)) {
          setMode('upgrade');
          setOpen(true);
        }
      } catch {
        // offline or not available — try again next open
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, dismissedFor]);

  return (
    <SecureWalletFlow
      visible={open}
      mode={mode}
      onClose={() => {
        setOpen(false);
        if (mode === 'upgrade' && user?.id) setDismissedFor(user.id);
      }}
      onDone={() => setDismissedFor(user?.id || null)}
    />
  );
}
