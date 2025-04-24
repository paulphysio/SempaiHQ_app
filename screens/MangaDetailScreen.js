// screens/MangaDetailScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { FontAwesome5 } from '@expo/vector-icons';

const MangaDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params; // Get manga ID from navigation params
  const [manga, setManga] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchManga = async () => {
      setLoading(true);
      try {
        const { data: mangaData, error: mangaError } = await supabase
          .from('manga')
          .select('id, title, cover_image, summary, user_id, status, tags')
          .eq('id', id)
          .single();

        if (mangaError) throw mangaError;

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, isArtist')
          .eq('id', mangaData.user_id)
          .single();

        if (userError) throw userError;

        const { data: interactionsData, error: interactionsError } = await supabase
          .from('manga_interactions')
          .select('manga_id')
          .eq('manga_id', id);

        if (interactionsError) throw interactionsError;

        const { data: ratingsData, error: ratingsError } = await supabase
          .from('chapter_ratings')
          .select('rating')
          .eq('content_type', 'manga')
          .eq('content_id', id);

        if (ratingsError) throw ratingsError;

        const ratings = ratingsData.map(r => r.rating);
        const averageRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(2) : 0;

        setManga({
          ...mangaData,
          image: mangaData.cover_image,
          writer: userData,
          viewers: interactionsData.length,
          averageRating,
          isAdult: mangaData.tags && mangaData.tags.includes('Adult(18+)'),
        });
      } catch (err) {
        console.error('Error fetching manga:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchManga();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF5733" />
      </View>
    );
  }

  if (error || !manga) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Manga not found.'}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Image
        source={{ uri: manga.image || 'https://via.placeholder.com/300x400' }}
        style={styles.coverImage}
      />
      <View style={styles.content}>
        <Text style={styles.title}>{manga.title}</Text>
        {manga.writer.isArtist && (
          <TouchableOpacity
            style={styles.writerContainer}
            onPress={() => navigation.navigate('WritersProfile', { id: manga.user_id })}
          >
            <FontAwesome5 name="feather-alt" size={16} color="#fff" />
            <Text style={styles.writerName}>{manga.writer.name || 'Unknown'}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.summary}>{manga.summary || 'No summary available.'}</Text>
        <Text style={styles.status}>Status: {manga.status}</Text>
        {manga.isAdult && <Text style={styles.adultWarning}>Adult(18+)</Text>}
        <View style={styles.stats}>
          <Text style={styles.stat}>
            <FontAwesome5 name="eye" size={16} color="#fff" /> {manga.viewers}
          </Text>
          <Text style={styles.stat}>
            <FontAwesome5 name="star" size={16} color="#ffd700" /> {manga.averageRating}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  coverImage: {
    width: '100%',
    height: 400,
    resizeMode: 'cover',
  },
  content: {
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  writerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  writerName: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 5,
  },
  summary: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 10,
  },
  status: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 10,
  },
  adultWarning: {
    color: '#ff3b3b',
    fontSize: 14,
    marginBottom: 10,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  stat: {
    color: '#fff',
    fontSize: 16,
  },
  backButton: {
    backgroundColor: '#FF5733',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff3b3b',
    fontSize: 18,
    textAlign: 'center',
  },
});

export default MangaDetailScreen;