// Web version of expo-secure-store.
// Browsers have no hardware keystore, so:
//  · wallet secrets (the unlocked key) live in sessionStorage — they're gone
//    when the tab closes, and the person unlocks again with their password;
//  · everything else (prices cache, small settings) uses localStorage.
// Wallet keys are never sent anywhere from here.
const SENSITIVE = [/^walletData$/, /^walletSecretV2$/, /^wallet-secret-/, /^cashout_links_v1$/]; // cash-out claim codes are bearer secrets
const isSensitive = (key) => SENSITIVE.some((re) => re.test(String(key)));
const store = (key) => {
  try { return isSensitive(key) ? window.sessionStorage : window.localStorage; } catch { return null; }
};

export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY';
export const ALWAYS = 'ALWAYS';
export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY';

export async function isAvailableAsync() { return true; }
export function canUseBiometricAuthentication() { return false; }

export async function getItemAsync(key) {
  try { return store(key)?.getItem(key) ?? null; } catch { return null; }
}
export function getItem(key) {
  try { return store(key)?.getItem(key) ?? null; } catch { return null; }
}
export async function setItemAsync(key, value) {
  if (typeof value !== 'string') throw new Error('SecureStore values must be strings');
  store(key)?.setItem(key, value);
  // never leave a wallet secret in localStorage from an older build
  if (isSensitive(key)) { try { window.localStorage.removeItem(key); } catch {} }
}
export function setItem(key, value) { setItemAsync(key, value); }
export async function deleteItemAsync(key) {
  try { window.sessionStorage.removeItem(key); } catch {}
  try { window.localStorage.removeItem(key); } catch {}
}
