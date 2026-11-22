import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, Modal, Image, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, RefreshControl, Linking, Share, StyleSheet, useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../services/supabaseClient';
import {
  POST_MAX, MAX_IMAGES, SITE_URL, currentUserId, fetchMe, fetchPosts, fetchMyMarks, fetchFollowing,
  setLiked, setReposted, setFollowing, createPost, deletePost, fetchReplies, addReply, deleteReply,
  postImages, xShareUrl, displayName,
} from '../services/feed';
import { shrinkImage } from '../utils/imageUpload';
import { useFeedColors, Avatar, Byline, MediaGrid, ActionBar, PostRow } from '../components/feed/FeedKit';
import { toast } from '../components/Toast';

/*
 * Crazy Corner — the community timeline, in the style of X.
 */
const ALSO_X_KEY = 'feed:alsoPostToX';
const NAV_CLEAR = (insets) => Math.max(insets.bottom, 8) + 12 + 68 + 8; // floating bottom bar

export default function FeedScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const c = useFeedColors();
  const top = Platform.OS === 'web' ? 0 : insets.top;

  const [me, setMe] = useState(null); // { id, name, image, ... } — null for guests
  const [tab, setTab] = useState('all'); // 'all' | 'following'
  const [posts, setPosts] = useState([]);
  const [liked, setLikedMap] = useState({});
  const [reposted, setRepostedMap] = useState({});
  const [following, setFollowingIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [thread, setThread] = useState(null); // post being viewed
  const [viewer, setViewer] = useState(null); // { urls, index }
  const [menu, setMenu] = useState(null); // { post, kind: 'more' | 'share' }
  const busy = useRef({});

  // ── who am I ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const id = await currentUserId();
      const profile = id ? await fetchMe(id) : null;
      if (!alive) return;
      setMe(profile || (id ? { id } : null));
      if (id) setFollowingIds(await fetchFollowing(id));
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') load();
    });
    return () => { alive = false; sub?.subscription?.unsubscribe(); };
  }, []);

  const mergeMarks = useCallback(async (list) => {
    if (!me?.id || !list.length) return;
    const m = await fetchMyMarks(me.id, list.map((p) => p.id));
    setLikedMap((o) => ({ ...o, ...m.liked }));
    setRepostedMap((o) => ({ ...o, ...m.reposted }));
  }, [me?.id]);

  // ── timeline ─────────────────────────────────────────────────────────────
  const authorFilter = tab === 'following' ? [...following, ...(me?.id ? [me.id] : [])] : null;

  const load = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    setFailed(false);
    try {
      const list = await fetchPosts({ authorIds: authorFilter });
      setPosts(list);
      setEnded(list.length < 20);
      mergeMarks(list);
    } catch (e) {
      setFailed(true);
      console.warn('[Feed] load failed:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, following.join(','), me?.id, mergeMarks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (more || ended || !posts.length) return;
    setMore(true);
    try {
      const next = await fetchPosts({ before: posts[posts.length - 1].created_at, authorIds: authorFilter });
      setPosts((p) => [...p, ...next.filter((n) => !p.some((x) => x.id === n.id))]);
      setEnded(next.length < 20);
      mergeMarks(next);
    } catch {}
    setMore(false);
  };

  // ── actions ──────────────────────────────────────────────────────────────
  const needSignIn = (what) => {
    if (me?.id) return false;
    toast.info(`Sign in to ${what}.`);
    return true;
  };
  const bump = (postId, field, delta) => {
    const f = (p) => (p.id === postId ? { ...p, [field]: Math.max(0, (p[field] || 0) + delta) } : p);
    setPosts((list) => list.map(f));
    setThread((t) => (t && t.id === postId ? f(t) : t));
  };

  const toggleLike = async (post) => {
    if (needSignIn('like posts') || busy.current[`l${post.id}`]) return;
    busy.current[`l${post.id}`] = true;
    const on = !liked[post.id];
    setLikedMap((m) => ({ ...m, [post.id]: on }));
    bump(post.id, 'likes_count', on ? 1 : -1);
    try {
      await setLiked(me.id, post.id, on);
    } catch {
      setLikedMap((m) => ({ ...m, [post.id]: !on }));
      bump(post.id, 'likes_count', on ? -1 : 1);
      toast.error("Couldn't save your like. Check your connection.");
    }
    busy.current[`l${post.id}`] = false;
  };

  const toggleRepost = async (post) => {
    if (needSignIn('repost') || busy.current[`r${post.id}`]) return;
    busy.current[`r${post.id}`] = true;
    const on = !reposted[post.id];
    setRepostedMap((m) => ({ ...m, [post.id]: on }));
    bump(post.id, 'shares_count', on ? 1 : -1);
    try {
      await setReposted(me.id, post.id, on);
      if (on) toast.success('Reposted');
    } catch {
      setRepostedMap((m) => ({ ...m, [post.id]: !on }));
      bump(post.id, 'shares_count', on ? -1 : 1);
      toast.error("Couldn't repost. Check your connection.");
    }
    busy.current[`r${post.id}`] = false;
  };

  const toggleFollow = async (user) => {
    if (needSignIn('follow people')) return;
    const on = !following.includes(user.id);
    setFollowingIds((f) => (on ? [...f, user.id] : f.filter((x) => x !== user.id)));
    try {
      await setFollowing(me.id, user.id, on);
      toast.success(on ? `Following ${displayName(user)}` : `Unfollowed ${displayName(user)}`);
    } catch {
      setFollowingIds((f) => (on ? f.filter((x) => x !== user.id) : [...f, user.id]));
      toast.error("Couldn't update. Try again.");
    }
  };

  const removePost = async (post) => {
    setMenu(null);
    try {
      await deletePost(post.id);
      setPosts((p) => p.filter((x) => x.id !== post.id));
      setThread((t) => (t?.id === post.id ? null : t));
      toast.success('Post deleted');
    } catch {
      toast.error("Couldn't delete the post.");
    }
  };

  const shareToX = (post) => {
    setMenu(null);
    Linking.openURL(xShareUrl(post.content || 'On Crazy Corner', `${SITE_URL}/feed`)).catch(() => toast.error("Couldn't open X."));
  };
  const shareElsewhere = async (post) => {
    setMenu(null);
    try {
      await Share.share({ message: `${post.content ? `${post.content}\n\n` : ''}${SITE_URL}/feed` });
    } catch {}
  };

  const openProfile = (user) => user?.id && navigation.navigate('Profile', { userId: user.id });

  const onPosted = (post) => {
    setPosts((p) => [post, ...p]);
    setComposeOpen(false);
  };

  // ── render ───────────────────────────────────────────────────────────────
  const renderItem = ({ item }) => (
    <PostRow
      post={item}
      liked={!!liked[item.id]}
      reposted={!!reposted[item.id]}
      c={c}
      onOpen={() => setThread(item)}
      onAuthor={() => openProfile(item.author)}
      onMore={() => setMenu({ post: item, kind: 'more' })}
      onImage={(i) => setViewer({ urls: postImages(item), index: i })}
      onReply={() => setThread({ ...item, _reply: true })}
      onRepost={() => toggleRepost(item)}
      onLike={() => toggleLike(item)}
      onShare={() => setMenu({ post: item, kind: 'share' })}
    />
  );

  const header = (
    <View style={{ paddingTop: top, backgroundColor: c.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
      <View style={s.headRow}>
        <View style={s.headSide}>
          {me ? <Avatar user={me} size={32} onPress={() => openProfile(me)} /> : null}
        </View>
        <Text style={[s.headTitle, { color: c.text }]}>Crazy Corner</Text>
        <View style={s.headSide} />
      </View>
      <View style={s.tabs}>
        {[['all', 'For you'], ['following', 'Following']].map(([key, label]) => {
          const on = tab === key;
          return (
            <Pressable key={key} onPress={() => (key === 'following' && needSignIn('see who you follow') ? null : setTab(key))} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[s.tabText, { color: on ? c.text : c.muted, fontWeight: on ? '700' : '500' }]}>{label}</Text>
              <View style={[s.tabBar, { backgroundColor: on ? c.accent : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const empty = loading ? (
    <View style={s.center}><ActivityIndicator color={c.accent} /></View>
  ) : failed ? (
    <View style={s.center}>
      <Text style={[s.emptyTitle, { color: c.text }]}>Couldn't load posts</Text>
      <Text style={[s.emptySub, { color: c.muted }]}>Check your connection and pull down to try again.</Text>
    </View>
  ) : tab === 'following' ? (
    <View style={s.center}>
      <Text style={[s.emptyTitle, { color: c.text }]}>Nothing here yet</Text>
      <Text style={[s.emptySub, { color: c.muted }]}>Follow people from their posts (the ··· button) and what they post shows up here.</Text>
    </View>
  ) : (
    <View style={s.center}>
      <Text style={[s.emptyTitle, { color: c.text }]}>Say something</Text>
      <Text style={[s.emptySub, { color: c.muted }]}>Be the first to post in Crazy Corner.</Text>
    </View>
  );

  return (
    <View style={[s.page, { backgroundColor: c.bg }]}>
      {header}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        ListFooterComponent={more ? <ActivityIndicator style={{ marginVertical: 18 }} color={c.accent} /> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        contentContainerStyle={{ paddingBottom: NAV_CLEAR(insets) + 70, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load({ silent: true }); }} tintColor={c.accent} colors={[c.accent]} />}
        style={{ backgroundColor: c.bg }}
        initialNumToRender={8}
        windowSize={9}
      />

      <Pressable
        onPress={() => (needSignIn('post') ? null : setComposeOpen(true))}
        style={({ pressed }) => [s.fab, { bottom: NAV_CLEAR(insets) + 6, backgroundColor: c.accent, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        accessibilityRole="button"
        accessibilityLabel="New post"
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>

      {composeOpen ? <Composer me={me} c={c} onClose={() => setComposeOpen(false)} onPosted={onPosted} /> : null}

      {thread ? (
        <Thread
          post={thread}
          me={me}
          c={c}
          liked={!!liked[thread.id]}
          reposted={!!reposted[thread.id]}
          onClose={() => setThread(null)}
          onLike={() => toggleLike(thread)}
          onRepost={() => toggleRepost(thread)}
          onShare={() => setMenu({ post: thread, kind: 'share' })}
          onMore={() => setMenu({ post: thread, kind: 'more' })}
          onAuthor={(u) => { setThread(null); openProfile(u); }}
          onImage={(i) => setViewer({ urls: postImages(thread), index: i })}
          onReplied={() => bump(thread.id, 'comments_count', 1)}
          onReplyRemoved={() => bump(thread.id, 'comments_count', -1)}
          needSignIn={needSignIn}
        />
      ) : null}

      {menu ? (
        <Sheet c={c} onClose={() => setMenu(null)}>
          {menu.kind === 'share' ? (
            <>
              <SheetItem c={c} icon={<FontAwesome6 name="x-twitter" brand size={18} color={c.text} />} label="Post to X" onPress={() => shareToX(menu.post)} />
              <SheetItem c={c} icon={<Ionicons name="share-social-outline" size={20} color={c.text} />} label="Share via…" onPress={() => shareElsewhere(menu.post)} />
            </>
          ) : (
            <>
              {menu.post.user_id === me?.id ? (
                <SheetItem c={c} danger icon={<Ionicons name="trash-outline" size={20} color="#F4212E" />} label="Delete post" onPress={() => removePost(menu.post)} />
              ) : (
                <SheetItem
                  c={c}
                  icon={<Ionicons name={following.includes(menu.post.user_id) ? 'person-remove-outline' : 'person-add-outline'} size={20} color={c.text} />}
                  label={`${following.includes(menu.post.user_id) ? 'Unfollow' : 'Follow'} ${displayName(menu.post.author)}`}
                  onPress={() => { const u = menu.post.author || { id: menu.post.user_id }; setMenu(null); toggleFollow(u); }}
                />
              )}
              <SheetItem c={c} icon={<FontAwesome6 name="x-twitter" brand size={18} color={c.text} />} label="Post to X" onPress={() => shareToX(menu.post)} />
            </>
          )}
        </Sheet>
      ) : null}

      {viewer ? <Viewer {...viewer} onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

/* ── composer ─────────────────────────────────────────────────────────────── */
function Composer({ me, c, onClose, onPosted }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [images, setImages] = useState([]); // shrunk { uri, width, height }
  const [alsoX, setAlsoX] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ALSO_X_KEY).then((v) => setAlsoX(v === '1')).catch(() => {});
  }, []);
  const flipX = () => {
    setAlsoX((v) => {
      AsyncStorage.setItem(ALSO_X_KEY, v ? '0' : '1').catch(() => {});
      return !v;
    });
  };

  const pick = async () => {
    if (images.length >= MAX_IMAGES) return;
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { toast.info('Allow photo access to add pictures.'); return; }
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
        quality: 1,
      });
      if (r.canceled || !r.assets?.length) return;
      const shrunk = [];
      for (const a of r.assets.slice(0, MAX_IMAGES - images.length)) shrunk.push(await shrinkImage(a));
      setImages((cur) => [...cur, ...shrunk].slice(0, MAX_IMAGES));
    } catch {
      toast.error("Couldn't add that picture.");
    }
  };

  const canPost = (text.trim().length > 0 || images.length > 0) && !posting;
  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      const post = await createPost(me.id, { content: text, images });
      onPosted({ ...post, author: post.author || me });
      toast.success('Posted');
      if (alsoX) Linking.openURL(xShareUrl(text.trim() || 'New on Crazy Corner')).catch(() => {});
    } catch (e) {
      toast.error(`Couldn't post — ${e?.message || 'check your connection.'}`);
      setPosting(false);
    }
  };

  const left = POST_MAX - text.length;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.composeBar, { paddingTop: (Platform.OS === 'web' ? 0 : insets.top) + 6 }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"><Text style={{ color: c.text, fontSize: 16 }}>Cancel</Text></Pressable>
          <Pressable
            onPress={submit}
            disabled={!canPost}
            accessibilityRole="button"
            style={[s.pill, { backgroundColor: c.accent, opacity: canPost ? 1 : 0.5 }]}
          >
            {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.pillText}>Post</Text>}
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, flexDirection: 'row', gap: 12 }}>
          <Avatar user={me} size={40} />
          <View style={{ flex: 1 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="What's happening?"
              placeholderTextColor={c.muted}
              multiline
              autoFocus
              maxLength={POST_MAX}
              style={[s.composeInput, { color: c.text }]}
            />
            {images.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
                {images.map((im, i) => (
                  <View key={im.uri}>
                    <Image source={{ uri: im.uri }} style={[s.thumb, { borderColor: c.border }]} />
                    <Pressable onPress={() => setImages((cur) => cur.filter((_, j) => j !== i))} style={s.thumbX} accessibilityRole="button" accessibilityLabel="Remove picture">
                      <Ionicons name="close" size={16} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </ScrollView>
        <View style={[s.toolbar, { borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable onPress={pick} disabled={images.length >= MAX_IMAGES} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add pictures" style={{ opacity: images.length >= MAX_IMAGES ? 0.4 : 1 }}>
            <Ionicons name="image-outline" size={22} color={c.accent} />
          </Pressable>
          <Pressable onPress={flipX} accessibilityRole="switch" accessibilityState={{ checked: alsoX }} style={[s.xChip, { borderColor: alsoX ? c.text : c.border, backgroundColor: alsoX ? c.chip : 'transparent' }]}>
            <FontAwesome6 name="x-twitter" brand size={13} color={alsoX ? c.text : c.muted} />
            <Text style={{ color: alsoX ? c.text : c.muted, fontSize: 13, fontWeight: '600' }}>{alsoX ? 'Also on X' : 'Post on X too'}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <CharRing used={text.length} left={left} c={c} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CharRing({ used, left, c }) {
  const r = 10;
  const len = 2 * Math.PI * r;
  const pct = Math.min(1, used / POST_MAX);
  const color = left <= 0 ? '#F4212E' : left <= 20 ? '#FFD400' : c.accent;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {left <= 20 ? <Text style={{ color: left <= 0 ? '#F4212E' : c.muted, fontSize: 13 }}>{left}</Text> : null}
      <Svg width={26} height={26} viewBox="0 0 26 26">
        <Circle cx={13} cy={13} r={r} stroke={c.border} strokeWidth={2.5} fill="none" />
        <Circle cx={13} cy={13} r={r} stroke={color} strokeWidth={2.5} fill="none" strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - pct)} strokeLinecap="round" transform="rotate(-90 13 13)" />
      </Svg>
    </View>
  );
}

/* ── one post with its replies ─────────────────────────────────────────────── */
function Thread({ post, me, c, liked, reposted, onClose, onLike, onRepost, onShare, onMore, onAuthor, onImage, onReplied, onReplyRemoved, needSignIn }) {
  const insets = useSafeAreaInsets();
  const [replies, setReplies] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchReplies(post.id).then((r) => alive && setReplies(r)).catch(() => alive && setReplies([]));
    if (post._reply && me?.id) setTimeout(() => inputRef.current?.focus(), 350);
    return () => { alive = false; };
  }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (needSignIn('reply') || !text.trim() || sending) return;
    setSending(true);
    try {
      const r = await addReply(me.id, post.id, text);
      setReplies((cur) => [...(cur || []), { ...r, author: r.author || me }]);
      setText('');
      onReplied();
    } catch {
      toast.error("Couldn't send your reply.");
    }
    setSending(false);
  };

  const removeReply = async (r) => {
    try {
      await deleteReply(r.id);
      setReplies((cur) => cur.filter((x) => x.id !== r.id));
      onReplyRemoved();
    } catch {
      toast.error("Couldn't delete the reply.");
    }
  };

  const when = new Date(post.created_at);
  const stamp = `${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${when.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.threadBar, { paddingTop: (Platform.OS === 'web' ? 0 : insets.top) + 4, borderBottomColor: c.border }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
          <Text style={[s.threadTitle, { color: c.text }]}>Post</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar user={post.author} size={44} onPress={() => onAuthor(post.author)} />
              <View style={{ flex: 1 }}><Byline user={post.author} c={c} big onPressName={() => onAuthor(post.author)} /></View>
              <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options">
                <Ionicons name="ellipsis-horizontal" size={18} color={c.muted} />
              </Pressable>
            </View>
            {post.content ? <Text style={[s.bigText, { color: c.text }]}>{post.content}</Text> : null}
            <MediaGrid urls={postImages(post)} c={c} onOpen={onImage} tall />
            <Text style={[s.stamp, { color: c.muted }]}>{stamp}</Text>
            {(post.shares_count || post.likes_count) ? (
              <View style={[s.stats, { borderColor: c.border }]}>
                {post.shares_count ? <Text style={{ color: c.muted }}><Text style={{ color: c.text, fontWeight: '700' }}>{post.shares_count}</Text> {post.shares_count === 1 ? 'Repost' : 'Reposts'}</Text> : null}
                {post.likes_count ? <Text style={{ color: c.muted }}><Text style={{ color: c.text, fontWeight: '700' }}>{post.likes_count}</Text> {post.likes_count === 1 ? 'Like' : 'Likes'}</Text> : null}
              </View>
            ) : <View style={{ height: 10 }} />}
            <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, paddingBottom: 2 }}>
              <ActionBar post={{ ...post, comments_count: null, shares_count: null, likes_count: null }} liked={liked} reposted={reposted} onReply={() => inputRef.current?.focus()} onRepost={onRepost} onLike={onLike} onShare={onShare} c={c} spread />
            </View>
          </View>
          {replies == null ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={c.accent} />
          ) : replies.length === 0 ? (
            <Text style={{ color: c.muted, textAlign: 'center', marginTop: 28, fontSize: 15 }}>No replies yet. Start the conversation.</Text>
          ) : (
            replies.map((r) => (
              <View key={r.id} style={[s.reply, { borderBottomColor: c.border }]}>
                <Avatar user={r.author} size={36} onPress={() => onAuthor(r.author)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Byline user={r.author} time={r.created_at} c={c} onPressName={() => onAuthor(r.author)} />
                    {r.user_id === me?.id ? (
                      <Pressable onPress={() => removeReply(r)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete reply">
                        <Ionicons name="trash-outline" size={15} color={c.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={{ color: c.muted, fontSize: 14, marginTop: 1 }}>Replying to <Text style={{ color: c.accent }}>{displayName(post.author)}</Text></Text>
                  <Text style={[s.replyText, { color: c.text }]}>{r.content}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <View style={[s.replyBar, { borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
          {me ? <Avatar user={me} size={32} /> : null}
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={me ? 'Post your reply' : 'Sign in to reply'}
            editable={!!me}
            placeholderTextColor={c.muted}
            multiline
            maxLength={POST_MAX}
            style={[s.replyInput, { color: c.text, backgroundColor: c.raised }]}
          />
          <Pressable onPress={send} disabled={!text.trim() || sending} accessibilityRole="button" style={[s.pill, s.pillSmall, { backgroundColor: c.accent, opacity: text.trim() && !sending ? 1 : 0.5 }]}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.pillText}>Reply</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── bottom sheet menu ─────────────────────────────────────────────────────── */
function Sheet({ c, onClose, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[s.scrim, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[s.sheet, { backgroundColor: c.bg, paddingBottom: Math.max(insets.bottom, 12) + 8, borderColor: c.border }]}>
        <View style={[s.grab, { backgroundColor: c.border }]} />
        {children}
        <Pressable onPress={onClose} style={[s.cancel, { borderColor: c.border }]} accessibilityRole="button">
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
function SheetItem({ c, icon, label, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.sheetItem, { backgroundColor: pressed ? c.raised : 'transparent' }]} accessibilityRole="button">
      <View style={{ width: 26, alignItems: 'center' }}>{icon}</View>
      <Text style={{ color: danger ? '#F4212E' : c.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/* ── full-screen pictures ─────────────────────────────────────────────────── */
function Viewer({ urls, index, onClose }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [at, setAt] = useState(index);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {urls.map((u) => (
            <Pressable key={u} onPress={onClose} style={{ width, height }}>
              <Image source={{ uri: u }} style={{ width, height }} resizeMode="contain" />
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={onClose} style={[s.viewerClose, { top: (Platform.OS === 'web' ? 0 : insets.top) + 10 }]} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        {urls.length > 1 ? <Text style={[s.viewerCount, { bottom: insets.bottom + 20 }]}>{at + 1} / {urls.length}</Text> : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Web: pin to the screen so only the timeline scrolls (header and the new
  // post button stay put); phones already size the screen this way.
  page: Platform.OS === 'web' ? { ...StyleSheet.absoluteFillObject } : { flex: 1 },
  headRow: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  headSide: { width: 40 },
  headTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12 },
  tabText: { fontSize: 15, paddingBottom: 12 },
  tabBar: { height: 4, width: 56, borderRadius: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 15, lineHeight: 20, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 18, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  composeBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  pill: { height: 34, minWidth: 68, paddingHorizontal: 16, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pillSmall: { height: 32, minWidth: 64 },
  pillText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  composeInput: { fontSize: 19, lineHeight: 25, minHeight: 120, textAlignVertical: 'top', paddingTop: 6, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  thumb: { width: 110, height: 140, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  thumbX: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(15,20,25,0.75)', alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  xChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1 },
  threadBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  threadTitle: { fontSize: 18, fontWeight: '800', marginLeft: 12 },
  bigText: { fontSize: 17, lineHeight: 24, marginTop: 12 },
  stamp: { fontSize: 15, marginTop: 14, marginBottom: 12 },
  stats: { flexDirection: 'row', gap: 18, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  reply: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  replyText: { fontSize: 15, lineHeight: 20, marginTop: 2 },
  replyBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  replyInput: { flex: 1, minHeight: 38, maxHeight: 120, borderRadius: 19, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, fontSize: 15, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  scrim: { flex: 1 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 52, paddingHorizontal: 14, borderRadius: 12 },
  cancel: { height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginHorizontal: 8 },
  viewerClose: { position: 'absolute', left: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  viewerCount: { position: 'absolute', alignSelf: 'center', color: '#fff', fontSize: 14, fontWeight: '600' },
});
