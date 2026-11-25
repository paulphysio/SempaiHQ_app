import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../feed/FeedKit';

/*
 * Chat building blocks in the bubbly gel style:
 *   Bubble       my messages = glossy accent gel; theirs = glass
 *   DayPill      "Today" / "Yesterday" / "Mon 3 Nov"
 *   ChatRow      a conversation in the list
 */
export const nameOf = (u) => {
  const n = (u?.name || '').trim();
  if (!n) return 'Reader';
  return n.length > 30 && !/\s/.test(n) ? `${n.slice(0, 4)}…${n.slice(-4)}` : n;
};

export const clock = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
};

export const listTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 86400 && d.getDate() === new Date().getDate()) return clock(iso);
  if (s < 7 * 86400) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

export function DayPill({ label }) {
  const { isDark, colors } = useTheme();
  return (
    <View style={k.dayWrap}>
      <View style={[k.day, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : `rgba(${colors.accentRgb},0.08)`, borderColor: isDark ? 'rgba(255,255,255,0.08)' : `rgba(${colors.accentRgb},0.14)` }]}>
        <Text style={[k.dayText, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
}

/*
 * mine       my message (right, gel)
 * first      first of a run from this author (shows name/avatar in group)
 * author     user object (group only)
 * parent     { name, content, media } of the message being replied to
 * status     'sending' | 'failed' | 'sent' | 'read'
 */
export function Bubble({ msg, mine, first, last, showAuthor, author, parent, status, onLongPress, onPressImage, onPressAuthor, onPressParent, reactions, onReact, onDoubleTap }) {
  const lastTap = React.useRef(0);
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) { lastTap.current = 0; onDoubleTap?.(); } else lastTap.current = now;
  };
  const { isDark, colors } = useTheme();
  const textColor = mine ? '#FFFFFF' : colors.textPrimary;
  const sub = mine ? 'rgba(255,255,255,0.78)' : colors.textMuted;
  const r = 20;
  const corner = mine
    ? { borderTopRightRadius: first ? r : 6, borderBottomRightRadius: last ? 6 : 6 }
    : { borderTopLeftRadius: first ? r : 6, borderBottomLeftRadius: last ? 6 : 6 };
  const onlyImage = msg.media && !msg.content;

  const body = (
    <View
      style={[
        k.bubble,
        corner,
        onlyImage && { padding: 4 },
        mine
          ? { borderColor: 'rgba(255,255,255,0.28)' }
          : { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.09)' : `rgba(${colors.accentRgb},0.16)` },
        status === 'failed' && { opacity: 0.6 },
      ]}
    >
      {mine ? (
        <>
          <LinearGradient colors={[colors.accentHi, colors.accent, colors.accentDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
            style={{ position: 'absolute', top: 1, left: 10, right: 10, height: 16, borderRadius: 12 }}
          />
        </>
      ) : null}
      {showAuthor && first && !mine ? (
        <Pressable onPress={onPressAuthor} hitSlop={4}>
          <Text style={[k.author, { color: colors.accent }]} numberOfLines={1}>{nameOf(author)}</Text>
        </Pressable>
      ) : null}
      {parent ? (
        <Pressable onPress={onPressParent} style={[k.quote, { backgroundColor: mine ? 'rgba(0,0,0,0.14)' : isDark ? 'rgba(255,255,255,0.06)' : `rgba(${colors.accentRgb},0.07)`, borderLeftColor: mine ? '#FFFFFF' : colors.accent }]}>
          <Text style={[k.quoteName, { color: mine ? '#FFFFFF' : colors.accent }]} numberOfLines={1}>{parent.name}</Text>
          <Text style={[k.quoteText, { color: mine ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]} numberOfLines={2}>
            {parent.content || (parent.media ? '📷 Photo' : 'Message')}
          </Text>
        </Pressable>
      ) : null}
      {msg.media ? (
        <Pressable onPress={() => onPressImage?.(msg.media)} accessibilityRole="imagebutton" accessibilityLabel="Photo">
          <Image source={{ uri: msg.media }} style={[k.media, msg.content ? { marginBottom: 6 } : null]} resizeMode="cover" />
        </Pressable>
      ) : null}
      {msg.content ? <Text style={[k.text, { color: textColor }]} selectable>{msg.content}</Text> : null}
      <View style={[k.meta, onlyImage && { position: 'absolute', right: 10, bottom: 8, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 6, borderRadius: 8 }]}>
        {msg.editedAt ? <Text style={[k.metaText, { color: onlyImage ? '#fff' : sub }]}>edited · </Text> : null}
        <Text style={[k.metaText, { color: onlyImage ? '#fff' : sub }]}>{status === 'sending' ? 'Sending…' : status === 'failed' ? 'Not sent' : clock(msg.createdAt)}</Text>
        {mine && (status === 'sent' || status === 'read') ? (
          <FontAwesome5
            name={status === 'read' ? 'check-double' : 'check'}
            size={9}
            color={onlyImage ? '#fff' : status === 'read' ? '#FFFFFF' : sub}
            style={{ marginLeft: 4, opacity: status === 'read' ? 1 : 0.8 }}
            accessibilityLabel={status === 'read' ? 'Read' : 'Sent'}
          />
        ) : null}
        {status === 'failed' ? <FontAwesome5 name="exclamation-circle" size={10} color="#FFD1D1" style={{ marginLeft: 4 }} /> : null}
      </View>
    </View>
  );

  return (
    <View style={[k.row, { justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: first ? 8 : 2 }]}>
      {!mine && showAuthor ? (
        <View style={{ width: 34, alignSelf: 'flex-end' }}>
          {last ? <Avatar user={author} size={28} onPress={onPressAuthor} /> : null}
        </View>
      ) : null}
      <View style={{ maxWidth: '80%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Pressable onPress={onTap} onLongPress={onLongPress} delayLongPress={280} accessibilityHint="Double tap to like, long press for reactions and options">
          {body}
        </Pressable>
        {reactions?.length ? (
          <View style={[k.reacts, mine ? { marginRight: 8 } : { marginLeft: 8 }]}>
            {reactions.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => onReact?.(r.emoji)}
                accessibilityRole="button"
                accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ', yours — tap to remove' : ''}`}
                style={[
                  k.react,
                  {
                    backgroundColor: r.mine ? `rgba(${colors.accentRgb},0.22)` : isDark ? '#1E1F2B' : '#FFFFFF',
                    borderColor: r.mine ? colors.accent : isDark ? 'rgba(255,255,255,0.12)' : `rgba(${colors.accentRgb},0.18)`,
                  },
                ]}
              >
                <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
                {r.count > 1 ? <Text style={{ fontSize: 12, fontWeight: '800', marginLeft: 3, color: r.mine ? colors.accent : colors.textSecondary }}>{r.count}</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A conversation in the list. */
export function ChatRow({ title, user, icon, preview, time, unread, onPress }) {
  const { isDark, colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${unread ? `, ${unread} unread` : ''}`}
      style={({ pressed }) => [
        k.chatRow,
        {
          backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.08)' : `rgba(${colors.accentRgb},0.08)`) : isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.07)' : `rgba(${colors.accentRgb},0.12)`,
        },
      ]}
    >
      {icon || <Avatar user={user} size={48} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[k.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
          <Text style={[k.rowTime, { color: unread ? colors.accent : colors.textMuted }]}>{time}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <Text style={[k.rowPreview, { color: unread ? colors.textPrimary : colors.textSecondary, fontWeight: unread ? '700' : '400' }]} numberOfLines={1}>
            {preview}
          </Text>
          {unread ? (
            <View style={[k.unread, { backgroundColor: colors.accent }]}>
              <Text style={k.unreadText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const k = StyleSheet.create({
  reacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -8, zIndex: 2 },
  react: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, height: 26, borderRadius: 13, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, gap: 6 },
  bubble: { borderRadius: 20, paddingHorizontal: 13, paddingTop: 8, paddingBottom: 6, overflow: 'hidden', borderWidth: 1, minWidth: 64 },
  author: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  text: { fontSize: 16, lineHeight: 22 },
  meta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2 },
  metaText: { fontSize: 11 },
  media: { width: 230, height: 230, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.15)' },
  quote: { borderLeftWidth: 3, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 9, marginBottom: 6, marginTop: 2 },
  quoteName: { fontSize: 12, fontWeight: '800' },
  quoteText: { fontSize: 13, lineHeight: 17, marginTop: 1 },
  dayWrap: { alignItems: 'center', marginVertical: 12 },
  day: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  dayText: { fontSize: 12, fontWeight: '700' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 24, borderWidth: 1, marginBottom: 8 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  rowTime: { fontSize: 12, fontWeight: '600' },
  rowPreview: { flex: 1, fontSize: 14 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
