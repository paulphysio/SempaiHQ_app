import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Image,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';

const { width, height } = Dimensions.get('window');

// Kaito Adventure Design System - Japanese Dark-Orange
const KA_COLORS = {
  bgPrimary: '#0c0c0c',
  bgCard: '#141210',
  bgElevated: '#1a1714',
  orangePrimary: '#cc5500',
  orangeBright: '#ff6b35',
  orangeSoft: '#e67e22',
  orangeDim: '#8b4513',
  gold: '#c9a84c',
  goldBright: '#ffd700',
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

const FALLBACK_IMAGE = 'https://placehold.co/300x400/png?text=No+Image';

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: KA_COLORS.bgPrimary,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: KA_COLORS.bgPrimary,
  },
  emberContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  ember: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: KA_COLORS.orangePrimary,
    shadowColor: KA_COLORS.orangeBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: KA_COLORS.ivory,
    fontSize: 16,
    marginTop: 16,
    letterSpacing: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: KA_COLORS.ivory,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 2,
  },
  errorMessage: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 1,
  },
  backHomeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backHomeText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  summaryMain: {
    flex: 1,
    padding: 16,
  },
  singleSummaryContainer: {
    padding: 16,
  },
  singleSummaryTitle: {
    color: KA_COLORS.ivory,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 1,
  },
  singleSummaryText: {
    color: KA_COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 28,
    letterSpacing: 0.5,
  },
  summaryHeader: {
    backgroundColor: KA_COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  summaryHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  logoText: {
    color: KA_COLORS.ivory,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  summaryPageTitle: {
    color: KA_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  searchSection: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  summaryNovelsGrid: {
    gap: 16,
  },
  summaryNovelCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryCardGradient: {
    backgroundColor: KA_COLORS.bgCard,
    padding: 16,
  },
  summaryCardContent: {
    gap: 12,
  },
  summaryNovelTitle: {
    color: KA_COLORS.ivory,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  summaryPreview: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  readMoreText: {
    color: KA_COLORS.orangePrimary,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noResultsIcon: {
    marginBottom: 16,
  },
  noResultsTitle: {
    color: KA_COLORS.ivory,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  noResultsText: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 1,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: KA_COLORS.border,
  },
  footerText: {
    color: KA_COLORS.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
});

const NovelSummaryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {};
  
  const [novels, setNovels] = useState([]);
  const [singleNovel, setSingleNovel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const emberAnims = useRef([]);

  // Initialize ember particles
  useEffect(() => {
    const embers = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 4,
    }));
    emberAnims.current = embers.map(() => new Animated.Value(0));
    
    emberAnims.current.forEach((anim, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(embers[index].delay * 1000),
          Animated.timing(anim, {
            toValue: 1,
            duration: embers[index].duration * 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  // Fetch single novel summary if id is provided, otherwise fetch all novels
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (id) {
          // Fetch single novel summary
          const { data, error } = await supabase
            .from('novels')
            .select('id, title, summary, image')
            .eq('id', id)
            .single();

          if (error) throw error;
          setSingleNovel(data);
        } else {
          // Fetch all novels with summaries
          const { data, error } = await supabase
            .from('novels')
            .select('id, title, summary, image')
            .not('summary', 'is', 'null')
            .order('id', { ascending: false });

          if (error) throw error;
          setNovels(data || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load summaries.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Filter novels based on search term (only for list view)
  const filteredNovels = novels.filter(novel =>
    novel.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderNovelCard = ({ item }) => (
    <TouchableOpacity
      style={styles.summaryNovelCard}
      onPress={() => navigation.navigate('NovelDetail', { id: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.summaryCardGradient}>
        <View style={styles.summaryCardContent}>
          <Text style={styles.summaryNovelTitle}>{item.title}</Text>
          <Text style={styles.summaryPreview}>
            {item.summary
              ? `${item.summary.substring(0, 150)}${item.summary.length > 150 ? '...' : ''}`
              : 'No summary available'
            }
          </Text>
          <View style={styles.readMore}>
            <Text style={styles.readMoreText}>Read Full Summary</Text>
            <FontAwesome5 name="arrow-right" size={14} color={KA_COLORS.orangePrimary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.backgroundGradient} />
        <View style={styles.emberContainer}>
          {emberAnims.current.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.ember,
                {
                  left: `${Math.random() * 100}%`,
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [height, -50],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KA_COLORS.orangePrimary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.backgroundGradient} />
        <View style={styles.emberContainer}>
          {emberAnims.current.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.ember,
                {
                  left: `${Math.random() * 100}%`,
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [height, -50],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error Loading Summaries</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.backHomeLink}
            onPress={() => navigation.navigate('Home')}
          >
            <FontAwesome5 name="home" size={16} color={KA_COLORS.ivory} />
            <Text style={styles.backHomeText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Single novel summary view
  if (id && singleNovel) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.backgroundGradient} />
        <View style={styles.emberContainer}>
          {emberAnims.current.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.ember,
                {
                  left: `${Math.random() * 100}%`,
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [height, -50],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>

        <ScrollView style={styles.summaryMain}>
          <View style={styles.singleSummaryContainer}>
            <Text style={styles.singleSummaryTitle}>{singleNovel.title}</Text>
            <Text style={styles.singleSummaryText}>
              {singleNovel.summary || 'No summary available for this novel.'}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // List view (all novels with summaries)
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.backgroundGradient} />
      <View style={styles.emberContainer}>
        {emberAnims.current.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.ember,
              {
                left: `${Math.random() * 100}%`,
                opacity: anim,
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height, -50],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      {/* Header */}
      <View style={styles.summaryHeader}>
        <View style={styles.summaryHeaderContent}>
          <TouchableOpacity
            style={styles.logoLink}
            onPress={() => navigation.navigate('Home')}
          >
            <Image
              source={{
                uri:
                  'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' ||
                  'https://placehold.co/50x50/png?text=Logo',
              }}
              style={styles.logo}
              resizeMode="cover"
              defaultSource={{ uri: 'https://placehold.co/50x50/png?text=Logo' }}
            />
            <Text style={styles.logoText}>SempaiHQ</Text>
          </TouchableOpacity>
          <Text style={styles.summaryPageTitle}>Novel Summaries</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color={KA_COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search novels..."
            placeholderTextColor={KA_COLORS.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      {/* Novels Grid */}
      <View style={styles.summaryMain}>
        {filteredNovels.length === 0 ? (
          <View style={styles.noResults}>
            <FontAwesome5 name="book-open" size={48} color={KA_COLORS.orangePrimary} style={styles.noResultsIcon} />
            <Text style={styles.noResultsTitle}>No novels found</Text>
            <Text style={styles.noResultsText}>Try adjusting your search terms.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredNovels}
            renderItem={renderNovelCard}
            keyExtractor={(item) => item.id}
            numColumns={1}
            contentContainerStyle={styles.summaryNovelsGrid}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
      </View>
    </SafeAreaView>
  );
};

export default NovelSummaryScreen;