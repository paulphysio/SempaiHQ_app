import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { displayName, shortTime, compactCount, postImages } from '../../services/feed';

/*
 * Crazy Corner building blocks, in the look of X: true black in dark mode,
 * hairline dividers, round profile pictures, quiet grey actions — and our
 * orange for likes and buttons.
 */
export const LIKE_ORANGE = '#F36316';
export const REPOST_GREEN = '#00BA7C';

export function useFeedColors() {
  const { isDark } = useTheme();
  return useMemo(() => (isDark
    ? {
        isDark, bg: '#000000', raised: '#16181C', text: '#E7E9EA', muted: '#71767B', border: '#2F3336',
        accent: LIKE_ORANGE, accentSoft: 'rgba(243,99,22,0.12)', repost: REPOST_GREEN, scrim: 'rgba(91,112,131,0.4)',
        input: '#000000', chip: '#202327',
      }
    : {
        isDark, bg: '#FFFFFF', raised: '#F7F9F9', text: '#0F1419', muted: '#536471', border: '#EFF3F4',
        accent: LIKE_ORANGE, accentSoft: 'rgba(243,99,22,0.10)', repost: REPOST_GREEN, scrim: 'rgba(0,0,0,0.4)',
        input: '#FFFFFF', chip: '#EFF3F4',
      }), [isDark]);
}

const AVATAR_TINTS = ['#F36316', '#7C5CFF', '#00BA7C', '#1D9BF0', '#F91880', '#FFAD1F'];

/** Profile picture, or a coloured initial when there isn't one. */
export function Avatar({ user, size = 40, onPress }) {
  const name = displayName(user);
  const tint = AVATAR_TINTS[(name.charCodeAt(0) || 0) % AVATAR_TINTS.length];
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user?.image]);
  const body = user?.image && !broken ? (
    <Image
      source={{ uri: user.image }}
      onError={() => setBroken(true)}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2F3336' }}
    />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}'s profile`} hitSlop={4}>
      {body}
    </Pressable>
  );
}

/** Small mark after a writer's / artist's name. */
export function CreatorMark({ user, c }) {
  if (user?.isWriter) return <FontAwesome5 name="feather-alt" size={11} color={c.accent} style={{ marginLeft: 4, marginRight: 2 }} accessibilityLabel="Writer" />;
  if (user?.isArtist) return <FontAwesome5 name="palette" size={11} color={c.accent} style={{ marginLeft: 4, marginRight: 2 }} accessibilityLabel="Artist" />;
  return null;
}

/** Name · time line, X style. */
export function Byline({ user, time, c, onPressName, big }) {
  return (
    <View style={k.byline}>
      <Pressable onPress={onPressName} disabled={!onPressName} style={k.nameWrap} hitSlop={4}>
        <Text style={[k.name, { color: c.text, fontSize: big ? 16 : 15 }]} numberOfLines={1}>{displayName(user)}</Text>
        <CreatorMark user={user} c={c} />
      </Pressable>
      {time ? <Text style={[k.time, { color: c.muted }]} numberOfLines={1}> · {shortTime(time)}</Text> : null}
    </View>
  );
}

