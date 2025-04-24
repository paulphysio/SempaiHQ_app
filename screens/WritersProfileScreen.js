// screens/WritersProfileScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { FontAwesome5 } from '@expo/vector-icons';

const WritersProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params; // Get user ID from navigation params
  const [profile, setProfile] = useState(null);
  const [novels, setNovels] = useState([]);
  const [manga, setManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, bio, isWriter, isArtist')
          .eq('id', id)
          .single();

        if (userError) throw userError;

        const { data: novelsData, error: novelsError } = await supabase
          .from('novels')
          .select('id, title, image, summary, tags')
          .eq('user_id', id);

        if (novelsError) throw novelsError;

        const { data: mangaData, error: mangaError } = await supabase
          .from('manga')
          .select('id, title, cover_image, summary, status, tags')
          .eq('user_id', id);

        if (mangaError) throw mangaError;

        setProfile(userData);
        setNovels(novelsData.map(novel => ({
          ...novel,
          isAdult: novel.tags && novel.tags.includes('Adult(18+)'),
        })));
        setManga(mangaData.map(m => ({
          ...m,
          image: m.cover_image,
          isAdult: m.tags && m.tags.includes('Adult(18+)'),
        })));
      } catch (err) {
        console.error('Error fetching profile:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  const renderContentItem = ({ item, type }) => (
    <TouchableOpacity
      style={styles.contentCard}
      onPress={() => navigation.navigate(type === 'novel' ? 'Novel' : 'Manga', { id: item.id })}
    >
      <Image
        source={{ uri: item.image || 'https://via.placeholder.com/150x200' }}
        style={styles.contentImage}
      />
      <Text style={styles.contentTitle}>{item.title}</Text>
      {item.isAdult && <Text style={styles.adultWarning}>Adult(18+)</Text>}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF5733" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Profile not found.'}</Text>
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
      <View style={styles.header}>
        <Text style={styles.name}>{profile.name || 'Unknown'}</Text>
        <Text style={styles.role}>
          {profile.isWriter && profile.isArtist ? 'Writer & Artist' : profile.isWriter ? 'Writer' : profile.isArtist ? 'Artist' : 'Creator'}
        </Text>
        <Text style={styles.bio}>{profile.bio || 'No bio available.'}</Text>
      </View>
      {novels.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Novels</Text>
          <FlatList
            data={novels}
            renderItem={({ item }) => renderContentItem({ item, type: 'novel' })}
            keyExtractor={item => `novel-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}
      {manga.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manga</Text>
          <FlatList
            data={manga}
            renderItem={({ item }) => renderContentItem({ item, type: 'manga' })}
            keyExtractor={item => `manga-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.backButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  role: {
    color: '#FF5733',
    fontSize: 18,
    marginVertical: 5,
  },
  bio: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  contentCard: {
    marginRight: 10,
    width: 150,
  },
  contentImage: {
    width: 150,
    height: 200,
    borderRadius: 5,
  },
  contentTitle: {
    color: '#fff',
    fontSize: 16,
    marginTop: 5,
  },
  adultWarning: {
    color: '#ff3b3b',
    fontSize: 12,
  },
  backButton: {
    backgroundColor: '#FF5733',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    margin: 20,
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

export default WritersProfileScreen;