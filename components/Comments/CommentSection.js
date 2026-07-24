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
import { EmbeddedWalletContext } from '../../components/ConnectButtonEnhanced';
import { AMETHYST_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../../constants';

const connection = new Connection(RPC_URL, 'confirmed');

// Kaito Adventure Design System
const KA_COLORS = {
  bgPrimary: '#0c0c0c',
  bgCard: '#141210',
  bgElevated: '#1a1714',
  orangePrimary: '#cc5500',
  orangeBright: '#ff6b35',
  orangeSoft: '#e67e22',
  orangeDim: '#8b4513',
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
};

const styles = StyleSheet.create({
  commentSection: {
    padding: 16,
  },
  commentSectionContainer: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 8,
    padding: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: KA_COLORS.gold,
    fontSize: 20,
    
    marginLeft: 8,
    letterSpacing: 1,
  },
  errorMessage: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.error,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  errorMessageText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    flex: 1,
  },
  clearErrorButton: {
    padding: 8,
  },
  connectPrompt: {
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
  },
  connectPromptText: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  connectButton: {
    backgroundColor: KA_COLORS.orangePrimary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  connectButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 16,
  },
  textarea: {
    backgroundColor: KA_COLORS.bgElevated,
    color: KA_COLORS.ivory,
    fontSize: 14,
    padding: 12,
    borderRadius: 4,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: KA_COLORS.border,
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
    color: KA_COLORS.textMuted,
    fontSize: 12,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KA_COLORS.orangePrimary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  postButtonDisabled: {
    backgroundColor: KA_COLORS.orangeDim,
    opacity: 0.5,
  },
  postButtonText: {
    color: KA_COLORS.ivory,
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
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
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
    color: KA_COLORS.orangePrimary,
    fontSize: 14,
    
  },
  commentTimestamp: {
    color: KA_COLORS.textMuted,
    fontSize: 12,
  },
  commentContent: {
    marginBottom: 8,
  },
  commentText: {
    color: KA_COLORS.ivory,
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
    color: KA_COLORS.ivory,
    fontSize: 12,
    marginLeft: 4,
  },
  replyInputContainer: {
    marginTop: 12,
    marginLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: KA_COLORS.orangePrimary,
    paddingLeft: 12,
  },
  replyInput: {
    backgroundColor: KA_COLORS.bgElevated,
    color: KA_COLORS.ivory,
    fontSize: 14,
    padding: 10,
    borderRadius: 4,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: KA_COLORS.border,
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
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    marginRight: 8,
  },
  postReplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KA_COLORS.orangePrimary,
    padding: 8,
    borderRadius: 4,
  },
  postReplyButtonDisabled: {
    backgroundColor: KA_COLORS.orangeDim,
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
    color: KA_COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 16,
  },
});

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
  chapter,
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
        placeholderTextColor={KA_COLORS.textMuted}
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
            <FontAwesome5 name="times" size={16} color={KA_COLORS.ivory} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.postReplyButton, !newComment && styles.postReplyButtonDisabled]}
            onPress={handleCommentSubmit}
            disabled={!newComment}
          >
            <FontAwesome5 name="paper-plane" size={16} color={KA_COLORS.ivory} />
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
              color={replyingTo === comment.id ? KA_COLORS.orangePrimary : KA_COLORS.ivory}
            />
            <Text style={styles.actionButtonText}>{replyingTo === comment.id ? 'Replying' : 'Reply'}</Text>
          </TouchableOpacity>
          {replies.length > 0 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => toggleRepliesVisibility(comment.id)}
            >
              <FontAwesome5
                name={areRepliesVisible[comment.id] ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={KA_COLORS.ivory}
              />
              <Text style={styles.actionButtonText}>({replies.length})</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => deleteComment(comment.id)}
            >
              <FontAwesome5 name="trash" size={16} color={KA_COLORS.error} />
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
                chapter={chapter}
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

