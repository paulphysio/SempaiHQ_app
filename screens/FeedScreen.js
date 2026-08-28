import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { getFeedStyles } from '../styles/FeedStyles';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

const API_BASE_URL = 'https://sempaihq.com/api';

const FeedScreen = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  const { isDark, colors } = useTheme();
  const themedStyles = getFeedStyles(isDark);
  
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState('');
  const [userId, setUserId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [resharedPosts, setResharedPosts] = useState({});

  useEffect(() => {
    if (isWalletConnected) {
      loadUserId();
    }
    loadPosts();
  }, [isWalletConnected, userId]);

  const loadUserId = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet?.publicKey?.toString())
        .single();
      if (data) setUserId(data.id);
    } catch (error) {
      console.error('Error loading user ID:', error);
    }
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/feed/posts`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to fetch posts');
      
      const data = await response.json();
      setPosts(data.posts || []);
      
      // Load user's existing likes and reshares
      if (userId) {
        loadUserInteractions(data.posts || []);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      try {
        const { data: posts } = await supabase
          .from('feed_posts')
          .select('*, users(*)')
          .order('created_at', { ascending: false })
          .limit(20);
        setPosts(posts || []);
        
        if (userId) {
          loadUserInteractions(posts || []);
        }
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
        setPosts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserInteractions = async (posts) => {
    if (!userId || !posts.length) return;

    try {
      // Load user's likes
      const { data: likes } = await supabase
        .from('feed_post_likes')
        .select('post_id')
        .eq('user_id', userId);

      const likedPostIds = (likes || []).map(like => like.post_id);
      const likedPostsMap = {};
      likedPostIds.forEach(postId => {
        likedPostsMap[postId] = true;
      });
      setLikedPosts(likedPostsMap);

      // Load user's reshares
      const { data: shares } = await supabase
        .from('feed_shares')
        .select('post_id')
        .eq('user_id', userId);

      const resharedPostIds = (shares || []).map(share => share.post_id);
      const resharedPostsMap = {};
      resharedPostIds.forEach(postId => {
        resharedPostsMap[postId] = true;
      });
      setResharedPosts(resharedPostsMap);
    } catch (error) {
      console.error('Error loading user interactions:', error);
    }
  };

  const handleCreatePost = async () => {
    if (!userId || !postContent.trim()) return;

    try {
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('content', postContent.trim());

      const response = await fetch(`${API_BASE_URL}/feed/posts`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to create post');

      setPostContent('');
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post');
    }
  };

  const handleEditPost = async () => {
    if (!editingPost || !editContent.trim()) return;

    try {
      const { error } = await supabase
        .from('feed_posts')
        .update({ content: editContent.trim() })
        .eq('id', editingPost);

      if (error) throw error;

      setEditingPost(null);
      setEditContent('');
      loadPosts();
    } catch (error) {
      console.error('Error editing post:', error);
      Alert.alert('Error', 'Failed to edit post');
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      const { error } = await supabase
        .from('feed_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setShowDeleteModal(null);
      loadPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      Alert.alert('Error', 'Failed to delete post');
    }
  };

  const loadComments = async (postId) => {
    try {
      const { data } = await supabase
        .from('feed_comments')
        .select('*, users(*)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      
      setComments(prev => ({ ...prev, [postId]: data || [] }));
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleLikePost = async (postId) => {
    if (!userId) return;

    try {
      const isLiked = likedPosts[postId];
      
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('feed_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;

        setLikedPosts(prev => ({ ...prev, [postId]: false }));
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, likes_count: Math.max(0, (post.likes_count || 0) - 1) }
            : post
        ));
      } else {
        // Like - check if already exists first
        const { data: existingLike } = await supabase
          .from('feed_post_likes')
          .select('*')
          .eq('post_id', postId)
          .eq('user_id', userId)
          .single();

        if (existingLike) {
          // Already liked, just update state
          setLikedPosts(prev => ({ ...prev, [postId]: true }));
          return;
        }

        const { error } = await supabase
          .from('feed_post_likes')
          .insert({
            post_id: postId,
            user_id: userId,
          });

        if (error) throw error;

        setLikedPosts(prev => ({ ...prev, [postId]: true }));
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, likes_count: (post.likes_count || 0) + 1 }
            : post
        ));
      }
    } catch (error) {
      console.error('Error liking post:', error);
      Alert.alert('Error', 'Failed to like post');
    }
  };

  const handleResharePost = async (postId) => {
    if (!userId) return;

    try {
      const isReshared = resharedPosts[postId];
      
      if (isReshared) {
        // Unshare
        const { error } = await supabase
          .from('feed_shares')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;

        setResharedPosts(prev => ({ ...prev, [postId]: false }));
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, shares_count: Math.max(0, (post.shares_count || 0) - 1) }
            : post
        ));
      } else {
        // Share - check if already exists first
        const { data: existingShare } = await supabase
          .from('feed_shares')
          .select('*')
          .eq('post_id', postId)
          .eq('user_id', userId)
          .single();

        if (existingShare) {
          // Already reshared, just update state
          setResharedPosts(prev => ({ ...prev, [postId]: true }));
          return;
        }

        const { error } = await supabase
          .from('feed_shares')
          .insert({
            post_id: postId,
            user_id: userId,
          });

        if (error) throw error;

        setResharedPosts(prev => ({ ...prev, [postId]: true }));
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, shares_count: (post.shares_count || 0) + 1 }
            : post
        ));
      }
    } catch (error) {
      console.error('Error resharing post:', error);
      Alert.alert('Error', 'Failed to reshare post');
    }
  };

  const handleCreateComment = async (postId) => {
    if (!userId || !newComment[postId]?.trim()) return;

    try {
      const { error } = await supabase
        .from('feed_comments')
        .insert({
          post_id: postId,
          user_id: userId,
          content: newComment[postId].trim(),
        });

      if (error) throw error;

      setNewComment(prev => ({ ...prev, [postId]: '' }));
      loadComments(postId);
      
      // Update comment count in posts
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, comments_count: (post.comments_count || 0) + 1 }
          : post
      ));
    } catch (error) {
      console.error('Error creating comment:', error);
      Alert.alert('Error', 'Failed to create comment');
    }
  };

  const toggleComments = (postId) => {
    setExpandedComments(prev => {
      const newState = { ...prev, [postId]: !prev[postId] };
      if (newState[postId] && !comments[postId]) {
        loadComments(postId);
      }
      return newState;
    });
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  const renderPost = (post) => {
    const isOwnPost = post.user_id === userId;
    const isExpanded = expandedComments[post.id];
    const postComments = comments[post.id] || [];

    return (
      <View key={post.id} style={themedStyles.postCard}>
        <View style={themedStyles.postContent}>
          {/* Avatar */}
          <View style={themedStyles.avatar}>
            <FontAwesome5 name="user" size={20} color={colors.accent} />
          </View>

          {/* Post Body */}
          <View style={themedStyles.userDetails}>
            {/* Header */}
            <View style={themedStyles.postHeader}>
              <View style={themedStyles.userInfo}>
                <Text style={themedStyles.userName}>
                  {post.user?.name || post.users?.name || 'Anonymous'}
                </Text>
                <Text style={themedStyles.postTime}>· {formatTimeAgo(post.created_at)}</Text>
              </View>
              
              {isOwnPost && (
                <TouchableOpacity 
                  style={themedStyles.menuButton}
                  onPress={() => setShowDeleteModal(post.id)}
                >
                  <MaterialIcons name="more-horiz" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Content */}
            {editingPost === post.id ? (
              <View style={themedStyles.postCreator}>
                <TextInput
                  style={themedStyles.postInput}
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                  autoFocus
                />
                <View style={themedStyles.modalActions}>
                  <TouchableOpacity
                    style={themedStyles.attachButton}
                    onPress={() => {
                      setEditingPost(null);
                      setEditContent('');
                    }}
                  >
                    <Text style={themedStyles.actionText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={themedStyles.postButton}
                    onPress={handleEditPost}
                  >
                    <Text style={themedStyles.postButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={themedStyles.postContent}>{post.content}</Text>
            )}

            {/* Image */}
            {post.image_url && (
              <Image source={{ uri: post.image_url }} style={themedStyles.postImage} />
            )}

            {/* Actions */}
            <View style={themedStyles.postActions}>
              <TouchableOpacity 
                style={themedStyles.actionButton}
                onPress={() => toggleComments(post.id)}
              >
                <FontAwesome5 
                  name="comment" 
                  size={16} 
                  color={isExpanded ? colors.accent : colors.textMuted} 
                />
                <Text style={[themedStyles.actionText, isExpanded && { color: colors.accent }]}>
                  {post.comments_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={themedStyles.actionButton}
                onPress={() => handleResharePost(post.id)}
              >
                <FontAwesome5 
                  name="retweet" 
                  size={16} 
                  color={resharedPosts[post.id] ? colors.accent : colors.textMuted} 
                />
                <Text style={[themedStyles.actionText, resharedPosts[post.id] && { color: colors.accent }]}>
                  {post.shares_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={themedStyles.actionButton}
                onPress={() => handleLikePost(post.id)}
              >
                <FontAwesome5 
                  name="heart" 
                  size={16} 
                  color={likedPosts[post.id] ? colors.danger : colors.textMuted} 
                />
                <Text style={[themedStyles.actionText, likedPosts[post.id] && { color: colors.danger }]}>
                  {post.likes_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={themedStyles.actionButton}>
                <FontAwesome5 name="share-alt" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Comments Section */}
            {isExpanded && (
              <View style={themedStyles.postCreator}>
                {postComments.length > 0 ? (
                  postComments.map(comment => (
                    <View key={comment.id} style={themedStyles.postHeader}>
                      <View style={themedStyles.avatar}>
                        <FontAwesome5 name="user" size={14} color={colors.accent} />
                      </View>
                      <View style={themedStyles.userDetails}>
                        <View style={themedStyles.userInfo}>
                          <Text style={themedStyles.userName}>
                            {comment.users?.name || 'Anonymous'}
                          </Text>
                          <Text style={themedStyles.postTime}>
                            · {formatTimeAgo(comment.created_at)}
                          </Text>
                        </View>
                        <Text style={themedStyles.postContent}>{comment.content}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={themedStyles.emptySubtext}>No comments yet</Text>
                )}

                {/* Add Comment */}
                <View style={themedStyles.postHeader}>
                  <View style={themedStyles.avatar}>
                    <FontAwesome5 name="user" size={14} color={colors.accent} />
                  </View>
                  <TextInput
                    style={themedStyles.postInput}
                    placeholder="Write a comment..."
                    placeholderTextColor={colors.textMuted}
                    value={newComment[post.id] || ''}
                    onChangeText={(text) => setNewComment(prev => ({ ...prev, [post.id]: text }))}
                  />
                  <TouchableOpacity
                    style={themedStyles.menuButton}
                    onPress={() => handleCreateComment(post.id)}
                    disabled={!newComment[post.id]?.trim()}
                  >
                    <FontAwesome5 name="paper-plane" size={16} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={themedStyles.container}>
        <View style={themedStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={themedStyles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={themedStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={themedStyles.container}>
        <ScrollView 
          style={themedStyles.feedContent}
          contentContainerStyle={themedStyles.feedList}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={themedStyles.header}>
            <Text style={themedStyles.headerTitle}>Home</Text>
            <TouchableOpacity style={themedStyles.menuButton}>
              <FontAwesome5 name="feather" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Post Composer */}
          {userId && (
            <View style={themedStyles.postCreator}>
              <View style={themedStyles.avatar}>
                <FontAwesome5 name="user" size={20} color={colors.accent} />
              </View>
              <View style={themedStyles.userDetails}>
                <TextInput
                  style={themedStyles.postInput}
                  placeholder="What's happening?"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={postContent}
                  onChangeText={setPostContent}
                  maxLength={280}
                />
                <View style={themedStyles.modalActions}>
                  <TouchableOpacity style={themedStyles.attachButton}>
                    <FontAwesome5 name="image" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={themedStyles.attachButton}>
                    <FontAwesome5 name="gift" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[themedStyles.postButton, !postContent.trim() && { opacity: 0.5 }]}
                    onPress={handleCreatePost}
                    disabled={!postContent.trim()}
                  >
                    <Text style={themedStyles.postButtonText}>Post</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Posts */}
          {posts.length > 0 ? (
            posts.map(post => renderPost(post))
          ) : (
            <View style={themedStyles.emptyContainer}>
              <FontAwesome5 name="newspaper" size={48} color={colors.textMuted} />
              <Text style={themedStyles.emptyText}>No posts yet</Text>
              <Text style={themedStyles.emptySubtext}>Be the first to share something!</Text>
            </View>
          )}

          {/* Bottom padding for nav */}
          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(null)}
      >
        <View style={themedStyles.modalContainer}>
          <View style={themedStyles.modalContent}>
            <Text style={themedStyles.modalTitle}>Delete Post?</Text>
            <Text style={themedStyles.postContent}>
              This action cannot be undone.
            </Text>
            <View style={themedStyles.modalActions}>
              <TouchableOpacity
                style={themedStyles.attachButton}
                onPress={() => setShowDeleteModal(null)}
              >
                <Text style={themedStyles.actionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[themedStyles.postButton, { backgroundColor: colors.danger }]}
                onPress={() => handleDeletePost(showDeleteModal)}
              >
                <Text style={themedStyles.postButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};


export default FeedScreen;
