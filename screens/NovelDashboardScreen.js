import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { View, Text, Pressable, Platform, ScrollView, Image, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Modal from 'react-native-modal';
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
} from 'react-native-draggable-flatlist';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import { LinearGradient } from 'expo-linear-gradient';
import ChapterEditor from '../components/editor/ChapterEditor';
import { draftKey, loadDraft, clearDraft, listDrafts, timeSince } from '../services/drafts';
import { cacheSet, cacheValue } from '../services/localCache';
import { useOnline } from '../hooks/useOnline';
import { FontAwesome5 } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import ConnectButton from '../components/ConnectButton';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';
import { notifyReaders, getTitleReaderIds, getCreatorReaderIds } from '../services/notify';
import ScreenSkeleton from '../components/ScreenSkeleton';
import { EmptyState } from '../components/ui';
import GelOrb from '../components/nav/GelOrb';
import { ActionButton, makeDetailStyles, STATUS, formatCount } from '../components/detail/DetailKit';
import {
  Page, PageHeader, SectionHeader, Card, ChipRow, Field, TextField, StatTile, Segmented, Toggle, GUTTER, PAGE_BOTTOM,
} from '../components/page/PageKit';
import { coverSource, radius, space } from '../theme/tokens';

import { gelAlert } from '../components/gel/GelAlert';
// The actual image bytes for upload. (Passing the picker's {uri, name, type}
// object made storage save that object as text instead of the picture.)
async function readImageBytes(uri) {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}


// Predefined tag options
const TAG_OPTIONS = [
  { value: 'Action', label: 'Action' },
  { value: 'Adult(18+)', label: 'Adult(18+)' },
  { value: 'Adventure', label: 'Adventure' },
  { value: 'Comedy', label: 'Comedy' },
  { value: 'Drama', label: 'Drama' },
  { value: 'Fantasy', label: 'Fantasy' },
  { value: 'Horror', label: 'Horror' },
  { value: 'Mystery', label: 'Mystery' },
  { value: 'Romance', label: 'Romance' },
  { value: 'Sci-Fi', label: 'Sci-Fi' },
  { value: 'Slice of Life', label: 'Slice of Life' },
  { value: 'Supernatural', label: 'Supernatural' },
  { value: 'Thriller', label: 'Thriller' },
  { value: 'Historical', label: 'Historical' },
  { value: 'Sports', label: 'Sports' },
  { value: 'Psychological', label: 'Psychological' },
  { value: 'Shonen', label: 'Shonen' },
  { value: 'Shojo', label: 'Shojo' },
  { value: 'Seinen', label: 'Seinen' },
  { value: 'Josei', label: 'Josei' },
];

// Generate picker options
const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() + i); // 2025-2035
const months = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString().padStart(2, '0'),
  label: new Date(0, i).toLocaleString('en', { month: 'long' }),
}));
const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

// Function to validate date
const validateDate = (year, month, day, hour, minute) => {
  const dateString = `${year}-${month}-${day} ${hour}:${minute}`;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;

  // Check if date is valid (e.g., not Feb 30)
  if (date.getDate() !== parseInt(day)) return false;

  // Ensure date is in the future
  const now = new Date();
  return date >= now;
};

// Function to convert selections to ISO string
const selectionsToISO = (year, month, day, hour, minute) => {
  if (!year || !month || !day || !hour || !minute) return null;
  const dateString = `${year}-${month}-${day} ${hour}:${minute}`;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date.toISOString();
};

// Function to parse ISO date to picker values
const parseISOToSelections = (isoDate) => {
  if (!isoDate) return { year: '', month: '', day: '', hour: '', minute: '' };
  const date = new Date(isoDate);
  return {
    year: date.getFullYear().toString(),
    month: (date.getMonth() + 1).toString().padStart(2, '0'),
    day: date.getDate().toString().padStart(2, '0'),
    hour: date.getHours().toString().padStart(2, '0'),
    minute: date.getMinutes().toString().padStart(2, '0'),
  };
};


const NovelDashboardScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const editNovelId = route?.params?.editNovelId || null;
  const openedFromLink = useRef(null);
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const { isDark, colors } = useTheme();
  const ss = useMemo(() => makeStudioStyles(colors, isDark), [colors, isDark]);
  const kit = useMemo(() => makeDetailStyles(colors, isDark), [colors, isDark]);

  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey;
  const [access, setAccess] = useState('checking'); // checking | granted | denied | error
  const [novelsLoaded, setNovelsLoaded] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [novelTitle, setNovelTitle] = useState('');
  const [novelImage, setNovelImage] = useState(null);
  const [novelImageUrl, setNovelImageUrl] = useState('');
  const [novelSummary, setNovelSummary] = useState('');
  const [novelStatus, setNovelStatus] = useState('ongoing');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterContent, setNewChapterContent] = useState('');
  const [newChapterIsAdvance, setNewChapterIsAdvance] = useState(false);
  const [chapterReleaseDate, setChapterReleaseDate] = useState({ year: '', month: '', day: '', hour: '', minute: '' });
  const [novelsList, setNovelsList] = useState([]);
  const [selectedNovel, setSelectedNovel] = useState(null);
  const [chapterTitles, setChapterTitles] = useState([]);
  const [chapterContents, setChapterContents] = useState([]);
  const [advanceChapters, setAdvanceChapters] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isWriter, setIsWriter] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [writers, setWriters] = useState([]);
  const [editChapterIndex, setEditChapterIndex] = useState(null);
  const [loading, setLoading] = useState(false); // publish / delete in flight
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementReleaseDate, setAnnouncementReleaseDate] = useState({ year: '', month: '', day: '', hour: '', minute: '' });
  const [tags, setTags] = useState([]);
  const [reordering, setReordering] = useState(false);
  useEffect(() => setReordering(false), [selectedNovel?.id]);

  // Writing Studio + device drafts (offline-first)
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const currentDraftKey = draftKey({ novelId: selectedNovel?.id, chapterIndex: editChapterIndex });
  useEffect(() => {
    let alive = true;
    if (editorOpen) return undefined;
    loadDraft(currentDraftKey).then((d) => { if (alive) setPendingDraft(d); });
    return () => { alive = false; };
  }, [currentDraftKey, editorOpen]);
  const chapterTitleRef = useRef(null);

  // Focus the chapter title input when editing a chapter
  useEffect(() => {
    if (editChapterIndex !== null && chapterTitleRef.current) chapterTitleRef.current.focus();
  }, [editChapterIndex]);

  const validateChapterData = () => {
    if (chapterTitles.length !== chapterContents.length) {
      console.error('Chapter titles and contents are out of sync:', {
        titlesLength: chapterTitles.length,
        contentsLength: chapterContents.length,
      });
      toast.error('Chapter data is out of sync. Please reset the form.');
      return false;
    }
    return true;
  };

  // Offline: the studio still opens from what this phone remembers (who you
  // are + your manuscripts), so writing never waits for a connection.
  const [offline, setOffline] = useState(false);
  const [deviceDrafts, setDeviceDrafts] = useState([]);
  const online = useOnline();
  const accessCacheKey = activePublicKey ? `studio:access:${activePublicKey.toString()}` : null;

  const handleCreatorAccess = async () => {
    if (!isWalletConnected || !activePublicKey) return;
    setAccess((a) => (a === 'granted' ? a : 'checking'));
    const grant = (d) => {
      setCurrentUserId(d.id);
      setIsWriter(!!d.isWriter);
      setIsSuperuser(!!d.isSuperuser);
      setAccess('granted');
    };
    try {
      const walletAddress = activePublicKey.toString();
      const { data, error } = await supabase
        .from('users')
        .select('id, isWriter, isSuperuser')
        .eq('wallet_address', walletAddress)
        .single();
      if (error && error.code !== 'PGRST116') throw new Error(error.message || 'Failed to fetch user data');
      if (!data || (!data.isWriter && !data.isSuperuser)) {
        setAccess('denied');
        return;
      }
      cacheSet(accessCacheKey, { id: data.id, isWriter: !!data.isWriter, isSuperuser: !!data.isSuperuser });
      setOffline(false);
      grant(data);
    } catch (err) {
      const remembered = accessCacheKey ? await cacheValue(accessCacheKey) : null;
      if (remembered?.id) {
        setOffline(true);
        grant(remembered);
        return;
      }
      console.error('Error in creator access:', err.message);
      setAccess('error');
    }
  };

  const fetchNovels = async () => {
    if (!currentUserId) return;
    const listKey = `studio:novels:${currentUserId}:${isSuperuser ? 'all' : 'mine'}`;
    try {
      let query = supabase.from('novels').select('*, viewers_count, tags');
      if (!isSuperuser) query = query.eq('user_id', currentUserId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      setNovelsList(data || []);
      cacheSet(listKey, data || []);
      setOffline(false);
    } catch (err) {
      const remembered = await cacheValue(listKey);
      if (remembered) {
        setNovelsList(remembered);
        setOffline(true);
      } else {
        console.error('Error fetching novels:', err.message);
        toast.error("Couldn't load your manuscripts — you can still write; drafts save on this phone.");
      }
    } finally {
      setNovelsLoaded(true);
    }
  };

  const refreshDeviceDrafts = () => listDrafts().then(setDeviceDrafts);
  useEffect(() => { if (!editorOpen) refreshDeviceDrafts(); }, [editorOpen, novelsLoaded]);

  // Back online: refresh quietly.
  useEffect(() => {
    if (online === true && offline) {
      handleCreatorAccess();
      fetchNovels();
    }
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick up a draft saved on this phone: open its manuscript + chapter, then the editor.
  const resumeDeviceDraft = (d) => {
    if (d.novelId === 'new') {
      resetForm();
    } else {
      const novel = novelsList.find((n) => n.id === d.novelId);
      if (!novel) {
        toast.info("That draft's manuscript isn't on this phone yet — connect once to load it.");
        return;
      }
      handleEditNovel(novel);
      // Set the chapter from the manuscript itself (same update batch, so it
      // wins over the reset inside handleEditNovel).
      const titles = Array.isArray(novel.chaptertitles) ? novel.chaptertitles : [];
      const contents = Array.isArray(novel.chaptercontents) ? novel.chaptercontents : [];
      const idx = d.chapterIndex;
      if (idx !== null && idx >= 0 && idx < titles.length) {
        const adv = (Array.isArray(novel.advance_chapters) ? novel.advance_chapters : []).find((c) => c.index === idx) || {};
        setNewChapterTitle(titles[idx] || '');
        setNewChapterContent(contents[idx] || '');
        setNewChapterIsAdvance(!!adv.is_advance);
        setChapterReleaseDate(parseISOToSelections(adv.free_release_date || null));
        setEditChapterIndex(idx);
      } else {
        // A new chapter (or one that's since been removed): bring the words along.
        setEditChapterIndex(null);
        if (idx !== null) {
          setNewChapterTitle(d.title || '');
          setNewChapterContent(d.content || '');
        }
      }
    }
    // Open once the draft key points at this chapter; the editor restores the draft.
    setTimeout(() => { setEditorOpen(true); scrollToEditor(); }, 80);
  };

  const fetchWriters = async () => {
    if (!isSuperuser) return;

    try {
      const { data, error } = await supabase.rpc('admin_list_users', { p_role: 'writer', p_limit: 1000 });

      if (error) throw new Error(error.message);
      setWriters(data || []);
    } catch (err) {
      console.error('Error fetching writers:', err.message);
      toast.error(`Failed to fetch writers: ${err.message}`);
    } finally {
    }
  };

  useEffect(() => {
    handleCreatorAccess();
  }, [isWalletConnected, activePublicKey]);

  useEffect(() => {
    if (currentUserId && (isWriter || isSuperuser)) {
      fetchNovels();
      if (isSuperuser) fetchWriters();
    }
  }, [currentUserId, isWriter, isSuperuser]);

  // Opened from Home (admin 'Edit' on a spotlight novel): open it in the editor.
  useEffect(() => {
    if (!editNovelId || !novelsLoaded || openedFromLink.current === editNovelId) return;
    const target = novelsList.find((n) => n.id === editNovelId);
    if (!target) return;
    openedFromLink.current = editNovelId;
    openManuscript(target);
  }, [editNovelId, novelsLoaded, novelsList]);

  const handleImageChange = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission Denied — We need permission to access your photo library to select a cover image.');
        return;
      }

      const response = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (response.canceled) return;
      if (response.errorCode) {
        toast.error(`Image selection failed: ${response.errorMessage}`);
        return;
      }
      if (response.assets && response.assets[0]) {
        // Covers are shown at phone size: 1080px JPEG keeps them sharp but
        // light (originals were 1–4 MB and loaded slowly for readers).
        const small = await ImageManipulator.manipulateAsync(
          response.assets[0].uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
        );
        const file = {
          uri: small.uri,
          name: `cover-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        setNovelImage(file);
        setNovelImageUrl(file.uri);
      }
    } catch (err) {
      console.error('Error in handleImageChange:', err.message);
      toast.error(`Failed to select image: ${err.message}`);
    }
  };

  const handleAddChapter = () => {
    if (!newChapterTitle.trim() || !newChapterContent.trim()) {
      toast.error('Please provide both a chapter title and content.');
      return;
    }

    // Validate release date if advance chapter
    if (newChapterIsAdvance) {
      const { year, month, day, hour, minute } = chapterReleaseDate;
      if (!year || !month || !day || !hour || !minute) {
        toast.error('Please select all date and time components for the advance chapter.');
        return;
      }
      if (!validateDate(year, month, day, hour, minute)) {
        toast.error('Invalid or past release date. Please select a valid future date.');
        return;
      }
    }

    const index = editChapterIndex !== null ? editChapterIndex : chapterTitles.length;
    const isoDate = newChapterIsAdvance
      ? selectionsToISO(
          chapterReleaseDate.year,
          chapterReleaseDate.month,
          chapterReleaseDate.day,
          chapterReleaseDate.hour,
          chapterReleaseDate.minute
        )
      : null;

    if (editChapterIndex !== null) {
      setChapterTitles((prev) => {
        const updated = [...prev];
        updated[index] = newChapterTitle;
        return updated;
      });
      setChapterContents((prev) => {
        const updated = [...prev];
        updated[index] = newChapterContent;
        return updated;
      });
      setAdvanceChapters((prev) => {
        const updated = [...prev.filter((c) => c.index !== index)];
        updated.push({
          index,
          is_advance: newChapterIsAdvance,
          free_release_date: isoDate,
        });
        return updated;
      });
      setEditChapterIndex(null);
    } else {
      setChapterTitles((prev) => [...prev, newChapterTitle]);
      setChapterContents((prev) => [...prev, newChapterContent]);
      setAdvanceChapters((prev) => [
        ...prev,
        {
          index,
          is_advance: newChapterIsAdvance,
          free_release_date: isoDate,
        },
      ]);
    }

    setNewChapterTitle('');
    setNewChapterContent('');
    setNewChapterIsAdvance(false);
    setChapterReleaseDate({ year: '', month: '', day: '', hour: '', minute: '' });
    clearDraft(draftKey({ novelId: selectedNovel?.id, chapterIndex: editChapterIndex }));
    setPendingDraft(null);
  };

  const handleEditChapter = (index) => {
    if (
      index === undefined ||
      index === null ||
      index < 0 ||
      index >= chapterTitles.length ||
      index >= chapterContents.length
    ) {
      console.error('Invalid chapter index:', index, {
        chapterTitlesLength: chapterTitles.length,
        chapterContentsLength: chapterContents.length,
      });
      toast.error('Invalid chapter index.');
      setEditChapterIndex(null);
      return;
    }

    const title = chapterTitles[index] || '';
    const content = chapterContents[index] || '';
    const advanceInfo = advanceChapters.find((c) => c.index === index) || {
      is_advance: false,
      free_release_date: null,
    };

    setNewChapterTitle(title);
    setNewChapterContent(content);
    setNewChapterIsAdvance(advanceInfo.is_advance);
    setChapterReleaseDate(parseISOToSelections(advanceInfo.free_release_date));
    setEditChapterIndex(index);
  };

  const deleteChapterAt = (index) => {
    if (index === undefined || index === null || index < 0 || index >= chapterTitles.length) {
      toast.error('Invalid chapter index for deletion.');
      return;
    }
    setChapterTitles((prev) => prev.filter((_, i) => i !== index));
    setChapterContents((prev) => prev.filter((_, i) => i !== index));
    setAdvanceChapters((prev) =>
      prev
        .filter((c) => c.index !== index)
        .map((c) => ({ ...c, index: c.index > index ? c.index - 1 : c.index }))
    );
    if (editChapterIndex === index) setEditChapterIndex(null);
  };

  const handleRemoveChapter = (index) => {
    if (index === undefined || index === null || index < 0 || index >= chapterTitles.length) {
      toast.error('Invalid chapter index for deletion.');
      return;
    }
    gelAlert(
      'Delete chapter?',
      `"${chapterTitles[index]}" will be removed when you save. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteChapterAt(index) },
      ]
    );
  };

  const handleDragEnd = ({ data }) => {
    if (!validateChapterData()) {
      toast.error('Chapter titles and contents are out of sync.');
      return;
    }

    const newTitles = data.map((item) => item.title);
    const newContents = data.map((item) => item.content);
    const newAdvanceChapters = data.map((item, newIndex) => {
      const originalChapter = advanceChapters.find((c) => c.index === item.id) || {
        index: newIndex,
        is_advance: false,
        free_release_date: null,
      };
      return {
        ...originalChapter,
        index: newIndex,
      };
    });

    setChapterTitles(newTitles);
    setChapterContents(newContents);
    setAdvanceChapters(newAdvanceChapters);
  };

  const handleEditNovel = (novel) => {
    if (novel.user_id !== currentUserId && !isSuperuser) {
      toast.error('You can only edit your own novels unless you are a superuser.');
      return;
    }
    const nextChapterTitles = Array.isArray(novel.chaptertitles) ? novel.chaptertitles : [];
    const nextChapterContents = Array.isArray(novel.chaptercontents) ? novel.chaptercontents : [];
    const nextAdvanceChapters = Array.isArray(novel.advance_chapters) ? novel.advance_chapters : [];
    setSelectedNovel(novel);
    setNovelTitle(novel.title || '');
    setNovelImage(null);
    setNovelImageUrl(novel.image || '');
    setNovelSummary(novel.summary || '');
    setNovelStatus(novel.status || 'ongoing');
    setChapterTitles(nextChapterTitles);
    setChapterContents(nextChapterContents);
    setAdvanceChapters(nextAdvanceChapters);
    setTags(novel.tags ? novel.tags.map((tag) => ({ value: tag, label: tag })) : []);
    setEditChapterIndex(null);
  };

  const handleDeleteNovel = (novel) => {
    if (novel.user_id !== currentUserId && !isSuperuser) {
      toast.error('You can only delete your own novels unless you are a superuser.');
      return;
    }
    gelAlert('Delete novel?', `"${novel.title}" and all its chapters will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNovel(novel) },
    ]);
  };

  const deleteNovel = async (novel) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('novels').delete().eq('id', novel.id);
      if (error) throw new Error(error.message);
      setNovelsList((prev) => prev.filter((n) => n.id !== novel.id));
      if (selectedNovel && selectedNovel.id === novel.id) resetForm();
      toast.success('Novel deleted');
    } catch (err) {
      console.error('Error deleting novel:', err.message);
      toast.error(`Failed to delete novel: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNovelSubmit = async () => {
    try {
      const net = await Network.getNetworkStateAsync();
      if (net && net.isConnected === false) {
        toast.info("You're offline — your writing is safe on this device. Publish when you're back online.");
        return;
      }
    } catch {
      /* unknown network state: try anyway */
    }
    if (!novelTitle.trim() || (!novelImage && !selectedNovel?.image) || !novelSummary.trim()) {
      toast.error('Please fill in all novel details.');
      return;
    }
    if (!validateChapterData()) {
      toast.error('Chapter titles and contents are out of sync.');
      return;
    }

    // Validate advance chapters' release dates
    for (const chapter of advanceChapters) {
      if (chapter.is_advance && chapter.free_release_date) {
        const { year, month, day, hour, minute } = parseISOToSelections(chapter.free_release_date);
        if (!validateDate(year, month, day, hour, minute)) {
          toast.error(`Invalid or past release date for chapter ${chapter.index + 1}. Please select a valid future date.`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      let imageUrl = selectedNovel ? selectedNovel.image : '';
      if (novelImage) {
        const fileName = `${currentUserId}/${Date.now()}-${novelImage.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('covers')
          .upload(fileName, await readImageBytes(novelImage.uri), {
            contentType: 'image/jpeg',
            upsert: true,
          });
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
        imageUrl = supabase.storage.from('covers').getPublicUrl(fileName).data.publicUrl;
      }

      const novelData = {
        user_id: currentUserId,
        title: novelTitle,
        image: imageUrl,
        summary: novelSummary,
        chaptertitles: chapterTitles,
        chaptercontents: chapterContents,
        advance_chapters: advanceChapters,
        tags: tags.map((tag) => tag.value),
        viewers_count: selectedNovel ? selectedNovel.viewers_count : 0,
        status: novelStatus,
      };

      let novelId, chapterNumber, message;
      if (selectedNovel) {
        if (selectedNovel.user_id !== currentUserId && !isSuperuser) {
          throw new Error('You can only update your own novels unless you are a superuser.');
        }
        const { error } = await supabase.from('novels').update(novelData).eq('id', selectedNovel.id);
        if (error) throw new Error(error.message);

        novelId = selectedNovel.id;
        chapterNumber = chapterTitles.length;
        message = `A new chapter (${chapterNumber}) has been added to "${novelTitle}"!`;
      } else {
        const { data, error } = await supabase.from('novels').insert([novelData]).select('id').single();
        if (error) throw new Error(error.message);

        novelId = data.id;
        message = `A new novel "${novelTitle}" has been published!`;
      }

      // ── Reader notifications (best-effort: never fails the save) ──
      //  · new chapter(s) on an existing novel → that novel's readers
      //  · brand-new novel → everyone who reads this writer's other work
      //  · edits with no new chapter → nobody (used to spam "new chapter")
      const creatorId = selectedNovel ? selectedNovel.user_id : currentUserId;
      const prevChapterCount = selectedNovel && Array.isArray(selectedNovel.chaptertitles) ? selectedNovel.chaptertitles.length : 0;
      const addedChapters = selectedNovel ? chapterTitles.length - prevChapterCount : 0;
      let notified = 0;

      if (selectedNovel && addedChapters > 0) {
        const latestTitle = chapterTitles[chapterTitles.length - 1];
        const body = addedChapters > 1
          ? `${addedChapters} new chapters are up — start with Chapter ${prevChapterCount + 1}.`
          : `Chapter ${chapterNumber}${latestTitle ? `: ${latestTitle}` : ''} is out now.`;
        ({ notified } = await notifyReaders({
          userIds: await getTitleReaderIds('novel', novelId),
          excludeUserId: creatorId,
          title: `📖 New chapter · ${novelTitle}`,
          body,
          data: { novelId, chapterId: String(chapterTitles.length - 1), type: 'new_chapter' },
          rowFor: (userId) => ({
            user_id: userId,
            novel_id: novelId,
            novel_title: novelTitle,
            type: 'new_chapter',
            message,
            chapter: chapterNumber,
          }),
        }));
      } else if (!selectedNovel) {
        ({ notified } = await notifyReaders({
          userIds: await getCreatorReaderIds(creatorId, { excludeContentId: novelId }),
          excludeUserId: creatorId,
          title: `✨ New novel · ${novelTitle}`,
          body: 'A writer you read just started a new story. Be one of the first to dive in.',
          data: { novelId, type: 'new_novel' },
          rowFor: (userId) => ({
            user_id: userId,
            novel_id: novelId,
            novel_title: novelTitle,
            type: 'new_novel',
            message,
            chapter: null,
          }),
        }));
      }

      toast.success(
        !selectedNovel
          ? `"${novelTitle}" is live!${notified ? ` ${notified} reader${notified === 1 ? '' : 's'} notified.` : ''}`
          : addedChapters > 0
          ? `Chapter published${notified ? ` — ${notified} reader${notified === 1 ? '' : 's'} notified` : ''}`
          : 'Changes saved'
      );
      resetForm();
      fetchNovels();
    } catch (err) {
      console.error('Error submitting novel:', err.message);
      toast.error(`Failed to submit novel: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnouncementSubmit = async () => {
    if (!selectedNovel) {
      toast.error('Please select a novel to announce.');
      return;
    }
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      toast.error('Please provide both an announcement title and message.');
      return;
    }

    // Validate announcement release date if provided
    const { year, month, day, hour, minute } = announcementReleaseDate;
    if (year || month || day || hour || minute) {
      if (!year || !month || !day || !hour || !minute) {
        toast.error('Please select all date and time components for the announcement.');
        return;
      }
      if (!validateDate(year, month, day, hour, minute)) {
        toast.error('Invalid or past announcement release date. Please select a valid future date.');
        return;
      }
    }

    setAnnouncing(true);
    try {
      const announcementData = {
        writer_id: currentUserId,
        novel_id: selectedNovel.id,
        title: announcementTitle,
        message: announcementMessage,
        release_date: selectionsToISO(year, month, day, hour, minute),
      };

      const { error: announcementError } = await supabase
        .from('writer_announcements')
        .insert([announcementData]);

      if (announcementError) throw new Error(announcementError.message);

      // Readers of this novel hear about it (best-effort; never fails the send).
      const { notified } = await notifyReaders({
        userIds: await getTitleReaderIds('novel', selectedNovel.id),
        excludeUserId: selectedNovel.user_id,
        title: `📣 ${selectedNovel.title}`,
        body: `${announcementTitle} — ${announcementMessage}`,
        data: { novelId: selectedNovel.id, type: 'announcement' },
        rowFor: (userId) => ({
          user_id: userId,
          novel_id: selectedNovel.id,
          type: 'announcement',
          message: `${announcementTitle}: ${announcementMessage}`,
          novel_title: selectedNovel.title,
        }),
      });

      toast.success(notified ? `Announcement sent to ${notified} reader${notified === 1 ? '' : 's'}` : 'Announcement posted — no readers to notify yet');
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      setAnnouncementReleaseDate({ year: '', month: '', day: '', hour: '', minute: '' });
    } catch (err) {
      console.error('Error sending announcement:', err.message);
      toast.error(`Failed to send announcement: ${err.message}`);
    } finally {
      setAnnouncing(false);
    }
  };

  const resetForm = () => {
    setNovelTitle('');
    setNovelImage(null);
    setNovelImageUrl('');
    setNovelSummary('');
    setNewChapterTitle('');
    setNewChapterContent('');
    setNewChapterIsAdvance(false);
    setChapterReleaseDate({ year: '', month: '', day: '', hour: '', minute: '' });
    setChapterTitles([]);
    setChapterContents([]);
    setAdvanceChapters([]);
    setSelectedNovel(null);
    setEditChapterIndex(null);
    setTags([]);
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setAnnouncementReleaseDate({ year: '', month: '', day: '', hour: '', minute: '' });
  };

  const handleTagSelect = (tag) => {
    if (tags.find((t) => t.value === tag.value)) {
      setTags(tags.filter((t) => t.value !== tag.value));
    } else {
      setTags([...tags, tag]);
    }
  };

  /* ═════════════════════════════════ render ═════════════════════════════════ */

  const scrollRef = useRef(null);
  const editorY = useRef(0);
  const scrollToEditor = () => scrollRef.current?.scrollTo?.({ y: Math.max(0, editorY.current - 12), animated: true });

  const startNewManuscript = () => {
    resetForm();
    scrollToEditor();
  };

  const openManuscript = (novel) => {
    handleEditNovel(novel);
    setTimeout(scrollToEditor, 60);
  };

  const stats = useMemo(() => {
    const views = novelsList.reduce((sum, n) => sum + (Number(n.viewers_count) || 0), 0);
    const chapters = novelsList.reduce((sum, n) => sum + (Array.isArray(n.chaptertitles) ? n.chaptertitles.length : 0), 0);
    return { views, chapters };
  }, [novelsList]);

  const wordCount = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

  /*
   * Chapter rows render two ways:
   *  - normal: a plain list, no gesture handlers at all, so the page scrolls
   *    freely no matter where your finger lands; tap a row to edit it.
   *  - reorder mode: the draggable list, dragged by the grip handle.
   * (Previously every row lived inside the drag list, whose gesture handler
   * claimed any vertical move — the page couldn't scroll over the chapters.)
   */
  const renderChapterItem = ({ item, drag, isActive }) => {
    if (item.id === undefined || item.id === null) return null;
    const advanceInfo = advanceChapters.find((c) => c.index === item.id) || { is_advance: false };
    const editing = editChapterIndex === item.id;
    const sorting = !!drag;
    return (
      <Pressable
        key={`chapter-${item.id}`}
        onPress={sorting ? undefined : () => handleEditChapter(item.id)}
        style={[
          ss.chapterRow,
          (isActive || editing) && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
          isActive && { transform: [{ scale: 1.02 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Chapter ${item.id + 1}, ${item.title}${sorting ? '' : '. Tap to edit'}`}
      >
        <View style={[ss.disc, { backgroundColor: `${colors.accent}1F`, borderColor: `${colors.accent}55` }]}>
          <Text style={[ss.discText, { color: colors.accent }]}>{item.id + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ss.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={ss.rowSub} numberOfLines={1}>{(item.content || '').replace(/\s+/g, ' ').slice(0, 80)}</Text>
          {advanceInfo.is_advance ? (
            <View style={[ss.badge, { backgroundColor: `rgba(${colors.goldRgb},0.16)` }]}>
              <FontAwesome5 name="star" size={8} color={colors.gold} solid />
              <Text style={[ss.badgeText, { color: colors.gold }]}>
                Advance · free{' '}
                {advanceInfo.free_release_date
                  ? new Date(advanceInfo.free_release_date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'TBD'}
              </Text>
            </View>
          ) : null}
        </View>
        {sorting ? (
          // Drag starts the instant the handle is touched — no long-press guessing.
          <Pressable
            onPressIn={drag}
            hitSlop={10}
            style={[ss.handle, { borderColor: colors.borderAccent, backgroundColor: colors.accentSoft }]}
            accessibilityRole="adjustable"
            accessibilityLabel={`Drag to move chapter ${item.id + 1}`}
          >
            <FontAwesome5 name="grip-lines" size={14} color={colors.accent} />
          </Pressable>
        ) : (
          <>
            <GelOrb icon="pen" size={32} onPress={() => handleEditChapter(item.id)} label={`Edit chapter ${item.id + 1}`} breathe={false} />
            <GelOrb icon="trash" size={32} tone={colors.danger} onPress={() => handleRemoveChapter(item.id)} label={`Delete chapter ${item.id + 1}`} breathe={false} />
          </>
        )}
      </Pressable>
    );
  };

  const renderManuscript = (novel) => {
    const active = selectedNovel?.id === novel.id;
    const chapters = Array.isArray(novel.chaptertitles) ? novel.chaptertitles.length : 0;
    const status = STATUS[novel.status];
    const canEdit = novel.user_id === currentUserId || isSuperuser;
    return (
      <Pressable
        onPress={() => (canEdit ? openManuscript(novel) : navigation.navigate('NovelDetail', { id: novel.id }))}
        style={({ pressed }) => [
          ss.manuscript,
          active && { borderColor: colors.accent, shadowColor: colors.accent, ...ss.manuscriptActive },
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${novel.title}${active ? ', currently editing' : ''}`}
      >
        <Image source={coverSource(novel.image)} style={ss.manuscriptCover} />
        <View style={{ flex: 1 }}>
          <Text style={ss.manuscriptTitle} numberOfLines={2}>{novel.title}</Text>
          <View style={ss.manuscriptMeta}>
            {status ? (
              <View style={[ss.dot, { backgroundColor: colors[status.key] }]} />
            ) : null}
            <Text style={ss.metaText} numberOfLines={1}>
              {status ? `${status.label} · ` : ''}{chapters} ch · {formatCount(novel.viewers_count)} views
            </Text>
          </View>
          {canEdit ? (
            <View style={ss.manuscriptActions}>
              <View style={[ss.editPill, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                <FontAwesome5 name={active ? 'feather-alt' : 'pen'} size={10} color={active ? '#FFFFFF' : colors.accent} />
                <Text style={[ss.editPillText, active && { color: '#FFFFFF' }]}>{active ? 'Editing' : 'Edit'}</Text>
              </View>
              <GelOrb icon="trash" size={30} tone={colors.danger} onPress={() => handleDeleteNovel(novel)} label={`Delete ${novel.title}`} breathe={false} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderDatePicker = (type, dateState, setDateState) => {
    const columns = [
      { key: 'year', label: 'Year', items: years.map((y) => ({ label: String(y), value: String(y) })) },
      { key: 'month', label: 'Month', items: months.map((m) => ({ label: m.label.slice(0, 3), value: m.value })) },
      { key: 'day', label: 'Day', items: days.map((d) => ({ label: d, value: d })) },
      { key: 'hour', label: 'Hr', items: hours.map((h) => ({ label: h, value: h })) },
      { key: 'minute', label: 'Min', items: minutes.map((m) => ({ label: m, value: m })) },
    ];
    return (
      <View style={ss.dateRow}>
        {columns.map((col) => (
          <View key={col.key} style={[ss.dateCell, col.key === 'year' || col.key === 'month' ? { flex: 1.35 } : null]}>
            <Picker
              selectedValue={dateState[col.key]}
              onValueChange={(value) => setDateState((prev) => ({ ...prev, [col.key]: value }))}
              style={ss.picker}
              dropdownIconColor={colors.textMuted}
              mode="dropdown"
              accessibilityLabel={`${type} ${col.label}`}
            >
              <Picker.Item label={col.label} value="" color={colors.textMuted} />
              {col.items.map((it) => (
                <Picker.Item key={it.value} label={it.label} value={it.value} />
              ))}
            </Picker>
          </View>
        ))}
      </View>
    );
  };

  /* ─────────────── access states ─────────────── */
  if (!isWalletConnected) {
    return (
      <Page>
        <View style={ss.center}>
          <EmptyState
            icon="feather-alt"
            title="Writer's Studio"
            subtitle="Connect your wallet to write, publish and manage your novels."
          />
          <View style={{ alignSelf: 'stretch', paddingHorizontal: space.xl }}>
            <ConnectButton />
          </View>
        </View>
      </Page>
    );
  }

  if (access === 'checking' || (access === 'granted' && !novelsLoaded)) {
    return <ScreenSkeleton variant="studio" label="Loading your studio" />;
  }

  if (access !== 'granted') {
    return (
      <Page>
        <View style={ss.center}>
          <EmptyState
            icon={access === 'error' ? 'exclamation-triangle' : 'lock'}
            title={access === 'error' ? "Couldn't open your studio" : 'Writers only'}
            subtitle={
              access === 'error'
                ? 'Check your connection and try again.'
                : 'The Writer’s Studio is for approved writers. Apply to become one and start publishing.'
            }
            action={access === 'error' ? 'Try again' : 'Become a writer'}
            onAction={() => (access === 'error' ? handleCreatorAccess() : navigation.navigate('Apply'))}
          />
        </View>
      </Page>
    );
  }

  const chapterData = chapterTitles
    .map((title, index) => ({ id: index, title, content: chapterContents[index] }))
    .filter((item) => item.title && item.content);
  const chaptersInSync = chapterTitles.length === chapterContents.length;

  return (
    <Page>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* One scroll owner; the draggable chapter list nests inside it. */}
        <NestableScrollContainer
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={ss.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PageHeader
            eyebrow="Writer's Studio"
            title="Novel Dashboard"
            subtitle={isSuperuser ? 'Superuser · all manuscripts' : 'Write, publish and grow your readers.'}
            right={<GelOrb icon="plus" size={42} lit onPress={startNewManuscript} label="New manuscript" breathe={false} />}
          />

          {/* stats */}
          <View style={ss.stats}>
            <StatTile icon="book" label="Manuscripts" value={novelsList.length} />
            <StatTile icon="eye" label="Total views" value={formatCount(stats.views)} tone={colors.info} />
            <StatTile icon="layer-group" label="Chapters" value={stats.chapters} tone={colors.gold} />
          </View>

          {offline ? (
            <Card tint style={{ marginTop: space.md, borderColor: `${colors.gold}66`, borderWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <FontAwesome5 name="wifi" size={14} color={colors.gold} />
                <Text style={[ss.cardTitle, { marginBottom: 0, flex: 1 }]}>You're offline — keep writing</Text>
              </View>
              <Text style={[ss.note, { marginTop: 6 }]}>
                Everything you write is saved on this phone as you type. Publish when you're back online — the studio refreshes by itself.
              </Text>
            </Card>
          ) : null}

          {/* drafts saved on this phone */}
          {deviceDrafts.length ? (
            <>
              <SectionHeader title="Drafts on this phone" count={deviceDrafts.length} />
              {deviceDrafts.slice(0, 6).map((d) => {
                const novel = d.novelId === 'new' ? null : novelsList.find((n) => n.id === d.novelId);
                const where = d.novelId === 'new'
                  ? 'New manuscript'
                  : `${novel?.title || 'Manuscript'} · ${d.chapterIndex === null ? 'new chapter' : `chapter ${d.chapterIndex + 1}`}`;
                return (
                  <Pressable
                    key={d.key}
                    onPress={() => resumeDeviceDraft(d)}
                    style={({ pressed }) => [ss.draftBanner, { marginTop: space.sm, borderColor: `${colors.gold}88`, backgroundColor: `rgba(${colors.goldRgb},${pressed ? 0.2 : 0.1})` }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Continue draft ${d.title || 'untitled'}, ${where}`}
                  >
                    <FontAwesome5 name="pen-fancy" size={13} color={colors.gold} />
                    <View style={{ flex: 1 }}>
                      <Text style={[ss.rowTitle, { fontSize: 14 }]} numberOfLines={1}>{d.title || 'Untitled chapter'}</Text>
                      <Text style={ss.rowSub} numberOfLines={1}>
                        {where} · {wordCount(d.content).toLocaleString()} words · {timeSince(d.updatedAt)}
                      </Text>
                    </View>
                    <FontAwesome5 name="chevron-right" size={11} color={colors.gold} />
                  </Pressable>
                );
              })}
            </>
          ) : null}

          {/* manuscripts */}
          <SectionHeader title={isSuperuser ? 'All manuscripts' : 'Your manuscripts'} count={novelsList.length} />
          {novelsList.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.bleed} contentContainerStyle={ss.rail}>
              {novelsList.map((n) => (
                <React.Fragment key={n.id}>{renderManuscript(n)}</React.Fragment>
              ))}
            </ScrollView>
          ) : (
            <Card tint>
              <Text style={ss.cardTitle}>Your first story starts here</Text>
              <Text style={ss.note}>Fill in the manuscript below and publish it to readers across SempaiHQ.</Text>
            </Card>
          )}

          {/* editor */}
          <View onLayout={(e) => { editorY.current = e.nativeEvent.layout.y; }}>
            <SectionHeader
              title={selectedNovel ? 'Editing manuscript' : 'New manuscript'}
              action={selectedNovel ? 'Cancel' : undefined}
              onAction={resetForm}
            />
            <Card tint>
              <View style={ss.identity}>
                <Pressable onPress={handleImageChange} style={ss.coverPick} accessibilityRole="button" accessibilityLabel={novelImageUrl ? 'Change cover image' : 'Choose cover image'}>
                  {novelImageUrl ? (
                    <Image source={{ uri: novelImageUrl }} style={ss.fill} resizeMode="cover" />
                  ) : (
                    <View style={ss.coverEmpty}>
                      <FontAwesome5 name="image" size={22} color={colors.textMuted} />
                      <Text style={ss.coverEmptyText}>Add cover</Text>
                    </View>
                  )}
                  <View style={[ss.coverBadge, { backgroundColor: colors.accent }]}>
                    <FontAwesome5 name="camera" size={10} color="#FFFFFF" solid />
                  </View>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Field label="Title" style={{ marginTop: 0 }}>
                    <TextField value={novelTitle} onChangeText={setNovelTitle} placeholder="Your novel's title" maxLength={120} />
                  </Field>
                  <Field label="Status">
                    <Segmented
                      value={novelStatus}
                      onChange={setNovelStatus}
                      options={[
                        { value: 'ongoing', label: 'Ongoing' },
                        { value: 'completed', label: 'Done' },
                        { value: 'hiatus', label: 'Hiatus' },
                      ]}
                    />
                  </Field>
                </View>
              </View>

              <Field label="Summary" counter={`${novelSummary.length}/1000`}>
                <TextField multiline value={novelSummary} onChangeText={setNovelSummary} placeholder="Hook your readers in a few lines" maxLength={1000} minHeight={110} />
              </Field>

              <Field label="Genres" counter={tags.length ? `${tags.length} selected` : undefined}>
                <ChipRow
                  options={TAG_OPTIONS}
                  selected={tags.map((t) => t.value)}
                  onToggle={(v) => handleTagSelect(TAG_OPTIONS.find((o) => o.value === v))}
                  onClear={() => setTags([])}
                  style={{ marginTop: 0 }}
                />
              </Field>
            </Card>
          </View>

          {/* chapters */}
          <SectionHeader
            title="Chapters"
            count={chapterData.length}
            action={chapterData.length > 1 && chaptersInSync ? (reordering ? 'Done' : 'Reorder') : undefined}
            onAction={() => setReordering((v) => !v)}
          />
          {chapterData.length > 0 && chaptersInSync ? (
            reordering ? (
              <>
                <View style={[ss.reorderHint, { borderColor: colors.borderAccent, backgroundColor: colors.accentSoft }]}>
                  <FontAwesome5 name="grip-lines" size={12} color={colors.accent} />
                  <Text style={[ss.note, { flex: 1, color: colors.textPrimary }]}>
                    Drag a chapter by its handle. Tap Done when you're finished.
                  </Text>
                </View>
                <NestableDraggableFlatList
                  data={chapterData}
                  renderItem={renderChapterItem}
                  keyExtractor={(item) => `chapter-${item.id}`}
                  onDragEnd={handleDragEnd}
                  activationDistance={8}
                />
              </>
            ) : (
              // Plain rows: no gesture handlers, so the page always scrolls.
              <View>{chapterData.map((item) => renderChapterItem({ item }))}</View>
            )
          ) : null}

          <Card tint style={{ marginTop: space.md }}>
            <Text style={ss.cardTitle}>
              {editChapterIndex !== null ? `Editing chapter ${editChapterIndex + 1}` : `Chapter ${chapterData.length + 1}`}
            </Text>
            {pendingDraft && !newChapterContent.trim() ? (
              <Pressable
                onPress={() => setEditorOpen(true)}
                style={[ss.draftBanner, { borderColor: `${colors.gold}88`, backgroundColor: `rgba(${colors.goldRgb},0.12)` }]}
                accessibilityRole="button"
                accessibilityLabel="Resume your unsaved draft"
              >
                <FontAwesome5 name="history" size={13} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[ss.rowTitle, { fontSize: 14 }]} numberOfLines={1}>
                    Resume draft{pendingDraft.title ? ` · ${pendingDraft.title}` : ''}
                  </Text>
                  <Text style={ss.rowSub}>
                    {wordCount(pendingDraft.content).toLocaleString()} words · saved {timeSince(pendingDraft.updatedAt)}
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={11} color={colors.gold} />
              </Pressable>
            ) : null}
            <Field label="Chapter title" style={{ marginTop: space.sm }}>
              <TextField ref={chapterTitleRef} value={newChapterTitle} onChangeText={setNewChapterTitle} placeholder="e.g. The Gate Opens" maxLength={150} />
            </Field>
            <Field label="Content" counter={`${wordCount(newChapterContent).toLocaleString()} words`}>
              {/* The page: tap to write in the full-screen Writing Studio */}
              <Pressable
                onPress={() => setEditorOpen(true)}
                style={({ pressed }) => [ss.pagePreview, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={newChapterContent.trim() ? 'Continue writing in the Writing Studio' : 'Start writing in the Writing Studio'}
              >
                {newChapterContent.trim() ? (
                  <Text style={ss.pageText} numberOfLines={6}>{newChapterContent}</Text>
                ) : (
                  <Text style={[ss.pageText, { color: colors.textMuted }]}>
                    Tap to open the Writing Studio — find & replace, smart typography, undo/redo, word goals, and drafts saved on your device.
                  </Text>
                )}
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(0,0,0,0)', colors.bgCard]}
                  style={ss.pageFade}
                />
                <View style={ss.pageCta}>
                  <LinearGradient
                    colors={[colors.accentHi, colors.accent, colors.accentDeep]}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={ss.pageCtaFill}
                  >
                    <FontAwesome5 name="feather-alt" size={12} color="#FFFFFF" />
                    <Text style={ss.pageCtaText}>{newChapterContent.trim() ? 'Continue writing' : 'Open writing studio'}</Text>
                  </LinearGradient>
                </View>
              </Pressable>
            </Field>
            <Toggle
              value={newChapterIsAdvance}
              onChange={setNewChapterIsAdvance}
              label="Advance chapter"
              sub="Readers pay to read early; it becomes free on the release date."
              style={{ marginTop: space.lg }}
            />
            {newChapterIsAdvance ? (
              <Field label="Free on" style={{ marginTop: space.sm }}>
                {renderDatePicker('Chapter', chapterReleaseDate, setChapterReleaseDate)}
              </Field>
            ) : null}
            <View style={ss.actions}>
              <ActionButton
                lit
                icon={editChapterIndex !== null ? 'check' : 'plus'}
                label={editChapterIndex !== null ? 'Update chapter' : 'Add chapter'}
                onPress={handleAddChapter}
                styles={kit}
                colors={colors}
                isDark={isDark}
              />
              <ActionButton
                icon="eraser"
                label="Clear"
                onPress={() => {
                  setNewChapterTitle('');
                  setNewChapterContent('');
                  setNewChapterIsAdvance(false);
                  setChapterReleaseDate({ year: '', month: '', day: '', hour: '', minute: '' });
                  setEditChapterIndex(null);
                }}
                styles={kit}
                colors={colors}
                isDark={isDark}
              />
            </View>
          </Card>

          {/* publish */}
          <View style={[ss.actions, { marginTop: space.xl }]}>
            <ActionButton
              lit
              icon={loading ? 'spinner' : selectedNovel ? 'save' : 'paper-plane'}
              label={loading ? 'Saving…' : selectedNovel ? 'Save changes' : 'Publish novel'}
              onPress={loading ? undefined : handleNovelSubmit}
              disabled={loading}
              styles={kit}
              colors={colors}
              isDark={isDark}
            />
          </View>
          <Text style={[ss.note, { textAlign: 'center', marginTop: space.sm }]}>
            {selectedNovel ? 'Readers of this novel are notified about new chapters.' : 'Publishing notifies readers across SempaiHQ.'}
          </Text>

          {/* announce */}
          {selectedNovel ? (
            <>
              <SectionHeader title="Announce to readers" />
              <Card tint>
                <Text style={ss.note}>Send an update to everyone reading “{selectedNovel.title}”.</Text>
                <Field label="Headline">
                  <TextField value={announcementTitle} onChangeText={setAnnouncementTitle} placeholder="e.g. New arc starts Friday!" maxLength={120} />
                </Field>
                <Field label="Message" counter={`${announcementMessage.length}/500`}>
                  <TextField multiline value={announcementMessage} onChangeText={setAnnouncementMessage} placeholder="What do you want readers to know?" maxLength={500} minHeight={100} />
                </Field>
                <Field label="Schedule (optional)" hint="Leave empty to send right away.">
                  {renderDatePicker('Announcement', announcementReleaseDate, setAnnouncementReleaseDate)}
                </Field>
                <View style={ss.actions}>
                  <ActionButton
                    lit
                    icon={announcing ? 'spinner' : 'bullhorn'}
                    label={announcing ? 'Sending…' : 'Send announcement'}
                    onPress={announcing ? undefined : handleAnnouncementSubmit}
                    disabled={announcing}
                    styles={kit}
                    colors={colors}
                    isDark={isDark}
                  />
                </View>
              </Card>
            </>
          ) : null}

          {/* writers (superuser) */}
          {isSuperuser ? (
            <>
              <SectionHeader title="Writers" count={writers.length} />
              <Card>
                {writers.length === 0 ? (
                  <Text style={ss.note}>No writers yet.</Text>
                ) : (
                  writers.map((w, i) => (
                    <View key={w.id} style={[ss.writerRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                      <View style={[ss.avatar, { backgroundColor: colors.accentSoft }]}>
                        <Text style={{ color: colors.accent, fontWeight: '800' }}>{(w.name || w.email || '?').slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.rowTitle} numberOfLines={1}>{w.name || 'Unnamed writer'}</Text>
                        <Text style={ss.rowSub} numberOfLines={1}>{w.email}</Text>
                      </View>
                    </View>
                  ))
                )}
              </Card>
            </>
          ) : null}
        </NestableScrollContainer>
      </KeyboardAvoidingView>

      <ChapterEditor
        visible={editorOpen}
        heading={editChapterIndex !== null ? `Chapter ${editChapterIndex + 1}` : `Chapter ${chapterData.length + 1}`}
        initialTitle={newChapterTitle}
        initialContent={newChapterContent}
        draftKey={currentDraftKey}
        onClose={() => setEditorOpen(false)}
        onDone={({ title, content }) => {
          if (title) setNewChapterTitle(title);
          setNewChapterContent(content);
          setEditorOpen(false);
          toast.success('Chapter ready — add it to your manuscript below');
        }}
      />
    </Page>
  );
};

const makeStudioStyles = (c, isDark) =>
  StyleSheet.create({
    scroll: { paddingHorizontal: GUTTER, paddingTop: GUTTER, paddingBottom: PAGE_BOTTOM },
    center: { flex: 1, justifyContent: 'center', paddingBottom: PAGE_BOTTOM / 2 },
    bleed: { marginHorizontal: -GUTTER },
    rail: { paddingHorizontal: GUTTER, gap: space.md },
    fill: { width: '100%', height: '100%' },
    stats: { flexDirection: 'row', gap: space.md },
    cardTitle: { fontFamily: 'Yoruka', fontSize: 19, color: c.textPrimary },
    note: { fontSize: 13, lineHeight: 19, color: c.textSecondary },
    actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },

    manuscript: {
      width: 260,
      minHeight: 124,
      flexDirection: 'row',
      gap: space.md,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    manuscriptActive: { shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
    manuscriptCover: { width: 68, height: 100, borderRadius: radius.sm, backgroundColor: c.bgCardAlt },
    manuscriptTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    manuscriptMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    metaText: { flex: 1, fontSize: 12, color: c.textMuted },
    dot: { width: 6, height: 6, borderRadius: 3 },
    manuscriptActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 8 },
    editPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 30,
      paddingHorizontal: 12,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: c.borderAccent,
    },
    editPillText: { fontSize: 12, fontWeight: '800', color: c.accent },

    identity: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    coverPick: {
      width: 110,
      height: 160,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: c.bgCardAlt,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderStyle: 'dashed',
    },
    coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    coverEmptyText: { fontSize: 12, fontWeight: '700', color: c.textMuted },
    coverBadge: { position: 'absolute', right: 6, bottom: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    chapterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      marginBottom: 8,
      borderRadius: radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    disc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    discText: { fontSize: 14, fontWeight: '800' },
    rowTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    rowSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 7, height: 20, borderRadius: 10, marginTop: 6 },
    badgeText: { fontSize: 10, fontWeight: '800' },
    handle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    draftBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: space.md, borderRadius: radius.md, borderWidth: 1 },
    pagePreview: {
      minHeight: 190,
      padding: 16,
      paddingBottom: 64,
      borderRadius: radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.borderStrong,
      overflow: 'hidden',
    },
    pageText: { fontSize: 15, lineHeight: 23, color: c.textSecondary },
    pageFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
    pageCta: { position: 'absolute', left: 16, right: 16, bottom: 12, height: 42, borderRadius: 21, overflow: 'hidden' },
    pageCtaFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    pageCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    reorderHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      marginBottom: space.sm,
      borderRadius: radius.md,
      borderWidth: 1,
    },

    dateRow: { flexDirection: 'row', gap: 6 },
    dateCell: {
      flex: 1,
      height: 48,
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.borderStrong,
      overflow: 'hidden',
    },
    picker: { color: c.textPrimary, marginHorizontal: Platform.OS === 'android' ? -8 : 0 },

    writerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  });

export default NovelDashboardScreen;
