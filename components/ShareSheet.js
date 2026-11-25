// Share a novel / manga / chapter: a preview of the card people will see on X, then
// Post on X · Copy link · More (system share sheet). Links go to app.sempaihq.com, which opens
// the chapter on the web (and on iPhone), and shows the card when posted on X.
import React, { useState } from 'react';
import { View, Text, Image, Share, Linking, Platform, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { GelModal, GelButton } from './gel/GelKit';
import { useTheme } from '../context/ThemeContext';
import { toast } from './Toast';

const APP = 'https://app.sempaihq.com';
const CARD = 'https://www.sempaihq.com/api/og';

/** Build the share link + card for kind 'novel' | 'manga', title id, and optional chapter (novel index / manga chapter id). */
export function shareTarget({ kind, id, chapter }) {
  const hasCh = chapter !== undefined && chapter !== null && chapter !== '';
  const path = `/${kind}/${id}${hasCh ? `/chapter/${chapter}` : ''}`;
  return {
    url: `${APP}${path}`,
    card: `${CARD}?kind=${kind}&id=${id}${hasCh ? `&ch=${encodeURIComponent(chapter)}` : ''}`,
  };
}

export default function ShareSheet({ visible, onClose, kind = 'novel', id, chapter, title, chapterLabel, chapterTitle }) {
  const { colors, isDark } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!id) return null;
  const { url, card } = shareTarget({ kind, id, chapter });
  const what = chapterLabel ? `${chapterLabel}${chapterTitle ? `: ${chapterTitle}` : ''} of ${title}` : title;
  const text = `Reading ${what} on @HomeforSempai 📖`;

  const postX = async () => {
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    try {
      if (Platform.OS === 'web') window.open(intent, '_blank', 'noopener');
      else await Linking.openURL(intent);
      onClose?.();
    } catch {
      toast.error('Could not open X');
    }
  };
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(url);
      toast.success('Link copied');
    } catch { /* ignore */ }
  };
  const more = async () => {
    try {
      if (Platform.OS === 'web' && navigator.share) await navigator.share({ title, text, url });
      else await Share.share({ message: `${text}\n${url}`, url, title });
    } catch { /* cancelled */ }
  };

  return (
    <GelModal visible={visible} onClose={onClose} variant="sheet" title="Share" subtitle={what}>
      <View
        style={{
          marginTop: 12, borderRadius: 22, overflow: 'hidden', aspectRatio: 1200 / 630,
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : `rgba(${colors.accentRgb},0.06)`,
          borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : `rgba(${colors.accentRgb},0.15)`,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {!failed ? (
          <Image
            source={{ uri: card }}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            resizeMode="cover"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            accessibilityLabel="Preview of the card people will see"
          />
        ) : null}
        {!loaded && !failed ? <ActivityIndicator color={colors.accent} /> : null}
        {failed ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{title}</Text> : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' }} numberOfLines={1}>{url.replace('https://', '')}</Text>
      <GelButton label="Post on X" icon="twitter" onPress={postX} style={{ marginTop: 14 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <GelButton label="Copy link" icon="link" variant="secondary" onPress={copy} style={{ flex: 1 }} small />
        <GelButton label="More…" icon="share-alt" variant="secondary" onPress={more} style={{ flex: 1 }} small />
      </View>
    </GelModal>
  );
}
