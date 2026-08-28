import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
  StyleSheet,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { EmbeddedWalletContext } from '../../components/ConnectButtonEnhanced';
import { useGoogleAuth } from '../../components/GoogleAuthProvider';
import { useTheme } from '../../context/ThemeContext';
import { AMETHYST_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../../constants';

const connection = new Connection(RPC_URL, 'confirmed');

const COLOR = {
  dark: {
    bgPrimary: '#0c0c0c',
    bgCard: '#141210',
    bgElevated: '#1a1714',
    accent: '#cc5500',
    accentBright: '#ff6b35',
    accentSoft: '#e67e22',
    accentDim: '#8b4513',
    gold: '#c9a84c',
    goldBright: '#ffd700',
    ivory: '#f5e6d3',
    ivoryDim: '#c4b5a0',
    border: '#2d2418',
    textPrimary: '#f5e6d3',
    textSecondary: '#a09080',
    textMuted: '#6b5d4f',
    success: '#4a7c59',
    error: '#c41e3a',
    warning: '#c9a84c',
  },
  light: {
    bgPrimary: '#FDFBD4',
    bgCard: '#ffffff',
    bgElevated: '#f5f5f5',
    accent: '#3b82f6',
    accentBright: '#2563eb',
    accentSoft: 'rgba(59, 130, 246, 0.1)',
    accentDim: '#1d4ed8',
    gold: '#f59e0b',
    goldBright: '#fbbf24',
    ivory: '#1e293b',
    ivoryDim: '#64748b',
    border: '#e2e8f0',
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
  },
};

const getCommentStyles = (isDark = true) => {
  const colors = isDark ? COLOR.dark : COLOR.light;

  return StyleSheet.create({
    commentSection: {
      padding: 16,
    },
    commentSectionContainer: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 16,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      color: colors.gold,
      fontSize: 20,
      marginLeft: 8,
      letterSpacing: 1,
    },
    errorMessage: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: 4,
      padding: 12,
      marginBottom: 16,
    },
    errorMessageText: {
      color: colors.ivory,
      fontSize: 14,
      flex: 1,
    },
    clearErrorButton: {
      padding: 8,
    },
    connectContainer: {
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 16,
      marginBottom: 16,
    },
    connectText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 12,
    },
    connectButton: {
      width: '100%',
    },
    inputContainer: {
      marginBottom: 16,
    },
    textarea: {
      backgroundColor: colors.bgElevated,
      color: colors.ivory,
      fontSize: 14,
      padding: 12,
      borderRadius: 4,
      minHeight: 80,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border,
    },
    textareaDisabled: {
      opacity: 0.5,
    },
    inputFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    charCounter: {
      color: colors.textMuted,
      fontSize: 12,
    },
    postButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accent,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 4,
    },
    postButtonDisabled: {
      backgroundColor: colors.accentDim,
      opacity: 0.5,
    },
    postButtonText: {
      color: colors.ivory,
      fontSize: 14,
      marginLeft: 8,
    },
    commentsContainer: {
      paddingBottom: 16,
    },
    comment: {
      marginBottom: 12,
    },
    commentCard: {
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 12,
    },
    commentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    commentUsername: {
      color: colors.accent,
      fontSize: 14,
    },
    commentTimestamp: {
      color: colors.textMuted,
      fontSize: 12,
    },
    commentContent: {
      marginBottom: 8,
    },
    commentText: {
      color: colors.ivory,
      fontSize: 14,
      lineHeight: 20,
    },
    commentActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      marginRight: 12,
    },
    actionButtonText: {
      color: colors.ivory,
      fontSize: 12,
      marginLeft: 4,
    },
    replyInputContainer: {
      marginTop: 12,
      marginLeft: 16,
      borderLeftWidth: 2,
      borderLeftColor: colors.accent,
      paddingLeft: 12,
    },
    replyInput: {
      backgroundColor: colors.bgElevated,
      color: colors.ivory,
      fontSize: 14,
      padding: 10,
      borderRadius: 4,
      minHeight: 60,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border,
    },
    replyActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    replyButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cancelReplyButton: {
      padding: 8,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      marginRight: 8,
    },
    postReplyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accent,
      padding: 8,
      borderRadius: 4,
    },
    postReplyButtonDisabled: {
      backgroundColor: colors.accentDim,
      opacity: 0.5,
    },
    replies: {
      marginLeft: 16,
      marginTop: 8,
    },
    repliesContainer: {
      paddingBottom: 8,
    },
    noComments: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginVertical: 16,
    },
  });
};

