import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Animated, { FadeInDown, FadeOut, Layout } from 'react-native-reanimated';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { supabase } from '../services/supabaseClient';
import { AMETHYST_MINT_ADDRESS, RPC_URL, SMP_DECIMALS } from '../constants';
import { radius, space, Tap, Input, GradientButton, Toast, SectionHeader } from './ui';
import { useMangaTheme } from '../theme/theme';

const connection = new Connection(RPC_URL, 'confirmed');

const COMMENT_COOLDOWN = 60 * 1000;
const DAILY_REWARD_LIMIT = 10;
const MIN_COMMENT_LENGTH = 2;
const avatarColors = (colors) => [colors.primary, colors.sakura, colors.electric, colors.info, colors.mint, colors.gold];

const rewardFor = (bal) =>
  bal >= 5000000 ? 25 : bal >= 1000000 ? 20 : bal >= 500000 ? 17 : bal >= 250000 ? 15 : bal >= 100000 ? 12 : 10;

const displayName = (u = '') => (u.length > 15 ? `${u.slice(0, 2)}**${u.slice(-2)}` : u);

const timeAgo = (iso) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
};

const Avatar = ({ name = '?' }) => {
  const { colors, type } = useMangaTheme();
  const AVATAR_COLORS = avatarColors(colors);
  const c = AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c + '30', borderWidth: 1.5, borderColor: c, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
      <Text style={{ ...type.h3, color: c }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
};

const Comment = ({ comment, replies, depth = 0, ctx }) => {
  const { colors, type } = useMangaTheme();
  const { addReply, replyingTo, cancelReply, toggleReplies, showReplies, deleteComment, currentUserId } = ctx;
  const isOwner = comment.user_id === currentUserId;
  const isReplying = replyingTo === comment.id;
  const open = !!showReplies[comment.id];

  return (
    <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOut.duration(150)} layout={Layout.springify().damping(18)} style={{ marginBottom: space.md }}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: depth ? colors.surface : colors.surfaceHi,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: isReplying ? colors.primary : colors.line,
          padding: space.md,
        }}
      >
        <Avatar name={comment.username} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ ...type.bodyStrong, color: colors.primaryHi }} numberOfLines={1}>{displayName(comment.username)}</Text>
            <Text style={type.caption}>{timeAgo(comment.created_at)}</Text>
          </View>
          <Text style={{ ...type.body, color: '#fff', marginTop: 4 }}>{comment.content}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <Tap onPress={() => addReply(comment.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
              <Icon name="reply" size={11} color={isReplying ? colors.primary : colors.textMute} />
              <Text style={{ ...type.caption, marginLeft: 5, color: isReplying ? colors.primary : colors.textMute, fontWeight: '700' }}>
                {isReplying ? 'Replying…' : 'Reply'}
              </Text>
            </Tap>
            {isReplying ? (
              <Tap onPress={cancelReply} style={{ marginRight: 16 }}>
                <Text style={{ ...type.caption, fontWeight: '700' }}>Cancel</Text>
              </Tap>
            ) : null}
            {replies.length > 0 ? (
              <Tap onPress={() => toggleReplies(comment.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                <Icon name={open ? 'chevron-up' : 'chevron-down'} size={10} color={colors.textMute} />
                <Text style={{ ...type.caption, marginLeft: 5, fontWeight: '700' }}>
                  {open ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </Text>
              </Tap>
            ) : null}
            {isOwner ? (
              <Tap
                onPress={() => Alert.alert('Delete comment?', 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteComment(comment.id) },
                ])}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Icon name="trash" size={11} color={colors.danger} />
                <Text style={{ ...type.caption, marginLeft: 5, color: colors.danger, fontWeight: '700' }}>Delete</Text>
              </Tap>
            ) : null}
          </View>
        </View>
      </View>
      {open && replies.length > 0 ? (
        <View style={{ marginLeft: 22, marginTop: space.sm, paddingLeft: space.md, borderLeftWidth: 2, borderLeftColor: colors.line }}>
          {replies.map((r) => (
            <Comment key={r.id} comment={r} replies={r.replies || []} depth={depth + 1} ctx={ctx} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
};

/**
 * Generic threaded comments.
 *  table         – supabase table (manga_comments | manga_detail_comments)
 *  scope         – columns that scope the thread, e.g. { manga_id, chapter_id }
 *  notifyContext – extra columns for the reply notification row
 *  replyMessage  – (userName) => string
 */
const CommentThread = ({ table, scope, notifyContext = {}, replyMessage, isWalletConnected, activePublicKey }) => {
  const { colors, type } = useMangaTheme();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showReplies, setShowReplies] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [error, setError] = useState(null);
  const [lastCommentTime, setLastCommentTime] = useState(0);
  const [posting, setPosting] = useState(false);
  const [balance, setBalance] = useState(0);

  const scopeKey = JSON.stringify(scope);
  const flash = (msg) => {
    setError(msg);
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
      let b = 0;
      if (ataInfo) {
        const ata = unpackAccount(ataAddress, ataInfo);
        b = Number(ata.amount) / 10 ** SMP_DECIMALS;
      }
      setBalance(b);
    } catch (e) {
      console.error('Error fetching Amethyst balance:', e);
      setBalance(0);
    }
  };

  useEffect(() => {
    if (!isWalletConnected || !activePublicKey) {
      setCurrentUserId(null);
      setBalance(0);
      return;
    }
    (async () => {
      try {
        const { data: user, error: err } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', activePublicKey.toString())
          .single();
        if (err || !user) throw new Error('User not found');
        setCurrentUserId(user.id);
        await fetchAmethystBalance();
      } catch (e) {
        console.error('Error fetching user ID:', e);
        flash('Failed to fetch user data.');
      }
    })();
  }, [isWalletConnected, activePublicKey]);

  const applyScope = (q) => Object.entries(scope).reduce((acc, [k, v]) => acc.eq(k, v), q);

  const fetchComments = async () => {
    try {
      const { data, error: err } = await applyScope(supabase.from(table).select('*')).order('created_at', { ascending: false });
      if (err) throw err;
      setComments(data || []);
    } catch (e) {
      console.error('Error fetching comments:', e);
      flash('Failed to load comments.');
    }
  };

  useEffect(() => {
    fetchComments();
    // Realtime filters accept ONE condition, so subscribe on manga_id and refetch (RLS/scope handled in the query).
    const channelName = `${table}:${scopeKey}`;
    const topic = `realtime:${channelName}`;
    supabase
      .getChannels()
      .filter((c) => c.topic === topic || c.topic === channelName)
      .forEach((c) => supabase.removeChannel(c));
    let channel;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `manga_id=eq.${scope.manga_id}` },
          fetchComments
        )
        .subscribe();
    } catch (err) {
      console.warn('[CommentThread] realtime subscribe failed:', err?.message);
      return undefined;
    }
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, scopeKey]);

  const deleteComment = async (commentId) => {
    try {
      const { error: err } = await supabase.from(table).delete().eq('id', commentId).eq('user_id', currentUserId);
      if (err) throw err;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      console.error('Error deleting comment:', e);
      flash('Failed to delete comment.');
    }
  };

  const handleCommentSubmit = async () => {
    if (!isWalletConnected || !activePublicKey) {
      flash('Please connect your wallet to post a comment.');
      return;
    }
    if (!newComment.trim() || newComment.trim().length < MIN_COMMENT_LENGTH) {
      Alert.alert('Too short', `Comment must be at least ${MIN_COMMENT_LENGTH} characters long.`);
      return;
    }
    const now = Date.now();
    if (now - lastCommentTime < COMMENT_COOLDOWN) {
      Alert.alert('Slow down', `Please wait ${Math.ceil((COMMENT_COOLDOWN - (now - lastCommentTime)) / 1000)}s before posting again.`);
      return;
    }

    setPosting(true);
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, weekly_points, wallet_address')
        .eq('wallet_address', activePublicKey.toString())
        .single();
      if (userError || !user) throw new Error('User not found');

      const today = new Date().setHours(0, 0, 0, 0);
      const { data: rewardedToday } = await supabase
        .from(table)
        .select('id')
        .eq('user_id', user.id)
        .eq('is_rewarded', true)
        .gte('created_at', new Date(today).toISOString());

      const hasReachedDailyLimit = (rewardedToday || []).length >= DAILY_REWARD_LIMIT;
      const rewardAmount = rewardFor(balance);
      const addr = activePublicKey.toString();

      const { error: commentError } = await supabase
        .from(table)
        .insert([
          {
            ...scope,
            user_id: user.id,
            username: user.name || `${addr.slice(0, 6)}...${addr.slice(-4)}`,
            content: newComment.trim(),
            parent_id: replyingTo || null,
            is_rewarded: !hasReachedDailyLimit,
          },
        ]);
      if (commentError) throw commentError;

      if (replyingTo) {
        const { data: parentComment } = await supabase.from(table).select('user_id').eq('id', replyingTo).single();
        if (parentComment?.user_id && parentComment.user_id !== user.id) {
          await supabase.from('notifications').insert([
            {
              user_id: parentComment.user_id,
              ...notifyContext,
              message: replyMessage(user.name || 'A user'),
              type: 'reply',
            },
          ]);
        }
      }

      if (!hasReachedDailyLimit) {
        await Promise.all([
          supabase.from('users').update({ weekly_points: user.weekly_points + rewardAmount }).eq('id', user.id),
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
      fetchComments();
    } catch (e) {
      console.error('Error submitting comment:', e);
      flash('Failed to submit comment.');
    } finally {
      setPosting(false);
    }
  };

  const addReply = (parentId) => {
    if (!isWalletConnected || !activePublicKey) {
      flash('Please connect your wallet to reply.');
      return;
    }
    setReplyingTo(parentId);
  };

  const thread = useMemo(() => {
    const map = {};
    comments.forEach((c) => (map[c.id] = { ...c, replies: [] }));
    const roots = [];
    comments.forEach((c) => {
      if (c.parent_id) map[c.parent_id]?.replies.push(map[c.id]);
      else roots.push(map[c.id]);
    });
    roots.forEach((r) => r.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    return roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [comments]);

  const ctx = {
    addReply,
    replyingTo,
    cancelReply: () => setReplyingTo(null),
    toggleReplies: (id) => setShowReplies((p) => ({ ...p, [id]: !p[id] })),
    showReplies,
    deleteComment,
    currentUserId,
  };

  const canPost = isWalletConnected && newComment.trim().length >= MIN_COMMENT_LENGTH;

  return (
    <View style={{ padding: space.lg }}>
      <SectionHeader title={`Comments${comments.length ? ` · ${comments.length}` : ''}`} icon="comments" accent={colors.sakura} />
      <Toast message={error} type="error" style={{ marginHorizontal: 0 }} />

      {!isWalletConnected ? (
        <View style={{ alignItems: 'center', padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.line, marginBottom: space.lg }}>
          <Icon name="lock" size={18} color={colors.textMute} solid />
          <Text style={{ ...type.body, marginTop: 8, textAlign: 'center' }}>Connect your wallet to join the conversation.</Text>
        </View>
      ) : (
        <View style={{ marginBottom: space.lg }}>
          {replyingTo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Icon name="reply" size={11} color={colors.primary} />
              <Text style={{ ...type.caption, color: colors.primary, marginLeft: 6, fontWeight: '700' }}>Replying to a comment</Text>
              <Tap onPress={() => setReplyingTo(null)} style={{ marginLeft: 'auto' }}>
                <Text style={{ ...type.caption, fontWeight: '700' }}>Cancel</Text>
              </Tap>
            </View>
          ) : null}
          <Input
            multiline
            value={newComment}
            onChangeText={setNewComment}
            placeholder={replyingTo ? 'Write your reply…' : 'Share your thoughts…'}
            maxLength={500}
            accessibilityLabel="Comment input"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Icon name="star" size={10} color={colors.gold} solid />
              <Text style={{ ...type.caption, marginLeft: 5 }}>+{rewardFor(balance)} pts · {DAILY_REWARD_LIMIT}/day</Text>
            </View>
            <GradientButton
              full={false}
              size="sm"
              icon="paper-plane"
              label={replyingTo ? 'Reply' : 'Post'}
              onPress={handleCommentSubmit}
              disabled={!canPost}
              loading={posting}
            />
          </View>
        </View>
      )}

      {thread.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <Icon name="comment-dots" size={26} color={colors.textFaint} />
          <Text style={{ ...type.body, marginTop: 8 }}>No comments yet. Be the first!</Text>
        </View>
      ) : (
        thread.map((c) => <Comment key={c.id} comment={c} replies={c.replies} ctx={ctx} />)
      )}
    </View>
  );
};

export default CommentThread;
