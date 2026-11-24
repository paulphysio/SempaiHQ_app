import React, {useState, useEffect, useContext, useMemo } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getMarketplaceStyles } from '../styles/MarketplaceStyles';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';
import { GelModal, GelInput, GelInset, GelRow, GelGlass, GelChips } from '../components/gel/GelKit';
import GelOrb from '../components/nav/GelOrb';
import { GelGate, GelPageHeader } from '../components/gel/GelGate';

import { SITE_API } from '../constants';
const API_BASE_URL = SITE_API;

const RARITY_COLORS = {
  common: ['#8B8B8B', '#6B6B6B'],
  rare: ['#4A90E2', '#357ABD'],
  epic: ['#9B59B6', '#8E44AD'],
  legendary: ['#F39C12', '#E67E22']
};

const RARITY_ICONS = {
  common: 'gem',
  rare: 'star',
  epic: 'crown',
  legendary: 'dragon'
};

const MarketplaceScreen = () => {
  const { isDark, colors } = useTheme();
  const themeColors = colors;
  const styles = useMemo(() => getMarketplaceStyles(colors), [isDark]);
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  
  const [listings, setListings] = useState([]);
  const [hoardItems, setHoardItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('marketplace');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [listingPrice, setListingPrice] = useState('');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (isWalletConnected) {
      loadUserId();
      loadListings();
      loadHoardItems();
    }
  }, [isWalletConnected]);

  const loadUserId = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet?.publicKey)
        .single();
      if (data) setUserId(data.id);
    } catch (error) {
      console.error('[MarketplaceScreen] Error loading user ID:', error);
    }
  };

  const loadListings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/marketplace/listings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setListings(data);
    } catch (error) {
      console.error('[MarketplaceScreen] Error loading listings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadHoardItems = async () => {
    try {
      if (!userId) return;
      
      const response = await fetch(`${API_BASE_URL}/marketplace/hoard/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setHoardItems(data);
    } catch (error) {
      console.error('[MarketplaceScreen] Error loading hoard items:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'marketplace') {
      loadListings();
    } else {
      loadHoardItems();
    }
  };

  const handlePurchase = async (listing) => {
    toast.info('Purchase Disabled — Purchase functionality is currently disabled. Backend API endpoints not implemented.');
    return;
  };

  const handleListItem = async () => {
    toast.info('Listing Disabled — Listing functionality is currently disabled. Backend API endpoints not implemented.');
    return;
  };

  const card = (item, onPress, footer) => {
    const tint = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
    const icon = RARITY_ICONS[item.rarity] || RARITY_ICONS.common;
    return (
      <Pressable onPress={onPress} style={{ flex: 1, margin: 6, maxWidth: '50%' }} accessibilityRole="button" accessibilityLabel={item.nft_name}>
        <GelGlass radius={22} glow={false} padding={8}>
          <View style={{ aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : `rgba(${themeColors.accentRgb},0.06)`, alignItems: 'center', justifyContent: 'center' }}>
            {item.nft_image_url ? <Image source={{ uri: item.nft_image_url }} style={{ width: '100%', height: '100%' }} /> : <FontAwesome5 name="image" size={34} color={themeColors.textMuted} />}
            <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name={icon} size={12} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={{ color: themeColors.textPrimary, fontWeight: '800', fontSize: 14, marginTop: 8, marginHorizontal: 4 }} numberOfLines={1}>{item.nft_name}</Text>
          <View style={{ marginHorizontal: 4, marginBottom: 4 }}>{footer}</View>
        </GelGlass>
      </Pressable>
    );
  };

  const renderListing = ({ item }) =>
    card(item, () => { setSelectedItem(item); setShowDetailModal(true); }, (
      <>
        <Text style={{ color: themeColors.accent, fontWeight: '900', fontSize: 13, marginTop: 2 }}>{item.price_smp?.toLocaleString()} SMP</Text>
        <Text style={{ color: themeColors.textMuted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>by {item.users?.name || 'Anonymous'}</Text>
      </>
    ));

  const renderHoardItem = ({ item }) =>
    card(item, () => { setSelectedItem(item); setShowListModal(true); }, (
      <>
        <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 2 }}>{item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}</Text>
        {item.is_listed ? <Text style={{ color: themeColors.accent, fontWeight: '800', fontSize: 12, marginTop: 1 }}>Listed · {item.listing_price_smp?.toLocaleString()} SMP</Text> : null}
      </>
    ));

  const renderDetailModal = () => (
    <GelModal
      visible={showDetailModal && !!selectedItem}
      onClose={() => setShowDetailModal(false)}
      title={selectedItem?.nft_name}
      actions={selectedItem ? [{ label: 'Buy', icon: 'shopping-cart', onPress: () => handlePurchase(selectedItem) }] : []}
    >
      {selectedItem ? (
        <>
          {selectedItem.nft_image_url ? (
            <Image source={{ uri: selectedItem.nft_image_url }} style={[styles.modalImage, { marginTop: 14, borderRadius: 18 }]} />
          ) : null}
          <GelInset>
            <GelRow label="Rarity" value={selectedItem.rarity.charAt(0).toUpperCase() + selectedItem.rarity.slice(1)} />
            <GelRow label="Price" value={`${selectedItem.price_smp?.toLocaleString()} SMP`} strong />
            <GelRow label="Seller" value={selectedItem.users?.name || 'Anonymous'} />
          </GelInset>
        </>
      ) : null}
    </GelModal>
  );

  const renderListModal = () => (
    <GelModal
      visible={showListModal && !!selectedItem}
      onClose={() => setShowListModal(false)}
      icon="tag"
      title="List for sale"
      subtitle={selectedItem?.nft_name}
      actions={[{ label: 'List item', icon: 'tag', disabled: !listingPrice, onPress: handleListItem }]}
    >
      <GelInput label="Price (SMP)" placeholder="e.g. 50000" value={listingPrice} onChangeText={setListingPrice} keyboardType="numeric" />
    </GelModal>
  );

  if (!isWalletConnected) {
    return <GelGate icon="store" headerTitle="Marketplace" title="Connect your wallet" subtitle="Connect a wallet to buy and sell collectibles." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.bg }}>
      <GelPageHeader title="Marketplace" subtitle="Collectibles from the SempaiHQ community" />
      <GelChips
        options={[{ value: 'marketplace', label: 'For sale' }, { value: 'hoard', label: 'My hoard' }]}
        value={activeTab}
        onChange={(v) => { setActiveTab(v); if (v === 'marketplace') loadListings(); else loadHoardItems(); }}
        style={{ marginTop: 4, marginHorizontal: 16, marginBottom: 6 }}
      />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={themeColors.accent} />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'marketplace' ? listings : hoardItems}
          renderItem={activeTab === 'marketplace' ? renderListing : renderHoardItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 10, paddingBottom: 130 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.accent} colors={[themeColors.accent]} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 70, paddingHorizontal: 30 }}>
              <View pointerEvents="none"><GelOrb icon={activeTab === 'marketplace' ? 'store' : 'gem'} size={64} lit breathe={false} /></View>
              <Text style={{ fontFamily: 'Yoruka', fontSize: 22, color: themeColors.textPrimary, marginTop: 14 }}>
                {activeTab === 'marketplace' ? 'Nothing for sale yet' : 'Your hoard is empty'}
              </Text>
              <Text style={{ color: themeColors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 }}>
                {activeTab === 'marketplace' ? 'Collectibles listed by readers and creators will show up here.' : 'Collectibles you own will show up here.'}
              </Text>
            </View>
          }
        />
      )}

      {renderDetailModal()}
      {renderListModal()}
    </View>
  );
};

export default MarketplaceScreen;
