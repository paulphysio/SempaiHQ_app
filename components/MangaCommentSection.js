import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { supabase } from '../services/supabaseClient';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Animated, { FadeIn } from 'react-native-reanimated';
import { styles } from '../styles/MangaCommentSectionStyles';
import { AMETHYST_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../constants';

const connection = new Connection(RPC_URL, 'confirmed');

const Comment = ({
  comment,
  replies,
  addReply,
  replyingTo,
  cancelReply,
  toggleReplies,
  showReplies,
  deleteComment,
  currentUserId,
}) => {
  const isOwner = comment.user_id === currentUserId;

  return (
    <Animated.View entering={FadeIn} style={styles.comment}>
      <View style={styles.commentHeader}>
        <Text style={styles.commentUsername}>
          {comment.username.length > 15
            ? `${comment.username.slice(0, 2)}**${comment.username.slice(-2)}`
            : comment.username}
        </Text>
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
          style={[styles.actionButton, replyingTo === comment.id ? styles.activeButton : null]}
          onPress={() => addReply(comment.id)}
        >
          <Icon name="reply" size={14} color="#FFFFFF" style={styles.actionIcon} />
          <Text style={styles.actionText}>
            {replyingTo === comment.id ? 'Replying' : 'Reply'}
          </Text>
        </TouchableOpacity>
        {replyingTo === comment.id && (
          <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={cancelReply}>
            <Icon name="times" size={14} color="#FFFFFF" style={styles.actionIcon} />
            <Text style={styles.actionText}>Cancel</Text>
          </TouchableOpacity>
        )}
        {replies.length > 0 && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleReplies(comment.id)}
          >
            <Icon
              name={showReplies[comment.id] ? 'eye-slash' : 'eye'}
              size={14}
              color="#FFFFFF"
              style={styles.actionIcon}
            />
            <Text style={styles.actionText}>
              {showReplies[comment.id] ? 'Hide' : 'Show'} ({replies.length})
            </Text>
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteComment(comment.id)}
          >
            <Icon name="trash" size={14} color="#FFFFFF" style={styles.actionIcon} />
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
      {showReplies[comment.id] && replies.length > 0 && (
        <View style={styles.replies}>
          {replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              replies={reply.replies || []}
              addReply={addReply}
              replyingTo={replyingTo}
              cancelReply={cancelReply}
              toggleReplies={toggleReplies}
              showReplies={showReplies}
              deleteComment={deleteComment}
              currentUserId={currentUserId}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
};

const MangaCommentSection = ({ mangaId, chapterId, isWalletConnected, activePublicKey }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showReplies, setShowReplies] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [error, setError] = useState(null);
  const [lastCommentTime, setLastCommentTime] = useState(0);
  const [rewardedCountToday, setRewardedCountToday] = useState(0);
  const [balance, setBalance] = useState(0);
  const COMMENT_COOLDOWN = 60 * 1000; // 1 minute
  const DAILY_REWARD_LIMIT = 10;
  const MIN_COMMENT_LENGTH = 2;

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
        if (error || !user) {
          throw new Error('User not found');
        }
        setCurrentUserId(user.id);
        await fetchAmethystBalance();
      } catch (error) {
        console.error('Error fetching user ID:', error);
        setError('Failed to fetch user data.');
        setTimeout(() => setError(null), 5000);
      }
    };
    fetchUserId();
  }, [isWalletConnected, activePublicKey]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('manga_comments')
        .select('*')
        .eq('manga_id', mangaId)
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to load comments.');
      setTimeout(() => setError(null), 5000);
    }
  };

  useEffect(() => {
    fetchComments();
    const subscription = supabase
      .channel('manga_comments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'manga_comments',
          filter: `manga_id=eq.${mangaId},chapter_id=eq.${chapterId}`,
        },
        fetchComments
      )
      .subscribe();
    return () => supabase.removeChannel(subscription);
  }, [mangaId, chapterId]);

  const deleteComment = async (commentId) => {
    try {
      const { error } = await supabase
        .from('manga_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUserId);
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCommentSubmit = async () => {
    if (!isWalletConnected || !activePublicKey) {
      setError('Please connect your wallet to post a comment.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (!newComment.trim() || newComment.length < MIN_COMMENT_LENGTH) {
      Alert.alert('Error', `Comment must be at least ${MIN_COMMENT_LENGTH} characters long.`);
      return;
    }

    const now = Date.now();
    if (now - lastCommentTime < COMMENT_COOLDOWN) {
      Alert.alert(
        'Cooldown',
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
        .from('manga_comments')
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

      const { data: insertedComment, error: commentError } = await supabase
        .from('manga_comments')
        .insert([
          {
            manga_id: mangaId,
            chapter_id: chapterId,
            user_id: user.id,
            username: user.name || activePublicKey.toString().slice(0, 6) + '...' + activePublicKey.toString().slice(-4),
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
          .from('manga_comments')
          .select('user_id')
          .eq('id', replyingTo)
          .single();
        if (parentComment?.user_id && parentComment.user_id !== user.id) {
          await supabase.from('notifications').insert([
            {
              user_id: parentComment.user_id,
              manga_id: mangaId,
              chapter_id: chapterId,
              message: `${user.name || 'A user'} replied to your comment.`,
              type: 'reply',
            },
          ]);
        }
      }

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
              event_details: 'manga_comment_reward',
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
      console.error('Error submitting comment:', error);
      setError('Failed to submit comment.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const addReply = (parentId) => {
    if (!isWalletConnected || !activePublicKey) {
      setError('Please connect your wallet to reply.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    setReplyingTo(parentId);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const toggleReplies = (parentId) => {
    setShowReplies((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const buildThread = (comments) => {
    const map = {};
    comments.forEach((c) => (map[c.id] = { ...c, replies: [] }));
    const roots = [];

    comments.forEach((c) => {
      if (c.parent_id) map[c.parent_id]?.replies.push(map[c.id]);
      else roots.push(map[c.id]);
    });

    return roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  return (
    <View style={styles.commentSection}>
      <Text style={styles.title}>
        <Icon name="comment" size={18} color="#F36316" style={styles.titleIcon} /> Comments
      </Text>
      {error && (
        <Animated.View entering={FadeIn} style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}
      {!isWalletConnected ? (
        <Text style={styles.connectPrompt}>Please connect your wallet to comment.</Text>
      ) : (
        <>
          <TextInput
            style={styles.textarea}
            value={newComment}
            onChangeText={setNewComment}
            placeholder={replyingTo ? 'Type your reply...' : 'Add your comment...'}
            placeholderTextColor="#888"
            multiline
            disabled={!isWalletConnected}
          />
          <TouchableOpacity
            style={[styles.postButton, !newComment.trim() || !isWalletConnected ? styles.disabledButton : null]}
            onPress={handleCommentSubmit}
            disabled={!isWalletConnected || !newComment.trim()}
          >
            <Icon name="comment" size={14} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.postButtonText}>
              {replyingTo ? 'Post Reply' : 'Post Comment'}
            </Text>
          </TouchableOpacity>
        </>
      )}
      <FlatList
        data={buildThread(comments)}
        renderItem={({ item }) => (
          <Comment
            comment={item}
            replies={item.replies}
            addReply={addReply}
            replyingTo={replyingTo}
            cancelReply={cancelReply}
            toggleReplies={toggleReplies}
            showReplies={showReplies}
            deleteComment={deleteComment}
            currentUserId={currentUserId}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        style={styles.commentsContainer}
      />
    </View>
  );
};

export default MangaCommentSection;