const formatUsername = (username) => {
  if (!username) return 'Anonymous';
  if (username.length > 15) return `${username.slice(0, 2)}**${username.slice(-2)}`;
  return username;
};

const Comment = ({
  comment,
  replies,
  addReply,
  replyingTo,
  cancelReply,
  toggleRepliesVisibility,
  areRepliesVisible,
  deleteComment,
  currentUserId,
  setNewComment,
  newComment,
  handleCommentSubmit,
  novelTitle,
  colors,
  styles,
}) => {
  const isOwner = comment.user_id === currentUserId;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const renderReplyInput = () => (
    <View style={styles.replyInputContainer}>
      <TextInput
        style={styles.replyInput}
        value={newComment}
        onChangeText={setNewComment}
        placeholder="Type your reply..."
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
      />
      <View style={styles.replyActions}>
        <Text style={styles.charCounter}>{newComment.length}/500</Text>
        <View style={styles.replyButtons}>
          <TouchableOpacity
            style={styles.cancelReplyButton}
            onPress={cancelReply}
          >
            <FontAwesome5 name="times" size={16} color={colors.ivory} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.postReplyButton, !newComment && styles.postReplyButtonDisabled]}
            onPress={handleCommentSubmit}
            disabled={!newComment}
          >
            <FontAwesome5 name="paper-plane" size={16} color={colors.ivory} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <Animated.View style={[styles.comment, { opacity: fadeAnim }]}>
      <View style={styles.commentCard}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{formatUsername(comment.username)}</Text>
          <Text style={styles.commentTimestamp}>
            {new Date(comment.created_at).toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Text>
        </View>
        <View style={styles.commentContent}>
          <Text style={styles.commentText}>{comment.content}</Text>
        </View>
        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => addReply(comment.id)}
          >
            <FontAwesome5
              name="reply"
              size={16}
              color={replyingTo === comment.id ? colors.accent : colors.ivory}
            />
          </TouchableOpacity>
          {replies.length > 0 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => toggleRepliesVisibility(comment.id)}
            >
              <FontAwesome5
                name={areRepliesVisible[comment.id] ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.ivory}
              />
              <Text style={styles.actionButtonText}>({replies.length})</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => deleteComment(comment.id)}
            >
              <FontAwesome5 name="trash" size={16} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {replyingTo === comment.id && renderReplyInput()}
      {areRepliesVisible[comment.id] && replies.length > 0 && (
        <View style={styles.replies}>
          <FlatList
            data={replies}
            renderItem={({ item }) => (
              <Comment
                comment={item}
                replies={item.replies || []}
                addReply={addReply}
                replyingTo={replyingTo}
                cancelReply={cancelReply}
                toggleRepliesVisibility={toggleRepliesVisibility}
                areRepliesVisible={areRepliesVisible}
                deleteComment={deleteComment}
                currentUserId={currentUserId}
                setNewComment={setNewComment}
                newComment={newComment}
                handleCommentSubmit={handleCommentSubmit}
                novelTitle={novelTitle}
                colors={colors}
                styles={styles}
              />
            )}
            keyExtractor={(item) => `reply-${item.id}`}
            contentContainerStyle={styles.repliesContainer}
          />
        </View>
      )}
    </Animated.View>
  );
};

