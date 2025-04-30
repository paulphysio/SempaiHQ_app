import React, { useState, useEffect, useRef, useContext } from 'react';
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
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import DraggableFlatList from 'react-native-draggable-flatlist';
import * as ImagePicker from 'expo-image-picker'; // Updated import for Expo
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import ConnectButton from '../components/ConnectButton';
import { styles } from '../styles/NovelDashboardStyles';
import * as Notifications from 'expo-notifications'; // Added for push notifications

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

const NovelDashboardScreen = () => {
  const navigation = useNavigation();
  const { wallet } = useContext(EmbeddedWalletContext);
  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey;
  const [novelTitle, setNovelTitle] = useState('');
  const [novelImage, setNovelImage] = useState(null);
  const [novelImageUrl, setNovelImageUrl] = useState('');
  const [novelSummary, setNovelSummary] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterContent, setNewChapterContent] = useState('');
  const [newChapterIsAdvance, setNewChapterIsAdvance] = useState(false);
  const [newChapterReleaseDate, setNewChapterReleaseDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementReleaseDate, setAnnouncementReleaseDate] = useState(null);
  const [showAnnouncementDatePicker, setShowAnnouncementDatePicker] = useState(false);
  const [tags, setTags] = useState([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState(null);
  const [showNovelDeleteConfirm, setShowNovelDeleteConfirm] = useState(false);
  const [novelToDelete, setNovelToDelete] = useState(null);
  const chapterTitleRef = useRef(null);

  // Debug state changes for chapter title and content
  useEffect(() => {
    console.log('Chapter Title:', newChapterTitle);
    console.log('Chapter Content:', newChapterContent);
  }, [newChapterTitle, newChapterContent]);

  // Focus the chapter title input when editing a chapter
  useEffect(() => {
    if (editChapterIndex !== null && chapterTitleRef.current) {
      chapterTitleRef.current.focus();
    }
  }, [editChapterIndex]);

  const validateChapterData = () => {
    if (chapterTitles.length !== chapterContents.length) {
      console.error('Chapter titles and contents are out of sync:', {
        titlesLength: chapterTitles.length,
        contentsLength: chapterContents.length,
      });
      Alert.alert('Error', 'Chapter data is out of sync. Please reset the form.');
      return false;
    }
    return true;
  };

  const handleCreatorAccess = async () => {
    if (!isWalletConnected || !activePublicKey) return;

    setLoading(true);
    try {
      const walletAddress = activePublicKey.toString();
      const { data, error } = await supabase
        .from('users')
        .select('id, isWriter, isSuperuser')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) throw new Error(error.message || 'Failed to fetch user data');
      if (!data) throw new Error('No user found');

      if (!data.isWriter && !data.isSuperuser) {
        navigation.navigate('Error');
        return;
      }

      setCurrentUserId(data.id);
      setIsWriter(data.isWriter);
      setIsSuperuser(data.isSuperuser);
    } catch (err) {
      console.error('Error in creator access:', err.message);
      Alert.alert('Error', `Failed to verify access: ${err.message}`);
      navigation.navigate('Error');
    } finally {
      setLoading(false);
    }
  };

  const fetchNovels = async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      let query = supabase.from('novels').select('*, viewers_count, tags');
      if (!isSuperuser) query = query.eq('user_id', currentUserId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      console.log('Fetched novels:', data);
      setNovelsList(data || []);
    } catch (err) {
      console.error('Error fetching novels:', err.message);
      Alert.alert('Error', `Failed to fetch novels: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchWriters = async () => {
    if (!isSuperuser) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, isWriter')
        .eq('isWriter', true);

      if (error) throw new Error(error.message);
      setWriters(data || []);
    } catch (err) {
      console.error('Error fetching writers:', err.message);
      Alert.alert('Error', `Failed to fetch writers: ${err.message}`);
    } finally {
      setLoading(false);
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

  // Modified handleImageChange to request permissions
  const handleImageChange = async () => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'We need permission to access your photo library to select a cover image.'
        );
        return;
      }

      // Launch image picker
      const response = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      console.log('Image Picker Response:', response);
      if (response.canceled) {
        console.log('Image selection cancelled');
        return;
      }
      if (response.errorCode) {
        Alert.alert('Error', `Image selection failed: ${response.errorMessage}`);
        return;
      }
      if (response.assets && response.assets[0]) {
        const file = {
          uri: response.assets[0].uri,
          name: response.assets[0].fileName || `image-${Date.now()}.jpg`,
          type: response.assets[0].type || 'image/jpeg',
        };
        setNovelImage(file);
        setNovelImageUrl(file.uri);
        console.log('Image selected:', file);
      }
    } catch (err) {
      console.error('Error in handleImageChange:', err.message);
      Alert.alert('Error', `Failed to select image: ${err.message}`);
    }
  };

  const handleAddChapter = () => {
    if (!newChapterTitle.trim() || !newChapterContent.trim()) {
      Alert.alert('Error', 'Please provide both a chapter title and content.');
      return;
    }

    const index = editChapterIndex !== null ? editChapterIndex : chapterTitles.length;

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
          free_release_date: newChapterIsAdvance ? (newChapterReleaseDate ? newChapterReleaseDate.toISOString() : null) : null,
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
          free_release_date: newChapterIsAdvance ? (newChapterReleaseDate ? newChapterReleaseDate.toISOString() : null) : null,
        },
      ]);
    }

    setNewChapterTitle('');
    setNewChapterContent('');
    setNewChapterIsAdvance(false);
    setNewChapterReleaseDate(null);
  };

  const handleEditChapter = (index) => {
    console.log('handleEditChapter called with index:', index);
    if (index === undefined || index === null || index < 0 || index >= chapterTitles.length || index >= chapterContents.length) {
      console.error('Invalid chapter index:', index, {
        chapterTitlesLength: chapterTitles.length,
        chapterContentsLength: chapterContents.length,
      });
      Alert.alert('Error', 'Invalid chapter index.');
      setEditChapterIndex(null);
      return;
    }

    const title = chapterTitles[index] || '';
    const content = chapterContents[index] || '';
    const advanceInfo = advanceChapters.find((c) => c.index === index) || {
      is_advance: false,
      free_release_date: null,
    };

    console.log('Editing chapter:', { index, title, content, advanceInfo });
    if (!title || !content) {
      console.warn('Chapter data is empty:', { title, content });
    }

    setNewChapterTitle(title);
    setNewChapterContent(content);
    setNewChapterIsAdvance(advanceInfo.is_advance);
    setNewChapterReleaseDate(advanceInfo.free_release_date ? new Date(advanceInfo.free_release_date) : null);
    setEditChapterIndex(index);
  };

  const handleRemoveChapter = (index) => {
    if (index === undefined || index === null || index < 0 || index >= chapterTitles.length) {
      console.error('Invalid chapter index for deletion:', index);
      Alert.alert('Error', 'Invalid chapter index for deletion.');
      return;
    }
    setChapterToDelete(index);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteChapter = () => {
    const index = chapterToDelete;
    if (index === undefined || index === null || index < 0 || index >= chapterTitles.length) {
      console.error('Invalid chapter index for deletion confirmation:', index);
      Alert.alert('Error', 'Invalid chapter index for deletion.');
      setShowDeleteConfirm(false);
      setChapterToDelete(null);
      return;
    }

    setChapterTitles((prev) => prev.filter((_, i) => i !== index));
    setChapterContents((prev) => prev.filter((_, i) => i !== index));
    setAdvanceChapters((prev) =>
      prev
        .filter((c) => c.index !== index)
        .map((c) => ({
          ...c,
          index: c.index > index ? c.index - 1 : c.index,
        }))
    );
    if (editChapterIndex === index) setEditChapterIndex(null);
    setShowDeleteConfirm(false);
    setChapterToDelete(null);
  };

  const handleDragEnd = ({ data }) => {
    if (!validateChapterData()) {
      Alert.alert('Error', 'Chapter titles and contents are out of sync.');
      return;
    }

    console.log('handleDragEnd data:', data);
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

    console.log('After drag:', { newTitles, newContents, newAdvanceChapters });
    setChapterTitles(newTitles);
    setChapterContents(newContents);
    setAdvanceChapters(newAdvanceChapters);
  };

  const handleEditNovel = (novel) => {
    if (novel.user_id !== currentUserId && !isSuperuser) {
      Alert.alert('Error', 'You can only edit your own novels unless you are a superuser.');
      return;
    }
    const chapterTitles = Array.isArray(novel.chaptertitles) ? novel.chaptertitles : [];
    const chapterContents = Array.isArray(novel.chaptercontents) ? novel.chaptercontents : [];
    const advanceChapters = Array.isArray(novel.advance_chapters) ? novel.advance_chapters : [];
    console.log('Editing novel:', { chapterTitles, chapterContents, advanceChapters });
    setSelectedNovel(novel);
    setNovelTitle(novel.title || '');
    setNovelImage(null);
    setNovelImageUrl(novel.image || '');
    setNovelSummary(novel.summary || '');
    setChapterTitles(chapterTitles);
    setChapterContents(chapterContents);
    setAdvanceChapters(advanceChapters);
    setTags(novel.tags ? novel.tags.map((tag) => ({ value: tag, label: tag })) : []);
    setEditChapterIndex(null);
  };

  const handleDeleteNovel = (novel) => {
    if (novel.user_id !== currentUserId && !isSuperuser) {
      Alert.alert('Error', 'You can only delete your own novels unless you are a superuser.');
      return;
    }
    setNovelToDelete(novel);
    setShowNovelDeleteConfirm(true);
  };

  const confirmDeleteNovel = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('novels').delete().eq('id', novelToDelete.id);
      if (error) throw new Error(error.message);

      setNovelsList((prev) => prev.filter((novel) => novel.id !== novelToDelete.id));
      if (selectedNovel && selectedNovel.id === novelToDelete.id) resetForm();
      Alert.alert('Success', 'Novel deleted successfully!');
    } catch (err) {
      console.error('Error deleting novel:', err.message);
      Alert.alert('Error', `Failed to delete novel: ${err.message}`);
    } finally {
      setLoading(false);
      setShowNovelDeleteConfirm(false);
      setNovelToDelete(null);
    }
  };

  const handleNovelSubmit = async () => {
    if (!novelTitle.trim() || (!novelImage && !selectedNovel?.image) || !novelSummary.trim()) {
      Alert.alert('Error', 'Please fill in all novel details.');
      return;
    }
    if (!validateChapterData()) {
      Alert.alert('Error', 'Chapter titles and contents are out of sync.');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = selectedNovel ? selectedNovel.image : '';
      if (novelImage) {
        const fileName = `${currentUserId}/${Date.now()}-${novelImage.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('covers')
          .upload(fileName, {
            uri: novelImage.uri,
            name: novelImage.name,
            type: novelImage.type,
          }, { upsert: true });
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

      const { data: users, error: usersError } = await supabase.from('users').select('id');
      if (usersError) throw new Error(usersError.message);

      if (users.length > 0) {
        const notifications = users.map((user) => ({
          user_id: user.id,
          novel_id: novelId,
          type: selectedNovel ? 'new_chapter' : 'new_novel',
          message,
          chapter: selectedNovel ? chapterNumber : null,
        }));

        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) throw new Error(notifError.message);

        // Schedule push notification for novel update
        await schedulePushNotification(
          selectedNovel ? `New Chapter for ${novelTitle}` : `New Novel: ${novelTitle}`,
          message,
          { novelId, type: selectedNovel ? 'new_chapter' : 'new_novel' }
        );
      }

      Alert.alert('Success', 'Novel submitted successfully! Users notified.');
      resetForm();
      fetchNovels();
    } catch (err) {
      console.error('Error submitting novel:', err.message);
      Alert.alert('Error', `Failed to submit novel: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnouncementSubmit = async () => {
    if (!selectedNovel) {
      Alert.alert('Error', 'Please select a novel to announce.');
      return;
    }
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      Alert.alert('Error', 'Please provide both an announcement title and message.');
      return;
    }

    setLoading(true);
    try {
      const { data: readers, error: readersError } = await supabase
        .from('novel_interactions')
        .select('user_id')
        .eq('novel_id', selectedNovel.id);

      if (readersError) throw new Error(readersError.message);

      const announcementData = {
        writer_id: currentUserId,
        novel_id: selectedNovel.id,
        title: announcementTitle,
        message: announcementMessage,
        release_date: announcementReleaseDate ? announcementReleaseDate.toISOString() : null,
      };

      const { error: announcementError } = await supabase
        .from('writer_announcements')
        .insert([announcementData]);

      if (announcementError) throw new Error(announcementError.message);

      if (readers.length > 0) {
        const notifications = readers.map((reader) => ({
          user_id: reader.user_id,
          novel_id: selectedNovel.id,
          type: 'announcement',
          message: `${announcementTitle}: ${announcementMessage}`,
          novel_title: selectedNovel.title,
        }));

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (notifError) throw new Error(notifError.message);

        // Schedule push notification for announcement
        await schedulePushNotification(
          announcementTitle,
          announcementMessage,
          { novelId: selectedNovel.id, type: 'announcement' }
        );
      }

      Alert.alert('Success', 'Announcement sent successfully to readers!');
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      setAnnouncementReleaseDate(null);
    } catch (err) {
      console.error('Error sending announcement:', err.message);
      Alert.alert('Error', `Failed to send announcement: ${err.message}`);
    } finally {
      setLoading(false);
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
    setNewChapterReleaseDate(null);
    setChapterTitles([]);
    setChapterContents([]);
    setAdvanceChapters([]);
    setSelectedNovel(null);
    setEditChapterIndex(null);
    setTags([]);
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setAnnouncementReleaseDate(null);
  };

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const handleTagSelect = (tag) => {
    if (tags.find((t) => t.value === tag.value)) {
      setTags(tags.filter((t) => t.value !== tag.value));
    } else {
      setTags([...tags, tag]);
    }
  };

  const renderChapterItem = ({ item, drag }) => {
    console.log('renderChapterItem item:', item);
    if (item.id === undefined || item.id === null) {
      console.error('Invalid item id in renderChapterItem:', item);
      return null;
    }
    const advanceInfo = advanceChapters.find((c) => c.index === item.id) || { is_advance: false };
    return (
      <TouchableOpacity
        style={[styles.chapterItem, styles.darkChapterItem]}
        onLongPress={drag}
        activeOpacity={0.7}
        accessible
        accessibilityLabel={`Chapter ${item.title}`}
        accessibilityRole="button"
      >
        <View style={styles.chapterText}>
          <Text style={[styles.chapterTitleText, styles.darkText]}>
            {item.title}
          </Text>
          <Text style={[styles.chapterPreview, styles.darkText]}>
            {item.content.slice(0, 50)}...
          </Text>
          {advanceInfo.is_advance && (
            <Text style={[styles.advanceInfo, styles.darkText]}>
              Advance (Free on: {advanceInfo.free_release_date || 'TBD'})
            </Text>
          )}
        </View>
        <View style={styles.chapterActions}>
          <TouchableOpacity
            onPress={() => {
              console.log('Edit button pressed for id:', item.id);
              handleEditChapter(item.id);
            }}
            style={styles.actionButton}
            activeOpacity={0.7}
            accessible
            accessibilityLabel="Edit chapter"
            accessibilityRole="button"
          >
            <Icon name="edit" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleRemoveChapter(item.id)}
            style={styles.actionButton}
            activeOpacity={0.7}
            accessible
            accessibilityLabel="Delete chapter"
            accessibilityRole="button"
          >
            <Icon name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderNovelItem = ({ item }) => (
    <View style={[styles.novelCard, styles.darkNovelCard]}>
      <Image source={{ uri: item.image }} style={styles.novelImage} />
      <View style={styles.novelInfo}>
        <Text style={[styles.novelTitle, styles.darkText]}>
          {item.title}
        </Text>
        <Text style={[styles.novelSummary, styles.darkText]}>
          {item.summary.slice(0, 50)}...
        </Text>
        <Text style={[styles.novelTags, styles.darkText]}>
          Tags: {item.tags?.join(', ') || 'None'}
        </Text>
        <Text style={[styles.novelViewers, styles.darkText]}>
          Viewers: {item.viewers_count || 0}
        </Text>
        {(item.user_id === currentUserId || isSuperuser) && (
          <View style={styles.novelActions}>
            <TouchableOpacity
              onPress={() => handleEditNovel(item)}
              style={styles.editNovelButton}
              activeOpacity={0.7}
              accessible
              accessibilityLabel={`Edit novel ${item.title}`}
              accessibilityRole="button"
            >
              <Icon name="edit" size={16} color="#fff" />
              <Text style={styles.editNovelButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteNovel(item)}
              style={styles.deleteButton}
              activeOpacity={0.7}
              accessible
              accessibilityLabel={`Delete novel ${item.title}`}
              accessibilityRole="button"
            >
              <Icon name="trash" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderWriterItem = ({ item }) => (
    <View style={[styles.writerItem, styles.darkWriterItem]}>
      <Text style={[styles.writerText, styles.darkText]}>
        {item.name} ({item.email})
      </Text>
      <Text style={[styles.writerId, styles.darkText]}>
        ID: {item.id}
      </Text>
    </View>
  );

  const renderMainContent = () => {
    if (!isWalletConnected) {
      return [
        {
          key: 'connectPrompt',
          render: () => (
            <View style={styles.connectPrompt}>
              <Icon name="gem" size={48} color="#E67E22" style={styles.connectIcon} />
              <Text style={[styles.connectText, styles.darkText]}>
                Connect your wallet to access the Writer’s Vault.
              </Text>
              <ConnectButton />
            </View>
          ),
        },
      ];
    }

    if (!isWriter && !isSuperuser) {
      return [
        {
          key: 'accessDenied',
          render: () => (
            <View style={styles.accessDenied}>
              <Icon name="times" size={48} color="#ff4444" style={styles.deniedIcon} />
              <Text style={[styles.accessDeniedText, styles.darkText]}>
                Access Denied. Only writers and superusers may enter.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Home')}
                style={styles.backButton}
                activeOpacity={0.7}
                accessible
                accessibilityLabel="Return to home"
                accessibilityRole="button"
              >
                <Icon name="home" size={16} color="#fff" />
                <Text style={styles.backButtonText}>Return Home</Text>
              </TouchableOpacity>
            </View>
          ),
        },
      ];
    }

    const chapterData = chapterTitles
      .map((title, index) => ({
        id: index,
        title,
        content: chapterContents[index],
      }))
      .filter((item) => item.title && item.content);

    console.log('chapterData:', chapterData);

    return [
      {
        key: 'novelForm',
        render: () => (
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, styles.darkText]}>
              <Icon name="book-open" size={20} color="#fff" />{' '}
              {selectedNovel ? 'Edit Manuscript' : 'New Manuscript'}
            </Text>
            <View style={styles.novelForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, styles.darkText]}>Title</Text>
                <TextInput
                  style={[styles.input, styles.darkInput]}
                  value={novelTitle}
                  onChangeText={setNovelTitle}
                  placeholder="Enter novel title"
                  placeholderTextColor="#888"
                  accessible
                  accessibilityLabel="Novel title input"
                  accessibilityRole="text"
                  accessibilityHint="Enter the title of your novel"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, styles.darkText]}>
                  <Icon name="image" size={16} color="#fff" /> Cover Image
                </Text>
                {novelImageUrl ? (
                  <Image source={{ uri: novelImageUrl }} style={styles.imagePreview} />
                ) : (
                  <Text style={[styles.placeholderText, styles.darkText]}>
                    No image selected
                  </Text>
                )}
                <TouchableOpacity
                  onPress={handleImageChange}
                  style={styles.fileButton}
                  activeOpacity={0.7}
                  accessible
                  accessibilityLabel="Choose cover image"
                  accessibilityRole="button"
                >
                  <Text style={styles.fileButtonText}>Choose Image</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, styles.darkText]}>Summary</Text>
                <TextInput
                  style={[styles.textarea, styles.darkInput]}
                  value={novelSummary}
                  onChangeText={setNovelSummary}
                  placeholder="Write a brief summary"
                  placeholderTextColor="#888"
                  multiline
                  numberOfLines={3}
                  accessible
                  accessibilityLabel="Novel summary input"
                  accessibilityRole="text"
                  accessibilityHint="Enter a brief summary of your novel"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, styles.darkText]}>Tags</Text>
                <TouchableOpacity
                  onPress={() => setShowTagModal(true)}
                  style={styles.tagButton}
                  activeOpacity={0.7}
                  accessible
                  accessibilityLabel="Select tags"
                  accessibilityRole="button"
                >
                  <Text style={[styles.tagButtonText, styles.darkText]}>
                    {tags.length > 0 ? tags.map((t) => t.label).join(', ') : 'Select tags...'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chapterSection}>
                <Text style={[styles.chapterTitle, styles.darkText]}>
                  <Icon name="plus" size={16} color="#fff" /> Chapters
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, styles.darkText]}>Chapter Title</Text>
                  <TextInput
                    ref={chapterTitleRef}
                    style={[styles.input, styles.darkInput]}
                    value={newChapterTitle}
                    onChangeText={setNewChapterTitle}
                    placeholder="Enter chapter title"
                    placeholderTextColor="#888"
                    accessible
                    accessibilityLabel="Chapter title input"
                    accessibilityRole="text"
                    accessibilityHint="Enter the title of the chapter"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, styles.darkText]}>Chapter Content</Text>
                  <TextInput
                    style={[styles.textarea, styles.darkInput]}
                    value={newChapterContent}
                    onChangeText={setNewChapterContent}
                    placeholder="Write chapter content"
                    placeholderTextColor="#888"
                    multiline
                    numberOfLines={4}
                    accessible
                    accessibilityLabel="Chapter content input"
                    accessibilityRole="text"
                    accessibilityHint="Enter the content of the chapter"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <TouchableOpacity
                    onPress={() => setNewChapterIsAdvance(!newChapterIsAdvance)}
                    style={styles.checkboxContainer}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel="Mark as advance chapter"
                    accessibilityRole="checkbox"
                  >
                    <Icon
                      name={newChapterIsAdvance ? 'check-square' : 'square'}
                      size={20}
                      color="#fff"
                    />
                    <Text style={[styles.checkboxLabel, styles.darkText]}>
                      Mark as Advance Chapter
                    </Text>
                  </TouchableOpacity>
                  {newChapterIsAdvance && (
                    <View>
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(true)}
                        style={styles.dateButton}
                        activeOpacity={0.7}
                        accessible
                        accessibilityLabel="Select chapter release date"
                        accessibilityRole="button"
                      >
                        <Text style={[styles.dateButtonText, styles.darkText]}>
                          {newChapterReleaseDate
                            ? newChapterReleaseDate.toLocaleString()
                            : 'Select release date'}
                        </Text>
                      </TouchableOpacity>
                      {showDatePicker && (
                        <DateTimePicker
                          value={newChapterReleaseDate || new Date()}
                          mode="datetime"
                          minimumDate={new Date()}
                          onChange={(event, date) => {
                            setShowDatePicker(Platform.OS === 'ios');
                            if (date) setNewChapterReleaseDate(date);
                          }}
                        />
                      )}
                    </View>
                  )}
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity
                    onPress={handleAddChapter}
                    style={[styles.addChapterButton, loading && styles.disabledButton]}
                    disabled={loading}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel={editChapterIndex !== null ? 'Update chapter' : 'Add chapter'}
                    accessibilityRole="button"
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Icon name="plus" size={16} color="#fff" />
                        <Text style={styles.addChapterButtonText}>
                          {editChapterIndex !== null ? 'Update Chapter' : 'Add Chapter'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={resetForm}
                    style={styles.resetButton}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel="Reset form"
                    accessibilityRole="button"
                  >
                    <Icon name="undo" size={16} color="#fff" />
                    <Text style={styles.resetButtonText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {chapterData.length > 0 && validateChapterData() && (
                <DraggableFlatList
                  data={chapterData}
                  renderItem={renderChapterItem}
                  keyExtractor={(item) => `chapter-${item.id}`}
                  onDragEnd={handleDragEnd}
                  containerStyle={styles.chapterList}
                />
              )}
              <TouchableOpacity
                onPress={handleNovelSubmit}
                style={[styles.submitButton, loading && styles.disabledButton]}
                disabled={loading}
                activeOpacity={0.7}
                accessible
                accessibilityLabel={selectedNovel ? 'Update novel' : 'Publish novel'}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="upload" size={16} color="#fff" />
                    <Text style={styles.submitButtonText}>{selectedNovel ? 'Update Novel' : 'Publish Novel'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {selectedNovel && (
              <View style={styles.announcementSection}>
                <Text style={[styles.sectionTitle, styles.darkText]}>
                  <Icon name="bullhorn" size={20} color="#fff" /> Announce to Readers
                </Text>
                <View style={styles.announcementForm}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, styles.darkText]}>
                      Announcement Title
                    </Text>
                    <TextInput
                      style={[styles.input, styles.darkInput]}
                      value={announcementTitle}
                      onChangeText={setAnnouncementTitle}
                      placeholder="e.g., New Chapter Coming Soon!"
                      placeholderTextColor="#888"
                      accessible
                      accessibilityLabel="Announcement title input"
                      accessibilityRole="text"
                      accessibilityHint="Enter the title of your announcement"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, styles.darkText]}>Message</Text>
                    <TextInput
                      style={[styles.textarea, styles.darkInput]}
                      value={announcementMessage}
                      onChangeText={setAnnouncementMessage}
                      placeholder="Write your announcement here"
                      placeholderTextColor="#888"
                      multiline
                      numberOfLines={3}
                      accessible
                      accessibilityLabel="Announcement message input"
                      accessibilityRole="text"
                      accessibilityHint="Enter the message for your announcement"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, styles.darkText]}>
                      Release Date (Optional)
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowAnnouncementDatePicker(true)}
                      style={styles.dateButton}
                      activeOpacity={0.7}
                      accessible
                      accessibilityLabel="Select announcement release date"
                      accessibilityRole="button"
                    >
                      <Text style={[styles.dateButtonText, styles.darkText]}>
                        {announcementReleaseDate
                          ? announcementReleaseDate.toLocaleString()
                          : 'Select release date'}
                      </Text>
                    </TouchableOpacity>
                    {showAnnouncementDatePicker && (
                      <DateTimePicker
                        value={announcementReleaseDate || new Date()}
                        mode="datetime"
                        minimumDate={new Date()}
                        onChange={(event, date) => {
                          setShowAnnouncementDatePicker(Platform.OS === 'ios');
                          if (date) setAnnouncementReleaseDate(date);
                        }}
                      />
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={handleAnnouncementSubmit}
                    style={[styles.announcementButton, loading && styles.disabledButton]}
                    disabled={loading}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel="Send announcement"
                    accessibilityRole="button"
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
          </View>
        ),
      },
      {
        key: 'novelsSection',
        render: () => (
          <View style={styles.novelsSection}>
            <Text style={[styles.sectionTitle, styles.darkText]}>
              <Icon name="book-open" size={20} color="#fff" /> Your Manuscripts
            </Text>
            {novelsList.length === 0 ? (
              <Text style={[styles.noNovels, styles.darkText]}>
                No manuscripts yet. Start creating!
              </Text>
            ) : (
              <FlatList
                data={novelsList}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderNovelItem}
                contentContainerStyle={styles.novelsGrid}
                initialNumToRender={10}
                windowSize={21}
              />
            )}
          </View>
        ),
      },
      ...(isSuperuser
        ? [
            {
              key: 'writersSection',
              render: () => (
                <View style={styles.writersSection}>
                  <Text style={[styles.sectionTitle, styles.darkText]}>
                    <Icon name="user-shield" size={20} color="#fff" /> Writers
                  </Text>
                  {writers.length === 0 ? (
                    <Text style={[styles.noWriters, styles.darkText]}>
                      No writers found.
                    </Text>
                  ) : (
                    <FlatList
                      data={writers}
                      keyExtractor={(item) => item.id.toString()}
                      renderItem={renderWriterItem}
                      contentContainerStyle={styles.writersList}
                      initialNumToRender={10}
                      windowSize={21}
                    />
                  )}
                </View>
              ),
            },
          ]
        : []),
    ];
  };

  return (
    <SafeAreaView style={[styles.container, styles.darkContainer]}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {/* Navbar */}
            <View style={[styles.navbar, styles.darkNavbar]}>
              <View style={styles.navContainer}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Home')}
                  style={styles.navLink}
                  activeOpacity={0.7}
                  accessible
                  accessibilityLabel="Navigate to home"
                  accessibilityRole="button"
                >
                  <Icon name="home" size={20} color="#fff" />
                  <Text style={[styles.navText, styles.darkText]}>Home</Text>
                </TouchableOpacity>
                <View style={styles.navRight}>
                  <ConnectButton />
                  <TouchableOpacity
                    onPress={toggleMenu}
                    style={styles.menuToggle}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel="Toggle menu"
                    accessibilityRole="button"
                  >
                    <Icon name={menuOpen ? 'times' : 'bars'} size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              {menuOpen && (
                <View style={[styles.navMenu, styles.darkNavMenu]}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Home')}
                    style={styles.navMenuItem}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel="Navigate to home"
                    accessibilityRole="button"
                  >
                    <Icon name="home" size={20} color="#fff" />
                    <Text style={[styles.navMenuText, styles.darkText]}>Home</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, styles.darkText]}>
                <Icon name="user-shield" size={24} color="#fff" /> Writer’s Vault
              </Text>
              <Text style={[styles.headerSubtitle, styles.darkText]}>
                Craft and curate your literary masterpieces.
              </Text>
            </View>

            {/* Main Content */}
            <FlatList
              data={renderMainContent()}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => item.render()}
              contentContainerStyle={styles.main}
            />

            {/* Tag Selection Modal */}
            <Modal
              isVisible={showTagModal}
              onBackdropPress={() => setShowTagModal(false)}
              style={styles.modalContainer}
              animationIn="slideInUp"
              animationOut="slideOutDown"
            >
              <View style={[styles.modalContainer, styles.darkModal]}>
                <Text style={[styles.modalTitle, styles.darkText]}>Select Tags</Text>
                <FlatList
                  data={TAG_OPTIONS}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleTagSelect(item)}
                      style={styles.tagOption}
                      activeOpacity={0.7}
                      accessible
                      accessibilityLabel={`Select tag ${item.label}`}
                      accessibilityRole="checkbox"
                    >
                      <Icon
                        name={tags.find((t) => t.value === item.value) ? 'check-square' : 'square'}
                        size={20}
                        color="#fff"
                      />
                      <Text style={[styles.tagOptionText, styles.darkText]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.tagList}
                />
                <TouchableOpacity
                  onPress={() => setShowTagModal(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                  accessible
                  accessibilityLabel="Close tag selection modal"
                  accessibilityRole="button"
                >
                  <Text style={styles.modalCloseButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </Modal>

            {/* Delete Chapter Confirmation */}
            <Modal
              isVisible={showDeleteConfirm}
              onBackdropPress={() => setShowDeleteConfirm(false)}
              style={styles.modalContainer}
              animationIn="slideInUp"
              animationOut="slideOutDown"
            >
              <View style={[styles.modalContainer, styles.darkModal]}>
                <Text style={[styles.modalTitle, styles.darkText]}>Confirm Deletion</Text>
                <Text style={[styles.modalText, styles.darkText]}>
                  Are you sure you want to delete{' '}
                  <Text style={{ fontWeight: 'bold' }}>{chapterTitles[chapterToDelete]}</Text>? This
                  action cannot be undone.
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    onPress={confirmDeleteChapter}
                    style={styles.confirmButton}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel="Confirm delete chapter"
                    accessibilityRole="button"
                  >
                    <Text style={styles.confirmButtonText}>Yes, Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowDeleteConfirm(false)}
                    style={styles.cancelButton}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel="Cancel delete chapter"
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Delete Novel Confirmation */}
            <Modal
              isVisible={showNovelDeleteConfirm}
              onBackdropPress={() => setShowNovelDeleteConfirm(false)}
              style={styles.modalContainer}
              animationIn="slideInUp"
              animationOut="slideOutDown"
            >
              <View style={[styles.modalContainer, styles.darkModal]}>
                <Text style={[styles.modalTitle, styles.darkText]}>Confirm Deletion</Text>
                <Text style={[styles.modalText, styles.darkText]}>
                  Are you sure you want to delete{' '}
                  <Text style={{ fontWeight: 'bold' }}>{novelToDelete?.title}</Text>? This action
                  cannot be undone.
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    onPress={confirmDeleteNovel}
                    style={styles.confirmButton}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel="Confirm delete novel"
                    accessibilityRole="button"
                  >
                    <Text style={styles.confirmButtonText}>Yes, Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowNovelDeleteConfirm(false)}
                    style={styles.cancelButton}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel="Cancel delete novel"
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Footer */}
            <View style={[styles.footer, styles.darkFooter]}>
              <Text style={[styles.footerText, styles.darkText]}>
                © 2025 Sempai HQ. All rights reserved.
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default NovelDashboardScreen;