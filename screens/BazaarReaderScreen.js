import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Platform, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import EPUBReader from '../components/EPUBReader';
import PDFReader from '../components/PDFReader';
import { getBookFileUrl } from '../utils/bazaar';
import { createBazaarReadTracker } from '../services/bazaarReadTracker';
import { myId, getBookPosition, saveBookPosition } from '../services/bookProgress';
import { toast } from '../components/Toast';
import { useTheme } from '../context/ThemeContext';

/*
 * Reading a Bazaar book, full screen (no app bars). The file comes from a
 * short-lived private link; on phones it is kept in the cache only while the
 * book is open. It reopens where you stopped (saved on the phone and to your
 * account), and pages/time are tracked for refund reviews.
 */
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
        const [url, me] = await Promise.all([getBookFileUrl(bookId), myId()]);
        meRef.current = me;
        const pos = me ? await getBookPosition(me, bookId).catch(() => null) : null;
        const ext = isPdf ? 'pdf' : 'epub';
        let uri = url;
        if (Platform.OS !== 'web') {
          const local = `${FileSystem.cacheDirectory}bazaar-${bookId}-${Date.now()}.${ext}`;
          const dl = await FileSystem.downloadAsync(url, local);
          if (dl.status !== 200) throw new Error('The book could not be downloaded. Check your connection.');
          uri = dl.uri;
          localUriRef.current = dl.uri;
        }
        if (!alive) return;
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
    return () => {
      alive = false;
      flush();
      trackerRef.current?.close();
      trackerRef.current = null;
      if (localUriRef.current) FileSystem.deleteAsync(localUriRef.current, { idempotent: true }).catch(() => {});
    };
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('BazaarBook', { bookId }));

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
