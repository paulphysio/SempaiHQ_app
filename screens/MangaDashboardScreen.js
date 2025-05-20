import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Notifications from 'expo-notifications';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import ConnectButton from '../components/ConnectButton';
import { styles } from '../styles/MangaDashboardStyles';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

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

// Function to schedule a push notification
const schedulePushNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Immediate notification
    });
  } catch (error) {
    console.error('Error scheduling push notification:', error);
  }
};

const MangaDashboardScreen = () => {
  const navigation = useNavigation();
  const { wallet } = useContext(EmbeddedWalletContext);
  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey;
  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [summary, setSummary] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterPages, setChapterPages] = useState([]);
  const [chapterPrice, setChapterPrice] = useState('2.5'); // New state for chapter price
  const [isPremium, setIsPremium] = useState(false);
  const [mangaCollection, setMangaCollection] = useState([]);
  const [activeManga, setActiveManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [userId, setUserId] = useState(null);
  const [isArtist, setIsArtist] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [artistList, setArtistList] = useState([]);
  const [editingChapterIdx, setEditingChapterIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeText, setNoticeText] = useState('');
  const [noticeDate, setNoticeDate] = useState(null);
  const [showNoticeDatePicker, setShowNoticeDatePicker] = useState(false);
  const [tags, setTags] = useState([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const chapterInputRef = useRef(null);
  const scrollViewRef = useRef(null);

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
      Alert.alert('Error', `Failed to fetch manga: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadArtists = async () => {
    if (!isAdmin) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, isArtist')
        .eq('isArtist', true);
      if (error) throw new Error('Failed to fetch artists');

      setArtistList(data || []);
    } catch (err) {
      console.error('Artists fetch error:', err.message);
      Alert.alert('Error', `Failed to fetch artists: ${err.message}`);
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

  const uploadCoverImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'We need permission to access your photo library to select a cover image.'
        );
        return;
      }

      const response = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (response.canceled) return;
      if (response.errorCode) {
        Alert.alert('Error', `Image selection failed: ${response.errorMessage}`);
        return;
      }

      if (response.assets && response.assets[0]) {
        const compressedImage = await ImageManipulator.manipulateAsync(
          response.assets[0].uri,
          [{ resize: { width: 1920 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );

        const file = {
          uri: compressedImage.uri,
          name: `cover-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        setCoverImage(file);
        setCoverPreview(file.uri);
      }
    } catch (err) {
      console.error('Error uploading cover image:', err);
      Alert.alert('Error', 'Failed to upload cover image.');
    }
  };

  const uploadChapterPages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'We need permission to access your photo library to select chapter pages.'
        );
        return;
      }

      const response = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (response.canceled) return;
      if (response.errorCode) {
        Alert.alert('Error', `Image selection failed: ${response.errorMessage}`);
        return;
      }

      const compressed = await Promise.all(
        response.assets.map(async (asset) => {
          const compressedImage = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1920 } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          );
          return {
            file: {
              uri: compressedImage.uri,
              name: `page-${Date.now()}.jpg`,
              type: 'image/jpeg',
            },
            url: compressedImage.uri,
          };
        })
      );

      setChapterPages((prev) => [...prev, ...compressed]);
    } catch (err) {
      console.error('Error uploading chapter pages:', err);
      Alert.alert('Error', 'Failed to upload chapter pages.');
    }
  };

  const manageChapter = () => {
    if (!chapterTitle.trim() || chapterPages.length === 0) {
      Alert.alert('Error', 'Chapter title and at least one page are required.');
      return;
    }
    if (isPremium && (!chapterPrice || parseFloat(chapterPrice) <= 0)) {
      Alert.alert('Error', 'Please set a valid price for the premium chapter.');
      return;
    }

    const chapterData = {
      title: chapterTitle,
      pages: chapterPages,
      isPremium,
      price: isPremium ? parseFloat(chapterPrice) : null,
    };
    if (editingChapterIdx !== null) {
      setChapters((prev) =>
        prev.map((ch, idx) => (idx === editingChapterIdx ? chapterData : ch))
      );
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
    setIsPremium(chapter.isPremium || false);
    setChapterPrice(chapter.price ? chapter.price.toString() : '2.5');
    setEditingChapterIdx(idx);
    chapterInputRef.current?.focus();
    scrollViewRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const deleteChapter = (idx) => {
    setChapters((prev) => prev.filter((_, i) => i !== idx));
    if (editingChapterIdx === idx) setEditingChapterIdx(null);
  };

  const loadMangaForEdit = async (manga) => {
    setActiveManga(manga);
    setTitle(manga.title || '');
    setCoverPreview(manga.cover_image || '');
    setSummary(manga.summary || '');
    setTags(manga.tags ? manga.tags.map((tag) => ({ value: tag, label: tag })) : []);
    await fetchChapters(manga.id);
  };

  const fetchChapters = async (mangaId) => {
    try {
      const { data: chapterData, error } = await supabase
        .from('manga_chapters')
        .select('id, title, is_premium, price')
        .eq('manga_id', mangaId)
        .order('chapter_number', { ascending: true });
      if (error) throw new Error('Chapter fetch error');

      const chaptersWithPages = await Promise.all(
        chapterData.map(async (chapter) => {
          const { data: pages, error: pageError } = await supabase
            .from('manga_pages')
            .select('image_url')
            .eq('chapter_id', chapter.id)
            .order('page_number', { ascending: true });
          if (pageError) throw new Error('Page fetch error');
          return {
            ...chapter,
            pages: pages.map((p) => ({ url: p.image_url })),
            price: chapter.price,
          };
        })
      );
      setChapters(chaptersWithPages);
    } catch (err) {
      console.error('Error fetching chapters:', err.message);
      Alert.alert('Error', `Failed to fetch chapters: ${err.message}`);
    }
  };

  const submitManga = async () => {
    if (!title.trim() || (!coverImage && !coverPreview) || !summary.trim()) {
      Alert.alert('Error', 'All manga details are required.');
      return;
    }

    setLoading(true);
    try {
      let coverUrl = coverPreview;
      if (coverImage) {
        const path = `manga/${userId}/${Date.now()}-${coverImage.name}`;
        const { data, error } = await supabase.storage
          .from('covers')
          .upload(path, coverImage, { upsert: true });
        if (error) throw new Error('Cover upload failed');
        coverUrl = supabase.storage.from('covers').getPublicUrl(data.path).data.publicUrl;
      }

      const mangaPayload = {
        user_id: userId,
        title,
        cover_image: coverUrl,
        summary,
        author:
          (await supabase.from('users').select('name').eq('id', userId).single()).data?.name ||
          'Unknown',
        status: 'ongoing',
        tags: tags.map((tag) => tag.value),
        viewers_count: activeManga ? activeManga.viewers_count : 0,
      };

      let mangaId;
      if (activeManga) {
        const { error } = await supabase.from('manga').update(mangaPayload).eq('id', activeManga.id);
        if (error) throw new Error('Manga update failed');
        mangaId = activeManga.id;
      } else {
        const { data, error } = await supabase
          .from('manga')
          .insert([mangaPayload])
          .select('id')
          .single();
        if (error) throw new Error('Manga creation failed');
        mangaId = data.id;
      }

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
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
          const { error } = await supabase
            .from('manga_chapters')
            .update({
              title: chapter.title,
              is_premium: chapter.isPremium,
              price: chapter.isPremium ? chapter.price : null,
            })
            .eq('id', existing.id);
          if (error) throw new Error('Chapter update failed');
          chapterId = existing.id;
          await supabase.from('manga_pages').delete().eq('chapter_id', chapterId);
        } else {
          const { data, error } = await supabase
            .from('manga_chapters')
            .insert([
              {
                manga_id: mangaId,
                chapter_number: i + 1,
                title: chapter.title,
                is_premium: chapter.isPremium,
                price: chapter.isPremium ? chapter.price : null,
              },
            ])
            .select('id')
            .single();
          if (error) throw new Error('Chapter creation failed');
          chapterId = data.id;
        }

        for (let j = 0; j < chapter.pages.length; j++) {
          const page = chapter.pages[j];
          let pageUrl = page.url;
          if (page.file) {
            const pagePath = `${mangaId}/${chapterId}/${j + 1}-${Date.now()}.jpg`;
            const { data, error } = await supabase.storage
              .from('manga-pages')
              .upload(pagePath, page.file, { upsert: true });
            if (error) throw new Error('Page upload failed');
            pageUrl = supabase.storage.from('manga-pages').getPublicUrl(data.path).data.publicUrl;
          }
          const { error } = await supabase
            .from('manga_pages')
            .insert([{ chapter_id: chapterId, page_number: j + 1, image_url: pageUrl }]);
          if (error) throw new Error('Page save failed');
        }
      }

      const message = activeManga
        ? `A new chapter has been added to "${title}"!`
        : `A new manga "${title}" has been published!`;
      const { data: users, error: usersError } = await supabase.from('users').select('id');
      if (usersError) throw new Error(usersError.message);

      if (users.length > 0) {
        const notifications = users.map((user) => ({
          user_id: user.id,
          manga_id: mangaId,
          type: activeManga ? 'new_chapter' : 'new_manga',
          message,
          chapter: activeManga ? chapters.length : null,
        }));

        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) throw new Error(notifError.message);

        await schedulePushNotification(
          activeManga ? `New Chapter for ${title}` : `New Manga: ${title}`,
          message,
          { mangaId, type: activeManga ? 'new_chapter' : 'new_manga' }
        );
      }

      Alert.alert('Success', 'Manga saved successfully!');
      clearForm();
      loadManga();
    } catch (err) {
      console.error('Submission error:', err.message);
      Alert.alert('Error', `Failed to save manga: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendNotice = async () => {
    if (!activeManga) {
      Alert.alert('Error', 'Select a manga to announce.');
      return;
    }
    if (!noticeTitle.trim() || !noticeText.trim()) {
      Alert.alert('Error', 'Announcement title and message are required.');
      return;
    }

    setLoading(true);
    try {
      const { data: readers, error } = await supabase
        .from('manga')
        .select('user_id')
        .eq('id', activeManga.id);
      if (error) throw new Error('Failed to fetch readers');

      const noticePayload = {
        writer_id: userId,
        manga_id: activeManga.id,
        title: noticeTitle,
        message: noticeText,
        release_date: noticeDate ? noticeDate.toISOString() : null,
      };
      const { error: noticeError } = await supabase
        .from('writer_announcements')
        .insert([noticePayload]);
      if (noticeError) throw new Error('Announcement save failed');

      if (readers.length > 0) {
        const notifications = readers.map((reader) => ({
          user_id: reader.user_id,
          manga_id: activeManga.id,
          type: 'announcement',
          message: `${noticeTitle}: ${noticeText}`,
          manga_title: activeManga.title,
        }));
        const { error } = await supabase.from('notifications').insert(notifications);
        if (error) throw new Error('Notification send failed');

        await schedulePushNotification(
          noticeTitle,
          noticeText,
          { mangaId: activeManga.id, type: 'announcement' }
        );
      }

      Alert.alert('Success', 'Announcement sent!');
      setNoticeTitle('');
      setNoticeText('');
      setNoticeDate(null);
    } catch (err) {
      console.error('Announcement error:', err.message);
      Alert.alert('Error', `Failed to send announcement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setTitle('');
    setCoverImage(null);
    setCoverPreview('');
    setSummary('');
    clearChapterForm();
    setChapters([]);
    setActiveManga(null);
    setTags([]);
  };

  const clearChapterForm = () => {
    setChapterTitle('');
    setChapterPages([]);
    setIsPremium(false);
    setChapterPrice('2.5');
    setEditingChapterIdx(null);
  };

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const handleTagSelect = (tag) => {
    if (tags.find((t) => t.value === tag.value)) {
      setTags(tags.filter((t) => t.value !== tag.value));
    } else {
      setTags([...tags, tag]);
    }
  };

  const renderChapterItem = useCallback(
    ({ item, index }) => (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.chapterItem}>
        <Text style={styles.chapterTitleText}>
          {item.title} ({item.pages.length} pages) {item.isPremium && `[Premium: $${item.price}]`}
        </Text>
        <View style={styles.chapterActions}>
          <TouchableOpacity
            onPress={() => editChapter(index)}
            style={styles.actionButton}
            accessible
            accessibilityLabel="Edit chapter"
          >
            <Icon name="edit" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => deleteChapter(index)}
            style={styles.actionButton}
            accessible
            accessibilityLabel="Delete chapter"
          >
            <Icon name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    ),
    [editChapter, deleteChapter]
  );

  const renderMangaItem = useCallback(
    ({ item }) => (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.mangaCard}>
        <Image source={{ uri: item.cover_image }} style={styles.mangaImage} />
        <View style={styles.mangaInfo}>
          <Text style={styles.mangaTitle}>{item.title}</Text>
          <Text style={styles.mangaSummary}>{item.summary.slice(0, 50)}...</Text>
          <Text style={styles.mangaTags}>Tags: {item.tags?.join(', ') || 'None'}</Text>
          <Text style={styles.mangaViewers}>Viewers: {item.viewers_count || 0}</Text>
          <TouchableOpacity
            onPress={() => loadMangaForEdit(item)}
            style={styles.editMangaButton}
            accessible
            accessibilityLabel={`Edit manga ${item.title}`}
          >
            <Icon name="edit" size={16} color="#fff" />
            <Text style={styles.editMangaButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    ),
    [loadMangaForEdit]
  );

  const renderArtistItem = useCallback(
    ({ item }) => (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.artistItem}>
        <Icon name="user-shield" size={16} color="#fff" style={styles.artistIcon} />
        <Text style={styles.artistText}>
          {item.name} ({item.email}) - ID: {item.id}
        </Text>
      </Animated.View>
    ),
    []
  );

  const renderMainContent = () => {
    if (loading) {
      return [
        {
          key: 'loading',
          render: () => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F36316" />
            </View>
          ),
        },
      ];
    }

    if (!isWalletConnected) {
      return [
        {
          key: 'connectPrompt',
          render: () => (
            <Animated.View entering={FadeIn} style={styles.connectPrompt}>
              <Icon name="gem" size={48} color="#F36316" style={styles.connectIcon} />
              <Text style={styles.connectText}>
                Connect your wallet to access the Artist’s Studio.
              </Text>
              <ConnectButton />
            </Animated.View>
          ),
        },
      ];
    }

    if (!isArtist && !isAdmin) {
      return [
        {
          key: 'accessDenied',
          render: () => (
            <Animated.View entering={FadeIn} style={styles.accessDenied}>
              <Icon name="times" size={48} color="#ff4444" style={styles.deniedIcon} />
              <Text style={styles.accessDeniedText}>
                Access restricted to artists and admins.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Home')}
                style={styles.backButton}
                accessible
                accessibilityLabel="Return to home"
              >
                <Icon name="home" size={16} color="#fff" />
                <Text style={styles.backButtonText}>Return Home</Text>
              </TouchableOpacity>
            </Animated.View>
          ),
        },
      ];
    }

    return [
      {
        key: 'mangaForm',
        render: () => (
          <Animated.View entering={FadeIn} style={styles.formSection}>
            <Text style={styles.sectionTitle}>
              <Icon name="paint-brush" size={20} color="#fff" />{' '}
              {activeManga ? 'Edit Manga' : 'Create Manga'}
            </Text>
            <View style={styles.mangaForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter manga title"
                  placeholderTextColor="#888"
                  accessible
                  accessibilityLabel="Manga title input"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Icon name="image" size={16} color="#fff" /> Cover Image
                </Text>
                {coverPreview ? (
                  <Image source={{ uri: coverPreview }} style={styles.imagePreview} />
                ) : (
                  <Text style={styles.placeholderText}>No image selected</Text>
                )}
                <TouchableOpacity
                  onPress={uploadCoverImage}
                  style={styles.fileButton}
                  accessible
                  accessibilityLabel="Choose cover image"
                >
                  <Text style={styles.fileButtonText}>Choose Image</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Summary</Text>
                <TextInput
                  style={styles.textarea}
                  value={summary}
                  onChangeText={setSummary}
                  placeholder="Write a brief summary"
                  placeholderTextColor="#888"
                  multiline
                  numberOfLines={3}
                  accessible
                  accessibilityLabel="Manga summary input"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tags</Text>
                <TouchableOpacity
                  onPress={() => setShowTagModal(true)}
                  style={styles.tagButton}
                  accessible
                  accessibilityLabel="Select tags"
                >
                  <Text style={styles.tagButtonText}>
                    {tags.length > 0 ? tags.map((t) => t.label).join(', ') : 'Select tags...'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chapterSection}>
                <Text style={styles.chapterTitle}>
                  <Icon name="plus" size={16} color="#fff" /> Chapters
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Chapter Title</Text>
                  <TextInput
                    ref={chapterInputRef}
                    style={styles.input}
                    value={chapterTitle}
                    onChangeText={setChapterTitle}
                    placeholder="Enter chapter title"
                    placeholderTextColor="#888"
                    accessible
                    accessibilityLabel="Chapter title input"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pages</Text>
                  <TouchableOpacity
                    onPress={uploadChapterPages}
                    style={styles.fileButton}
                    accessible
                    accessibilityLabel="Choose chapter pages"
                  >
                    <Text style={styles.fileButtonText}>Choose Pages</Text>
                  </TouchableOpacity>
                  <FlatList
                    data={chapterPages}
                    keyExtractor={(item, index) => `page-${index}`}
                    renderItem={({ item }) => (
                      <Image source={{ uri: item.url }} style={styles.pagePreview} />
                    )}
                    horizontal
                    style={styles.imageGrid}
                    nestedScrollEnabled={false}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => setIsPremium(!isPremium)}
                  style={styles.checkboxContainer}
                  accessible
                  accessibilityLabel="Mark as premium chapter"
                >
                  <Icon
                    name={isPremium ? 'check-square' : 'square'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.checkboxLabel}>Premium Chapter</Text>
                </TouchableOpacity>
                {isPremium && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Chapter Price (USDC)</Text>
                    <TextInput
                      style={styles.input}
                      value={chapterPrice}
                      onChangeText={setChapterPrice}
                      placeholder="Enter price (e.g., 2.5)"
                      placeholderTextColor="#888"
                      keyboardType="numeric"
                      accessible
                      accessibilityLabel="Chapter price input"
                    />
                  </View>
                )}
                <TouchableOpacity
                  onPress={manageChapter}
                  style={[styles.addChapterButton, loading && styles.disabledButton]}
                  disabled={loading}
                  accessible
                  accessibilityLabel={editingChapterIdx !== null ? 'Update chapter' : 'Add chapter'}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="plus" size={16} color="#fff" />
                      <Text style={styles.addChapterButtonText}>
                        {editingChapterIdx !== null ? 'Update Chapter' : 'Add Chapter'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              {chapters.length > 0 && (
                <FlatList
                  data={chapters}
                  keyExtractor={(item, index) => `chapter-${index}`}
                  renderItem={renderChapterItem}
                  style={styles.chapterList}
                  nestedScrollEnabled={false}
                />
              )}
              <TouchableOpacity
                onPress={submitManga}
                style={[styles.submitButton, loading && styles.disabledButton]}
                disabled={loading}
                accessible
                accessibilityLabel={activeManga ? 'Update manga' : 'Publish manga'}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="upload" size={16} color="#fff" />
                    <Text style={styles.submitButtonText}>
                      {activeManga ? 'Update Manga' : 'Publish Manga'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {activeManga && (
              <View style={styles.announcementSection}>
                <Text style={styles.sectionTitle}>
                  <Icon name="bullhorn" size={20} color="#fff" /> Announce to Readers
                </Text>
                <View style={styles.announcementForm}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Announcement Title</Text>
                    <TextInput
                      style={styles.input}
                      value={noticeTitle}
                      onChangeText={setNoticeTitle}
                      placeholder="e.g., New Chapter Coming Soon!"
                      placeholderTextColor="#888"
                      accessible
                      accessibilityLabel="Announcement title input"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Message</Text>
                    <TextInput
                      style={styles.textarea}
                      value={noticeText}
                      onChangeText={setNoticeText}
                      placeholder="Write your announcement here"
                      placeholderTextColor="#888"
                      multiline
                      numberOfLines={3}
                      accessible
                      accessibilityLabel="Announcement message input"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Release Date (Optional)</Text>
                    <TouchableOpacity
                      onPress={() => setShowNoticeDatePicker(true)}
                      style={styles.dateButton}
                      accessible
                      accessibilityLabel="Select announcement release date"
                    >
                      <Text style={styles.dateButtonText}>
                        {noticeDate ? noticeDate.toLocaleString() : 'Select release date'}
                      </Text>
                    </TouchableOpacity>
                    {showNoticeDatePicker && (
                      <DateTimePicker
                        value={noticeDate || new Date()}
                        mode="datetime"
                        minimumDate={new Date()}
                        onChange={(event, date) => {
                          setShowNoticeDatePicker(Platform.OS === 'ios');
                          if (date) setNoticeDate(date);
                        }}
                      />
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={sendNotice}
                    style={[styles.announcementButton, loading && styles.disabledButton]}
                    disabled={loading}
                    accessible
                    accessibilityLabel="Send announcement"
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Icon name="bullhorn" size={16} color="#fff" />
                        <Text style={styles.announcementButtonText}>Send Announcement</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        ),
      },
      {
        key: 'mangaSection',
        render: () => (
          <Animated.View entering={FadeIn} style={styles.mangaSection}>
            <Text style={styles.sectionTitle}>
              <Icon name="book-open" size={20} color="#fff" /> Your Works
            </Text>
            {mangaCollection.length === 0 ? (
              <Text style={styles.noManga}>No manga yet. Start creating!</Text>
            ) : (
              <FlatList
                data={mangaCollection}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderMangaItem}
                contentContainerStyle={styles.mangaGrid}
                nestedScrollEnabled={false}
              />
            )}
          </Animated.View>
        ),
      },
      ...(isAdmin
        ? [
            {
              key: 'artistsSection',
              render: () => (
                <Animated.View entering={FadeIn} style={styles.artistsSection}>
                  <Text style={styles.sectionTitle}>
                    <Icon name="user-shield" size={20} color="#fff" /> Artists
                  </Text>
                  {artistList.length === 0 ? (
                    <Text style={styles.noArtists}>No artists found.</Text>
                  ) : (
                    <FlatList
                      data={artistList}
                      keyExtractor={(item) => item.id.toString()}
                      renderItem={renderArtistItem}
                      contentContainerStyle={styles.artistsList}
                      nestedScrollEnabled={false}
                    />
                  )}
                </Animated.View>
              ),
            },
          ]
        : []),
    ];
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {/* Navbar */}
            <Animated.View entering={FadeIn} style={styles.navbar}>
              <View style={styles.navContainer}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Home')}
                  style={styles.navLink}
                  accessible
                  accessibilityLabel="Navigate to home"
                >
                  <Icon name="home" size={20} color="#fff" />
                  <Text style={styles.navText}>Home</Text>
                </TouchableOpacity>
                <View style={styles.navRight}>
                  <ConnectButton />
                  <TouchableOpacity
                    onPress={toggleMenu}
                    style={styles.menuToggle}
                    accessible
                    accessibilityLabel="Toggle menu"
                  >
                    <Icon name={menuOpen ? 'times' : 'bars'} size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              {menuOpen && (
                <Animated.View entering={FadeIn} style={styles.navMenu}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Home')}
                    style={styles.navMenuItem}
                    accessible
                    accessibilityLabel="Navigate to home"
                  >
                    <Icon name="home" size={20} color="#fff" />
                    <Text style={styles.navMenuText}>Home</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </Animated.View>

            {/* Header */}
            <Animated.View entering={FadeIn} style={styles.header}>
              <Text style={styles.headerTitle}>
                <Icon name="paint-brush" size={24} color="#fff" /> Artist’s Studio
              </Text>
              <Text style={styles.headerSubtitle}>
                Craft and showcase your manga masterpieces.
              </Text>
            </Animated.View>

            {/* Main Content */}
            <FlatList
              data={renderMainContent()}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => item.render()}
              contentContainerStyle={[styles.main, { flexGrow: 1 }]}
              ref={scrollViewRef}
              initialNumToRender={5}
              windowSize={10}
              removeClippedSubviews={true}
              nestedScrollEnabled={true}
            />

            {/* Tag Selection Modal */}
            <Modal
              isVisible={showTagModal}
              onBackdropPress={() => setShowTagModal(false)}
              style={styles.modalContainer}
              animationIn="slideInUp"
              animationOut="slideOutDown"
              avoidKeyboard={true}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Tags</Text>
                <FlatList
                  data={TAG_OPTIONS}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleTagSelect(item)}
                      style={styles.tagOption}
                      accessible
                      accessibilityLabel={`Select tag ${item.label}`}
                    >
                      <Icon
                        name={tags.find((t) => t.value === item.value) ? 'check-square' : 'square'}
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.tagOptionText}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.tagList}
                  nestedScrollEnabled={false}
                />
                <TouchableOpacity
                  onPress={() => setShowTagModal(false)}
                  style={styles.modalCloseButton}
                  accessible
                  accessibilityLabel="Close tag selection modal"
                >
                  <Text style={styles.modalCloseButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </Modal>

            {/* Footer */}
            <Animated.View entering={FadeIn} style={styles.footer}>
              <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default MangaDashboardScreen;