import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Text, FlatList, Platform } from 'react-native';
import { GelModal } from './gel/GelKit';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ReaderShell, { TextSizePanel } from './reader/ReaderShell';

/*
 * EPUB reader. Two ways to read (remembered):
 *   Pages  — swipe left/right (or tap the edges) to turn pages; swiping past the end of a chapter
 *            goes straight into the next one. Tap the middle to hide/show the bars.
 *   Scroll — the whole book scrolls top to bottom like a web page.
 * Comfortable 16px text by default, text size (remembered), contents list, full screen.
 */
const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.1.5/dist/jszip.min.js';
const EPUBJS_CDN = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';
const CHUNK_SIZE = 512 * 1024; // base64 chars per injected chunk
const SIZE_KEY = 'reader:epubTextSize';
const FLOW_KEY = 'reader:epubFlow'; // 'pages' | 'scroll'
const MIN_SIZE = 12;
const MAX_SIZE = 24;
const DEFAULT_SIZE = 16;

const buildHtml = (p) => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<script src="${JSZIP_CDN}"></script>
<script src="${EPUBJS_CDN}"></script>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: ${p.bg}; overflow: hidden; }
  #viewer { width: 100%; height: 100%; }
  #viewer .epub-container { -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
  #viewer iframe { background: ${p.bg} !important; }
  #viewer.turn-next { animation: turnNext .32s cubic-bezier(.2,.8,.2,1); }
  #viewer.turn-prev { animation: turnPrev .32s cubic-bezier(.2,.8,.2,1); }
  @keyframes turnNext { from { transform: translateX(42px); opacity: .35; } to { transform: none; opacity: 1; } }
  @keyframes turnPrev { from { transform: translateX(-42px); opacity: .35; } to { transform: none; opacity: 1; } }
  #status { position: absolute; top: 50%; left: 0; right: 0; transform: translateY(-50%); text-align: center;
            color: ${p.muted}; font: 14px sans-serif; pointer-events: none; }
