import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import GelOrb from '../nav/GelOrb';
import { toast } from '../Toast';
import { radius, space } from '../../theme/tokens';
import { saveDraft, loadDraft, loadWriterPrefs, saveWriterPrefs, timeSince } from '../../services/drafts';

/*
 * Writing Studio — a full-screen, offline-first chapter editor.
 *
 *  · insert at the cursor: “ ” ‘ ’ — … ✦ scene break, paste
 *  · undo / redo history
 *  · find & replace (next, replace, replace all)
 *  · tidy: smart quotes, ellipses, dashes, stray spaces, blank lines
 *  · live words / characters / paragraphs / reading time + word goal
 *  · text size, remembered
 *  · autosaves a draft to the device every ~1s — survives offline, crashes
 *    and closing the app; restored automatically next time
 *
 * Chapters are plain text (the reader turns each line into a paragraph), so
 * the tools are typography & structure aids, not markup.
 */

const SCENE_BREAK = '\n\n✦ ✦ ✦\n\n';
const HISTORY_LIMIT = 120;
const GOALS = [500, 1000, 2000, 3000, 5000];

const countWords = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const countParagraphs = (t) => t.split('\n').filter((l) => l.trim()).length;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Smart typography + whitespace clean-up. */
export const tidyText = (text) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '') // trailing spaces
    .replace(/^[ \t]+/gm, '') // leading spaces
    .replace(/[ \t]{2,}/g, ' ') // double spaces
    .replace(/\.{3}/g, '…')
    .replace(/ ?-{2,} ?/g, ' — ')
    .replace(/(^|[\s([{—-])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s([{—-])'/g, '$1‘')
    .replace(/'/g, '’')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const ToolButton = ({ icon, glyph, label, onPress, disabled, active, colors, styles }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    hitSlop={4}
    style={({ pressed }) => [
      styles.tool,
      active && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
      pressed && { transform: [{ scale: 0.92 }] },
      disabled && { opacity: 0.35 },
    ]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    {icon ? <FontAwesome5 name={icon} size={14} color={active ? colors.accent : colors.textPrimary} solid /> : null}
    {glyph ? <Text style={[styles.toolGlyph, { color: active ? colors.accent : colors.textPrimary }]}>{glyph}</Text> : null}
  </Pressable>
);

const ChapterEditor = ({
  visible,
  onClose,
  onDone,
  heading = 'New chapter',
  initialTitle = '',
  initialContent = '',
  draftKey,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialContent);
  const [prefs, setPrefs] = useState({ fontSize: 17, goal: 2000 });
  const [savedAt, setSavedAt] = useState(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [goalOpen, setGoalOpen] = useState(false);
  const [, forceTick] = useState(0); // refreshes "saved Xs ago"
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const inputRef = useRef(null);
  const selRef = useRef({ start: 0, end: 0 });
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const committed = useRef(initialContent);
  const snapTimer = useRef(null);
  const saveTimer = useRef(null);
  const latest = useRef({ title: initialTitle, text: initialContent });
  latest.current = { title, text };

  /* ── open: reset, then offer an unsaved draft if there is one ── */
  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    setTitle(initialTitle);
    setText(initialContent);
    committed.current = initialContent;
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setFindOpen(false);
    setSavedAt(null);
    loadWriterPrefs().then((p) => alive && setPrefs(p));

    if (draftKey) {
      loadDraft(draftKey).then((draft) => {
        if (!alive || !draft) return;
        const same = draft.content === initialContent && draft.title === initialTitle;
        if (same) {
          setSavedAt(draft.updatedAt);
          return;
        }
        const restore = () => {
          setTitle(draft.title || initialTitle);
          setText(draft.content || '');
          committed.current = draft.content || '';
          setSavedAt(draft.updatedAt);
          toast.success(`Draft restored — saved ${timeSince(draft.updatedAt)}`);
        };
        if (!initialContent.trim() && !initialTitle.trim()) restore();
        else
          Alert.alert('Unsaved draft found', `You have a newer draft on this device (${timeSince(draft.updatedAt)}). Restore it?`, [
            { text: 'Keep current', style: 'cancel' },
            { text: 'Restore draft', onPress: restore },
          ]);
      });
    }
    const tick = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => {
      alive = false;
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /* ── autosave to the device ── */
  const flushSave = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!draftKey) return;
    const d = await saveDraft(draftKey, { title: latest.current.title, content: latest.current.text });
    if (d) setSavedAt(d.updatedAt);
  }, [draftKey]);

  useEffect(() => {
    if (!visible || !draftKey) return undefined;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 1000);
    return () => clearTimeout(saveTimer.current);
  }, [title, text, visible, draftKey, flushSave]);

  useEffect(() => () => { clearTimeout(snapTimer.current); clearTimeout(saveTimer.current); }, []);

  /* ── history ── */
  const pushHistory = useCallback((prev) => {
    if (prev === undefined) return;
    undoStack.current.push(prev);
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // Typing is committed to history after a short pause (word-sized steps).
  const onChangeText = (t) => {
    setText(t);
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      if (committed.current !== t) {
        pushHistory(committed.current);
        committed.current = t;
      }
    }, 700);
  };

  const applyEdit = useCallback((next, cursor) => {
    clearTimeout(snapTimer.current);
    if (committed.current !== latest.current.text) pushHistory(committed.current);
    pushHistory(latest.current.text);
    committed.current = next;
    setText(next);
    if (typeof cursor === 'number') {
      selRef.current = { start: cursor, end: cursor };
      setTimeout(() => inputRef.current?.setNativeProps?.({ selection: { start: cursor, end: cursor } }), 30);
    }
  }, [pushHistory]);

  const undo = () => {
    clearTimeout(snapTimer.current);
    const cur = latest.current.text;
    if (committed.current !== cur) {
      // un-committed typing: snapshot first so redo can bring it back
      undoStack.current.push(committed.current);
    }
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    redoStack.current.push(cur);
    committed.current = prev;
    setText(prev);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(latest.current.text);
    committed.current = next;
    setText(next);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  };

  /* ── insert at cursor ── */
  const insert = (snippet, { wrap } = {}) => {
    const t = latest.current.text;
    const { start, end } = selRef.current;
    const s = Math.min(start, t.length);
    const e = Math.min(Math.max(end, s), t.length);
    if (wrap) {
      const [open, close] = wrap;
      const inner = t.slice(s, e);
      applyEdit(t.slice(0, s) + open + inner + close + t.slice(e), s + open.length + inner.length + (inner ? close.length : 0));
    } else {
      applyEdit(t.slice(0, s) + snippet + t.slice(e), s + snippet.length);
    }
  };

  const paste = async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      if (!clip) {
        toast.info('Clipboard is empty');
        return;
      }
      insert(clip.replace(/\r\n?/g, '\n'));
    } catch {
      toast.error('Could not read the clipboard');
    }
  };

  const copyAll = async () => {
    try {
      await Clipboard.setStringAsync(latest.current.text);
      toast.success('Chapter copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const tidy = () => {
    const next = tidyText(latest.current.text);
    if (next === latest.current.text) {
      toast.info('Already tidy ✨');
      return;
    }
    applyEdit(next);
    toast.success('Tidied — smart quotes, dashes and spacing fixed');
  };

  /* ── find & replace ── */
  const matches = useMemo(() => {
    if (!findQuery) return 0;
    const m = text.match(new RegExp(escapeRe(findQuery), 'gi'));
    return m ? m.length : 0;
  }, [text, findQuery]);

  const findNext = () => {
    if (!findQuery || !matches) return;
    const t = latest.current.text.toLowerCase();
    const q = findQuery.toLowerCase();
    let i = t.indexOf(q, selRef.current.end);
    if (i < 0) i = t.indexOf(q); // wrap around
    if (i < 0) return;
    const sel = { start: i, end: i + findQuery.length };
    selRef.current = sel;
    inputRef.current?.focus();
    setTimeout(() => inputRef.current?.setNativeProps?.({ selection: sel }), 30);
  };

  const replaceOne = () => {
    const t = latest.current.text;
    const { start, end } = selRef.current;
    if (findQuery && t.slice(start, end).toLowerCase() === findQuery.toLowerCase()) {
      applyEdit(t.slice(0, start) + replaceWith + t.slice(end), start + replaceWith.length);
      setTimeout(findNext, 60);
    } else {
      findNext();
    }
  };

  const replaceAll = () => {
    if (!findQuery || !matches) return;
    const n = matches;
    applyEdit(latest.current.text.replace(new RegExp(escapeRe(findQuery), 'gi'), replaceWith));
    toast.success(`Replaced ${n} match${n === 1 ? '' : 'es'}`);
  };

  /* ── prefs ── */
  const setFont = (delta) => {
    const next = { ...prefs, fontSize: Math.max(13, Math.min(26, prefs.fontSize + delta)) };
    setPrefs(next);
    saveWriterPrefs(next);
  };
  const setGoal = (goal) => {
    const next = { ...prefs, goal };
    setPrefs(next);
    saveWriterPrefs(next);
    setGoalOpen(false);
  };

  /* ── close / done ── */
  const done = async () => {
    if (!latest.current.text.trim()) {
      toast.error('Write something first');
      return;
    }
    await flushSave();
    onDone?.({ title: latest.current.title.trim(), content: latest.current.text.replace(/\s+$/, '') });
  };

  const close = async () => {
    await flushSave();
    onClose?.();
  };

  /* ── stats ── */
  const words = countWords(text);
  const paragraphs = countParagraphs(text);
  const minutes = Math.max(1, Math.round(words / 230));
  const goalPct = Math.min(1, prefs.goal ? words / prefs.goal : 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LinearGradient
          pointerEvents="none"
          colors={[`rgba(${colors.accentRgb},${isDark ? 0.12 : 0.06})`, 'rgba(0,0,0,0)']}
          style={styles.glow}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* top bar */}
          <View style={styles.bar}>
            <GelOrb icon="times" size={38} onPress={close} label="Close editor (your draft is kept)" breathe={false} />
            <View style={styles.barText}>
              <Text style={styles.barEyebrow}>WRITING STUDIO</Text>
              <View style={styles.savedRow}>
                <View style={[styles.savedDot, { backgroundColor: savedAt ? colors.success : colors.textFaint }]} />
                <Text style={styles.savedText} numberOfLines={1}>
                  {savedAt ? `Saved on device · ${timeSince(savedAt)}` : 'Autosaves on this device'}
                </Text>
              </View>
            </View>
            <Pressable onPress={done} style={({ pressed }) => [styles.doneBtn, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel="Done, use this chapter">
              <LinearGradient colors={[colors.accentHi, colors.accent, colors.accentDeep]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.doneFill}>
                <FontAwesome5 name="check" size={12} color="#FFFFFF" />
                <Text style={styles.doneText}>Done</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* page */}
          <View style={styles.page}>
            <Text style={styles.heading}>{heading.toUpperCase()}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Chapter title"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              style={styles.titleInput}
              maxLength={150}
              returnKeyType="next"
              onSubmitEditing={() => inputRef.current?.focus()}
              blurOnSubmit={false}
            />
            <View style={styles.rule} />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={onChangeText}
              onSelectionChange={(e) => { selRef.current = e.nativeEvent.selection; }}
              placeholder={'Once upon a time…\n\nEach line becomes a paragraph for your readers.'}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              multiline
              scrollEnabled
              textAlignVertical="top"
              autoCapitalize="sentences"
              autoCorrect
              spellCheck
              style={[styles.body, { fontSize: prefs.fontSize, lineHeight: Math.round(prefs.fontSize * 1.65) }]}
            />
          </View>

          {/* stats + goal */}
          <View style={styles.stats}>
            <Text style={styles.statText}>
              <Text style={styles.statStrong}>{words.toLocaleString()}</Text> words · {text.length.toLocaleString()} chars · {paragraphs} ¶ · {minutes} min
            </Text>
            <Pressable onPress={() => setGoalOpen((v) => !v)} hitSlop={8} style={styles.goal} accessibilityRole="button" accessibilityLabel={`Word goal ${prefs.goal}. Tap to change`}>
              <View style={[styles.goalTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.goalFill, { width: `${goalPct * 100}%`, backgroundColor: goalPct >= 1 ? colors.success : colors.accent }]} />
              </View>
              <Text style={[styles.goalText, goalPct >= 1 && { color: colors.success }]}>
                {goalPct >= 1 ? 'Goal met' : `${prefs.goal.toLocaleString()} goal`}
              </Text>
            </Pressable>
          </View>
          {goalOpen ? (
            <View style={styles.goalRow}>
              {GOALS.map((g) => (
                <Pressable key={g} onPress={() => setGoal(g)} style={[styles.goalChip, prefs.goal === g && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.goalChipText, prefs.goal === g && { color: colors.accent }]}>{g.toLocaleString()}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* find & replace */}
          {findOpen ? (
            <View style={styles.findPanel}>
              <View style={styles.findRow}>
                <View style={styles.findField}>
                  <FontAwesome5 name="search" size={11} color={colors.textMuted} />
                  <TextInput
                    value={findQuery}
                    onChangeText={setFindQuery}
                    placeholder="Find"
                    placeholderTextColor={colors.textMuted}
                    style={styles.findInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={findNext}
                  />
                  <Text style={styles.findCount}>{findQuery ? matches : ''}</Text>
                </View>
                <Pressable onPress={findNext} disabled={!matches} style={[styles.findBtn, !matches && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Next match">
                  <FontAwesome5 name="arrow-down" size={12} color={colors.textPrimary} />
                </Pressable>
              </View>
              <View style={styles.findRow}>
                <View style={styles.findField}>
                  <FontAwesome5 name="exchange-alt" size={11} color={colors.textMuted} />
                  <TextInput
                    value={replaceWith}
                    onChangeText={setReplaceWith}
                    placeholder="Replace with"
                    placeholderTextColor={colors.textMuted}
                    style={styles.findInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Pressable onPress={replaceOne} disabled={!matches} style={[styles.findTextBtn, !matches && { opacity: 0.4 }]}>
                  <Text style={styles.findTextBtnLabel}>Replace</Text>
                </Pressable>
                <Pressable onPress={replaceAll} disabled={!matches} style={[styles.findTextBtn, { backgroundColor: colors.accent, borderColor: colors.accent }, !matches && { opacity: 0.4 }]}>
                  <Text style={[styles.findTextBtnLabel, { color: '#FFFFFF' }]}>All</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* toolbar (rides above the keyboard) */}
          <View style={[styles.toolbarWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.toolbar}>
              <ToolButton icon="undo" label="Undo" onPress={undo} disabled={!canUndo && committed.current === text} colors={colors} styles={styles} />
              <ToolButton icon="redo" label="Redo" onPress={redo} disabled={!canRedo} colors={colors} styles={styles} />
              <View style={styles.sep} />
              <ToolButton glyph="“ ”" label="Insert double quotes" onPress={() => insert('', { wrap: ['“', '”'] })} colors={colors} styles={styles} />
              <ToolButton glyph="‘ ’" label="Insert single quotes" onPress={() => insert('', { wrap: ['‘', '’'] })} colors={colors} styles={styles} />
              <ToolButton glyph="—" label="Insert em dash" onPress={() => insert('—')} colors={colors} styles={styles} />
              <ToolButton glyph="…" label="Insert ellipsis" onPress={() => insert('…')} colors={colors} styles={styles} />
              <ToolButton glyph="✦" label="Insert scene break" onPress={() => insert(SCENE_BREAK)} colors={colors} styles={styles} />
              <View style={styles.sep} />
              <ToolButton icon="search" label="Find and replace" onPress={() => setFindOpen((v) => !v)} active={findOpen} colors={colors} styles={styles} />
              <ToolButton icon="magic" label="Tidy typography and spacing" onPress={tidy} colors={colors} styles={styles} />
              <ToolButton icon="paste" label="Paste" onPress={paste} colors={colors} styles={styles} />
              <ToolButton icon="copy" label="Copy chapter" onPress={copyAll} colors={colors} styles={styles} />
              <View style={styles.sep} />
              <ToolButton glyph="A−" label="Smaller text" onPress={() => setFont(-1)} colors={colors} styles={styles} />
              <ToolButton glyph="A+" label="Larger text" onPress={() => setFont(1)} colors={colors} styles={styles} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const makeStyles = (c, isDark) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },

    bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
    barText: { flex: 1 },
    barEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: c.accent },
    savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    savedDot: { width: 7, height: 7, borderRadius: 4 },
    savedText: { flex: 1, fontSize: 12, fontWeight: '600', color: c.textMuted },
    doneBtn: { height: 38, borderRadius: 19, overflow: 'hidden' },
    doneFill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
    doneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

    page: { flex: 1, paddingHorizontal: 22, paddingTop: 6 },
    heading: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: c.textMuted },
    titleInput: { fontFamily: 'Yoruka', fontSize: 26, color: c.textPrimary, paddingVertical: 6 },
    rule: { height: 2, width: 44, borderRadius: 1, backgroundColor: c.accent, marginTop: 4, marginBottom: 10 },
    body: { flex: 1, color: isDark ? '#E9E7F0' : c.textPrimary, paddingTop: 0, paddingBottom: 24 },

    stats: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    statText: { flex: 1, fontSize: 12, color: c.textMuted },
    statStrong: { fontWeight: '800', color: c.textPrimary },
    goal: { alignItems: 'flex-end', gap: 4 },
    goalTrack: { width: 72, height: 4, borderRadius: 2, overflow: 'hidden' },
    goalFill: { height: '100%', borderRadius: 2 },
    goalText: { fontSize: 10, fontWeight: '800', color: c.textMuted },
    goalRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 22, paddingBottom: 8 },
    goalChip: { flex: 1, height: 30, borderRadius: 15, borderWidth: 1, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' },
    goalChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },

    findPanel: { paddingHorizontal: 12, paddingTop: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.bgElevated },
    findRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    findField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.borderStrong },
    findInput: { flex: 1, fontSize: 14, color: c.textPrimary, paddingVertical: 0 },
    findCount: { fontSize: 12, fontWeight: '800', color: c.accent },
    findBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.borderStrong },
    findTextBtn: { height: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.bgCard },
    findTextBtnLabel: { fontSize: 13, fontWeight: '800', color: c.textPrimary },

    toolbarWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.bgElevated, paddingTop: 8 },
    toolbar: { alignItems: 'center', gap: 6, paddingHorizontal: 10 },
    tool: { minWidth: 42, height: 42, paddingHorizontal: 10, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard },
    toolGlyph: { fontSize: 15, fontWeight: '800' },
    sep: { width: 1, height: 24, backgroundColor: c.border, marginHorizontal: 2 },
  });

export default ChapterEditor;
