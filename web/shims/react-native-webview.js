// Web: a WebView made from an <iframe>.
// - source.html → srcdoc, with window.ReactNativeWebView.postMessage bridged to onMessage
// - source.uri  → src (some sites refuse to be framed; nothing we can do there)
// - ref.injectJavaScript(code) runs code inside the frame (same-origin srcdoc only)
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';

let seq = 0;
export const WebView = forwardRef(({ source, style, onMessage, onLoadEnd, onLoadStart, onLoad, startInLoadingState, renderLoading }, ref) => {
  const frame = useRef(null);
  const id = useMemo(() => `rnwv${++seq}`, []);

  const bridge = `<script>window.ReactNativeWebView={postMessage:function(d){parent.postMessage({__rnwv:'${id}',data:String(d)},'*')}};</script>`;
  const srcDoc = source?.html != null
    ? (/<head[^>]*>/i.test(source.html) ? source.html.replace(/<head[^>]*>/i, (m) => m + bridge) : bridge + source.html)
    : undefined;

  useEffect(() => {
    const onMsg = (e) => {
      if (e?.data && e.data.__rnwv === id && onMessage) onMessage({ nativeEvent: { data: e.data.data } });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [id, onMessage]);

  useEffect(() => { onLoadStart && onLoadStart({ nativeEvent: {} }); }, [source?.uri, source?.html]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    injectJavaScript: (code) => {
      try { frame.current?.contentWindow?.eval(code); } catch (e) { console.warn('[WebView web] inject failed', e?.message); }
    },
    postMessage: (data) => {
      try { frame.current?.contentWindow?.postMessage(data, '*'); } catch {}
    },
    reload: () => { try { frame.current?.contentWindow?.location.reload(); } catch {} },
    goBack: () => { try { frame.current?.contentWindow?.history.back(); } catch {} },
    goForward: () => { try { frame.current?.contentWindow?.history.forward(); } catch {} },
    stopLoading: () => {},
  }), []);

  return (
    <View style={[{ flex: 1 }, style]}>
      {React.createElement('iframe', {
        ref: frame,
        title: 'content',
        src: srcDoc == null ? source?.uri : undefined,
        srcDoc,
        allow: 'clipboard-write',
        style: { border: 0, width: '100%', height: '100%', flex: 1, background: 'transparent' },
        onLoad: () => { onLoad && onLoad({ nativeEvent: {} }); onLoadEnd && onLoadEnd({ nativeEvent: {} }); },
      })}
    </View>
  );
});
export default WebView;