</style>
</head>
<body>
<div id="viewer"></div>
<div id="status">Opening book…</div>
<script>
  var book = null, rendition = null, toc = [], current = -1, chunks = [], ready = false, flow = 'pages', textPx = 16;
  function post(m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} }
  window.addChunk = function (s) { chunks.push(s); };
  function bytesFrom(b64) {
    var out = new Uint8Array(Math.floor(b64.length * 3 / 4) + 3), o = 0;
    for (var i = 0; i < b64.length; i += 0x8000) {
      var bin = atob(b64.substr(i, 0x8000));
      for (var j = 0; j < bin.length; j++) out[o++] = bin.charCodeAt(j);
    }
    return out.subarray(0, o);
  }
  function flatten(items, depth, out) {
    (items || []).forEach(function (it) {
      out.push({ label: (it.label || 'Untitled').trim(), href: it.href, depth: depth });
      if (it.subitems && it.subitems.length) flatten(it.subitems, depth + 1, out);
    });
    return out;
  }
  function indexOf(href) {
    if (!href) return -1;
    var clean = href.split('#')[0], best = -1;
    for (var i = 0; i < toc.length; i++) {
      var h = (toc[i].href || '').split('#')[0];
      if (h === clean || clean.endsWith('/' + h) || h.endsWith('/' + clean)) { best = i; break; }
    }
    return best;
  }
  window.setTextSize = function (px) {
    textPx = px;
    if (!rendition) return;
    rendition.themes.fontSize(px + 'px');
  };

  // ── page turning (Pages mode): swipe or tap the edges; swiping past the last page of a
  //    chapter goes straight into the next chapter (and back).
  function turn(dir) {
    if (!rendition) return;
    var v = document.getElementById('viewer');
    var go = dir > 0 ? rendition.next() : rendition.prev();
    Promise.resolve(go).then(function () {
      v.classList.remove('turn-next', 'turn-prev'); void v.offsetWidth;
      v.classList.add(dir > 0 ? 'turn-next' : 'turn-prev');
    });
  }
  window.nextPage = function () { turn(1); };
  window.prevPage = function () { turn(-1); };
  function attachGestures(doc, win) {
    var x0 = 0, y0 = 0, t0 = 0, moved = false;
    doc.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); moved = false; }, { passive: true });
    doc.addEventListener('touchmove', function () { moved = true; }, { passive: true });
    doc.addEventListener('touchend', function (e) {
      if (flow !== 'pages') return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      var sel = win.getSelection && String(win.getSelection() || '');
      if (sel) return; // selecting text — not a page turn
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) { turn(dx < 0 ? 1 : -1); return; }
      if (!moved && Date.now() - t0 < 350 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        var w = win.innerWidth || window.innerWidth;
        var x = t.clientX % w; // paginated iframes are wider than the screen
        if (x < w * 0.28) turn(-1);
        else if (x > w * 0.72) turn(1);
        else post({ type: 'tap' });
      }
    }, { passive: true });
  }

  // Build (or rebuild) the view in the current mode, at a given spot.
  function render(at) {
    if (rendition) { try { rendition.destroy(); } catch (e) {} }
    document.getElementById('viewer').innerHTML = '';
    rendition = flow === 'pages'
      ? book.renderTo('viewer', { width: '100%', height: '100%', flow: 'paginated', spread: 'none', manager: 'default' })
      : book.renderTo('viewer', { width: '100%', height: '100%', flow: 'scrolled', manager: 'continuous', spread: 'none' });
    rendition.hooks.content.register(function (contents) { attachGestures(contents.document, contents.window); });
    theme(textPx);
    rendition.on('relocated', onRelocated);
    return (at ? rendition.display(at).catch(function () { return rendition.display(); }) : rendition.display());
  }
  window.setFlow = function (mode) {
    if (!book || mode === flow) return;
    var at = null;
    try { at = rendition && rendition.currentLocation() && rendition.currentLocation().start.cfi; } catch (e) {}
    flow = mode;
    render(at);
  };
  function onRelocated(loc) {
    var href = loc && loc.start && loc.start.href;
    var i = indexOf(href);
    if (i >= 0) current = i;
    var pct = null;
    try {
      if (book.locations && book.locations.length() && loc.start.cfi) pct = book.locations.percentageFromCfi(loc.start.cfi);
    } catch (e) {}
    var page = null, pages = null;
    try { if (flow === 'pages' && loc.start.displayed) { page = loc.start.displayed.page; pages = loc.start.displayed.total; } } catch (e) {}
    post({ type: 'loc', index: current, pct: pct, cfi: (loc && loc.start && loc.start.cfi) || null, page: page, pages: pages, atEnd: !!(loc && loc.atEnd) });
  }
  function theme(px) {
    rendition.themes.default({
      'html, body': { 'background': '${p.bg} !important', 'color': '${p.text} !important' },
      'body': { 'padding': '0 20px !important', 'margin': '0 !important',
                'font-family': 'Georgia, "Times New Roman", serif !important',
                'line-height': '1.65 !important', 'word-wrap': 'break-word' },
      // Publishers often set huge sizes; keep body text at the chosen size.
      'p, li, blockquote, dd, dt, td, span, div': { 'font-size': '1em !important', 'line-height': '1.65 !important' },
      'p': { 'margin': '0 0 0.85em 0 !important' },
      'h1': { 'font-size': '1.45em !important' }, 'h2': { 'font-size': '1.3em !important' },
      'h3, h4, h5, h6': { 'font-size': '1.12em !important' },
      'h1, h2, h3, h4, h5, h6': { 'color': '${p.accent} !important', 'font-family': 'sans-serif !important', 'line-height': '1.3 !important', 'margin': '1.2em 0 0.6em !important' },
      'a': { 'color': '${p.accent} !important', 'text-decoration': 'none !important' },
      'img, svg, image': { 'max-width': '100% !important', 'height': 'auto !important' },
      '*': { 'background-color': 'transparent !important' }
    });
    window.setTextSize(px);
  }
  window.finishLoad = function (px, startAt, mode) {
    flow = mode === 'scroll' ? 'scroll' : 'pages';
    textPx = px;
    try {
      if (typeof JSZip === 'undefined' || typeof ePub !== 'function') {
        post({ type: 'error', message: 'The book engine did not load. Check your connection and try again.' });
        return;
      }
      var data = bytesFrom(chunks.join('')); chunks = null;
      book = ePub(data.buffer);
      book.ready.then(function () {
        toc = flatten(book.navigation && book.navigation.toc, 0, []);
        if (!toc.length) {
          book.spine.each(function (it) { toc.push({ label: it.label || ('Section ' + (toc.length + 1)), href: it.href, depth: 0 }); });
        }
        post({ type: 'toc', chapters: toc.map(function (c) { return { label: c.label, depth: c.depth || 0 }; }) });
        // Reopen where the reader stopped; if that spot can't be found, start at the top.
        return render(startAt);
      }).then(function () {
        var st = document.getElementById('status'); if (st) st.style.display = 'none';
        ready = true;
        post({ type: 'ready' });
        // Percent read needs a pass over the whole book; do it after the first page shows.
        return book.locations.generate(1600).then(function () { post({ type: 'locationsReady' }); });
      }).catch(function (err) {
        post({ type: 'error', message: 'This book could not be opened: ' + (err && err.message ? err.message : err) });
      });
    } catch (e) {
      post({ type: 'error', message: 'This book could not be opened: ' + (e && e.message ? e.message : e) });
    }
  };
  window.goTo = function (i) { try { if (rendition && toc[i]) rendition.display(toc[i].href); } catch (e) {} };
  window.addEventListener('error', function (e) {
    var m = e && e.message ? String(e.message).toLowerCase() : '';
    if (!ready && (m.indexOf('epub') !== -1 || m.indexOf('jszip') !== -1)) {
      post({ type: 'error', message: 'The book engine did not load. Check your connection and try again.' });
    }
  }, true);
