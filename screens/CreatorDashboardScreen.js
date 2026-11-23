import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, StatusBar, Platform, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, StyleSheet, Dimensions, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
} from 'react-native-draggable-flatlist';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import ConnectButton from '../components/ConnectButton';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';

const { width, height } = Dimensions.get('window');

// Kaito Adventure Design System - Japanese Dark-Orange
const KA_COLORS_BASE = {
  bgPrimary: '#0c0c0c',
  bgCard: '#141210',
  bgElevated: '#1a1714',
  orangePrimary: '#cc5500',
  orangeBright: '#FF8A3D',
  orangeSoft: '#e67e22',
  orangeDim: '#8b4513',
  gold: '#c9a84c',
  goldBright: '#FFC857',
  ivory: '#f5e6d3',
  ivoryDim: '#c4b5a0',
  border: '#2d2418',
  textPrimary: '#f5e6d3',
  textSecondary: '#a09080',
  textMuted: '#6b5d4f',
  success: '#4a7c59',
  error: '#c41e3a',
  warning: '#c9a84c',
};
const kaColors = (isDark, c) => isDark ? KA_COLORS_BASE : {
  ...KA_COLORS_BASE,
  bgPrimary: c.bg, bgCard: c.bgCard, bgElevated: c.bgElevated,
  orangePrimary: c.accent, orangeBright: c.accent, orangeSoft: c.accentDeep, orangeDim: c.accentDeep,
  gold: c.gold, goldBright: c.gold,
  ivory: c.textPrimary, ivoryDim: c.textSecondary,
  border: c.border, textPrimary: c.textPrimary, textSecondary: c.textSecondary, textMuted: c.textMuted,
  success: '#16a34a', error: c.danger, warning: c.gold,
};


