import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Platform, StyleSheet, AppState } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import EPUBReader from '../components/EPUBReader';
import PDFReader from '../components/PDFReader';
import { callBazaarFunction } from '../utils/bazaar';
import { localBook, saveBookFile, removeBookFile, markBookOpen, clearOpenBook } from '../services/bookShelf';
import { createBazaarReadTracker } from '../services/bazaarReadTracker';
import { myId, getBookPosition, saveBookPosition } from '../services/bookProgress';
import { toast } from '../components/Toast';
import { useTheme } from '../context/ThemeContext';

/*
 * Reading a Bazaar book, full screen (no app bars), like a dedicated e-reader:
 *  · the book is kept on the phone after the first open — instant and offline next time; access is
 *    re-checked whenever you're online, and the copy is removed if it has ended (e.g. a loan);
 *  · it reopens exactly where you stopped (saved on the phone and to your account, and saved the
 *    moment the app goes to the background);
 *  · if you leave the app while reading, the app reopens straight into this book next time.
 * Pages/time are tracked for refund reviews.
 */
const ACCESS_TIMEOUT_MS = 6000;

/** { url } when allowed · { denied: message } when access has ended · throws when offline. */
async function checkAccess(bookId) {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('offline')), ACCESS_TIMEOUT_MS));
  const res = await Promise.race([callBazaarFunction('get-bazaar-book-url', { bookId }), timeout]);
  if (res.ok && res.data?.url) return { url: res.data.url };
  // Only the server's clear "access has ended" answers remove the copy on the phone. Anything else
  // (expired login, paused book, server trouble) just means "read the saved copy for now".
  const msg = String(res.data?.error || '');
  if ((res.status === 403 && /access/i.test(msg)) || (res.status === 404 && /book not found/i.test(msg))) {
    return { denied: msg || 'You no longer have access to this book.' };
  }
  throw new Error(msg || 'offline');
}
const SAVE_EVERY_MS = 1500;

export default function BazaarReaderScreen() {
  const navigation = useNavigation();
  const { params = {} } = useRoute();
  const { bookId, title, fileType, fileName, purchaseId, userId, walletAddress } = params;
  const isPdf = fileType === 'pdf';
  const { colors } = useTheme();
  const [file, setFile] = useState(null);
  const [startPos, setStartPos] = useState(null);
  const [error, setError] = useState(null);
  const trackerRef = useRef(null);
  const localUriRef = useRef(null);
  const meRef = useRef(null);
  const latestRef = useRef(null); // newest position, waiting to be saved
  const savedPctRef = useRef(0);
  const timerRef = useRef(null);
  const offlineRef = useRef(false);

  const flush = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (latestRef.current && meRef.current) {
      saveBookPosition(meRef.current, bookId, latestRef.current);
      latestRef.current = null;
    }
  };
  const queueSave = (pos) => {
    latestRef.current = pos;
    if (!timerRef.current) timerRef.current = setTimeout(flush, SAVE_EVERY_MS);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ext = isPdf ? 'pdf' : 'epub';
        const me = await myId();
        meRef.current = me;
        const [pos, local] = await Promise.all([
          me ? getBookPosition(me, bookId).catch(() => null) : null,
          localBook(bookId, ext),
        ]);
        let access = null;
        try {
          access = await checkAccess(bookId);
        } catch {
          offlineRef.current = true; // offline: read the copy on the phone if there is one
        }
        if (access?.denied) {
          await removeBookFile(bookId);
          throw new Error(access.denied);
        }
        let uri = local;
        if (!uri) {
          if (!access?.url) throw new Error("This book isn't saved on your phone yet, and it couldn't be downloaded right now. Check your connection and try again.");
          uri = await saveBookFile(bookId, ext, access.url); // web: just the link
        }
        if (!alive) return;
        localUriRef.current = uri;
        markBookOpen({ bookId, title, fileType, fileName, purchaseId: purchaseId || null, userId: userId || me || null, walletAddress: walletAddress || null });
        trackerRef.current = createBazaarReadTracker({
          purchaseId: purchaseId || null,
          bookId,
          userId: userId || me || null,
          walletAddress: walletAddress || null,
          fileType,
        });
        if (pos && pos.kind === (isPdf ? 'pdf' : 'epub') && pos.pct > 0.5) {
          savedPctRef.current = pos.pct / 100;
          setStartPos(pos);
          toast.info(`Picked up where you left off · ${Math.round(pos.pct)}%`);
        }
        setFile({ uri, name: fileName || `${title || 'book'}.${ext}` });
      } catch (e) {
        if (alive) setError(e?.message || 'The book could not be opened.');
      }
    })();
    // Save the exact spot the moment the app goes to the background (it may never come back).
    const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') flush(); });
    return () => {
      alive = false;
      sub.remove();
      flush();
      trackerRef.current?.close();
      trackerRef.current = null;
    };
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    clearOpenBook(); // closed on purpose: don't reopen it on the next launch
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('BazaarBook', { bookId });
  };

  if (error) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
        <Text style={[s.msg, { color: colors.textSecondary }]}>{error}</Text>
        <Pressable onPress={close} style={[s.btn, { backgroundColor: colors.accent }]} accessibilityRole="button">
          <Text style={s.btnText}>Back to the book</Text>
        </Pressable>
      </View>
    );
  }
  if (!file) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[s.msg, { color: colors.textMuted }]}>Getting your book…</Text>
      </View>
    );
  }
  return isPdf ? (
    <PDFReader
      file={file}
      title={title}
      onBack={close}
      startPage={startPos?.page || 1}
      onProgress={({ page, total }) => {
        trackerRef.current?.recordPage(page, total);
        // The web's PDF viewer can't report page turns — don't overwrite the
        // phone's saved page with "page 1" there.
        if (Platform.OS === 'web' || !total) return;
        queueSave({ kind: 'pdf', page, pct: total > 1 ? (page - 1) / (total - 1) : 1 });
      }}
    />
  ) : (
    <EPUBReader
      file={file}
      title={title}
      onBack={close}
      startAt={startPos?.cfi || null}
      onProgress={({ index, total, cfi, pct }) => {
        trackerRef.current?.recordPage(index + 1, total);
        if (typeof pct === 'number') savedPctRef.current = pct;
        // Until the whole book is measured, keep the last known percent.
        if (cfi) queueSave({ kind: 'epub', cfi, chapterIndex: index, pct: savedPctRef.current });
      }}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  msg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: { paddingHorizontal: 22, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
