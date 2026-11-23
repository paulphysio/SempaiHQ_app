import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { View, Text, SafeAreaView, StatusBar, Platform, FlatList, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { supabase } from '../services/supabaseClient';
import { readerAction } from '../services/readerActions';
import { notifyReaders, getTitleReaderIds, getCreatorReaderIds } from '../services/notify';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import ConnectButton from '../components/ConnectButton';
import { formatNumber } from '../utils/formatNumber';
import { useTheme } from '../context/ThemeContext';
import {
  Screen, AppBar, IconButton, Tap, Chip, Input, Field, Panel, SectionHeader, StatTile, Segmented,
  Sheet, GradientButton, GhostButton, EmptyState, StatusBadge, Skeleton, Divider,
} from '../components/ui';
import { radius, space, layout, glow, useMangaTheme } from '../theme/theme';
import { getStyles as getDashboardStyles } from '../styles/MangaDashboardStyles';
import { toast } from '../components/Toast';

import { gelAlert } from '../components/gel/GelAlert';
const TAG_OPTIONS = [
  'Action', 'Adult(18+)', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance',
  'Sci-Fi', 'Slice of Life', 'Supernatural', 'Thriller', 'Historical', 'Sports', 'Psychological',
  'Shonen', 'Shojo', 'Seinen', 'Josei',
].map((v) => ({ value: v, label: v }));

const STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
];

const SUMMARY_MAX = 600;


/* ───────── building blocks ───────── */
const StepHeader = ({ n, title, sub, done }) => {
  const mangaTheme = useMangaTheme();
  const { colors, type } = mangaTheme;
  const styles = useMemo(() => getDashboardStyles(mangaTheme), [mangaTheme]);
  return (
  <View style={styles.stepHeader}>
    <View style={[styles.stepBadge, done && { backgroundColor: colors.mint, borderColor: colors.mint }]}>
      {done ? <Icon name="check" size={12} color="#06281a" solid /> : <Text style={styles.stepBadgeText}>{n}</Text>}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={type.h2}>{title}</Text>
      {sub ? <Text style={type.caption}>{sub}</Text> : null}
    </View>
  </View>
  );
};

const WorkCard = ({ item, selected, onPress }) => {
  const mangaTheme = useMangaTheme();
  const { colors, gradients, type } = mangaTheme;
  const styles = useMemo(() => getDashboardStyles(mangaTheme), [mangaTheme]);
  return (
  <Tap onPress={onPress} scaleTo={0.97} style={styles.workCard} accessibilityLabel={`Edit ${item.title}`}>
    <View style={[styles.workCover, selected && { borderColor: colors.primary, borderWidth: 2 }, selected && glow(colors.primary, 0.5)]}>
      <Image source={{ uri: item.cover_image }} style={StyleAbs} resizeMode="cover" />
      <LinearGradient colors={gradients.card} style={styles.workShade} />
      <View style={styles.workEdit}>
        <Icon name="pen" size={10} color="#fff" solid />
      </View>
    </View>
    <Text numberOfLines={1} style={styles.workTitle}>{item.title}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name="eye" size={9} color={colors.textMute} />
      <Text style={{ ...type.caption, marginLeft: 4 }}>{formatNumber(item.viewers_count || 0)}</Text>
    </View>
  </Tap>
  );
};

const StyleAbs = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' };

// Convert a signed/authenticated storage URL back to the canonical
// /object/public/ form we store in manga_pages.image_url.
const canonicalizeStorageUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const m = url.match(/^(https?:\/\/[^/]+)\/storage\/v1\/object\/(?:sign|authenticated|public)\/(.+?)\/(.+?)(?:\?.*)?$/);
  if (!m) return url;
  return `${m[1]}/storage/v1/object/public/${m[2]}/${m[3]}`;
};

