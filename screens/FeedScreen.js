import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/FeedStyles';

const API_BASE_URL = 'https://sempaihq.com/api';

const FeedScreen = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [userId, setUserId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (isWalletConnected) {
      loadUserId();
    }
    loadPosts();
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
      console.error('[FeedScreen] Error loading user ID:', error);
    }
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      
      let response;
      if (userId) {
        // Use personalized feed with algorithm
        response = await fetch(`${API_BASE_URL}/feed/personalized?userId=${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
      } else {
        // Fallback to regular feed
        response = await fetch(`${API_BASE_URL}/feed/posts`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setPosts(data.posts || data || []);
    } catch (error) {
      console.error('[FeedScreen] Error loading posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
  }, [userId]);

  const handleLike = async (postId) => {
    if (!userId) return;
    
    try {
      const post = posts.find(p => p.id === postId);
      const response = await fetch(`${API_BASE_URL}/feed/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      loadPosts();
    } catch (error) {
      console.error('[FeedScreen] Error liking post:', error);
    }
  };

  const handleCreatePost = async () => {
    if (!userId || !postContent.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/feed/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          content: postContent.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      setPostContent('');
      loadPosts();
    } catch (error) {
      console.error('[FeedScreen] Error creating post:', error);
    }
  };

  const handleNewPost = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  const renderPost = ({ item }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <FontAwesome5 name="user" size={20} color="#CCCCCC" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.users?.name || 'Anonymous'}</Text>
            <Text style={styles.postTime}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.postImage} />
      )}

      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <FontAwesome5 
            name="heart" 
            size={18} 
            color={item.isLiked ? '#E74C3C' : '#CCCCCC'} 
          />
          <Text style={[styles.actionText, item.isLiked && styles.likedText]}>
            {item.likesCount || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <FontAwesome5 name="comment" size={18} color="#CCCCCC" />
          <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <FontAwesome5 name="share" size={18} color="#CCCCCC" />
          <Text style={styles.actionText}>{item.shares_count || 0}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D94F04" />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      {/* Navbar */}
      <View style={styles.feedNavbar}>
        <View style={styles.navbarContent}>
          <TouchableOpacity
            style={styles.logoLink}
            onPress={() => navigation.navigate('Home')}
          >
            <Image
              source={{
                uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' ||
                'https://placehold.co/50x50/png?text=Logo',
              }}
              style={styles.logo}
              resizeMode="cover"
              defaultSource={{ uri: 'https://placehold.co/50x50/png?text=Logo' }}
            />
            <Text style={styles.logoText}>SempaiHQ Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuOpen(!menuOpen)}
          >
            <FontAwesome5 name={menuOpen ? 'times' : 'bars'} size={24} color="#D94F04" />
          </TouchableOpacity>
        </View>
        {menuOpen && (
          <View style={styles.navItems}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate('Home');
              }}
            >
              <FontAwesome5 name="home" size={16} color="#fff" />
              <Text style={styles.navItemText}>Home</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Feed Content */}
      <View style={styles.feedContent}>
        <View style={styles.feedMain}>
          <View style={styles.feedTitleContainer}>
            <FontAwesome5 name="feather" size={24} color="#D94F04" />
            <Text style={styles.feedTitle}>SempaiHQ Feed</Text>
          </View>
          <Text style={styles.feedSubtitle}>
            Share your thoughts with the community
          </Text>

          {/* Post Creator */}
          {userId && (
            <View style={styles.postCreatorContainer}>
              <View style={styles.postCreator}>
                <View style={styles.userPreview}>
                  <View style={styles.avatar}>
                    <FontAwesome5 name="user" size={20} color="#CCCCCC" />
                  </View>
                  <Text style={styles.userName}>You</Text>
                </View>
                <TextInput
                  style={styles.postInput}
                  placeholder="What's on your mind?"
                  placeholderTextColor="#888"
                  multiline
                  value={postContent}
                  onChangeText={setPostContent}
                  maxLength={500}
                />
                <TouchableOpacity
                  style={styles.postButton}
                  onPress={handleCreatePost}
                  disabled={!postContent.trim()}
                >
                  <FontAwesome5 name="paper-plane" size={16} color="#fff" />
                  <Text style={styles.postButtonText}>Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Posts */}
          <View style={styles.postsContainer}>
            {posts.length > 0 ? (
              <FlatList
                data={posts}
                renderItem={renderPost}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.feedList}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
              />
            ) : (
              <View style={styles.noPosts}>
                <FontAwesome5 name="newspaper" size={48} color="#CCCCCC" />
                <Text style={styles.noPostsText}>No posts yet. Be the first to share!</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default FeedScreen;
