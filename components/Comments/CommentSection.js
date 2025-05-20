import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabaseClient';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { EmbeddedWalletContext } from '../../components/ConnectButton';
import { styles } from '../../styles/CommentSectionStyles';
import { AMETHYST_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../../constants';

const connection = new Connection(RPC_URL, 'confirmed');

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
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

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
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        multiline
        maxLength={500}
      />
      <View style={styles.replyActions}>
        <Text style={styles.charCounter}>{newComment.length}/500</Text>
        <View style={styles.replyButtons}>
          <TouchableOpacity
            style={styles.cancelReplyButton}
            onPress={cancelReply}
            accessibilityLabel="Cancel Reply"
          >
            <FontAwesome5 name="times" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.postReplyButton, !newComment && styles.postReplyButtonDisabled]}
            onPress={handleCommentSubmit}
            disabled={!newComment}
            accessibilityLabel="Post Reply"
          >
            <FontAwesome5 name="paper-plane" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <Animated.View style={[styles.comment, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#1A1A2E', '#0F0F1F']}
        style={styles.commentCard}
      >
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
            accessibilityLabel={replyingTo === comment.id ? 'Replying' : 'Reply'}
          >
            <FontAwesome5
              name="reply"
              size={16}
              color={replyingTo === comment.id ? '#F36316' : '#fff'}
            />
            <Text style={styles.actionButtonText}>{replyingTo === comment.id ? 'Replying' : 'Reply'}</Text>
          </TouchableOpacity>
          {replies.length > 0 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => toggleRepliesVisibility(comment.id)}
              accessibilityLabel={areRepliesVisible[comment.id] ? 'Hide Replies' : 'Show Replies'}
            >
              <FontAwesome5
                name={areRepliesVisible[comment.id] ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>({replies.length})</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => deleteComment(comment.id)}
              accessibilityLabel="Delete Comment"
            >
              <FontAwesome5 name="trash" size={16} color="#ff5555" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
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
      setError('Failed to fetch balance.');
      setTimeout(() => setError(null), 5000);
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
    const subscription = supabase
      .channel(`comments-${novelId}-${chapter}`)
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
    return () => supabase.removeChannel(subscription);
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
      console.error('Delete comment error:', err);
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
    if (now - lastCommentTime < COMMENT_COOLD | false) {
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
      console.error('Submit comment error:', err);
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
      <LinearGradient
        colors={['#1A1A2E', '#0F0F1F']}
        style={styles.commentSectionContainer}
      >
        <View style={styles.titleContainer}>
          <FontAwesome5 name="comment" size={20} color="#F36316" />
          <Text style={styles.title}>Comments</Text>
        </View>
        {error && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.errorMessage}>
            <Text style={styles.errorMessageText}>{error}</Text>
            <TouchableOpacity
              style={styles.clearErrorButton}
              onPress={() => setError(null)}
              accessibilityLabel="Clear error"
            >
              <FontAwesome5 name="times" size={16} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
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
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
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
              accessibilityLabel={replyingTo ? 'Post Reply' : 'Post Comment'}
            >
              <FontAwesome5 name="paper-plane" size={16} color="#fff" />
              <Text style={styles.postButtonText}>{replyingTo ? 'Post Reply' : 'Post Comment'}</Text>
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
              chapter={chapter}
            />
          )}
          keyExtractor={(item) => `comment-${item.id}`}
          contentContainerStyle={styles.commentsContainer}
          ListEmptyComponent={
            <Text style={styles.noComments}>No comments yet. Be the first!</Text>
          }
        />
      </LinearGradient>
    </View>
  );
};

export default CommentSection;