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
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

const API_BASE_URL = 'https://sempaihq.com/api';

const FeedScreen = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  
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
      <View key={post.id} style={styles.postCard}>
        <View style={styles.postContent}>
          {/* Avatar */}
          <View style={styles.avatar}>
            <FontAwesome5 name="user" size={20} color="#D94F04" />
          </View>

          {/* Post Body */}
          <View style={styles.postBody}>
            {/* Header */}
            <View style={styles.postHeader}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {post.user?.name || post.users?.name || 'Anonymous'}
                </Text>
                <Text style={styles.userHandle}>
                  @{(post.user?.name || post.users?.name || 'user').toLowerCase().replace(/\s/g, '')}
                </Text>
                <Text style={styles.postTime}>· {formatTimeAgo(post.created_at)}</Text>
              </View>
              
              {isOwnPost && (
                <TouchableOpacity 
                  style={styles.moreButton}
                  onPress={() => setShowDeleteModal(post.id)}
                >
                  <MaterialIcons name="more-horiz" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {/* Content */}
            {editingPost === post.id ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                  autoFocus
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setEditingPost(null);
                      setEditContent('');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleEditPost}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.postText}>{post.content}</Text>
            )}

            {/* Image */}
            {post.image_url && (
              <Image source={{ uri: post.image_url }} style={styles.postImage} />
            )}

            {/* Actions */}
            <View style={styles.postActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => toggleComments(post.id)}
              >
                <FontAwesome5 
                  name="comment" 
                  size={16} 
                  color={isExpanded ? '#D94F04' : '#666'} 
                />
                <Text style={[styles.actionText, isExpanded && styles.actionTextActive]}>
                  {post.comments_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleResharePost(post.id)}
              >
                <FontAwesome5 
                  name="retweet" 
                  size={16} 
                  color={resharedPosts[post.id] ? '#D94F04' : '#666'} 
                />
                <Text style={[styles.actionText, resharedPosts[post.id] && styles.actionTextActive]}>
                  {post.shares_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleLikePost(post.id)}
              >
                <FontAwesome5 
                  name="heart" 
                  size={16} 
                  color={likedPosts[post.id] ? '#D94F04' : '#666'} 
                />
                <Text style={[styles.actionText, likedPosts[post.id] && styles.actionTextActive]}>
                  {post.likes_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <FontAwesome5 name="share-alt" size={16} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Comments Section */}
            {isExpanded && (
              <View style={styles.commentsSection}>
                {postComments.length > 0 ? (
                  postComments.map(comment => (
                    <View key={comment.id} style={styles.comment}>
                      <View style={styles.commentAvatar}>
                        <FontAwesome5 name="user" size={14} color="#D94F04" />
                      </View>
                      <View style={styles.commentBody}>
                        <View style={styles.commentHeader}>
                          <Text style={styles.commentUserName}>
                            {comment.users?.name || 'Anonymous'}
                          </Text>
                          <Text style={styles.commentTime}>
                            · {formatTimeAgo(comment.created_at)}
                          </Text>
                        </View>
                        <Text style={styles.commentText}>{comment.content}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noComments}>No comments yet</Text>
                )}

                {/* Add Comment */}
                <View style={styles.addComment}>
                  <View style={styles.commentInputAvatar}>
                    <FontAwesome5 name="user" size={14} color="#D94F04" />
                  </View>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment..."
                    placeholderTextColor="#666"
                    value={newComment[post.id] || ''}
                    onChangeText={(text) => setNewComment(prev => ({ ...prev, [post.id]: text }))}
                  />
                  <TouchableOpacity
                    style={styles.commentButton}
                    onPress={() => handleCreateComment(post.id)}
                    disabled={!newComment[post.id]?.trim()}
                  >
                    <FontAwesome5 name="paper-plane" size={16} color="#D94F04" />
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
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#D94F04" />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Home</Text>
            <TouchableOpacity style={styles.headerButton}>
              <FontAwesome5 name="feather" size={20} color="#D94F04" />
            </TouchableOpacity>
          </View>

          {/* Post Composer */}
          {userId && (
            <View style={styles.composer}>
              <View style={styles.composerAvatar}>
                <FontAwesome5 name="user" size={20} color="#D94F04" />
              </View>
              <View style={styles.composerBody}>
                <TextInput
                  style={styles.composerInput}
                  placeholder="What's happening?"
                  placeholderTextColor="#666"
                  multiline
                  value={postContent}
                  onChangeText={setPostContent}
                  maxLength={280}
                />
                <View style={styles.composerActions}>
                  <TouchableOpacity style={styles.composerActionButton}>
                    <FontAwesome5 name="image" size={18} color="#D94F04" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.composerActionButton}>
                    <FontAwesome5 name="gift" size={18} color="#D94F04" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.postButton, !postContent.trim() && styles.postButtonDisabled]}
                    onPress={handleCreatePost}
                    disabled={!postContent.trim()}
                  >
                    <Text style={styles.postButtonText}>Post</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Posts */}
          {posts.length > 0 ? (
            posts.map(post => renderPost(post))
          ) : (
            <View style={styles.centerContainer}>
              <FontAwesome5 name="newspaper" size={48} color="#666" />
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Be the first to share something!</Text>
            </View>
          )}

          {/* Bottom padding for nav */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Post?</Text>
            <Text style={styles.modalText}>
              This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDeleteModal(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={() => handleDeletePost(showDeleteModal)}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  bottomPadding: {
    height: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    color: '#666',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
     
  },
  headerButton: {
    padding: 8,
  },
  composer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  composerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D94F04',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  composerBody: {
    flex: 1,
  },
  composerInput: {
    color: '#fff',
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  composerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  composerActionButton: {
    padding: 8,
  },
  postButton: {
    backgroundColor: '#D94F04',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: '#2F3336',
  },
  postButtonText: {
    color: '#fff',
     
    fontSize: 14,
  },
  postCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  postContent: {
    flexDirection: 'row',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D94F04',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  postBody: {
    flex: 1,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userName: {
    color: '#fff',
     
    fontSize: 15,
    marginRight: 4,
  },
  userHandle: {
    color: '#666',
    fontSize: 14,
    marginRight: 4,
  },
  postTime: {
    color: '#666',
    fontSize: 14,
  },
  moreButton: {
    padding: 4,
  },
  postText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  editContainer: {
    marginBottom: 12,
  },
  editInput: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    minHeight: 60,
    marginBottom: 8,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#D94F04',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
     
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    color: '#666',
    fontSize: 13,
    marginLeft: 4,
  },
  actionTextActive: {
    color: '#D94F04',
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  comment: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D94F04',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentUserName: {
    color: '#fff',
     
    fontSize: 14,
    marginRight: 4,
  },
  commentTime: {
    color: '#666',
    fontSize: 12,
  },
  commentText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  noComments: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  addComment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D94F04',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 14,
  },
  commentButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginTop: 16,
     
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
     
    marginBottom: 8,
  },
  modalText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 14,
  },
  modalDeleteButton: {
    backgroundColor: '#F4212E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 14,
     
  },
});

export default FeedScreen;