const CreatorDashboardScreen = () => {
  const { isDark, colors } = useTheme();
  // After useTheme(): it used to read isDark/colors before they existed and crash.
  const KA_COLORS = useMemo(() => kaColors(isDark, colors), [isDark, colors]);
  const styles = useMemo(() => getCreatorDashStyles(colors), [isDark]);
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey;

  // Content type selector: 'novel' or 'manga'
  const [contentType, setContentType] = useState('novel');
  
  // Common state
  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Novel-specific state
  const [chapters, setChapters] = useState([]);
  const [chapterTitles, setChapterTitles] = useState({});
  const [chapterContents, setChapterContents] = useState({});
  const [advanceChapters, setAdvanceChapters] = useState([]);

  // Manga-specific state
  const [mangaChapters, setMangaChapters] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    if (activePublicKey) {
      loadContent();
    }
  }, [activePublicKey, contentType]);

  const loadContent = async () => {
    try {
      setLoading(true);
      setError(null);

      if (contentType === 'novel') {
        const { data, error } = await supabase
          .from('novels')
          .select('*')
          .eq('user_id', activePublicKey?.toString())
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setTitle(data.title || '');
          setCoverImage(data.cover_image);
          setDescription(data.description || '');
          setChapters(data.chaptertitles ? Object.keys(data.chaptertitles) : []);
          setChapterTitles(data.chaptertitles || {});
          setChapterContents(data.chaptercontents || {});
          setAdvanceChapters(data.advance_chapters || []);
        }
      } else {
        const { data, error } = await supabase
          .from('manga')
          .select('*')
          .eq('user_id', activePublicKey?.toString())
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setTitle(data.title || '');
          setCoverImage(data.cover_image);
          setDescription(data.description || '');
          setMangaChapters(data.chapters || []);
          setSelectedTags(data.tags || []);
        }
      }
    } catch (error) {
      console.error('[CreatorDashboard] Error loading content:', error);
      setError('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled) {
        setCoverImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[CreatorDashboard] Error picking image:', error);
      toast.error('Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userId = activePublicKey?.toString();

      if (contentType === 'novel') {
        const { error } = await supabase
          .from('novels')
          .upsert({
            user_id: userId,
            title: title.trim(),
            cover_image: coverImage,
            description: description.trim(),
            chaptertitles: chapterTitles,
            chaptercontents: chapterContents,
            advance_chapters: advanceChapters,
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('manga')
          .upsert({
            user_id: userId,
            title: title.trim(),
            cover_image: coverImage,
            description: description.trim(),
            chapters: mangaChapters,
            tags: selectedTags,
          });

        if (error) throw error;
      }

      setSuccessMessage('Content saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('[CreatorDashboard] Error saving content:', error);
      setError('Failed to save content');
    } finally {
      setLoading(false);
    }
  };

  const renderNovelContent = () => (
    <View style={styles.contentSection}>
      <Text style={styles.sectionTitle}>Chapters</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {/* TODO: Add chapter modal */}}
      >
        <FontAwesome5 name="plus" size={16} color={KA_COLORS.ivory} />
        <Text style={styles.addButtonText}>Add Chapter</Text>
      </TouchableOpacity>
      
      {chapters.map((chapter, index) => (
        <View key={chapter} style={styles.chapterItem}>
          <Text style={styles.chapterNumber}>Chapter {index + 1}</Text>
          <Text style={styles.chapterTitle}>{chapterTitles[chapter] || 'Untitled'}</Text>
        </View>
      ))}
    </View>
  );

  const renderMangaContent = () => (
    <View style={styles.contentSection}>
      <Text style={styles.sectionTitle}>Manga Chapters</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {/* TODO: Add manga chapter modal */}}
      >
        <FontAwesome5 name="plus" size={16} color={KA_COLORS.ivory} />
        <Text style={styles.addButtonText}>Add Chapter</Text>
      </TouchableOpacity>
      
      {mangaChapters.map((chapter, index) => (
        <View key={index} style={styles.chapterItem}>
          <Text style={styles.chapterNumber}>Chapter {index + 1}</Text>
          <Text style={styles.chapterTitle}>{chapter.title || 'Untitled'}</Text>
        </View>
      ))}
    </View>
  );

  if (!isWalletConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.message}>Please connect your wallet to access the Creator Dashboard</Text>
          <ConnectButton />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={KA_COLORS.bgPrimary} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <FontAwesome5 name="arrow-left" size={24} color={KA_COLORS.ivory} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Creator Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Content Type Selector */}
        <View style={styles.contentTypeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, contentType === 'novel' && styles.activeTypeButton]}
            onPress={() => setContentType('novel')}
          >
            <FontAwesome5 name="book" size={20} color={contentType === 'novel' ? KA_COLORS.ivory : KA_COLORS.textSecondary} />
            <Text style={[styles.typeButtonText, contentType === 'novel' && styles.activeTypeButtonText]}>Novel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, contentType === 'manga' && styles.activeTypeButton]}
            onPress={() => setContentType('manga')}
          >
            <FontAwesome5 name="image" size={20} color={contentType === 'manga' ? KA_COLORS.ivory : KA_COLORS.textSecondary} />
            <Text style={[styles.typeButtonText, contentType === 'manga' && styles.activeTypeButtonText]}>Manga</Text>
          </TouchableOpacity>
        </View>

        {/* Cover Image */}
        <TouchableOpacity style={styles.imageUpload} onPress={handleImagePick}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.coverImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <FontAwesome5 name="image" size={48} color={KA_COLORS.textSecondary} />
              <Text style={styles.imagePlaceholderText}>Tap to upload cover</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Title Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter title..."
            placeholderTextColor={KA_COLORS.textMuted}
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description..."
            placeholderTextColor={KA_COLORS.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Content-specific sections */}
        {contentType === 'novel' ? renderNovelContent() : renderMangaContent()}

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={KA_COLORS.ivory} />
          ) : (
            <>
              <FontAwesome5 name="save" size={16} color={KA_COLORS.ivory} />
              <Text style={styles.saveButtonText}>Save Content</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Messages */}
        {error && (
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-circle" size={16} color={KA_COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {successMessage && (
          <View style={styles.successContainer}>
            <FontAwesome5 name="check-circle" size={16} color={KA_COLORS.success} />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export const getCreatorDashStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    color: c.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: c.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: c.textPrimary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentTypeSelector: {
    flexDirection: 'row',
    backgroundColor: c.bgCard,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  activeTypeButton: {
    backgroundColor: c.accent,
  },
  typeButtonText: {
    color: c.textSecondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  activeTypeButtonText: {
    color: c.textPrimary,
  },
  imageUpload: {
    width: '100%',
    height: 300,
    backgroundColor: c.bgCard,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: c.border,
    borderStyle: 'dashed',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: c.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: c.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: 12,
    color: c.textPrimary,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  contentSection: {
    backgroundColor: c.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    color: c.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.accent,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  addButtonText: {
    color: c.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  chapterItem: {
    backgroundColor: c.bgElevated,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  chapterNumber: {
    color: c.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  chapterTitle: {
    color: c.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  saveButtonText: {
    color: c.textPrimary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(196, 30, 58, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: c.danger,
    fontSize: 14,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74, 124, 89, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  successText: {
    color: '#16a34a',
    fontSize: 14,
  },
});

export default CreatorDashboardScreen;
