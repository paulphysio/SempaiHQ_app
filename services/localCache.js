import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Last-known-good screen data, kept on the device so screens still open
 * offline (Home rows, libraries, novel pages, reading positions…).
 * Never throws.
 *
 *   await cacheSet('home:novels', list);
 *   const hit = await cacheGet('home:novels');   // { value, savedAt } | null
 */
const PREFIX = 'sempai_cache:';

export const cacheSet = async (key, value) => {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch (e) {
    console.warn('[localCache] set failed:', key, e?.message || e);
  }
};

export const cacheGet = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && 'value' in parsed ? parsed : null;
  } catch {
    return null;
  }
};

/** Value only (or `fallback`). */
export const cacheValue = async (key, fallback = null) => {
  const hit = await cacheGet(key);
  return hit ? hit.value : fallback;
};
