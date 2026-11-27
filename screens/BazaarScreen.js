import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, Pressable, View, Text, Image, StyleSheet } from 'react-native';
import { getBooksInProgress, myId, positionLabel } from '../services/bookProgress';
import { coverSource } from '../theme/tokens';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { cacheSet, cacheValue } from '../services/localCache';
import ScreenSkeleton from '../components/ScreenSkeleton';
import { EmptyState } from '../components/ui';
import GelOrb from '../components/nav/GelOrb';
import { useTheme } from '../context/ThemeContext';
import { formatCount } from '../components/detail/DetailKit';
import { fetchBazaarCopies } from '../utils/bazaar';
import { Page, PageHeader, SearchField, ChipRow, SectionHeader, PosterGrid, GUTTER } from '../components/page/PageKit';

const FILTERS = [
  { value: 'sale', label: 'For sale' },
  { value: 'lend', label: 'Lending' },
  { value: 'pdf', label: 'PDF' },
  { value: 'epub', label: 'EPUB' },
];

const BazaarScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [books, setBooks] = useState([]);
  const [copies, setCopies] = useState({}); // { [bookId]: { max, taken, left } }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState([]);
  const [reading, setReading] = useState([]); // books in progress: [{ book, pos }]

  // "Continue reading" — refreshed whenever you come back to the shelf.
  const loadReading = useCallback(async () => {
    try {
      const me = await myId();
      setReading(me ? await getBooksInProgress(me, 10) : []);
    } catch {
      /* the row just stays hidden */
    }
  }, []);
  useEffect(() => {
    loadReading();
    return navigation.addListener('focus', loadReading);
  }, [navigation, loadReading]);

  const openReading = (x) =>
    navigation.navigate('BazaarReader', {
      bookId: x.book.id,
      title: x.book.title,
      fileType: x.book.file_type === 'pdf' ? 'pdf' : 'epub',
      fileName: x.book.file_name || null,
    });

  const loadBooks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bazaar_books')
        .select('id, title, author_name, cover_url, file_type, price_usd, sale_enabled, lending_enabled, lend_price_smp, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBooks(data || []);
      cacheSet('lib:bazaar', data || []);
      fetchBazaarCopies((data || []).map((b) => b.id)).then(setCopies);
    } catch (err) {
      // Offline / flaky connection: show the last shelf we had.
      const cached = await cacheValue('lib:bazaar');
      if (cached) setBooks(cached);
      else console.warn('[Bazaar] Failed to load books:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const toggle = (v) => setFilters((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]));

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books
      .filter((b) => {
        if (q && !b.title?.toLowerCase().includes(q) && !b.author_name?.toLowerCase().includes(q)) return false;
        if (filters.includes('sale') && !b.sale_enabled) return false;
        if (filters.includes('lend') && !b.lending_enabled) return false;
        const type = String(b.file_type || '').toLowerCase();
        if (filters.includes('pdf') && type !== 'pdf') return false;
        if (filters.includes('epub') && type !== 'epub') return false;
        return true;
      })
      .map((b) => {
        const c = copies[b.id];
        const soldOut = !!c && c.left <= 0;
        const edition = c ? (soldOut ? 'Sold out' : `${c.left} left`) : null;
        return {
        id: b.id,
        kind: 'book',
        title: b.title,
        image: b.cover_url,
        author: b.author_name,
        badge: soldOut ? { label: 'SOLD OUT' } : b.file_type ? { label: String(b.file_type).toUpperCase() } : undefined,
        meta: b.sale_enabled
          ? ['$' + Number(b.price_usd).toFixed(0), edition, b.author_name || 'Unknown author'].filter(Boolean).join(' · ')
          : b.lending_enabled
          ? [`Lend · ${formatCount(b.lend_price_smp)} SMP`, edition].filter(Boolean).join(' · ')
          : b.author_name || 'Unknown author',
        };
      });
  }, [books, copies, query, filters]);

  const openBook = useCallback((item) => navigation.navigate('BazaarBook', { bookId: item.id }), [navigation]);
  const filtering = !!(query || filters.length);

  if (loading) {
    return <ScreenSkeleton variant="grid" label="Loading Bazaar" />;
  }

  return (
    <Page
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadBooks();
          }}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <Image
        source={require('../assets/bazaar.png')}
        style={{ width: 150, height: 150, alignSelf: 'center', marginTop: 4, marginBottom: -6 }}
        resizeMode="contain"
        accessibilityLabel="Sempai HQ Bazaar"
      />
      <PageHeader
        eyebrow="Marketplace"
        title="Bazaar"
        subtitle="Indie books, sold and lent by their authors."
        right={
          <>
            <GelOrb icon="ticket-alt" size={40} onPress={() => navigation.navigate('HQPass')} label="HQ Access Pass" breathe={false} />
            <GelOrb icon="chart-line" size={40} onPress={() => navigation.navigate('BazaarDashboard')} label="My Bazaar sales" breathe={false} />
            <GelOrb icon="cloud-upload-alt" size={40} lit onPress={() => navigation.navigate('UploadBook')} label="Upload a book" breathe={false} />
          </>
        }
      />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search title or author" />
      <ChipRow options={FILTERS} selected={filters} onToggle={toggle} onClear={() => setFilters([])} />

      {reading.length && !filtering ? (
        <>
          <SectionHeader title="Continue reading" count={reading.length} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.rail} style={st.bleed}>
            {reading.map((x) => {
              const pct = Math.max(0, Math.min(100, x.pos.pct));
              return (
                <Pressable
                  key={x.book.id}
                  onPress={() => openReading(x)}
                  style={({ pressed }) => [st.card, { backgroundColor: colors.bgCard, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Continue ${x.book.title}, ${positionLabel(x.pos)}`}
                >
                  <Image source={coverSource(x.book.cover_url)} style={st.cover} resizeMode="cover" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[st.title, { color: colors.textPrimary }]} numberOfLines={2}>{x.book.title}</Text>
                    <Text style={[st.meta, { color: colors.textMuted }]} numberOfLines={1}>{positionLabel(x.pos)}</Text>
                    <View style={[st.track, { backgroundColor: colors.border }]}>
                      <View style={[st.fill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <SectionHeader title={filtering ? 'Results' : 'New arrivals'} count={cards.length} />
      {cards.length ? (
        <PosterGrid items={cards} onOpen={openBook} />
      ) : (
        <EmptyState
          icon="store"
          title={filtering ? 'No matches' : 'The Bazaar is empty'}
          subtitle={filtering ? 'Try a different search or filter.' : 'Be the first to publish a book here.'}
          action={filtering ? 'Clear filters' : 'Upload a book'}
          onAction={() => {
            if (filtering) {
              setQuery('');
              setFilters([]);
            } else {
              navigation.navigate('UploadBook');
            }
          }}
        />
      )}
    </Page>
  );
};

const st = StyleSheet.create({
  bleed: { marginHorizontal: -GUTTER },
  rail: { paddingHorizontal: GUTTER, gap: 10, paddingBottom: 4 },
  card: { width: 250, flexDirection: 'row', gap: 12, padding: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  cover: { width: 52, height: 76, borderRadius: 8 },
  title: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 3 },
  track: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});

export default BazaarScreen;
