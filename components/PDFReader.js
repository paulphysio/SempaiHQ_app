import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Pressable, Platform } from 'react-native';
import Pdf from 'react-native-pdf';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ReaderShell from './reader/ReaderShell';

/*
 * PDF reader: pages scroll top to bottom, each fitted to the screen width
 * (pinch to zoom in on a page). Page counter, jump to start, full screen.
 * On the web the browser's own PDF viewer does the scrolling.
 */
// startPage: reopen at this page. onProgress({ page, total }).
const PDFReader = ({ file, title, onBack, onProgress, startPage = 1 }) => {
  const { colors, isDark } = useTheme();
  const [page, setPage] = useState(startPage || 1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const pdfRef = useRef(null);
  const isWeb = Platform.OS === 'web';

  const pct = total > 1 ? (page - 1) / (total - 1) : total === 1 ? 1 : null;

  return (
    <ReaderShell
      title={title || file?.name || 'Book'}
      subtitle={loading ? 'Opening…' : isWeb ? 'PDF' : `Page ${page} of ${total}`}
      progress={isWeb ? null : pct}
      onBack={onBack}
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((f) => !f)}
      tools={!isWeb && total > 1 && page > 1 ? [{ icon: 'arrow-up-outline', label: 'Back to first page', onPress: () => pdfRef.current?.setPage(1) }] : []}
    >
      {error ? (
        <View style={[st.center, { backgroundColor: colors.bg }]}>
          <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
          <Text style={[st.msg, { color: colors.textSecondary }]}>{error}</Text>
          <Pressable onPress={onBack} style={[st.btn, { backgroundColor: colors.accent }]} accessibilityRole="button">
            <Text style={st.btnText}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pdf
            ref={pdfRef}
            source={{ uri: file.uri, cache: true }}
            page={startPage || 1}
            style={{ flex: 1, backgroundColor: isDark ? '#1A1B24' : '#E9E6D8' }}
            fitPolicy={0} // fit page width
            spacing={8}
            horizontal={false}
            enablePaging={false}
            minScale={1}
            maxScale={4}
            enableAntialiasing
            trustAllCerts={false}
            onLoadComplete={(n) => {
              setTotal(n || 0);
              setLoading(false);
              onProgress?.({ page: Math.min(startPage || 1, n || 1), total: n || 0 });
            }}
            onPageChanged={(p, n) => {
              setPage(p);
              if (n) setTotal(n);
              onProgress?.({ page: p, total: n || total });
            }}
            onError={(e) => {
              setLoading(false);
              setError('This PDF could not be opened. Try again, or check your connection.');
              console.warn('[PDFReader]', e?.message || e);
            }}
          />
          {loading ? (
            <View style={[st.cover, { backgroundColor: colors.bg }]} pointerEvents="none">
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[st.msg, { color: colors.textMuted }]}>Opening book…</Text>
            </View>
          ) : null}
          {!loading && !isWeb && total > 0 ? (
            <View style={[st.pill, { backgroundColor: isDark ? 'rgba(11,11,20,0.72)' : 'rgba(255,255,255,0.85)', borderColor: colors.border }]} pointerEvents="none">
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{page} / {total}</Text>
            </View>
          ) : null}
        </>
      )}
    </ReaderShell>
  );
};

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  cover: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  msg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: { paddingHorizontal: 22, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  pill: { position: 'absolute', bottom: 18, alignSelf: 'center', paddingHorizontal: 12, height: 28, borderRadius: 14, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});

export default PDFReader;