const NovelCommentSection = ({ novelId, novelTitle = 'Unknown Novel' }) => {
  const { wallet } = useContext(EmbeddedWalletContext);
  const { isDark, colors } = useTheme();
  const styles = getCommentStyles(isDark);
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [areRepliesVisible, setAreRepliesVisible] = useState({});
  const [lastCommentTime, setLastCommentTime] = useState(0);
  const [rewardedCountToday, setRewardedCountToday] = useState(0);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [balance, setBalance] = useState(0);
  const COMMENT_COOLDOWN = 60 * 1000;
  const DAILY_REWARD_LIMIT = 10;
  const MIN_COMMENT_LENGTH = 2;
  const { session } = useGoogleAuth();

  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey ? new PublicKey(wallet.publicKey) : null;

  const fetchAmethystBalance = async () => {
    if (!isWalletConnected || !activePublicKey) {
      setBalance(0);
      return;
    }

    try {
      const mintAddress = new PublicKey(AMETHYST_MINT_ADDRESS);
      const ataAddress = getAssociatedTokenAddressSync(mintAddress, activePublicKey);
      const ataInfo = await connection.getAccountInfo(ataAddress);
      let balance = 0;
      if (ataInfo) {
        const ata = unpackAccount(ataAddress, ataInfo);
        balance = Number(ata.amount) / 10 ** SMP_DECIMALS;
      }
      setBalance(balance);
    } catch (error) {
      console.error('Error fetching Amethyst balance:', error);
      setBalance(0);
    }
  };

  useEffect(() => {
    if (!isWalletConnected || !activePublicKey) {
      setCurrentUserId(null);
      setBalance(0);
      return;
    }

    const fetchUserData = async () => {
      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', activePublicKey.toString())
          .single();

        if (userError) throw userError;
        setCurrentUserId(user.id);
        await fetchAmethystBalance();
      } catch (error) {
        console.error('Error fetching user data:', error.message);
        setError('Failed to load user data.');
        setTimeout(() => setError(null), 5000);
      }
    };

    fetchUserData();
  }, [activePublicKey, isWalletConnected]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          novel_id,
          user_id,
          username,
          content,
          created_at,
          parent_id,
          users:users(id, name)
        `)
        .eq('novel_id', novelId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedComments = data.map((comment) => ({
        ...comment,
        username: comment.username || comment.users?.name || 'Anonymous',
      }));

      setComments(enrichedComments);
    } catch (error) {
      console.error('Error fetching comments:', error.message);
      setError('Failed to load comments.');
      setTimeout(() => setError(null), 5000);
    }
  };

  useEffect(() => {
    fetchComments();

    // Disabled real-time subscription due to multiple subscription errors
    // Comments will be refreshed manually or on component remount
    // If real-time updates are needed, consider polling or a different approach
  }, [novelId]);

  const deleteComment = async (commentId) => {
    if (!currentUserId) {
      setError('You must be logged in to delete comments.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUserId);

      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error.message);
      setError('Failed to delete comment.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const sendNotification = async (receiverId, message, type = 'comment') => {
    if (!receiverId) return;

    try {
      const { error } = await supabase.from('notifications').insert([
        {
          user_id: receiverId,
          message,
          type,
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) console.error('Error inserting notification:', error.message);
    } catch (error) {
      console.error('Error sending notification:', error.message);
    }
  };

  const handleCommentSubmit = async () => {
    if (!isWalletConnected || !activePublicKey) {
      setError('You must connect a wallet to comment.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (!newComment || newComment.length < MIN_COMMENT_LENGTH) {
      setError(`Comment must be at least ${MIN_COMMENT_LENGTH} characters long.`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    const now = Date.now();
    if (now - lastCommentTime < COMMENT_COOLDOWN) {
      setError(
        `Please wait ${(COMMENT_COOLDOWN - (now - lastCommentTime)) / 1000} seconds before posting again.`
      );
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, weekly_points, wallet_address')
        .eq('wallet_address', activePublicKey.toString())
        .single();

      if (userError || !user) throw new Error('User not found');

      const today = new Date().setHours(0, 0, 0, 0);
      const { data: rewardedToday, error: rewardError } = await supabase
        .from('comments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_rewarded', true)
        .gte('created_at', new Date(today).toISOString());

      if (rewardError) throw rewardError;

      const hasReachedDailyLimit = rewardedToday.length >= DAILY_REWARD_LIMIT;
      const rewardAmount =
        balance >= 5000000
          ? 25
          : balance >= 1000000
          ? 20
          : balance >= 500000
          ? 17
          : balance >= 250000
          ? 15
          : balance >= 100000
          ? 12
          : 10;

      const username =
        user.name ||
        activePublicKey.toString().slice(0, 6) + '...' + activePublicKey.toString().slice(-4);

      const { data: insertedComment, error: commentError } = await supabase
        .from('comments')
        .insert([
          {
            novel_id: novelId,
            user_id: user.id,
            username,
            content: newComment,
            parent_id: replyingTo || null,
            is_rewarded: !hasReachedDailyLimit,
          },
        ])
        .select()
        .single();

      if (commentError) throw commentError;

      if (replyingTo) {
        const { data: parentComment } = await supabase
          .from('comments')
          .select('user_id')
          .eq('id', replyingTo)
          .single();
        if (parentComment?.user_id && parentComment.user_id !== user.id) {
          await sendNotification(
            parentComment.user_id,
            `${username} replied to your comment on "${novelTitle}".`,
            'reply'
          );
        }
      }

      await sendNotification(
        user.id,
        `Your comment on "${novelTitle || 'a novel'}" was posted successfully.`,
        'comment'
      );

      if (!hasReachedDailyLimit) {
        await Promise.all([
          supabase
            .from('users')
            .update({ weekly_points: user.weekly_points + rewardAmount })
            .eq('id', user.id),
          supabase.from('wallet_events').insert([
            {
              destination_user_id: user.id,
              event_type: 'credit',
              amount_change: rewardAmount,
              source_user_id: '6f859ff9-3557-473c-b8ca-f23fd9f7af27',
              destination_chain: 'SOL',
              source_currency: 'Token',
              event_details: 'comment_reward',
              wallet_address: user.wallet_address,
              source_chain: 'SOL',
            },
          ]),
        ]);
      }

      setNewComment('');
      setReplyingTo(null);
      setLastCommentTime(now);
      setRewardedCountToday(rewardedToday.length + 1);
      fetchComments();
    } catch (error) {
      console.error('Error submitting comment:', error.message);
      setError('Failed to post comment.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const addReply = (parentId) => {
    setReplyingTo(replyingTo === parentId ? null : parentId);
    setNewComment('');
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setNewComment('');
  };

  const toggleRepliesVisibility = (parentId) => {
    setAreRepliesVisible((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const buildThread = (comments) => {
    const map = {};
    comments.forEach((c) => (map[c.id] = { ...c, replies: [] }));
    const roots = [];

    comments.forEach((c) => {
      if (c.parent_id) map[c.parent_id]?.replies.push(map[c.id]);
      else roots.push(map[c.id]);
    });

    roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return roots;
  };

  return (
    <View style={styles.commentSection}>
      <View style={styles.commentSectionContainer}>
        <View style={styles.titleContainer}>
          <FontAwesome5 name="comment" size={20} color={colors.gold} />
          <Text style={styles.title}>Comments</Text>
        </View>
        {error && (
          <View style={styles.errorMessage}>
            <Text style={styles.errorMessageText}>{error}</Text>
            <TouchableOpacity
              style={styles.clearErrorButton}
              onPress={() => setError(null)}
            >
              <FontAwesome5 name="times" size={16} color={colors.ivory} />
            </TouchableOpacity>
          </View>
        )}
        {!session && (
          <View style={styles.connectContainer}>
            <Text style={styles.connectText}>Sign in to leave a comment</Text>
            <GoogleSignInButton style={styles.connectButton} />
          </View>
        )}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.textarea, !isWalletConnected && styles.textareaDisabled]}
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Add your comment..."
            placeholderTextColor={colors.textMuted}
            multiline
            editable={isWalletConnected}
            maxLength={500}
          />
          <View style={styles.inputFooter}>
            <Text style={styles.charCounter}>{newComment.length}/500</Text>
            <TouchableOpacity
              style={[styles.postButton, !isWalletConnected || !newComment && styles.postButtonDisabled]}
              onPress={handleCommentSubmit}
              disabled={!isWalletConnected || !newComment}
            >
              <FontAwesome5 name="paper-plane" size={16} color={colors.ivory} />
              <Text style={styles.postButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={buildThread(comments)}
          renderItem={({ item }) => (
            <Comment
              comment={item}
              replies={item.replies}
              addReply={addReply}
              replyingTo={replyingTo}
              cancelReply={cancelReply}
              toggleRepliesVisibility={toggleRepliesVisibility}
              areRepliesVisible={areRepliesVisible}
              deleteComment={deleteComment}
              currentUserId={currentUserId}
              setNewComment={setNewComment}
              newComment={newComment}
              handleCommentSubmit={handleCommentSubmit}
              novelTitle={novelTitle}
              colors={colors}
              styles={styles}
            />
          )}
          keyExtractor={(item) => `comment-${item.id}`}
          contentContainerStyle={styles.commentsContainer}
          ListEmptyComponent={
            <Text style={styles.noComments}>No comments yet. Be the first!</Text>
          }
        />
      </View>
    </View>
  );
};

export default NovelCommentSection;
