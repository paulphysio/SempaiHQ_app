import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, Image, ActivityIndicator, Platform, RefreshControl, StyleSheet, Modal, useWindowDimensions, ScrollView, Keyboard,
} from 'react-native';
import KeyboardAvoidingView from '../components/KeyboardSafe';
import { setActiveChat } from '../services/activeChat';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';
import {
  myId, fetchPeople, searchPeople, fetchInbox, fetchCommunityPreview, fetchMessages, sendMessage,
  editMessage, deleteMessage, markRead, uploadPhoto, searchGifs, watchChat, PAGE,
} from '../services/chat';
import { shrinkImage } from '../utils/imageUpload';
import { GelGlass, GelModal, GelOption, GelInput, GelButton } from '../components/gel/GelKit';
import GelOrb from '../components/nav/GelOrb';
import { Avatar } from '../components/feed/FeedKit';
import { Bubble, DayPill, ChatRow, nameOf, dayLabel, listTime } from '../components/chat/ChatKit';
import { toast } from '../components/Toast';
import { gelAlert } from '../components/gel/GelAlert';

/*
 * Chat — the Community room (everyone) and private conversations.
 * List of chats → a conversation with bubbly messages, replies, photos, GIFs,
 * "typing…", sent/read ticks, and live delivery.
 */
