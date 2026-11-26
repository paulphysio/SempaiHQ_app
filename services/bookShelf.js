// Books kept on the phone + "the book that was open when the app closed".
//
// Like a dedicated e-reader (Lithium etc.): a Bazaar book you open is kept in the app's private
// storage, so it reopens instantly and offline. Access is still checked every time you open it
// (when online); if access has ended (e.g. a borrowed book's loan) the copy is removed.
// If you leave the app while reading, it reopens straight into that book at your page.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}books/` : null;
const OPEN_KEY = 'reader:openBook';

export const localBookPath = (bookId, ext) => (DIR ? `${DIR}${bookId}.${ext}` : null);

export async function localBook(bookId, ext) {
  if (Platform.OS === 'web' || !DIR) return null;
  const path = localBookPath(bookId, ext);
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && info.size > 0 ? path : null;
  } catch {
    return null;
  }
}

export async function saveBookFile(bookId, ext, url) {
  if (Platform.OS === 'web' || !DIR) return url;
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  const path = localBookPath(bookId, ext);
  const tmp = `${path}.part`;
  const dl = await FileSystem.downloadAsync(url, tmp);
  if (dl.status !== 200) {
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    throw new Error('The book could not be downloaded. Check your connection.');
  }
  await FileSystem.moveAsync({ from: tmp, to: path });
  return path;
}

export async function removeBookFile(bookId) {
  if (Platform.OS === 'web' || !DIR) return;
  for (const ext of ['epub', 'pdf']) await FileSystem.deleteAsync(localBookPath(bookId, ext), { idempotent: true }).catch(() => {});
}

/** Remember the open book (its reader params) so the app can reopen it next launch. */
export const markBookOpen = (params) => AsyncStorage.setItem(OPEN_KEY, JSON.stringify({ ...params, at: Date.now() })).catch(() => {});
export const clearOpenBook = () => AsyncStorage.removeItem(OPEN_KEY).catch(() => {});
export async function getOpenBook() {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(OPEN_KEY)) || 'null');
    return v?.bookId ? v : null;
  } catch {
    return null;
  }
}
