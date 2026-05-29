import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Image,
  SafeAreaView,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/MarketplaceStyles';

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
    if (!userId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/marketplace/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: listing.id,
          buyerId: userId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      setShowDetailModal(false);
      loadListings();
      loadHoardItems();
    } catch (error) {
      console.error('[MarketplaceScreen] Error purchasing item:', error);
    }
  };

  const handleListItem = async () => {
    if (!userId || !selectedItem || !listingPrice) return;

    try {
      const price = parseInt(listingPrice);
      
      const response = await fetch(`${API_BASE_URL}/marketplace/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerId: userId,
          itemId: selectedItem.id,
          price
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      setShowListModal(false);
      setListingPrice('');
      loadHoardItems();
    } catch (error) {
      console.error('[MarketplaceScreen] Error listing item:', error);
    }
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
    <Modal
      visible={showDetailModal}
      animationType="fade"
      transparent
      onRequestClose={() => setShowDetailModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setShowDetailModal(false)}
          >
            <FontAwesome5 name="times" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {selectedItem && (
            <>
              {selectedItem.nft_image_url ? (
                <Image source={{ uri: selectedItem.nft_image_url }} style={styles.modalImage} />
              ) : (
                <View style={styles.modalPlaceholderImage}>
                  <FontAwesome5 name="image" size={60} color="#CCCCCC" />
                </View>
              )}

              <Text style={styles.modalTitle}>{selectedItem.nft_name}</Text>
              
              <View style={styles.modalInfo}>
                <View style={styles.infoRow}>
                  <FontAwesome5 name="tag" size={16} color="#4A90E2" />
                  <Text style={styles.infoLabel}>Rarity:</Text>
                  <Text style={styles.infoValue}>
                    {selectedItem.rarity.charAt(0).toUpperCase() + selectedItem.rarity.slice(1)}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <FontAwesome5 name="gem" size={16} color="#F39C12" />
                  <Text style={styles.infoLabel}>Price:</Text>
                  <Text style={styles.infoValue}>{selectedItem.price_smp?.toLocaleString()} SMP</Text>
                </View>

                <View style={styles.infoRow}>
                  <FontAwesome5 name="user" size={16} color="#9B59B6" />
                  <Text style={styles.infoLabel}>Seller:</Text>
                  <Text style={styles.infoValue}>{selectedItem.users?.name || 'Anonymous'}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.purchaseButton}
                onPress={() => handlePurchase(selectedItem)}
              >
                <FontAwesome5 name="shopping-cart" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Purchase</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderListModal = () => (
    <Modal
      visible={showListModal}
      animationType="fade"
      transparent
      onRequestClose={() => setShowListModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setShowListModal(false)}
          >
            <FontAwesome5 name="times" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {selectedItem && (
            <>
              <Text style={styles.modalTitle}>List for Sale</Text>
              <Text style={styles.modalSubtitle}>{selectedItem.nft_name}</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Price (SMP)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter price"
                  placeholderTextColor="#888"
                  value={listingPrice}
                  onChangeText={setListingPrice}
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity 
                style={styles.listButton}
                onPress={handleListItem}
              >
                <FontAwesome5 name="tag" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>List Item</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  if (!isWalletConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lockedContainer}>
          <FontAwesome5 name="wallet" size={48} color="#E74C3C" />
          <Text style={styles.lockedMessage}>Connect Wallet to Access Marketplace</Text>
          <TouchableOpacity 
            style={styles.connectButton}
            onPress={() => navigation.navigate('WalletImport')}
          >
            <FontAwesome5 name="wallet" size={16} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
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
