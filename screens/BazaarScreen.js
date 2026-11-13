import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import styles, { BAZAAR_COLORS } from '../styles/BazaarStyles';

const BazaarScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Clear the floating GlobalBottomNav (68px) so the last row stays visible.
  const bottomNavClearance = Math.max(insets.bottom, 8) + 12 + 68 + 8;
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBooks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bazaar_books')
        .select('id, title, author_name, cover_url, file_type, price_usd, sale_enabled, lending_enabled, lend_price_smp, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBooks(data || []);
    } catch (err) {
      console.error('[Bazaar] Failed to load books:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const renderBook = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('BazaarBook', { bookId: item.id })}
    >
      {item.cover_url ? (
        <Image source={{ uri: item.cover_url }} style={styles.cardCover} resizeMode="cover" />
      ) : (
        <View style={[styles.cardCover, styles.cardCoverPlaceholder]}>
          <Ionicons name="book" size={36} color={BAZAAR_COLORS.textMuted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cardAuthor} numberOfLines={1}>
          {item.author_name || 'Unknown author'}
        </Text>
        <View style={styles.cardFooter}>
          {item.sale_enabled ? (
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>${Number(item.price_usd).toFixed(2)}</Text>
            </View>
          ) : item.lending_enabled ? (
            <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
              <Text style={[styles.typeText, { color: '#FFD700' }]}>LEND</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{item.file_type}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bazaar</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BAZAAR_COLORS.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bazaar</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('UploadBook')}
          accessibilityLabel="Upload a book"
        >
          <Ionicons name="cloud-upload-outline" size={24} color={BAZAAR_COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('BazaarDashboard')}
          accessibilityLabel="My bazaar dashboard"
        >
          <Ionicons name="stats-chart-outline" size={24} color={BAZAAR_COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {books.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="book-outline" size={56} color={BAZAAR_COLORS.textMuted} />
          <Text style={[styles.mutedText, { marginTop: 16 }]}>
            No books in the bazaar yet.{"\n"}Be the first to upload one.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('UploadBook')}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Upload a Book</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          renderItem={renderBook}
          numColumns={2}
          columnWrapperStyle={{ gap: 16, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingVertical: 16, gap: 16, paddingBottom: bottomNavClearance }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadBooks();
              }}
              tintColor={BAZAAR_COLORS.accent}
            />
          }
        />
      )}
    </View>
  );
};

export default BazaarScreen;