const CommentSection = ({ novelId, chapter }) => {
  const { wallet } = useContext(EmbeddedWalletContext);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [areRepliesVisible, setAreRepliesVisible] = useState({});
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [lastCommentTime, setLastCommentTime] = useState(0);
  const [rewardedCountToday, setRewardedCountToday] = useState(0);
  const [balance, setBalance] = useState(0);
  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey ? new PublicKey(wallet.publicKey) : null;
  const COMMENT_COOLDOWN = 60 * 1000;
  const DAILY_REWARD_LIMIT = 10;
  const MIN_COMMENT_LENGTH = 2;

  const setTemporaryError = (message) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  };

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
      setTemporaryError('Failed to fetch balance.');
      setBalance(0);
    }
  };

  useEffect(() => {
    if (!isWalletConnected || !activePublicKey) {
      setCurrentUserId(null);
      setBalance(0);
      return;
    }

    const fetchUserId = async () => {
      try {
        const { data: user, error } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', activePublicKey.toString())
          .single();
        if (error) throw error;
        setCurrentUserId(user.id);
        await fetchAmethystBalance();
      } catch (err) {
        console.error('Fetch user error:', err);
        setTemporaryError('Failed to load user data.');
      }
    };
    fetchUserId();
  }, [activePublicKey, isWalletConnected]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          novel_id,
          chapter,
          user_id,
          username,
          content,
          created_at,
          parent_id,
          users:users(id, name)
        `)
        .eq('novel_id', novelId)
        .eq('chapter', chapter)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const enrichedComments = data.map((comment) => ({
        ...comment,
        username: comment.username || comment.users?.name || 'Anonymous',
        replies: comment.replies || [],
      }));
      setComments(enrichedComments);
    } catch (err) {
      console.error('Fetch comments error:', err);
      setTemporaryError('Failed to load comments.');
    }
  };

  useEffect(() => {
    fetchComments();
    const channelName = `comments-${novelId}-${chapter}`;
    const existing = supabase.getChannels().find((c) => c.topic === channelName);
    if (existing) {
      supabase.removeChannel(existing);
    }
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `novel_id=eq.${novelId},chapter=eq.${chapter}`,
        },
        fetchComments
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [novelId, chapter]);

  const deleteComment = async (commentId) => {
    if (!currentUserId) {
      setTemporaryError('You must be logged in to delete comments.');
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
    } catch (err) {
      console.error('[deleteComment] Error:', err);
      setTemporaryError('Failed to delete comment.');
    }
  };

  const handleCommentSubmit = async () => {
    if (!isWalletConnected || !activePublicKey) {
      setTemporaryError('You must connect a wallet to comment.');
      return;
    }
    if (!newComment.trim() || newComment.length < MIN_COMMENT_LENGTH) {
      setTemporaryError(`Comment must be at least ${MIN_COMMENT_LENGTH} characters long.`);
      return;
    }
    const now = Date.now();
    if (now - lastCommentTime < COMMENT_COOLDOWN) {
      setTemporaryError(
        `Please wait ${(COMMENT_COOLDOWN - (now - lastCommentTime)) / 1000} seconds before posting again.`
      );
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
      const { data: rewardedToday } = await supabase
        .from('comments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_rewarded', true)
        .gte('created_at', new Date(today).toISOString());

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
        user.name || activePublicKey.toString().slice(0, 6) + '...' + activePublicKey.toString().slice(-4);
      const { data: comment, error: commentError } = await supabase
        .from('comments')
        .insert([
          {
            novel_id: novelId,
            chapter,
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

      if (replyingTo) {
        const { data: parentComment } = await supabase
          .from('comments')
          .select('user_id')
          .eq('id', replyingTo)
          .single();
        if (parentComment && parentComment.user_id !== user.id) {
          await supabase.from('notifications').insert([
            {
              user_id: parentComment.user_id,
              novel_id: novelId,
              chapter,
              message: `${username} replied to your comment.`,
              type: 'reply',
            },
          ]);
        }
      }

      setNewComment('');
      setReplyingTo(null);
      setLastCommentTime(now);
      setRewardedCountToday(rewardedToday.length + 1);
      fetchComments();
    } catch (err) {
      console.error('[handleCommentSubmit] Error:', err);
      setTemporaryError('Failed to post comment.');
    }
  };

  const addReply = (parentId) => {
    setReplyingTo(parentId);
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
          <FontAwesome5 name="comment" size={20} color={KA_COLORS.gold} />
          <Text style={styles.title}>Comments</Text>
        </View>
        {error && (
          <View style={styles.errorMessage}>
            <Text style={styles.errorMessageText}>{error}</Text>
            <TouchableOpacity
              style={styles.clearErrorButton}
              onPress={() => setError(null)}
            >
              <FontAwesome5 name="times" size={16} color={KA_COLORS.ivory} />
            </TouchableOpacity>
          </View>
        )}
        {!isWalletConnected && (
          <View style={styles.connectPrompt}>
            <Text style={styles.connectPromptText}>Connect your wallet to comment.</Text>
            <TouchableOpacity style={styles.connectButton}>
              <Text style={styles.connectButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.textarea, !isWalletConnected && styles.textareaDisabled]}
            value={newComment}
            onChangeText={setNewComment}
            placeholder={replyingTo ? 'Type your reply...' : 'Add your comment...'}
            placeholderTextColor={KA_COLORS.textMuted}
            multiline
            editable={isWalletConnected}
            maxLength={500}
          />
          <View style={styles.inputFooter}>
            <Text style={styles.charCounter}>{newComment.length}/500</Text>
            <TouchableOpacity
              style={[styles.postButton, (!isWalletConnected || !newComment) && styles.postButtonDisabled]}
              onPress={handleCommentSubmit}
              disabled={!isWalletConnected || !newComment}
            >
              <FontAwesome5 name="paper-plane" size={16} color={KA_COLORS.ivory} />
              <Text style={styles.postButtonText}>{replyingTo ? 'Post Reply' : 'Post Comment'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.commentsContainer}>
          {buildThread(comments).length === 0 ? (
            <Text style={styles.noComments}>No comments yet. Be the first!</Text>
          ) : (
            buildThread(comments).map((comment) => (
              <Comment
                key={`comment-${comment.id}`}
                comment={comment}
                replies={comment.replies}
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
                chapter={chapter}
              />
            ))
          )}
        </View>
      </View>
    </View>
  );
};

export default React.memo(CommentSection);
