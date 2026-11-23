import React, {useState, useEffect, useContext, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, SafeAreaView, RefreshControl, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getMarketplaceStyles } from '../styles/MarketplaceStyles';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';
import { GelModal, GelInput, GelInset, GelRow } from '../components/gel/GelKit';
import { GelGate } from '../components/gel/GelGate';

const API_BASE_URL = 'https://sempaihq.com/api';

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

  const renderListing = ({ item }) => {
    const colors = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
    const icon = RARITY_ICONS[item.rarity] || RARITY_ICONS.common;

    return (
      <TouchableOpacity 
        style={styles.itemCard}
        onPress={() => {
          setSelectedItem(item);
          setShowDetailModal(true);
        }}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rarityBadge}
        >
          <FontAwesome5 name={icon} size={16} color="#FFFFFF" />
        </LinearGradient>
        
        {item.nft_image_url ? (
          <Image source={{ uri: item.nft_image_url }} style={styles.itemImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <FontAwesome5 name="image" size={40} color="#CCCCCC" />
          </View>
        )}
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.nft_name}</Text>
          <Text style={styles.itemPrice}>{item.price_smp.toLocaleString()} SMP</Text>
          <Text style={styles.itemSeller}>by {item.users?.name || 'Anonymous'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHoardItem = ({ item }) => {
    const colors = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
    const icon = RARITY_ICONS[item.rarity] || RARITY_ICONS.common;

    return (
      <TouchableOpacity 
        style={styles.itemCard}
        onPress={() => {
          setSelectedItem(item);
          setShowListModal(true);
        }}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rarityBadge}
        >
          <FontAwesome5 name={icon} size={16} color="#FFFFFF" />
        </LinearGradient>
        
        {item.nft_image_url ? (
          <Image source={{ uri: item.nft_image_url }} style={styles.itemImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <FontAwesome5 name="image" size={40} color="#CCCCCC" />
          </View>
        )}
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.nft_name}</Text>
          <Text style={styles.itemRarity}>{item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}</Text>
          {item.is_listed && (
            <Text style={styles.listedText}>Listed for {item.listing_price_smp?.toLocaleString()} SMP</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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
    <SafeAreaView style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'marketplace' && styles.activeTab]}
          onPress={() => {
            setActiveTab('marketplace');
            loadListings();
          }}
        >
          <FontAwesome5 
            name="store" 
            size={16} 
            color={activeTab === 'marketplace' ? '#FFFFFF' : '#CCCCCC'} 
          />
          <Text style={[styles.tabText, activeTab === 'marketplace' && styles.activeTabText]}>
            Marketplace
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hoard' && styles.activeTab]}
          onPress={() => {
            setActiveTab('hoard');
            loadHoardItems();
          }}
        >
          <FontAwesome5 
            name="treasure-chest" 
            size={16} 
            color={activeTab === 'hoard' ? '#FFFFFF' : '#CCCCCC'} 
          />
          <Text style={[styles.tabText, activeTab === 'hoard' && styles.activeTabText]}>
            My Hoard
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading marketplace...</Text>
        </View>
      ) : (
        <FlatList
          data={activeTab === 'marketplace' ? listings : hoardItems}
          renderItem={activeTab === 'marketplace' ? renderListing : renderHoardItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 
                name={activeTab === 'marketplace' ? 'store' : 'treasure-chest'} 
                size={48} 
                color="#CCCCCC" 
              />
              <Text style={styles.emptyText}>
                {activeTab === 'marketplace' ? 'No items for sale' : 'Your hoard is empty'}
              </Text>
            </View>
          }
        />
      )}

      {renderDetailModal()}
      {renderListModal()}
    </SafeAreaView>
  );
};

export default MarketplaceScreen;