/** 1–4 pictures, X's grid: one big, two side by side, three/four in a block. */
export function MediaGrid({ urls, c, onOpen, tall }) {
  if (!urls?.length) return null;
  const n = urls.length;
  const H = tall ? 300 : 220;
  const cell = (u, i, style) => (
    <Pressable key={u + i} onPress={() => onOpen?.(i)} style={[{ backgroundColor: c.raised, overflow: 'hidden' }, style]} accessibilityRole="imagebutton" accessibilityLabel={`Picture ${i + 1} of ${n}`}>
      <Image source={{ uri: u }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </Pressable>
  );
  const gap = 2;
  return (
    <View style={[k.media, { borderColor: c.border, height: n === 1 ? H + 40 : H }]}>
      {n === 1 ? cell(urls[0], 0, { flex: 1 }) : null}
      {n === 2 ? (
        <View style={{ flex: 1, flexDirection: 'row', gap }}>{urls.map((u, i) => cell(u, i, { flex: 1 }))}</View>
      ) : null}
      {n === 3 ? (
        <View style={{ flex: 1, flexDirection: 'row', gap }}>
          {cell(urls[0], 0, { flex: 1 })}
          <View style={{ flex: 1, gap }}>{cell(urls[1], 1, { flex: 1 })}{cell(urls[2], 2, { flex: 1 })}</View>
        </View>
      ) : null}
      {n >= 4 ? (
        <View style={{ flex: 1, gap }}>
          <View style={{ flex: 1, flexDirection: 'row', gap }}>{cell(urls[0], 0, { flex: 1 })}{cell(urls[1], 1, { flex: 1 })}</View>
          <View style={{ flex: 1, flexDirection: 'row', gap }}>{cell(urls[2], 2, { flex: 1 })}{cell(urls[3], 3, { flex: 1 })}</View>
        </View>
      ) : null}
    </View>
  );
}

/** One action (reply / repost / like / share) with its count. */
function Action({ icon, iconOn, on, onColor, count, label, onPress, c, scale }) {
  const color = on ? onColor : c.muted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on }}
      hitSlop={8}
      style={({ pressed }) => [k.action, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Animated.View style={scale ? { transform: [{ scale }] } : null}>
        <Ionicons name={on && iconOn ? iconOn : icon} size={18} color={color} />
      </Animated.View>
      {count != null ? (
        <Text style={[k.count, { color }]}>{count > 0 ? compactCount(count) : ''}</Text>
      ) : null}
    </Pressable>
  );
}

/** Reply · Repost · Like · Share. The like turns orange with a little pop. */
export function ActionBar({ post, liked, reposted, onReply, onRepost, onLike, onShare, c, spread }) {
  const pop = useRef(new Animated.Value(1)).current;
  const wasLiked = useRef(liked);
  useEffect(() => {
    if (liked && !wasLiked.current) {
      pop.setValue(0.6);
      Animated.spring(pop, { toValue: 1, friction: 3, tension: 180, useNativeDriver: true }).start();
    }
    wasLiked.current = liked;
  }, [liked, pop]);
  return (
    <View style={[k.actions, spread && { justifyContent: 'space-around' }]}>
      <Action icon="chatbubble-outline" count={post.comments_count} label={`Reply, ${post.comments_count || 0} replies`} onPress={onReply} c={c} />
      <Action icon="repeat" on={reposted} onColor={c.repost} count={post.shares_count} label={reposted ? 'Undo repost' : 'Repost'} onPress={onRepost} c={c} />
      <Action icon="heart-outline" iconOn="heart" on={liked} onColor={c.accent} count={post.likes_count} label={liked ? 'Unlike' : 'Like'} onPress={onLike} c={c} scale={pop} />
      <Action icon="share-outline" label="Share" onPress={onShare} c={c} />
    </View>
  );
}

/** A post in the timeline. */
export function PostRow({ post, liked, reposted, c, onOpen, onAuthor, onMore, onImage, onReply, onRepost, onLike, onShare }) {
  const imgs = postImages(post);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [k.row, { borderBottomColor: c.border, backgroundColor: pressed ? c.raised : c.bg }]}>
      <Avatar user={post.author} size={40} onPress={onAuthor} />
      <View style={k.rowBody}>
        <View style={k.rowTop}>
          <Byline user={post.author} time={post.created_at} c={c} onPressName={onAuthor} />
          <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options" style={k.more}>
            <Ionicons name="ellipsis-horizontal" size={16} color={c.muted} />
          </Pressable>
        </View>
        {post.content ? <Text style={[k.text, { color: c.text }]}>{post.content}</Text> : null}
        <MediaGrid urls={imgs} c={c} onOpen={onImage} />
        <ActionBar post={post} liked={liked} reposted={reposted} onReply={onReply} onRepost={onRepost} onLike={onLike} onShare={onShare} c={c} />
      </View>
    </Pressable>
  );
}

const k = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  byline: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  nameWrap: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
  name: { fontWeight: '700', flexShrink: 1 },
  time: { fontSize: 15, flexShrink: 0 },
  more: { paddingLeft: 8, paddingVertical: 2 },
  text: { fontSize: 15, lineHeight: 20, marginTop: 2 },
  media: { marginTop: 10, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingRight: 24 },
  action: { flexDirection: 'row', alignItems: 'center', minWidth: 52, height: 34, gap: 4 },
  count: { fontSize: 13, minWidth: 14 },
});