const MangaDashboardScreen = () => {
  const navigation = useNavigation();
  const { isDark, colors: themeColors } = useTheme();
  const mangaTheme = useMangaTheme();
  const { colors, gradients, type } = mangaTheme;
  const styles = useMemo(() => getDashboardStyles(mangaTheme), [mangaTheme]);
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey;

  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [summary, setSummary] = useState('');
  const [mangaStatus, setMangaStatus] = useState('ongoing');
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterPages, setChapterPages] = useState([]);
  const [mangaCollection, setMangaCollection] = useState([]);
  const [activeManga, setActiveManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  // Chapter count when the series was opened — decides whether a save added chapters.
  const loadedChapterCount = useRef(0);
  const [userId, setUserId] = useState(null);
  const [isArtist, setIsArtist] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [artistList, setArtistList] = useState([]);
  const [editingChapterIdx, setEditingChapterIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeText, setNoticeText] = useState('');
  const [noticeDate, setNoticeDate] = useState(null);
  const [showNoticeDatePicker, setShowNoticeDatePicker] = useState(false);
  const [tags, setTags] = useState([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [kbVisible, setKbVisible] = useState(false);

  const chapterInputRef = useRef(null);
  const scrollRef = useRef(null);
  const editorY = useRef(0);
  const chapterY = useRef(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /* ───────── data (logic unchanged) ───────── */
  const verifyUserAccess = async () => {
    if (!isWalletConnected || !activePublicKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const walletAddress = activePublicKey.toString();
      const { data, error } = await supabase
        .from('users')
        .select('id, isArtist, isSuperuser')
        .eq('wallet_address', walletAddress)
        .single();
      if (error || !data) throw new Error('User verification failed');
      if (!data.isArtist && !data.isSuperuser) {
        navigation.navigate('Error');
        return;
      }
      setUserId(data.id);
      setIsArtist(data.isArtist);
      setIsAdmin(data.isSuperuser);
    } catch (err) {
      console.error('Access verification error:', err.message);
      navigation.navigate('Error');
    } finally {
      setLoading(false);
    }
  };

  const loadManga = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const query = isAdmin
        ? supabase.from('manga').select('*, viewers_count, tags')
        : supabase.from('manga').select('*, viewers_count, tags').eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw new Error('Failed to fetch manga');
      setMangaCollection(data || []);
    } catch (err) {
      console.error('Manga fetch error:', err.message);
      toast.error(`Failed to fetch manga: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadArtists = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_users', { p_role: 'artist', p_limit: 1000 });
      if (error) throw new Error('Failed to fetch artists');
      setArtistList(data || []);
    } catch (err) {
      console.error('Artists fetch error:', err.message);
      toast.error(`Failed to fetch artists: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyUserAccess();
  }, [isWalletConnected, activePublicKey]);

  useEffect(() => {
    if (userId && (isArtist || isAdmin)) {
      loadManga();
      if (isAdmin) loadArtists();
    }
  }, [userId, isArtist, isAdmin]);

  /* ───────── images ───────── */
  const uploadCoverImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission needed — Allow photo access to choose a cover image.');
        return;
      }
      const response = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [2, 3],
        quality: 1,
      });
      if (response.canceled) return;
      if (response.errorCode) {
        toast.error(`Image selection failed: ${response.errorMessage}`);
        return;
      }
      if (response.assets && response.assets[0]) {
        const compressedImage = await ImageManipulator.manipulateAsync(
          response.assets[0].uri,
          [{ resize: { width: 1920 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        // Read the file as ArrayBuffer for direct upload
        const arrayBuffer = await FileSystem.readAsStringAsync(compressedImage.uri, { encoding: 'base64' });
        const binaryString = atob(arrayBuffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const file = { 
          uri: compressedImage.uri, 
          name: `cover-${Date.now()}.jpg`, 
          type: 'image/jpeg',
          arrayBuffer: bytes.buffer
        };
        setCoverImage(file);
        setCoverPreview(compressedImage.uri);
      }
    } catch (err) {
      console.error('Error uploading cover image:', err);
      toast.error('Failed to upload cover image.');
    }
  };

  const uploadChapterPages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission needed — Allow photo access to choose chapter pages.');
        return;
      }
      const response = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (response.canceled) return;
      if (response.errorCode) {
        toast.error(`Image selection failed: ${response.errorMessage}`);
        return;
      }
      const compressed = await Promise.all(
        response.assets.map(async (asset, i) => {
          const compressedImage = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1920 } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          );
          const base64 = await FileSystem.readAsStringAsync(compressedImage.uri, { encoding: 'base64' });
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          return {
            file: { uri: compressedImage.uri, name: `page-${Date.now()}-${i}.jpg`, type: 'image/jpeg', arrayBuffer: bytes.buffer },
            url: compressedImage.uri,
          };
        })
      );
      setChapterPages((prev) => [...prev, ...compressed]);
    } catch (err) {
      console.error('Error uploading chapter pages:', err);
      toast.error('Failed to upload chapter pages.');
    }
  };

  const removePage = (idx) => setChapterPages((prev) => prev.filter((_, i) => i !== idx));
  const movePageEarlier = (idx) =>
    setChapterPages((prev) => {
      if (idx === 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });

  /* ───────── chapters ───────── */
  const clearChapterForm = () => {
    setChapterTitle('');
    setChapterPages([]);
    setEditingChapterIdx(null);
  };

  const manageChapter = () => {
    if (!chapterTitle.trim() || chapterPages.length === 0) {
      toast.info('Almost there — Add a chapter title and at least one page.');
      return;
    }
    const chapterData = {
      title: chapterTitle,
      pages: chapterPages,
      isPremium: true,
      price: null,
    };
    if (editingChapterIdx !== null) {
      setChapters((prev) => prev.map((ch, idx) => (idx === editingChapterIdx ? chapterData : ch)));
      setEditingChapterIdx(null);
    } else {
      setChapters((prev) => [...prev, chapterData]);
    }
    clearChapterForm();
  };

  const editChapter = (idx) => {
    const chapter = chapters[idx];
    setChapterTitle(chapter.title || '');
    setChapterPages(chapter.pages || []);
    setEditingChapterIdx(idx);
    scrollRef.current?.scrollTo({ y: Math.max(0, editorY.current + chapterY.current - 12), animated: true });
    setTimeout(() => chapterInputRef.current?.focus(), 350);
  };

  const deleteChapter = (idx) => {
    gelAlert('Delete chapter?', `"${chapters[idx]?.title}" will be removed from this draft.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setChapters((prev) => prev.filter((_, i) => i !== idx));
          if (editingChapterIdx === idx) clearChapterForm();
        },
      },
    ]);
  };

  const parseStorageRef = (url) => {
    const m = (url || '').match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?.*)?$/);
    return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
  };

  const deleteSeries = () => {
    if (!activeManga?.id) return;
    gelAlert(
      'Delete series?',
      `"${activeManga.title}" and all its chapters, pages, comments, and reader subscriptions will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDeleteSeries },
      ]
    );
  };

  const performDeleteSeries = async () => {
    const mangaId = activeManga.id;
    const title = activeManga.title;
    setLoading(true);
    try {
      // Collect storage objects before rows disappear
      const { data: chapterRows } = await supabase
        .from('manga_chapters')
        .select('id')
        .eq('manga_id', mangaId);
      const chapterIds = (chapterRows || []).map((c) => c.id);
      const storageRefs = [];
      if (chapterIds.length) {
        const { data: pageRows } = await supabase
          .from('manga_pages')
          .select('image_url')
          .in('chapter_id', chapterIds);
        (pageRows || []).forEach((p) => {
          const ref = parseStorageRef(p.image_url);
          if (ref) storageRefs.push(ref);
        });
      }
      const coverRef = parseStorageRef(activeManga.cover_image);
      if (coverRef) storageRefs.push(coverRef);

      // The server deletes the title and everything attached to it (it checks
      // you are the creator — readers' rows can't be removed from the phone).
      const res = await readerAction('delete_title', { kind: 'manga', id: mangaId });
      if (!res.ok) throw new Error(res.error);

      // Best-effort storage cleanup (orphaned files are harmless but tidy)
      for (const ref of storageRefs) {
        try {
          await supabase.storage.from(ref.bucket).remove([ref.path]);
        } catch (_) { /* non-fatal */ }
      }

      setMangaCollection((prev) => prev.filter((m) => m.id !== mangaId));
      clearForm();
      toast.success(`Deleted — ${`"${title}" was deleted.`}`);
    } catch (e) {
      console.error('[MangaDashboard] delete series failed:', e?.message || e);
      toast.error(`Delete failed — ${e?.message || 'Could not delete the series. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchChapters = async (mangaId) => {
    try {
      const { data: chapterData, error } = await supabase
        .from('manga_chapters')
        .select('id, title')
        .eq('manga_id', mangaId)
        .order('chapter_number', { ascending: true });
      if (error) throw new Error('Chapter fetch error');

      const chaptersWithPages = await Promise.all(
        chapterData.map(async (chapter) => {
          // Pages are private — fetch short-lived signed URLs via the edge
          // function (the author's wallet is allowed through for previews).
          let pages = [];
          try {
            const { data, error: pagesError } = await supabase.functions.invoke('manga-chapter-pages', {
              body: { chapterId: chapter.id, walletAddress: activePublicKey?.toString() },
            });
            if (!pagesError && !data?.error && Array.isArray(data?.pages)) {
              pages = data.pages.map((p) => ({ url: p.image_url }));
            }
          } catch (e) {
            console.error('Page fetch error:', e?.message || e);
          }
          return { ...chapter, pages };
        })
      );
      setChapters(chaptersWithPages);
      loadedChapterCount.current = chaptersWithPages.length;
    } catch (err) {
      console.error('Error fetching chapters:', err.message);
      toast.error(`Failed to fetch chapters: ${err.message}`);
    }
  };

  /* ───────── series ───────── */
  const clearForm = () => {
    setTitle('');
    setCoverImage(null);
    setCoverPreview('');
    setSummary('');
    setMangaStatus('ongoing');
    clearChapterForm();
    setChapters([]);
    loadedChapterCount.current = 0;
    setActiveManga(null);
    setTags([]);
    setNoticeTitle('');
    setNoticeText('');
    setNoticeDate(null);
  };

  const loadMangaForEdit = async (manga) => {
    setActiveManga(manga);
    setTitle(manga.title || '');
    setCoverImage(null);
    setCoverPreview(manga.cover_image || '');
    setSummary(manga.summary || '');
    setMangaStatus(manga.status || 'ongoing');
    setTags(manga.tags ? manga.tags.map((tag) => ({ value: tag, label: tag })) : []);
    clearChapterForm();
    await fetchChapters(manga.id);
    scrollRef.current?.scrollTo({ y: Math.max(0, editorY.current - 12), animated: true });
  };

  const startNew = () => {
    const dirty = title || summary || coverPreview || chapters.length;
    if (!dirty && !activeManga) return;
    gelAlert('Start a new series?', 'Unsaved changes in the editor will be discarded.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard & start new', style: 'destructive', onPress: clearForm },
    ]);
  };

  const submitManga = async () => {
    console.log('[MangaDashboard] submitManga called');
    console.log('[MangaDashboard] Title:', title);
    console.log('[MangaDashboard] Cover image:', coverImage ? 'New file' : coverPreview ? 'Existing URL' : 'None');
    console.log('[MangaDashboard] Summary length:', summary.length);
    console.log('[MangaDashboard] Status:', mangaStatus);
    console.log('[MangaDashboard] Tags:', tags.map(t => t.value));
    console.log('[MangaDashboard] Chapters count:', chapters.length);
    console.log('[MangaDashboard] Active manga:', activeManga ? activeManga.id : 'Creating new');

    if (!title.trim() || (!coverImage && !coverPreview) || !summary.trim()) {
      console.log('[MangaDashboard] Validation failed: missing required fields');
      toast.error('Missing details — A title, cover image and summary are required.');
      return;
    }
    setLoading(true);
    try {
      console.log('[MangaDashboard] Step 1: Uploading cover image');
      console.log('[MangaDashboard] coverImage object:', coverImage);
      console.log('[MangaDashboard] coverPreview:', coverPreview);
      let coverUrl = coverPreview;
      if (coverImage) {
        const path = `covers/${userId}/${Date.now()}-${coverImage.name}`;
        console.log('[MangaDashboard] Cover upload path:', path);
        console.log('[MangaDashboard] Cover file name:', coverImage.name);
        console.log('[MangaDashboard] Cover file type:', coverImage.type);
        console.log('[MangaDashboard] Cover file URI:', coverImage.uri);
        console.log('[MangaDashboard] Cover has arrayBuffer:', !!coverImage.arrayBuffer);
        
        // Upload as ArrayBuffer
        const { data, error } = await supabase.storage.from('covers').upload(path, coverImage.arrayBuffer, {
          upsert: true,
          cacheControl: '3600',
          contentType: coverImage.type,
        });
        if (error) {
          console.error('[MangaDashboard] Cover upload error:', error);
          throw new Error('Cover upload failed: ' + error.message);
        }
        console.log('[MangaDashboard] Cover upload successful, data:', data);
        coverUrl = supabase.storage.from('covers').getPublicUrl(data.path).data.publicUrl;
        console.log('[MangaDashboard] Cover URL:', coverUrl);
      } else {
        console.log('[MangaDashboard] Using existing cover URL:', coverPreview);
      }

      console.log('[MangaDashboard] Step 2: Preparing manga payload');
      const mangaPayload = {
        user_id: userId,
        title,
        cover_image: coverUrl,
        summary,
        author: (await supabase.from('users').select('name').eq('id', userId).single()).data?.name || 'Unknown',
        status: mangaStatus,
        tags: tags.map((tag) => tag.value),
        viewers_count: activeManga ? activeManga.viewers_count : 0,
      };
      console.log('[MangaDashboard] Manga payload:', JSON.stringify(mangaPayload, null, 2));

      console.log('[MangaDashboard] Step 3: Saving manga to database');
      let mangaId;
      if (activeManga) {
        console.log('[MangaDashboard] Updating existing manga:', activeManga.id);
        const { error } = await supabase.from('manga').update(mangaPayload).eq('id', activeManga.id);
        if (error) throw new Error('Manga update failed: ' + error.message);
        mangaId = activeManga.id;
        console.log('[MangaDashboard] Manga updated successfully');
      } else {
        console.log('[MangaDashboard] Creating new manga');
        const { data, error } = await supabase.from('manga').insert([mangaPayload]).select('id').single();
        if (error) throw new Error('Manga creation failed: ' + error.message);
        mangaId = data.id;
        console.log('[MangaDashboard] Manga created successfully with ID:', mangaId);
      }

      console.log('[MangaDashboard] Step 4: Processing chapters');
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        console.log(`[MangaDashboard] Processing chapter ${i + 1}/${chapters.length}:`, chapter.title);
        console.log(`[MangaDashboard] Chapter ${i + 1} pages:`, chapter.pages.length);

        let chapterId;

        const existing = activeManga
          ? (
              await supabase
                .from('manga_chapters')
                .select('id')
                .eq('manga_id', mangaId)
                .eq('chapter_number', i + 1)
                .single()
            ).data
          : null;
        
        if (existing) {
          console.log(`[MangaDashboard] Chapter ${i + 1} exists, updating:`, existing.id);
          const { error } = await supabase
            .from('manga_chapters')
            .update({
              title: chapter.title,
              is_premium: true,
              price: null,
            })
            .eq('id', existing.id);
          if (error) throw new Error('Chapter update failed: ' + error.message);
          chapterId = existing.id;
          console.log(`[MangaDashboard] Chapter ${i + 1} updated successfully`);
          console.log(`[MangaDashboard] Deleting old pages for chapter ${i + 1}`);
          await supabase.from('manga_pages').delete().eq('chapter_id', chapterId);
        } else {
          console.log(`[MangaDashboard] Creating new chapter ${i + 1}`);
          const { data, error } = await supabase
            .from('manga_chapters')
            .insert([
              {
                manga_id: mangaId,
                chapter_number: i + 1,
                title: chapter.title,
                is_premium: true,
                price: null,
              },
            ])
            .select('id')
            .single();
          if (error) throw new Error('Chapter creation failed: ' + error.message);
          chapterId = data.id;
          console.log(`[MangaDashboard] Chapter ${i + 1} created successfully with ID:`, chapterId);
        }

        console.log(`[MangaDashboard] Step 5: Uploading pages for chapter ${i + 1}`);
        for (let j = 0; j < chapter.pages.length; j++) {
          const page = chapter.pages[j];
          console.log(`[MangaDashboard] Page ${j + 1}/${chapter.pages.length}:`, page.file ? 'New file' : 'Existing URL');
          console.log(`[MangaDashboard] Page ${j + 1} file object:`, page.file);
          console.log(`[MangaDashboard] Page ${j + 1} existing URL:`, page.url);
          // Existing pages may carry short-lived signed URLs from the preview
          // fetch — store the canonical storage URL so it never expires.
          let pageUrl = canonicalizeStorageUrl(page.url);
          if (page.file) {
            const pagePath = `pages/${mangaId}/${chapterId}/${j + 1}-${Date.now()}.jpg`;
            console.log(`[MangaDashboard] Uploading page ${j + 1} to:`, pagePath);
            console.log(`[MangaDashboard] Page file name:`, page.file.name);
            console.log(`[MangaDashboard] Page file type:`, page.file.type);
            console.log(`[MangaDashboard] Page file URI:`, page.file.uri);
            console.log(`[MangaDashboard] Page has arrayBuffer:`, !!page.file.arrayBuffer);
            const { data, error } = await supabase.storage.from('manga-images').upload(pagePath, page.file.arrayBuffer, {
              upsert: true,
              cacheControl: '3600',
              contentType: page.file.type,
            });
            if (error) {
              console.error(`[MangaDashboard] Page ${j + 1} upload error:`, error);
              throw new Error('Page upload failed: ' + error.message);
            }
            console.log(`[MangaDashboard] Page ${j + 1} upload successful, data:`, data);
            pageUrl = supabase.storage.from('manga-images').getPublicUrl(data.path).data.publicUrl;
            console.log(`[MangaDashboard] Page ${j + 1} uploaded successfully:`, pageUrl);
          }
          console.log(`[MangaDashboard] Saving page ${j + 1} to database with URL:`, pageUrl);
          const { error } = await supabase
            .from('manga_pages')
            .insert([{ chapter_id: chapterId, page_number: j + 1, image_url: pageUrl }]);
          if (error) {
            console.error(`[MangaDashboard] Page ${j + 1} database save error:`, error);
            throw new Error('Page save failed: ' + error.message);
          }
          console.log(`[MangaDashboard] Page ${j + 1} saved successfully`);
        }
      }

      // ── Reader notifications (best-effort: never fails the save) ──
      //  · new chapter(s) on an existing series → that series' readers
      //  · brand-new series → everyone who reads this artist's other work
      //  · edits with no new chapter → nobody (used to spam "new chapter")
      const creatorId = activeManga?.user_id || userId;
      const addedChapters = activeManga ? chapters.length - loadedChapterCount.current : 0;
      let notified = 0;
      if (activeManga && addedChapters > 0) {
        const latest = chapters[chapters.length - 1];
        ({ notified } = await notifyReaders({
          userIds: await getTitleReaderIds('manga', mangaId),
          excludeUserId: creatorId,
          title: `🎨 New chapter · ${title}`,
          body: addedChapters > 1
            ? `${addedChapters} new chapters just dropped.`
            : `Chapter ${chapters.length}${latest?.title ? `: ${latest.title}` : ''} is out now.`,
          data: { mangaId, type: 'new_chapter' },
          rowFor: (uid) => ({
            user_id: uid,
            manga_id: mangaId,
            novel_title: title,
            type: 'new_chapter',
            message: `A new chapter has been added to "${title}"!`,
            chapter: chapters.length,
          }),
        }));
      } else if (!activeManga) {
        ({ notified } = await notifyReaders({
          userIds: await getCreatorReaderIds(creatorId, { excludeContentId: mangaId }),
          excludeUserId: creatorId,
          title: `✨ New manga · ${title}`,
          body: 'An artist you read just launched a new series. Be one of the first to see it.',
          data: { mangaId, type: 'new_manga' },
          rowFor: (uid) => ({
            user_id: uid,
            manga_id: mangaId,
            novel_title: title,
            type: 'new_manga',
            message: `A new manga "${title}" has been published!`,
            chapter: null,
          }),
        }));
      }
      loadedChapterCount.current = chapters.length;

      console.log('[MangaDashboard] Step 7: Success - cleaning up and reloading');
      toast.success(
        !activeManga
          ? `"${title}" is live!${notified ? ` ${notified} reader${notified === 1 ? '' : 's'} notified.` : ''}`
          : addedChapters > 0
          ? `Chapter published${notified ? ` — ${notified} reader${notified === 1 ? '' : 's'} notified` : ''}`
          : 'Changes saved'
      );
      clearForm();
      loadManga();
    } catch (err) {
      console.error('[MangaDashboard] Submission error:', err.message);
      console.error('[MangaDashboard] Full error:', err);
      toast.error(`Failed to save manga: ${err.message}`);
    } finally {
      console.log('[MangaDashboard] Loading state set to false');
      setLoading(false);
    }
  };

  const sendNotice = async () => {
    if (!activeManga) {
      toast.info('Select a series — Open one of your series to announce to its readers.');
      return;
    }
    if (!noticeTitle.trim() || !noticeText.trim()) {
      toast.error('Missing details — Announcement title and message are required.');
      return;
    }
    setLoading(true);
    try {
      const { error: noticeError } = await supabase.from('writer_announcements').insert([
        {
          writer_id: userId,
          manga_id: activeManga.id,
          title: noticeTitle,
          message: noticeText,
          release_date: noticeDate ? noticeDate.toISOString() : null,
        },
      ]);
      if (noticeError) throw new Error('Announcement save failed');

      // Readers of this series hear about it (best-effort; never fails the send).
      const { notified } = await notifyReaders({
        userIds: await getTitleReaderIds('manga', activeManga.id),
        excludeUserId: activeManga.user_id || userId,
        title: `📣 ${activeManga.title}`,
        body: `${noticeTitle} — ${noticeText}`,
        data: { mangaId: activeManga.id, type: 'announcement' },
        rowFor: (uid) => ({
          user_id: uid,
          manga_id: activeManga.id,
          type: 'announcement',
          message: `${noticeTitle}: ${noticeText}`,
          novel_title: activeManga.title,
        }),
      });

      toast.success(notified ? `Announcement sent to ${notified} reader${notified === 1 ? '' : 's'}` : 'Announcement posted — no readers to notify yet');
      setNoticeTitle('');
      setNoticeText('');
      setNoticeDate(null);
    } catch (err) {
      console.error('Announcement error:', err.message);
      toast.error(`Failed to send announcement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag) =>
    setTags((prev) => (prev.find((t) => t.value === tag.value) ? prev.filter((t) => t.value !== tag.value) : [...prev, tag]));

  /* ───────── derived ───────── */
  const totalViewers = useMemo(() => mangaCollection.reduce((s, m) => s + (m.viewers_count || 0), 0), [mangaCollection]);
  const detailsDone = !!title.trim() && !!(coverImage || coverPreview) && !!summary.trim();
  const worksData = useMemo(() => [{ id: '__new' }, ...mangaCollection], [mangaCollection]);
  const initializing = loading && !userId;

  /* ───────── gate states ───────── */
  const gate = (node) => (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
      <Screen>
        {node}
      </Screen>
    </SafeAreaView>
  );

  if (!isWalletConnected) {
    return gate(
      <View style={styles.center}>
        <EmptyState icon="gem" title="Connect your wallet" subtitle="Connect to open the Artist Studio and publish your manga." />
        <ConnectButton />
      </View>
    );
  }

  if (initializing) {
    return gate(
      <View style={{ padding: space.xl }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Skeleton height={92} r={radius.md} style={{ flex: 1 }} />
          <Skeleton height={92} r={radius.md} style={{ flex: 1 }} />
          <Skeleton height={92} r={radius.md} style={{ flex: 1 }} />
        </View>
        <Skeleton height={190} r={radius.lg} style={{ marginTop: space.xl }} />
        <Skeleton height={320} r={radius.lg} style={{ marginTop: space.xl }} />
      </View>
    );
  }

  if (!isArtist && !isAdmin) {
    return gate(
      <View style={styles.center}>
        <EmptyState icon="user-lock" title="Artists only" subtitle="The Studio is restricted to artists and admins." action="Return Home" onAction={() => navigation.navigate('Home')} />
      </View>
    );
  }

  /* ───────── main ───────── */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
      <Screen style={{ backgroundColor: themeColors.bg }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 150 }}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Stats */}
            <Animated.View entering={FadeInDown.duration(350)} style={styles.statRow}>
              <StatTile icon="book" label="Series" value={mangaCollection.length} color={colors.primary} />
              <View style={{ width: space.sm }} />
              <StatTile icon="eye" label="Total views" value={formatNumber(totalViewers)} color={colors.sakura} />
              <View style={{ width: space.sm }} />
              <StatTile icon={isAdmin ? 'user-shield' : 'layer-group'} label={isAdmin ? 'Artists' : 'Draft chapters'} value={isAdmin ? artistList.length : chapters.length} color={colors.electric} />
            </Animated.View>

            {/* Works carousel */}
            <SectionHeader title="Your Works" icon="book-open" style={styles.pad} />
            <FlatList
              horizontal
              data={worksData}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.worksRail}
              renderItem={({ item }) =>
                item.id === '__new' ? (
                  <Tap onPress={startNew} style={styles.workCard} accessibilityLabel="Create new series">
                    <View style={[styles.workCover, styles.newCover, !activeManga && { borderColor: colors.primary }]}>
                      <Icon name="plus" size={22} color={!activeManga ? colors.primary : colors.textMute} solid />
                      <Text style={styles.newText}>New series</Text>
                    </View>
                    <Text style={styles.workTitle}>{activeManga ? 'Start fresh' : 'Drafting…'}</Text>
                  </Tap>
                ) : (
                  <WorkCard item={item} selected={activeManga?.id === item.id} onPress={() => loadMangaForEdit(item)} />
                )
              }
              ListFooterComponent={
                mangaCollection.length === 0 ? (
                  <Text style={[type.body, { alignSelf: 'center', marginLeft: space.md, maxWidth: 190 }]}>
                    No series yet. Create your first one below!
                  </Text>
                ) : null
              }
            />

            {/* Editor */}
            <View onLayout={(e) => (editorY.current = e.nativeEvent.layout.y)} style={styles.pad}>
              <Panel accent={activeManga ? colors.primary : undefined} style={styles.editorHead}>
                <View style={{ flex: 1 }}>
                  <Text style={type.label}>{activeManga ? 'Editing series' : 'New series'}</Text>
                  <Text numberOfLines={1} style={type.h1}>{activeManga ? activeManga.title : title || 'Untitled'}</Text>
                </View>
                {activeManga ? <StatusBadge value={activeManga.status || 'ongoing'} /> : null}
                {activeManga ? (
                  <IconButton icon="trash" label="Delete series" size={36} onPress={deleteSeries} style={{ marginLeft: space.sm, backgroundColor: colors.danger + '33' }} />
                ) : null}
                {(activeManga || title || summary || chapters.length > 0) ? (
                  <IconButton icon="undo" label="Reset editor" size={36} onPress={startNew} style={{ marginLeft: space.sm }} />
                ) : null}
              </Panel>

              {/* Step 1 */}
              <StepHeader n="1" title="Series details" sub="How readers will discover your manga" done={detailsDone} />
              <Panel>
                <Field label="Cover" hint="Portrait 2:3 works best">
                  <Tap onPress={uploadCoverImage} scaleTo={0.985} accessibilityLabel="Choose cover image" style={styles.coverPick}>
                    {coverPreview ? (
                      <>
                        <Image source={{ uri: coverPreview }} style={StyleAbs} resizeMode="cover" />
                        <LinearGradient colors={gradients.card} style={styles.coverShade} />
                        <View style={styles.coverChange}>
                          <Icon name="sync-alt" size={11} color="#fff" />
                          <Text style={styles.coverChangeText}>Change cover</Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.coverEmpty}>
                        <View style={styles.coverIconWrap}>
                          <Icon name="image" size={24} color={colors.primaryHi} solid />
                        </View>
                        <Text style={type.bodyStrong}>Upload cover art</Text>
                        <Text style={type.caption}>Tap to choose from your photos</Text>
                      </View>
                    )}
                  </Tap>
                </Field>

                <Field label="Title">
                  <Input icon="heading" value={title} onChangeText={setTitle} placeholder="e.g. Blade of the Ashen Moon" accessibilityLabel="Manga title input" maxLength={80} />
                </Field>

                <Field label="Summary" right={`${summary.length}/${SUMMARY_MAX}`}>
                  <Input multiline value={summary} onChangeText={setSummary} placeholder="Hook your readers in a few sentences…" maxLength={SUMMARY_MAX} accessibilityLabel="Manga summary input" />
                </Field>

                <Field label="Status">
                  <Segmented options={STATUS_OPTIONS} value={mangaStatus} onChange={setMangaStatus} />
                </Field>

                <Field label="Genres & tags" right={tags.length ? `${tags.length} selected` : undefined} style={{ marginBottom: 0 }}>
                  <View style={styles.tagBox}>
                    {tags.map((t) => (
                      <Chip key={t.value} label={t.label} active color={t.value === 'Adult(18+)' ? colors.danger : colors.primary} onPress={() => toggleTag(t)} icon="times" />
                    ))}
                    <Chip label={tags.length ? 'Add more' : 'Choose tags'} icon="plus" onPress={() => setShowTagModal(true)} />
                  </View>
                </Field>
              </Panel>

              {/* Step 2 */}
              <StepHeader n="2" title="Chapters" sub="Build chapters, then publish everything at once" done={chapters.length > 0} />
              <View onLayout={(e) => (chapterY.current = e.nativeEvent.layout.y)}>
                <Panel accent={editingChapterIdx !== null ? colors.gold : undefined}>
                  {editingChapterIdx !== null ? (
                    <Animated.View entering={FadeIn} style={styles.editingBanner}>
                      <Icon name="pen" size={11} color={colors.gold} solid />
                      <Text style={styles.editingText}>Editing chapter {editingChapterIdx + 1}</Text>
                      <Tap onPress={clearChapterForm} style={{ marginLeft: 'auto' }}>
                        <Text style={{ ...type.caption, color: colors.gold, fontWeight: '700' }}>Cancel</Text>
                      </Tap>
                    </Animated.View>
                  ) : null}

                  <Field label="Chapter title">
                    <Input ref={chapterInputRef} icon="bookmark" value={chapterTitle} onChangeText={setChapterTitle} placeholder={`Chapter ${chapters.length + 1}: …`} accessibilityLabel="Chapter title input" />
                  </Field>

                  <Field label="Pages" right={chapterPages.length ? `${chapterPages.length} page${chapterPages.length === 1 ? '' : 's'}` : undefined} hint="Pages read top-to-bottom in this order. Use ← to reorder.">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} keyboardShouldPersistTaps="handled">
                      <Tap onPress={uploadChapterPages} style={styles.addPage} accessibilityLabel="Add chapter pages">
                        <Icon name="plus" size={18} color={colors.primaryHi} solid />
                        <Text style={styles.addPageText}>Add</Text>
                      </Tap>
                      {chapterPages.map((p, i) => (
                        <View key={`${p.url}-${i}`} style={styles.pageThumb}>
                          <Image source={{ uri: p.url }} style={StyleAbs} resizeMode="cover" />
                          <View style={styles.pageNum}>
                            <Text style={styles.pageNumText}>{i + 1}</Text>
                          </View>
                          <Tap onPress={() => removePage(i)} style={styles.pageRemove} accessibilityLabel={`Remove page ${i + 1}`}>
                            <Icon name="times" size={10} color="#fff" solid />
                          </Tap>
                          {i > 0 ? (
                            <Tap onPress={() => movePageEarlier(i)} style={styles.pageMove} accessibilityLabel={`Move page ${i + 1} earlier`}>
                              <Icon name="arrow-left" size={10} color="#fff" solid />
                            </Tap>
                          ) : null}
                        </View>
                      ))}
                    </ScrollView>
                  </Field>

                  <View style={{ height: space.lg }} />
                  <GradientButton
                    tone={editingChapterIdx !== null ? 'gold' : 'electric'}
                    icon={editingChapterIdx !== null ? 'check' : 'plus'}
                    label={editingChapterIdx !== null ? 'Update chapter' : 'Add chapter to draft'}
                    onPress={manageChapter}
                  />
                </Panel>

                {chapters.length > 0 ? (
                  <View style={{ marginTop: space.md }}>
                    <Text style={[type.label, { marginBottom: space.sm }]}>Draft · {chapters.length} chapter{chapters.length === 1 ? '' : 's'}</Text>
                    {chapters.map((ch, idx) => (
                      <Animated.View key={`${ch.title}-${idx}`} entering={FadeInDown.duration(250)} style={[styles.chapterRow, editingChapterIdx === idx && { borderColor: colors.gold }]}>
                        <View style={styles.chapterIdx}>
                          <Text style={styles.chapterIdxText}>{idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={type.bodyStrong}>{ch.title}</Text>
                          <Text style={type.caption}>{ch.pages.length} page{ch.pages.length === 1 ? '' : 's'}</Text>
                        </View>
                        <IconButton icon="pen" label="Edit chapter" size={34} onPress={() => editChapter(idx)} style={{ marginRight: 6 }} />
                        <IconButton icon="trash" label="Delete chapter" size={34} onPress={() => deleteChapter(idx)} style={{ backgroundColor: colors.danger + '33' }} />
                      </Animated.View>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Announce */}
              {activeManga ? (
                <Animated.View entering={FadeInDown.duration(300)} style={{ marginTop: space.xxl }}>
                  <SectionHeader title="Announce to readers" icon="bullhorn" accent={colors.sakura} />
                  <Panel>
                    <Field label="Headline">
                      <Input icon="heading" value={noticeTitle} onChangeText={setNoticeTitle} placeholder="New chapter coming soon!" accessibilityLabel="Announcement title input" />
                    </Field>
                    <Field label="Message">
                      <Input multiline value={noticeText} onChangeText={setNoticeText} placeholder="Tell your readers what's up…" accessibilityLabel="Announcement message input" />
                    </Field>
                    <Field label="Release date (optional)" style={{ marginBottom: space.lg }}>
                      <Tap onPress={() => setShowNoticeDatePicker(true)} style={styles.dateBtn} accessibilityLabel="Select announcement release date">
                        <Icon name="calendar-alt" size={14} color={colors.textMute} />
                        <Text style={[type.body, { marginLeft: 10, color: noticeDate ? '#fff' : colors.textFaint, flex: 1 }]}>
                          {noticeDate ? noticeDate.toLocaleString() : 'Select a date & time'}
                        </Text>
                        {noticeDate ? (
                          <Tap onPress={() => setNoticeDate(null)}>
                            <Icon name="times-circle" size={14} color={colors.textMute} solid />
                          </Tap>
                        ) : null}
                      </Tap>
                      {showNoticeDatePicker ? (
                        <DateTimePicker
                          value={noticeDate || new Date()}
                          mode="datetime"
                          minimumDate={new Date()}
                          themeVariant="dark"
                          onChange={(event, date) => {
                            setShowNoticeDatePicker(Platform.OS === 'ios');
                            if (date) setNoticeDate(date);
                          }}
                        />
                      ) : null}
                    </Field>
                    <GradientButton tone="sakura" icon="paper-plane" label="Send announcement" onPress={sendNotice} />
                  </Panel>
                </Animated.View>
              ) : null}

              {/* Admin: artists */}
              {isAdmin ? (
                <View style={{ marginTop: space.xxl }}>
                  <SectionHeader title="Artists" icon="user-shield" accent={colors.electric} />
                  {artistList.length === 0 ? (
                    <Text style={type.body}>No artists found.</Text>
                  ) : (
                    artistList.map((a) => (
                      <View key={a.id} style={styles.artistRow}>
                        <View style={styles.artistAvatar}>
                          <Text style={type.h3}>{(a.name || '?').slice(0, 1).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={type.bodyStrong}>{a.name || 'Unnamed'}</Text>
                          <Text numberOfLines={1} style={type.caption}>{a.email}</Text>
                        </View>
                        <Icon name="user-shield" size={12} color={colors.electric} solid />
                      </View>
                    ))
                  )}
                </View>
              ) : null}

              <View style={styles.footer}>
                <Icon name="star" size={11} color={colors.gold} solid />
                <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
              </View>
            </View>
          </ScrollView>

          {/* Sticky publish bar */}
          {!kbVisible ? (
            <Animated.View entering={FadeInDown.duration(300)} style={[styles.publishBar, { paddingBottom: 100 }]}>
              <View style={{ flex: 1, marginRight: space.md }}>
                <Text style={type.bodyStrong} numberOfLines={1}>{title.trim() || 'Untitled series'}</Text>
                <Text style={type.caption}>
                  {detailsDone ? 'Details ready' : 'Details incomplete'} · {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
                </Text>
              </View>
              <GradientButton
                full={false}
                icon="upload"
                label={activeManga ? 'Update' : 'Publish'}
                onPress={submitManga}
                disabled={loading}
                loading={loading}
                style={{ minWidth: 130 }}
              />
            </Animated.View>
          ) : null}
        </KeyboardAvoidingView>

        {/* Saving overlay (only after the first load so the editor never disappears) */}
        {loading && userId ? (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.overlay} pointerEvents="auto">
            <View style={styles.overlayCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ ...type.bodyStrong, marginTop: space.md }}>Working…</Text>
              <Text style={type.caption}>Uploading images can take a moment</Text>
            </View>
          </Animated.View>
        ) : null}
      </Screen>

      {/* Tags sheet */}
      <Sheet
        visible={showTagModal}
        onClose={() => setShowTagModal(false)}
        title="Select tags"
        tall
        footer={<GradientButton label={`Done${tags.length ? ` (${tags.length})` : ''}`} icon="check" onPress={() => setShowTagModal(false)} />}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.tagGrid}>
            {TAG_OPTIONS.map((tag) => {
              const on = !!tags.find((t) => t.value === tag.value);
              return (
                <Chip
                  key={tag.value}
                  label={tag.label}
                  active={on}
                  icon={on ? 'check' : undefined}
                  color={tag.value === 'Adult(18+)' ? colors.danger : colors.primary}
                  onPress={() => toggleTag(tag)}
                />
              );
            })}
          </View>
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  );
};

export default MangaDashboardScreen;