const POLL_MS = 6000;

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState(undefined); // undefined = loading, null = signed out
  const [open, setOpen] = useState(null); // null | { type: 'group' } | { type: 'dm', userId, user }

  useEffect(() => {
    let alive = true;
    const load = () => myId().then((id) => alive && setMe(id));
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { alive = false; sub?.subscription?.unsubscribe(); };
  }, []);

  // Opened from elsewhere: { userId } (new) or { chatId: wallet } (older links)
  useEffect(() => {
    const p = route.params || {};
    if (p.userId) {
      fetchPeople([p.userId]).then((m) => setOpen({ type: 'dm', userId: p.userId, user: m[p.userId] || { id: p.userId } }));
    } else if (p.chatId && p.chatId !== 'group') {
      supabase.from('users').select('id, name, image').eq('wallet_address', p.chatId).maybeSingle()
        .then(({ data }) => data && setOpen({ type: 'dm', userId: data.id, user: data }));
    } else if (p.chatId === 'group') {
      setOpen({ type: 'group' });
    }
  }, [route.params?.userId, route.params?.chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = Platform.OS === 'web' ? 0 : insets.top;
  const page = [st.page, { backgroundColor: colors.bg }, Platform.OS === 'web' && StyleSheet.absoluteFillObject];

  if (me === undefined) {
    return <View style={[page, st.center]}><ActivityIndicator color={colors.accent} /></View>;
  }
  if (!me) {
    return (
      <View style={[page, { paddingTop: top }]}>
        <Header title="Chats" onBack={() => navigation.goBack()} colors={colors} />
        <View style={[st.center, { flex: 1, padding: 28 }]}>
          <GelOrb icon="comments" size={70} lit breathe={false} />
          <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>Sign in to chat</Text>
          <Text style={[st.emptySub, { color: colors.textSecondary }]}>Talk with readers and creators in the Community room, or message anyone privately.</Text>
        </View>
      </View>
    );
  }

  return open ? (
    <Conversation chat={open} me={me} onBack={() => (route.params?.userId || route.params?.chatId ? navigation.goBack() : setOpen(null))} />
  ) : (
    <ChatList me={me} onOpen={setOpen} onBack={() => navigation.goBack()} />
  );
}

/* ── header ─────────────────────────────────────────────────────────────── */
function Header({ title, subtitle, onBack, right, left, colors, onPressTitle }) {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 0 : insets.top;
  return (
    <View style={{ paddingTop: top + 6, paddingHorizontal: 10, paddingBottom: 8 }}>
      <GelGlass radius={30} glow={false}>
        <View style={st.headRow}>
          <GelOrb icon="arrow-left" size={36} onPress={onBack} label="Back" breathe={false} />
          {left}
          <Pressable style={{ flex: 1, minWidth: 0 }} onPress={onPressTitle} disabled={!onPressTitle}>
            <Text style={[st.headTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={[st.headSub, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
          </Pressable>
          {right}
        </View>
      </GelGlass>
    </View>
  );
}

/* ── list of chats ──────────────────────────────────────────────────────── */
function ChatList({ me, onOpen, onBack }) {
  const { colors } = useTheme();
  const [rows, setRows] = useState(null);
  const [community, setCommunity] = useState(null);
  const [q, setQ] = useState('');
  const [people, setPeople] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inbox, last] = await Promise.all([fetchInbox(), fetchCommunityPreview()]);
      setRows(inbox);
      setCommunity(last);
      setError(false);
    } catch {
      setError(true);
      setRows((r) => r || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]));

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setPeople([]); return undefined; }
    const t = setTimeout(() => searchPeople(term, me).then(setPeople).catch(() => setPeople([])), 300);
    return () => clearTimeout(t);
  }, [q, me]);

  const term = q.trim().toLowerCase();
  const shown = (rows || []).filter((r) => !term || (r.other_name || '').toLowerCase().includes(term));
  const totalUnread = (rows || []).reduce((n, r) => n + (r.unread || 0), 0);
  const preview = (r) => {
    const body = r.last_content || (r.last_media ? '📷 Photo' : '');
    return `${r.last_from_me ? 'You: ' : ''}${body}`;
  };

  return (
    <View style={[st.page, { backgroundColor: colors.bg }, Platform.OS === 'web' && StyleSheet.absoluteFillObject]}>
      <Header title="Chats" subtitle={totalUnread ? `${totalUnread} unread` : 'Community and private messages'} onBack={onBack} colors={colors} />
      <FlatList
        data={shown}
        keyExtractor={(r) => r.other_id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} colors={[colors.accent]} />}
        ListHeaderComponent={
          <View>
            <GelInput placeholder="Search chats or people" value={q} onChangeText={setQ} autoCapitalize="none" style={{ marginTop: 2, marginBottom: 12 }} />
            {people.length ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={[st.section, { color: colors.textMuted }]}>PEOPLE</Text>
                {people.map((u) => (
                  <ChatRow key={u.id} user={u} title={nameOf(u)} preview="Start a conversation" time="" onPress={() => onOpen({ type: 'dm', userId: u.id, user: u })} />
                ))}
              </View>
            ) : null}
            {!term ? (
              <>
                <Text style={[st.section, { color: colors.textMuted }]}>COMMUNITY</Text>
                <ChatRow
                  title="Community"
                  icon={<View pointerEvents="none"><GelOrb icon="users" size={44} lit breathe={false} /></View>}
                  preview={community ? (community.content || (community.media_url ? '📷 Photo' : '')) : 'Say hi to everyone on SempaiHQ'}
                  time={community ? listTime(community.created_at) : ''}
                  onPress={() => onOpen({ type: 'group' })}
                />
                <Text style={[st.section, { color: colors.textMuted, marginTop: 8 }]}>PRIVATE</Text>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ChatRow
            user={{ id: item.other_id, name: item.other_name, image: item.other_image }}
            title={nameOf({ name: item.other_name })}
            preview={preview(item)}
            time={listTime(item.last_at)}
            unread={item.unread}
            onPress={() => onOpen({ type: 'dm', userId: item.other_id, user: { id: item.other_id, name: item.other_name, image: item.other_image } })}
          />
        )}
        ListEmptyComponent={
          rows === null ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
          ) : (
            <View style={[st.center, { paddingVertical: 30 }]}>
              <Text style={[st.emptySub, { color: colors.textSecondary }]}>
                {error ? "Couldn't load your chats — pull down to retry." : term ? 'No chats match.' : 'No private chats yet. Search for someone above to start one.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

/* ── one conversation ───────────────────────────────────────────────────── */
function Conversation({ chat, me, onBack }) {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [kbOpen, setKbOpen] = useState(false);
  // this chat is on screen: its pushes shouldn't pop a banner
  useEffect(() => {
    setActiveChat(chat.type === 'group' ? 'group' : chat.userId);
    return () => setActiveChat(null);
  }, [chat.type, chat.userId]);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const { width, height } = useWindowDimensions();
  const [msgs, setMsgs] = useState([]); // oldest → newest
  const [people, setPeople] = useState(chat.user ? { [chat.user.id]: chat.user } : {});
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(false);
  const [ended, setEnded] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null); // message whose options are open
  const [attach, setAttach] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [typing, setTyping] = useState(null);
  const [sending, setSending] = useState(false);
  const watch = useRef(null);
  const typingTimer = useRef(null);
  const isGroup = chat.type === 'group';

  const learnPeople = useCallback(async (list) => {
    const ids = list.map((m) => m.authorId).filter((id) => id && !people[id]);
    if (!ids.length) return;
    const found = await fetchPeople(ids);
    setPeople((p) => ({ ...p, ...found }));
  }, [people]);

  const merge = useCallback((incoming) => {
    setMsgs((cur) => {
      const byId = new Map(cur.filter((m) => !m.temp).map((m) => [m.id, m]));
      incoming.forEach((m) => byId.set(m.id, { ...byId.get(m.id), ...m }));
      const temps = cur.filter((m) => m.temp && !incoming.some((n) => n.content === m.content && n.authorId === m.authorId));
      return [...byId.values(), ...temps].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
  }, []);

  // first page + live updates + a quiet poll in case live delivery is off
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const first = await fetchMessages(chat, { me });
        if (!alive) return;
        setMsgs(first);
        setEnded(first.length < PAGE);
        learnPeople(first);
        if (!isGroup) markRead(chat.userId);
      } catch {
        toast.error("Couldn't load messages.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    watch.current = watchChat(chat, me, {
      onInsert: (m) => { merge([m]); learnPeople([m]); if (!isGroup && m.authorId !== me) markRead(chat.userId); },
      onUpdate: (m) => merge([m]),
      onDelete: (id) => setMsgs((cur) => cur.filter((m) => m.id !== id)),
      onTyping: (uid) => {
        if (!uid || uid === me) return;
        setTyping(uid);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(null), 3500);
      },
    });
    const poll = setInterval(async () => {
      try {
        const latest = await fetchMessages(chat, { me });
        if (!alive) return;
        merge(latest);
        if (!isGroup && latest.some((m) => m.authorId !== me && !m.readAt)) markRead(chat.userId);
      } catch {}
    }, POLL_MS);
    return () => { alive = false; clearInterval(poll); clearTimeout(typingTimer.current); watch.current?.stop(); };
  }, [chat.type, chat.userId, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = async () => {
    if (older || ended || !msgs.length) return;
    setOlder(true);
    try {
      const more = await fetchMessages(chat, { me, before: msgs.find((m) => !m.temp)?.createdAt });
      merge(more);
      learnPeople(more);
      setEnded(more.length < PAGE);
    } catch {}
    setOlder(false);
  };

  const byId = useMemo(() => Object.fromEntries(msgs.map((m) => [m.id, m])), [msgs]);
  const parentOf = (m) => {
    const p = m.parentId && byId[m.parentId];
    if (!p) return null;
    return { name: p.authorId === me ? 'You' : nameOf(people[p.authorId]), content: p.content, media: p.media };
  };

  // newest first for the inverted list, with day separators
  const items = useMemo(() => {
    const out = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      const prev = msgs[i - 1];
      const next = msgs[i + 1];
      const first = !prev || prev.authorId !== m.authorId || new Date(m.createdAt) - new Date(prev.createdAt) > 5 * 60 * 1000;
      const last = !next || next.authorId !== m.authorId || new Date(next.createdAt) - new Date(m.createdAt) > 5 * 60 * 1000;
      out.push({ type: 'msg', key: m.id, m, first, last });
      if (!prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt)) out.push({ type: 'day', key: `day-${m.createdAt}`, label: dayLabel(m.createdAt) });
    }
    return out;
  }, [msgs]);

  const send = async ({ media = null } = {}) => {
    const body = text.trim();
    if (sending || (!body && !media)) return;
    if (editing) {
      const id = editing.id;
      setEditing(null);
      setText('');
      merge([{ ...editing, content: body, editedAt: new Date().toISOString() }]);
      try { await editMessage(chat, id, body); } catch { toast.error("Couldn't save the edit."); }
      return;
    }
    const temp = { id: `temp-${Date.now()}`, temp: true, authorId: me, content: body, media, parentId: replyTo?.id || null, createdAt: new Date().toISOString(), status: 'sending' };
    setMsgs((cur) => [...cur, temp]);
    setText('');
    setReplyTo(null);
    setSending(true);
    try {
      const saved = await sendMessage(chat, { content: body, media, parentId: temp.parentId });
      setMsgs((cur) => cur.filter((m) => m.id !== temp.id && m.id !== saved.id).concat(saved).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    } catch (e) {
      setMsgs((cur) => cur.map((m) => (m.id === temp.id ? { ...m, status: 'failed' } : m)));
      toast.error("Message not sent — check your connection and try again.");
    }
    setSending(false);
  };

  const pickPhoto = async () => {
    setAttach(false);
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { toast.info('Allow photo access to send pictures.'); return; }
      }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
      if (r.canceled || !r.assets?.[0]) return;
      setSending(true);
      const small = await shrinkImage(r.assets[0], 1600);
      const url = await uploadPhoto(me, small);
      setSending(false);
      await send({ media: url });
    } catch (e) {
      setSending(false);
      toast.error(e?.message || "Couldn't send the photo.");
    }
  };

  const remove = (m) => {
    setMenu(null);
    gelAlert('Delete message?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setMsgs((cur) => cur.filter((x) => x.id !== m.id));
          try { await deleteMessage(chat, m.id); } catch { toast.error("Couldn't delete it."); merge([m]); }
        },
      },
    ]);
  };

  const other = !isGroup ? people[chat.userId] || chat.user : null;
  const title = isGroup ? 'Community' : nameOf(other);
  const subtitle = typing ? (isGroup ? `${nameOf(people[typing])} is typing…` : 'typing…') : isGroup ? 'Everyone on SempaiHQ' : 'Private chat';
  const openProfile = (uid) => uid && navigation.navigate('Profile', { userId: uid });
  const statusOf = (m) => m.status || (isGroup ? 'sent' : m.readAt ? 'read' : 'sent');

  return (
    <KeyboardAvoidingView
      style={[st.page, { backgroundColor: colors.bg }, Platform.OS === 'web' && StyleSheet.absoluteFillObject]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        colors={colors}
        onPressTitle={!isGroup ? () => openProfile(chat.userId) : undefined}
        left={isGroup
          ? <View pointerEvents="none"><GelOrb icon="users" size={34} lit breathe={false} /></View>
          : <Avatar user={other} size={36} onPress={() => openProfile(chat.userId)} />}
      />

      {loading ? (
        <View style={[st.center, { flex: 1 }]}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          inverted
          data={items}
          keyExtractor={(it) => it.key}
          renderItem={({ item }) =>
            item.type === 'day' ? (
              <DayPill label={item.label} />
            ) : (
              <Bubble
                msg={item.m}
                mine={item.m.authorId === me}
                first={item.first}
                last={item.last}
                showAuthor={isGroup}
                author={people[item.m.authorId]}
                parent={parentOf(item.m)}
                status={statusOf(item.m)}
                onLongPress={() => !item.m.temp && setMenu(item.m)}
                onPressImage={setViewer}
                onPressAuthor={() => openProfile(item.m.authorId)}
              />
            )
          }
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          ListFooterComponent={older ? <ActivityIndicator style={{ margin: 14 }} color={colors.accent} /> : <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={[st.center, { padding: 30, transform: [{ scaleY: -1 }] }]}>
              <GelOrb icon={isGroup ? 'users' : 'comment-dots'} size={56} lit breathe={false} />
              <Text style={[st.emptySub, { color: colors.textSecondary, marginTop: 12 }]}>
                {isGroup ? 'Be the first to say something to everyone.' : `Say hi to ${nameOf(other)} 👋`}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* composer */}
      <View style={{ paddingHorizontal: 10, paddingBottom: kbOpen ? 8 : Math.max(insets.bottom, 10), paddingTop: 4 }}>
        <GelGlass radius={28} glow={false}>
          {replyTo || editing ? (
            <View style={[st.replyBar, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : `rgba(${colors.accentRgb},0.12)` }]}>
              <View style={[st.replyAccent, { backgroundColor: colors.accent }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>
                  {editing ? 'Editing message' : `Replying to ${replyTo.authorId === me ? 'yourself' : nameOf(people[replyTo.authorId])}`}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
                  {(editing || replyTo).content || '📷 Photo'}
                </Text>
              </View>
              <GelOrb icon="times" size={26} iconSize={10} onPress={() => { setReplyTo(null); if (editing) { setEditing(null); setText(''); } }} label="Cancel" breathe={false} />
            </View>
          ) : null}
          <View style={st.composer}>
            {!editing ? <GelOrb icon="plus" size={36} onPress={() => setAttach(true)} label="Add photo or GIF" breathe={false} /> : null}
            <TextInput
              value={text}
              onChangeText={(t) => { setText(t); if (t) watch.current?.typing(); }}
              placeholder={isGroup ? 'Message everyone…' : 'Message…'}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              style={[st.input, { color: colors.textPrimary, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)', borderColor: isDark ? 'rgba(255,255,255,0.10)' : `rgba(${colors.accentRgb},0.18)` }]}
            />
            <GelOrb
              icon={editing ? 'check' : 'paper-plane'}
              size={40}
              lit={!!text.trim()}
              loading={sending}
              disabled={!text.trim() || sending}
              onPress={() => send()}
              label={editing ? 'Save edit' : 'Send'}
              breathe={false}
            />
          </View>
        </GelGlass>
      </View>

      {/* message options */}
      <GelModal visible={!!menu} onClose={() => setMenu(null)} variant="sheet" title="Message">
        {menu ? (
          <View style={{ marginTop: 6 }}>
            <GelOption icon="reply" title="Reply" onPress={() => { setReplyTo(menu); setMenu(null); }} />
            {menu.content ? (
              <GelOption icon="copy" title="Copy text" onPress={async () => { try { await Clipboard.setStringAsync(menu.content); toast.success('Copied'); } catch {} setMenu(null); }} />
            ) : null}
            {menu.authorId === me && menu.content ? (
              <GelOption icon="pen" title="Edit" onPress={() => { setEditing(menu); setText(menu.content); setReplyTo(null); setMenu(null); }} />
            ) : null}
            {menu.authorId === me ? <GelOption icon="trash" tone="#E5484D" title="Delete" onPress={() => remove(menu)} /> : null}
            {menu.authorId !== me && isGroup ? (
              <GelOption icon="comment" title={`Message ${nameOf(people[menu.authorId])} privately`} onPress={() => { const u = people[menu.authorId] || { id: menu.authorId }; setMenu(null); navigation.push('Chat', { userId: u.id }); }} />
            ) : null}
          </View>
        ) : null}
      </GelModal>

      {/* attach */}
      <GelModal visible={attach} onClose={() => setAttach(false)} variant="sheet" title="Send">
        <View style={{ marginTop: 6 }}>
          <GelOption icon="image" title="Photo" description="From your gallery" onPress={pickPhoto} />
          <GelOption icon="film" title="GIF" description="Search the SempaiHQ GIF library" onPress={() => { setAttach(false); setGifOpen(true); }} />
        </View>
      </GelModal>

      <GifPicker visible={gifOpen} onClose={() => setGifOpen(false)} onPick={(url) => { setGifOpen(false); send({ media: url }); }} />

      {/* full-size photo */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }} onPress={() => setViewer(null)} accessibilityLabel="Close photo">
          {viewer ? <Image source={{ uri: viewer }} style={{ width, height: height * 0.85 }} resizeMode="contain" /> : null}
          <View style={{ position: 'absolute', top: (Platform.OS === 'web' ? 0 : insets.top) + 10, left: 12 }}>
            <GelOrb icon="times" size={36} onPress={() => setViewer(null)} label="Close" breathe={false} />
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function GifPicker({ visible, onClose, onPick }) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState(null);
  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(() => searchGifs(q).then(setGifs).catch(() => setGifs([])), 250);
    return () => clearTimeout(t);
  }, [q, visible]);
  return (
    <GelModal visible={visible} onClose={onClose} variant="sheet" title="GIFs">
      <GelInput placeholder="Search GIFs" value={q} onChangeText={setQ} autoCapitalize="none" />
      <ScrollView style={{ maxHeight: 380, marginTop: 12 }} showsVerticalScrollIndicator={false}>
        {gifs === null ? (
          <ActivityIndicator color={colors.accent} />
        ) : gifs.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {gifs.map((g) => (
              <Pressable key={g.id} onPress={() => onPick(g.url)} style={{ width: '31.5%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden' }} accessibilityRole="button" accessibilityLabel={g.title || 'GIF'}>
                <Image source={{ uri: g.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 20 }}>No GIFs found.</Text>
        )}
      </ScrollView>
    </GelModal>
  );
}

const st = StyleSheet.create({
  page: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 6 },
  headTitle: { fontFamily: 'Yoruka', fontSize: 20 },
  headSub: { fontSize: 12, marginTop: 1 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8, marginLeft: 6 },
  emptyTitle: { fontFamily: 'Yoruka', fontSize: 24, marginTop: 18, textAlign: 'center' },
  emptySub: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, padding: 6 },
  input: {
    flex: 1, minHeight: 42, maxHeight: 130, borderRadius: 21, borderWidth: 1, paddingHorizontal: 15,
    paddingTop: 10, paddingBottom: 10, fontSize: 16, marginBottom: 6, ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  replyAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
});
