import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

/*
 * One shared connection monitor for the whole app (a single native listener,
 * however many screens ask). `null` = not known yet.
 *
 *   const online = useOnline();          // true | false | null
 *   isOnlineNow()                         // last known value, outside React
 */
let current = null;
const subscribers = new Set();
let started = false;

const set = (value) => {
  if (value === current) return;
  current = value;
  subscribers.forEach((fn) => {
    try {
      fn(value);
    } catch {
      /* ignore */
    }
  });
};

const toOnline = (s) => {
  if (!s) return null;
  if (s.isConnected === false) return false;
  // isInternetReachable can be null while Android is still checking.
  if (s.isInternetReachable === false) return false;
  return s.isConnected === true ? true : null;
};

const start = () => {
  if (started) return;
  started = true;
  Network.getNetworkStateAsync()
    .then((s) => set(toOnline(s) ?? true))
    .catch(() => set(true));
  try {
    Network.addNetworkStateListener((s) => {
      const v = toOnline(s);
      if (v !== null) set(v);
    });
  } catch {
    /* older binaries without the listener: the initial reading still works */
  }
};

export const isOnlineNow = () => current;

/*
 * Real reachability beats the OS flag: a phone on Wi-Fi with no internet (or
 * a captive portal) reports "connected" while every request fails. The
 * Supabase client reports actual request outcomes here (services/
 * supabaseClient.js), so the whole app flips to offline mode on the first
 * failed request and back on the first successful one.
 */
export const reportRequestFailed = () => set(false);
export const reportRequestOk = () => set(true);

/*
 * While offline, screens stop making requests — so nothing would ever flip us
 * back. A tiny reachability probe (registered by the Supabase client) runs
 * every 8s until the server answers again.
 */
let probe = null;
let probeTimer = null;
export const setReachabilityProbe = (fn) => {
  probe = fn;
};
const stopProbe = () => {
  if (probeTimer) clearInterval(probeTimer);
  probeTimer = null;
};
const startProbe = () => {
  if (probeTimer || !probe) return;
  probeTimer = setInterval(async () => {
    if (current !== false) {
      stopProbe();
      return;
    }
    try {
      if (await probe()) reportRequestOk();
    } catch {
      /* still offline */
    }
  }, 8000);
};
subscribers.add((value) => (value === false ? startProbe() : stopProbe()));

export const useOnline = () => {
  const [online, setOnline] = useState(current);
  useEffect(() => {
    start();
    setOnline(current);
    subscribers.add(setOnline);
    return () => subscribers.delete(setOnline);
  }, []);
  return online;
};
