import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, Platform, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import EPUBReader from '../components/EPUBReader';
import PDFReader from '../components/PDFReader';
import { getBookFileUrl } from '../utils/bazaar';
import { createBazaarReadTracker } from '../services/bazaarReadTracker';
import { useTheme } from '../context/ThemeContext';

/*
 * Reading a Bazaar book, full screen (no app bars). The file comes from a
 * short-lived private link; on phones it is kept in the cache only while the
 * book is open. Pages/time are tracked for refund reviews.
 */
export default function BazaarReaderScreen() {
  const navigation = useNavigation();
  const { params = {} } = useRoute();
  const { bookId, title, fileType, fileName, purchaseId, userId, walletAddress } = params;
  const { colors } = useTheme();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const trackerRef = useRef(null);
  const localUriRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = await getBookFileUrl(bookId);
        const ext = fileType === 'pdf' ? 'pdf' : 'epub';
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
          userId: userId || null,
          walletAddress: walletAddress || null,
          fileType,
        });
        setFile({ uri, name: fileName || `${title || 'book'}.${ext}` });
      } catch (e) {
        if (alive) setError(e?.message || 'The book could not be opened.');
      }
    })();
    return () => {
      alive = false;
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
  return fileType === 'pdf' ? (
    <PDFReader
      file={file}
      title={title}
      onBack={close}
      onProgress={({ page, total }) => trackerRef.current?.recordPage(page, total)}
    />
  ) : (
    <EPUBReader
      file={file}
      title={title}
      onBack={close}
      onProgress={({ index, total }) => trackerRef.current?.recordPage(index + 1, total)}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  msg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: { paddingHorizontal: 22, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