</script>
</body>
</html>`;

// base64 of the book file (phones read it from disk; the web fetches it).
async function readBase64(file) {
  if (file.base64) return file.base64;
  if (Platform.OS === 'web') {
    const buf = new Uint8Array(await (await fetch(file.uri)).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  return FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
}

/*
 * startAt: a saved spot (CFI) to reopen at.
 * onProgress({ index, total, cfi, pct }) — chapter index, exact spot, 0..1 of the book.
 */
const EPUBReader = ({ file, title, onBack, onProgress, startAt = null }) => {
  const { isDark, colors } = useTheme();
  const palette = useMemo(() => ({
    bg: colors.bg,
    text: isDark ? '#E6E4EE' : '#1F2430',
    muted: colors.textMuted,
    accent: colors.accent,
  }), [isDark, colors]);
  const html = useMemo(() => buildHtml(palette), [palette]);

  const [phase, setPhase] = useState('reading'); // reading → opening → ready | error
  const [error, setError] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [current, setCurrent] = useState(0);
  const [pct, setPct] = useState(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [textSize, setTextSize] = useState(DEFAULT_SIZE);
  const [flow, setFlow] = useState('pages');
  const [pageInfo, setPageInfo] = useState(null); // { page, pages } in the current chapter

  const webRef = useRef(null);
  const b64Ref = useRef(null);
  const pageLoadedRef = useRef(false);
  const startedRef = useRef(false);
  const sizeRef = useRef(DEFAULT_SIZE);
  const flowRef = useRef('pages');
  const prefsLoaded = useRef(false);
  const chaptersRef = useRef([]);
  const startRef = useRef(startAt);
  const pctRef = useRef(null);

  // remembered text size + reading mode (loaded before the book opens)
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(SIZE_KEY), AsyncStorage.getItem(FLOW_KEY)]).then(([v, fl]) => {
      const n = Number(v);
      if (n >= MIN_SIZE && n <= MAX_SIZE) { sizeRef.current = n; setTextSize(n); }
      if (fl === 'scroll' || fl === 'pages') { flowRef.current = fl; setFlow(fl); }
    }).catch(() => {}).finally(() => { prefsLoaded.current = true; start(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeFlow = (mode) => {
    flowRef.current = mode;
    setFlow(mode);
    setPageInfo(null);
    AsyncStorage.setItem(FLOW_KEY, mode).catch(() => {});
    webRef.current?.injectJavaScript(`window.setFlow(${JSON.stringify(mode)}); true;`);
  };

  const start = useCallback(() => {
    if (startedRef.current || !b64Ref.current || !pageLoadedRef.current || !prefsLoaded.current) return;
    startedRef.current = true;
    setPhase('opening');
    const b64 = b64Ref.current;
    b64Ref.current = null;
    let i = 0;
    const next = () => {
      if (i >= b64.length) {
        webRef.current?.injectJavaScript(`window.finishLoad(${sizeRef.current}, ${JSON.stringify(startRef.current || null)}, ${JSON.stringify(flowRef.current)}); true;`);
        return;
      }
      webRef.current?.injectJavaScript(`window.addChunk(${JSON.stringify(b64.substring(i, i + CHUNK_SIZE))}); true;`);
      i += CHUNK_SIZE;
      setTimeout(next, 0);
    };
    next();
  }, []);

  useEffect(() => {
    let alive = true;
    startedRef.current = false;
    setPhase('reading');
    setError(null);
    readBase64(file)
      .then((b64) => { if (alive) { b64Ref.current = b64; start(); } })
      .catch(() => { if (alive) { setError('This book file could not be read. Try opening it again.'); setPhase('error'); } });
    return () => { alive = false; };
  }, [file, start]);

  const changeSize = (n) => {
    const v = Math.max(MIN_SIZE, Math.min(MAX_SIZE, n));
    sizeRef.current = v;
    setTextSize(v);
    AsyncStorage.setItem(SIZE_KEY, String(v)).catch(() => {});
    webRef.current?.injectJavaScript(`window.setTextSize(${v}); true;`);
  };

  const goTo = (i) => {
    setTocOpen(false);
    setCurrent(i);
    // the reader reports the new spot (with its exact location) once it lands
    webRef.current?.injectJavaScript(`window.goTo(${i}); true;`);
  };

  const onMessage = (event) => {
    let d;
    try { d = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (d.type === 'toc') {
      chaptersRef.current = d.chapters || [];
      setChapters(chaptersRef.current);
    } else if (d.type === 'loc') {
      if (d.index >= 0) setCurrent(d.index);
      if (typeof d.pct === 'number') { setPct(d.pct); pctRef.current = d.pct; }
      setPageInfo(d.page && d.pages ? { page: d.page, pages: d.pages } : null);
      onProgress?.({
        index: d.index >= 0 ? d.index : 0,
        total: chaptersRef.current.length,
        cfi: d.cfi || null,
        pct: typeof d.pct === 'number' ? d.pct : pctRef.current,
      });
    } else if (d.type === 'tap') {
      setSizeOpen(false);
      setFullscreen((f) => !f);
    } else if (d.type === 'ready') {
      setPhase('ready');
    } else if (d.type === 'error') {
      setError(d.message || 'This book could not be opened.');
      setPhase('error');
    }
  };

  const chapterLabel = chapters[current]?.label;
  const subtitle = phase !== 'ready'
    ? 'Opening…'
    : [chapterLabel, pageInfo ? `p. ${pageInfo.page}/${pageInfo.pages}` : null, pct != null ? `${Math.round(pct * 100)}%` : null].filter(Boolean).join(' · ');

  return (
    <ReaderShell
      title={title || file?.name || 'Book'}
      subtitle={subtitle}
      progress={pct}
      onBack={onBack}
      fullscreen={fullscreen}
      onToggleFullscreen={() => { setSizeOpen(false); setFullscreen((f) => !f); }}
      tools={[
        { icon: flow === 'pages' ? 'swap-vertical-outline' : 'book-outline', label: flow === 'pages' ? 'Switch to scrolling' : 'Switch to pages', onPress: () => changeFlow(flow === 'pages' ? 'scroll' : 'pages') },
        { icon: 'text-outline', label: 'Text size', onPress: () => setSizeOpen((o) => !o), active: sizeOpen },
        ...(chapters.length > 1 ? [{ icon: 'list-outline', label: 'Contents', onPress: () => setTocOpen(true) }] : []),
      ]}
      panel={sizeOpen ? <TextSizePanel size={textSize} min={MIN_SIZE} max={MAX_SIZE} onChange={changeSize} /> : null}
    >
      {phase === 'error' ? (
        <View style={[st.center, { backgroundColor: colors.bg }]}>
          <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
          <Text style={[st.msg, { color: colors.textSecondary }]}>{error}</Text>
          <Pressable onPress={onBack} style={[st.btn, { backgroundColor: colors.accent }]} accessibilityRole="button">
            <Text style={st.btnText}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <WebView
            ref={webRef}
            source={{ html }}
            style={{ flex: 1, backgroundColor: colors.bg }}
            onMessage={onMessage}
            onLoadEnd={() => { pageLoadedRef.current = true; start(); }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            showsVerticalScrollIndicator={false}
            setBuiltInZoomControls={false}
          />
          {phase !== 'ready' ? (
            <View style={[st.cover, { backgroundColor: colors.bg }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[st.msg, { color: colors.textMuted }]}>{phase === 'reading' ? 'Getting your book…' : 'Opening book…'}</Text>
            </View>
          ) : null}
        </>
      )}

      <GelModal visible={tocOpen} onClose={() => setTocOpen(false)} variant="sheet" title="Contents">
        <FlatList
          style={{ maxHeight: 440, marginTop: 10 }}
          data={chapters}
          keyExtractor={(_, i) => String(i)}
          initialScrollIndex={chapters.length && current > 3 ? current - 3 : undefined}
          getItemLayout={(_, i) => ({ length: 48, offset: 48 * i, index: i })}
          renderItem={({ item, index }) => {
            const on = index === current;
            return (
              <Pressable
                onPress={() => goTo(index)}
                style={[st.row, { borderRadius: 24 }, on && { backgroundColor: colors.accentSoft }]}
                accessibilityRole="button"
              >
                <Text
                  numberOfLines={1}
                  style={{ paddingLeft: (item.depth || 0) * 14, fontSize: 14, color: on ? colors.accent : colors.textSecondary, fontWeight: on ? '700' : '400' }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </GelModal>
    </ReaderShell>
  );
};

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  cover: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  msg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: { paddingHorizontal: 22, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingBottom: 18 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  row: { height: 48, justifyContent: 'center', paddingHorizontal: 18 },
});

export default EPUBReader;
