import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Modal, FlatList } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { getReaderStyles } from '../styles/ReaderStyles';
import { useTheme } from '../context/ThemeContext';

const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.1.5/dist/jszip.min.js';
const EPUBJS_CDN = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';
const CHUNK_SIZE = 512 * 1024; // base64 chars per injected chunk

const buildWebViewHtml = (isDark) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="${JSZIP_CDN}"></script>
  <script src="${EPUBJS_CDN}"></script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #0B0B14;
      overflow: hidden;
    }
    #viewer {
      width: 100%;
      height: 100%;
    }
    #viewer iframe {
      background-color: #0B0B14 !important;
    }
    #status {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      text-align: center;
      color: ${isDark ? '#8A8AA3' : '#64748B'};
      font-family: sans-serif;
      font-size: 14px;
      transform: translateY(-50%);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="viewer"></div>
  <div id="status">Loading book...</div>
  <script>
    var book = null;
    var rendition = null;
    var tocFlat = [];
    var currentIndex = -1;
    var __chunks = [];

    function post(msg) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      } catch (e) {}
    }

    window.addChunk = function (s) {
      __chunks.push(s);
    };

    function b64ToBytes(b64) {
      var len = b64.length;
      var out = new Uint8Array(Math.floor(len * 3 / 4) + 3);
      var o = 0;
      for (var i = 0; i < len; i += 0x8000) {
        var bin = atob(b64.substr(i, 0x8000));
        for (var j = 0; j < bin.length; j++) {
          out[o++] = bin.charCodeAt(j);
        }
      }
      return out.subarray(0, o);
    }

    function flattenToc(items, depth, out) {
      (items || []).forEach(function (item) {
        out.push({ label: item.label || 'Untitled', href: item.href, depth: depth });
        if (item.subitems && item.subitems.length) {
          flattenToc(item.subitems, depth + 1, out);
        }
      });
      return out;
    }

    function findChapterIndex(href) {
      if (!href) return -1;
      var clean = href.split('#')[0];
      for (var i = 0; i < tocFlat.length; i++) {
        var h = (tocFlat[i].href || '').split('#')[0];
        if (h === clean) return i;
      }
      return -1;
    }

    function applyTheme() {
      rendition.themes.register('sempai', {
        'body': {
          'color': '${isDark ? '#E8E6F0' : '#1E293B'}',
          'background': '${isDark ? '#0B0B14' : '#FFFFFF'}',
          'padding': '0 16px',
          'font-family': 'serif',
          'line-height': '1.7'
        },
        'p': { 'margin': '0 0 0.9em 0' },
        'h1, h2, h3, h4': { 'color': '${isDark ? '#F36316' : '#3B82F6'}', 'font-family': 'sans-serif' },
        'a': { 'color': '${isDark ? '#FF8C42' : '#2563EB'}', 'text-decoration': 'none' }
      });
      rendition.themes.select('sempai');
    }

    window.finishLoad = function () {
      try {
        if (typeof JSZip === 'undefined') {
          post({ type: 'error', message: 'JSZip failed to load. Check your connection and retry.' });
          return;
        }
        if (typeof ePub !== 'function') {
          post({ type: 'error', message: 'EPUB engine failed to load. Check your connection and retry.' });
          return;
        }
        var joined = __chunks.join('');
        __chunks = null;
        var bytes = b64ToBytes(joined);
        post({ type: 'progress', message: 'Opening book...' });

        book = ePub(bytes.buffer);
        rendition = book.renderTo('viewer', {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none'
        });

        rendition.on('relocated', function (loc) {
          var idx = findChapterIndex(loc && loc.start && loc.start.href ? loc.start.href : (loc && loc.href));
          if (idx >= 0 && idx !== currentIndex) {
            currentIndex = idx;
            post({ type: 'chapter', index: idx });
          }
        });

        book.ready.then(function () {
          applyTheme();
          return book.locations.generate(1024);
        }).then(function () {
          tocFlat = flattenToc(book.navigation && book.navigation.toc, 0, []);
          if (tocFlat.length === 0) {
            // Fallback: build chapter list from spine
            var spineItems = [];
            book.spine.each(function (item) {
              spineItems.push({ label: item.label || item.idref || ('Section ' + spineItems.length), href: item.href });
            });
            tocFlat = spineItems;
          }
          post({ type: 'toc', chapters: tocFlat.map(function (c) { return { label: c.label, depth: c.depth || 0 }; }) });
          return rendition.display(tocFlat.length ? tocFlat[0].href : undefined);
        }).then(function () {
          var status = document.getElementById('status');
          if (status) status.style.display = 'none';
          post({ type: 'ready' });
        }).catch(function (err) {
          post({ type: 'error', message: 'Failed to render book: ' + (err && err.message ? err.message : err) });
        });
      } catch (e) {
        post({ type: 'error', message: 'Failed to load EPUB: ' + (e && e.message ? e.message : e) });
      }
    };

    window.displayChapter = function (i) {
      try {
        if (rendition && tocFlat[i]) {
          rendition.display(tocFlat[i].href);
        }
      } catch (e) {}
    };

    // Detect epub.js CDN load failure
    window.addEventListener('error', function (e) {
      var m = e && e.message ? String(e.message).toLowerCase() : '';
      if (m.indexOf('epub') !== -1 || m.indexOf('jszip') !== -1) {
        post({ type: 'error', message: 'Could not load EPUB engine. Check your connection and retry.' });
      }
    }, true);
  </script>
</body>
</html>
`;

const EPUBReader = ({ file, onBack, onProgress }) => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getReaderStyles(isDark), [isDark]);
  const epubStyles = useMemo(() => getEpubLocalStyles(colors), [isDark]);
  const [fileLoading, setFileLoading] = useState(true);
  const [bookLoading, setBookLoading] = useState(false);
  const [statusText, setStatusText] = useState('Reading file...');
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [error, setError] = useState(null);
  const webViewRef = useRef(null);
  const fileB64Ref = useRef(null);
  const webViewReadyRef = useRef(false);
  const injectionStartedRef = useRef(false);

  useEffect(() => {
    loadEPUB();
    return () => {
      injectionStartedRef.current = false;
    };
  }, [file]);

  const loadEPUB = async () => {
    try {
      setFileLoading(true);
      setError(null);
      setStatusText('Reading file...');

      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      fileB64Ref.current = fileContent;
      setFileLoading(false);
      // If the WebView finished loading before the file read, kick off injection now
      if (webViewReadyRef.current) {
        startInjection();
      }
    } catch (err) {
      console.error('Error loading EPUB:', err);
      setError('Failed to read EPUB file. Please try a different file.');
      setFileLoading(false);
    }
  };

  const startInjection = () => {
    if (injectionStartedRef.current || !fileB64Ref.current) return;
    injectionStartedRef.current = true;
    setBookLoading(true);

    const b64 = fileB64Ref.current;
    fileB64Ref.current = null; // free memory

    // Reset any previous book state in the page
    webViewRef.current?.injectJavaScript('window.__chunks = []; true;');

    let i = 0;
    const injectNext = () => {
      if (i >= b64.length) {
        webViewRef.current?.injectJavaScript('window.finishLoad(); true;');
        return;
      }
      const chunk = b64.substring(i, i + CHUNK_SIZE);
      i += CHUNK_SIZE;
      webViewRef.current?.injectJavaScript(
        'window.addChunk(' + JSON.stringify(chunk) + '); true;'
      );
      // Let the WebView breathe between chunks
      setTimeout(injectNext, 0);
    };
    injectNext();
  };

  const handleWebViewLoad = () => {
    webViewReadyRef.current = true;
    startInjection();
  };

  const handlePreviousChapter = () => {
    if (currentChapter > 0) {
      const next = currentChapter - 1;
      setCurrentChapter(next);
      onProgress?.({ index: next, total: chapters.length });
      webViewRef.current?.injectJavaScript(
        'window.displayChapter(' + next + '); true;'
      );
    }
  };

  const handleNextChapter = () => {
    if (currentChapter < chapters.length - 1) {
      const next = currentChapter + 1;
      setCurrentChapter(next);
      onProgress?.({ index: next, total: chapters.length });
      webViewRef.current?.injectJavaScript(
        'window.displayChapter(' + next + '); true;'
      );
    }
  };

  const handleSelectChapter = (index) => {
    setTocOpen(false);
    setCurrentChapter(index);
    onProgress?.({ index, total: chapters.length });
    webViewRef.current?.injectJavaScript(
      'window.displayChapter(' + index + '); true;'
    );
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'toc') {
        const tocChapters = data.chapters || [];
        setChapters(tocChapters);
        onProgress?.({ index: currentChapter, total: tocChapters.length });
      } else if (data.type === 'chapter') {
        setCurrentChapter(data.index);
        onProgress?.({ index: data.index, total: chapters.length });
      } else if (data.type === 'ready') {
        setBookLoading(false);
        setStatusText('');
      } else if (data.type === 'progress') {
        setStatusText(data.message || 'Loading...');
      } else if (data.type === 'error') {
        setError(data.message || 'Failed to load EPUB.');
        setBookLoading(false);
      }
    } catch (err) {
      // Ignore non-JSON messages
    }
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={styles.errorText.color} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.pickButton} onPress={onBack}>
          <Text style={styles.pickButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (fileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={styles.filePickerIcon.color} />
        <Text style={styles.loadingText}>{statusText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.readerContainer}>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.name}
        </Text>
        <View style={styles.fileTypeBadge}>
          <Text style={styles.fileTypeText}>EPUB</Text>
        </View>
      </View>

      <WebView
        ref={webViewRef}
        source={{ html: buildWebViewHtml(isDark) }}
        style={styles.epubContainer}
        onMessage={handleWebViewMessage}
        onLoadEnd={handleWebViewLoad}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scalesPageToFit
        originWhitelist={['*']}
      />

      {bookLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={styles.filePickerIcon.color} />
          <Text style={styles.loadingText}>{statusText}</Text>
        </View>
      )}

      {chapters.length > 0 && !bookLoading && (
        <>
          <View style={styles.pageIndicator}>
            <TouchableOpacity onPress={() => setTocOpen(true)}>
              <Text style={styles.pageIndicatorText} numberOfLines={1}>
                {chapters[currentChapter]?.label || 'Chapter'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.navigationControls}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={handlePreviousChapter}
              disabled={currentChapter <= 0}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={currentChapter <= 0 ? styles.filePickerText.color : styles.filePickerIcon.color}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setTocOpen(true)}
            >
              <Ionicons name="list-outline" size={22} color={styles.filePickerIcon.color} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={handleNextChapter}
              disabled={currentChapter >= chapters.length - 1}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={currentChapter >= chapters.length - 1 ? styles.filePickerText.color : styles.filePickerIcon.color}
              />
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal
        visible={tocOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTocOpen(false)}
      >
        <View style={epubStyles.modalOverlay}>
          <View style={epubStyles.modalContent}>
            <View style={epubStyles.modalHeader}>
              <Text style={epubStyles.modalTitle}>Contents</Text>
              <TouchableOpacity onPress={() => setTocOpen(false)}>
                <Ionicons name="close" size={24} color="#E8E6F0" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={chapters}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[epubStyles.tocItem, index === currentChapter && epubStyles.tocItemActive]}
                  onPress={() => handleSelectChapter(index)}
                >
                  <Text
                    style={[
                      epubStyles.tocItemText,
                      (item.depth || 0) > 0 && { paddingLeft: 16 + (item.depth || 0) * 12 },
                      index === currentChapter && epubStyles.tocItemTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getEpubLocalStyles = (c) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16162A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A45',
  },
  modalTitle: {
    color: c.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  tocItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A45',
  },
  tocItemActive: {
    backgroundColor: 'rgba(243, 99, 22,0.12)',
  },
  tocItemText: {
    color: c.textSecondary,
    fontSize: 15,
  },
  tocItemTextActive: {
    color: c.accent,
    fontWeight: '600',
  },
});

export default EPUBReader;
