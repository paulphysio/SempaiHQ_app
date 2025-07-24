import React, { memo, useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  Animated,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native'; // Replaced useRouter and useLocalSearchParams
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import Modal from 'react-native-modal';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import { styles } from '../styles/ChatStyles';

const { width, height } = Dimensions.get('window');

const truncateName = (name) => {
  if (!name || name.length <= 10) return name;
  return `${name.slice(0, 3)}...${name.slice(-3)}`;
};

const Message = memo(
  ({ msg, walletAddress, onReply, isPrivate, onScrollToParent }) => {
    const isOwnMessage = isPrivate
      ? String(msg.sender_wallet).toLowerCase() === String(walletAddress).toLowerCase()
      : String(msg.wallet_address).toLowerCase() === String(walletAddress).toLowerCase();
    const isSuper = msg.is_superuser || (msg.is_writer && msg.is_artist);
    const showWriterBadge = msg.is_writer && !msg.is_artist && !msg.is_superuser;
    const showArtistBadge = msg.is_artist && !msg.is_writer && !msg.is_superuser;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownMessageBubble : null]}>
          <View style={styles.messageHeader}>
            {msg.profile_image ? (
              <Image source={{ uri: msg.profile_image }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
            <View style={styles.headerContent}>
              <View style={styles.nameContainer}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{truncateName(msg.name)}</Text>
                  {isSuper && (
                    <FontAwesome5
                      name="check-circle"
                      size={10}
                      color="#F28C38"
                      style={styles.badge}
                    />
                  )}
                  {showWriterBadge && (
                    <Image
                      source={require('../assets/writer-badge.png')}
                      style={styles.badgeImage}
                    />
                  )}
                  {showArtistBadge && (
                    <Image
                      source={require('../assets/artist-badge.png')}
                      style={styles.badgeImage}
                    />
                  )}
                </View>
              </View>
              {isPrivate && (
                <Text style={styles.messageStatus}>
                  {msg.status === 'sending'
                    ? '...'
                    : msg.status === 'read'
                    ? '✓✓'
                    : msg.status === 'delivered'
                    ? '✓'
                    : ''}
                </Text>
              )}
            </View>
          </View>
          {msg.parent_id && (
            <TouchableOpacity
              style={styles.replyPreview}
              onPress={() => onScrollToParent(msg.parent_id)}
            >
              <Text style={styles.replyName}>
                {truncateName(msg.parent_name) || 'Unknown'}
              </Text>
              <Text style={styles.replyContent}>
                {msg.parent_content
                  ? `${msg.parent_content.slice(0, 20)}${msg.parent_content.length > 20 ? '...' : ''}`
                  : 'No content'}
              </Text>
            </TouchableOpacity>
          )}
          {msg.content && <Text style={styles.messageText}>{msg.content}</Text>}
          {msg.media_url && <Image source={{ uri: msg.media_url }} style={styles.media} />}
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => onReply(msg.id)}
          >
            <FontAwesome5 name="reply" size={12} color="#F28C38" />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.msg.id === nextProps.msg.id &&
      prevProps.msg.content === nextProps.msg.content &&
      prevProps.msg.media_url === nextProps.msg.media_url &&
      prevProps.msg.status === nextProps.msg.status &&
      prevProps.msg.parent_id === nextProps.msg.parent_id &&
      prevProps.msg.parent_name === nextProps.msg.parent_name &&
      prevProps.msg.parent_content === nextProps.msg.parent_content &&
      prevProps.walletAddress === nextProps.walletAddress &&
      prevProps.isPrivate === nextProps.isPrivate &&
      prevProps.onReply === nextProps.onReply &&
      prevProps.onScrollToParent === nextProps.onScrollToParent
    );
  }
);

const ChatItem = memo(
  ({ item, activeChat, switchChat }) => (
    <TouchableOpacity
      style={[
        styles.chatItem,
        activeChat === item.wallet_address ? styles.activeChatItem : null,
      ]}
      onPress={() => switchChat(item.wallet_address)}
    >
      <View style={styles.chatItemContent}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.chatAvatar} />
        ) : (
          <View style={styles.chatAvatarPlaceholder} />
        )}
        <Text style={styles.chatItemText} numberOfLines={1}>
          {truncateName(item.name)}
        </Text>
      </View>
    </TouchableOpacity>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.item.wallet_address === nextProps.item.wallet_address &&
      prevProps.item.name === nextProps.item.name &&
      prevProps.item.image === nextProps.item.image &&
      prevProps.activeChat === nextProps.activeChat &&
      prevProps.switchChat === nextProps.switchChat
    );
  }
);

const GifPicker = ({ onSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const fetchGifs = useCallback(async (query) => {
    if (!query.trim()) {
      setGifs([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gifs')
        .select('id, title, url')
        .ilike('title', `%${query}%`)
        .limit(20);
      if (error) throw error;
      setGifs(data || []);
    } catch (error) {
      console.error('Error fetching GIFs:', error.message);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => fetchGifs(searchTerm), 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, fetchGifs]);

  return (
    <Modal
      isVisible={true}
      onBackdropPress={onClose}
      style={styles.gifModal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <Animated.View style={[styles.gifContainer, { opacity: fadeAnim }]}>
        <View style={styles.gifHeader}>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search GIFs..."
            style={styles.gifInput}
            autoFocus
          />
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome5 name="times" size={16} color="#F28C38" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color="#F28C38" />
        ) : gifs.length > 0 ? (
          <FlatList
            data={gifs}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onSelect(item.url)}
                style={styles.gifItem}
              >
                <Image source={{ uri: item.url }} style={styles.gifImage} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            contentContainerStyle={styles.gifGrid}
          />
        ) : (
          <Text style={styles.noGifs}>No GIFs found</Text>
        )}
      </Animated.View>
    </Modal>
  );
};

const ChatScreen = () => {
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  const navigation = useNavigation();
  const route = useRoute(); // Added to access route params
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [activeChat, setActiveChat] = useState('group');
  const [privateMessages, setPrivateMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const typingChannelRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const flatListRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const hasScrolled = useRef(false);
  const oldestMessageTimestamp = useRef(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  // Selection state for multi-select/delete/edit
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  // Delete and edit logic
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [editMsgId, setEditMsgId] = useState(null);

  useEffect(() => {
    const syncWallet = async () => {
      try {
        if (wallet && wallet.publicKey && isWalletConnected) {
          setWalletAddress(wallet.publicKey);
          await AsyncStorage.setItem('walletAddress', String(wallet.publicKey));
        } else {
          const key = await AsyncStorage.getItem('walletAddress');
          if (key) setWalletAddress(key);
          else setError('Please connect your wallet to chat.');
        }
      } catch (err) {
        setError('Failed to sync wallet');
      }
    };
    syncWallet();
  }, [wallet, isWalletConnected]);

  useEffect(() => {
    const { chatId, messageId } = route.params || {};
    if (chatId) {
      setActiveChat(chatId);
      if (chatId !== 'group' && !privateMessages[chatId]) {
        fetchPrivateMessages(chatId);
      }
    }
    if (messageId) {
      setTimeout(() => scrollToMessage(messageId), 500);
    }
  }, [route.params]);

  const scrollToMessage = (messageId) => {
    const msgList = activeChat === 'group' ? messages : privateMessages[activeChat] || [];
    const index = msgList.findIndex((m) => m.id.toString() === messageId);
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true });
      hasScrolled.current = true;
    }
  };

  const fetchRecentChats = useCallback(async () => {
    if (!walletAddress) return;
    try {
      // Fetch all private messages where the user is sender or recipient
      const { data, error } = await supabase
        .from('private_messages')
        .select('sender_wallet, recipient_wallet, created_at')
        .or(`sender_wallet.eq.${walletAddress},recipient_wallet.eq.${walletAddress}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Collect all unique wallet addresses that have messaged or been messaged by the user
      const uniqueContacts = new Map();
      for (const msg of data) {
        const contactWallets = [msg.sender_wallet, msg.recipient_wallet].filter(
          (w) => w !== walletAddress
        );
        for (const contactWallet of contactWallets) {
          if (!uniqueContacts.has(contactWallet)) {
            uniqueContacts.set(contactWallet, msg.created_at);
          }
        }
      }

      // Fetch user info for all unique contacts
      const contactWalletArr = Array.from(uniqueContacts.keys());
      let contacts = [];
      if (contactWalletArr.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, wallet_address, image, isWriter, isArtist, isSuperuser')
          .in('wallet_address', contactWalletArr);
        // Map by wallet_address for quick lookup
        const userMap = new Map((usersData || []).map(u => [u.wallet_address, u]));
        contacts = contactWalletArr.map(wallet => {
          const userData = userMap.get(wallet);
          return {
            id: userData?.id || null,
            name: userData?.name || wallet,
            wallet_address: userData?.wallet_address || wallet,
            image: userData?.image,
            isWriter: userData?.isWriter || false,
            isArtist: userData?.isArtist || false,
            isSuperuser: userData?.isSuperuser || false,
          };
        });
      }
      setRecentChats(contacts);
    } catch (error) {
      setError('Failed to load recent chats');
    }
  }, [walletAddress]);

  const fetchUsers = useCallback(async () => {
    if (!searchTerm.trim() || !walletAddress) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, wallet_address, image, isWriter, isArtist, isSuperuser')
        .or(`name.ilike.%${searchTerm}%,wallet_address.ilike.%${searchTerm}%`)
        .neq('wallet_address', walletAddress)
        .limit(10);
      if (error) throw error;
      const userList = data.map((user) => ({
        id: user.id,
        name: user.name || user.wallet_address,
        wallet_address: user.wallet_address,
        image: user.image,
        isWriter: user.isWriter || false,
        isArtist: user.isArtist || false,
        isSuperuser: user.isSuperuser || false,
      }));
      setUsers(userList);
    } catch (error) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, walletAddress]);

  const fetchGroupMessages = useCallback(async (loadMore = false) => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (loadMore && oldestMessageTimestamp.current) {
        query = query.lt('created_at', oldestMessageTimestamp.current);
      }

      const { data: messagesData, error } = await query;

      if (error) throw error;
      if (!messagesData || messagesData.length === 0) {
        if (!loadMore) setMessages([]);
        setHasMoreMessages(false);
        setLoading(false);
        return;
      }

      const enrichedMessages = await Promise.all(
        messagesData.map(async (msg) => {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, name, image, isWriter, isArtist, isSuperuser')
            .eq('wallet_address', msg.wallet_address)
            .maybeSingle();
          if (userError) console.error('Error fetching user for message:', userError.message);

          let parent_name = null;
          let parent_content = null;
          if (msg.parent_id) {
            const { data: parentMsg, error: parentError } = await supabase
              .from('messages')
              .select('wallet_address, content')
              .eq('id', msg.parent_id)
              .maybeSingle();
            if (parentError) console.error('Error fetching parent message:', parentError.message);
            else if (parentMsg) {
              const { data: parentUser, error: parentUserError } = await supabase
                .from('users')
                .select('name')
                .eq('wallet_address', parentMsg.wallet_address)
                .maybeSingle();
              if (parentUserError) console.error('Error fetching parent user:', parentUserError.message);
              parent_name = parentUser?.name || parentMsg.wallet_address || 'Unknown';
              parent_content = parentMsg.content || null;
            }
          }

          return {
            ...msg,
            user_id: userData?.id || null,
            name: userData?.name || msg.wallet_address,
            profile_image: userData?.image,
            is_writer: userData?.isWriter || false,
            is_artist: userData?.isArtist || false,
            is_superuser: userData?.isSuperuser || false,
            parent_name,
            parent_content,
          };
        })
      );

      setMessages((prev) => {
        const existingIds = new Set(prev.map((msg) => msg.id || msg.tempId));
        const newMessages = enrichedMessages.filter((msg) => !existingIds.has(msg.id || msg.tempId));
        const combinedMessages = loadMore ? [...newMessages, ...prev] : [...prev, ...newMessages];
        return combinedMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });
      setHasMoreMessages(messagesData.length === 50);
      if (enrichedMessages.length > 0) {
        oldestMessageTimestamp.current = enrichedMessages[0].created_at;
      }
    } catch (error) {
      setError('Failed to load group messages');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const fetchPrivateMessages = useCallback(async (recipientWallet, loadMore = false) => {
    if (!walletAddress || !recipientWallet) return;
    setLoading(true);
    try {
      let query = supabase
        .from('private_messages')
        .select('*')
        .or(
          `and(sender_wallet.eq.${walletAddress},recipient_wallet.eq.${recipientWallet}),and(sender_wallet.eq.${recipientWallet},recipient_wallet.eq.${walletAddress})`
        )
        .order('created_at', { ascending: false })
        .limit(50);

      if (loadMore && oldestMessageTimestamp.current) {
        query = query.lt('created_at', oldestMessageTimestamp.current);
      }

      const { data: messagesData, error } = await query;

      if (error) throw error;
      if (!messagesData || messagesData.length === 0) {
        if (!loadMore) {
          setPrivateMessages((prev) => ({ ...prev, [recipientWallet]: [] }));
        }
        setHasMoreMessages(false);
        setLoading(false);
        return;
      }

      const enrichedMessages = await Promise.all(
        messagesData.map(async (msg) => {
          const { data: senderData, error: senderError } = await supabase
            .from('users')
            .select('id, name, image, isWriter, isArtist, isSuperuser')
            .eq('wallet_address', msg.sender_wallet)
            .maybeSingle();
          if (senderError) console.error('Error fetching sender:', senderError.message);

          let parent_name = null;
          let parent_content = null;
          if (msg.parent_id) {
            const { data: parentMsg, error: parentError } = await supabase
              .from('private_messages')
              .select('sender_wallet, content')
              .eq('id', msg.parent_id)
              .maybeSingle();
            if (parentError) console.error('Error fetching parent private message:', parentError.message);
            else if (parentMsg) {
              const { data: parentUser, error: parentUserError } = await supabase
                .from('users')
                .select('name')
                .eq('wallet_address', parentMsg.sender_wallet)
                .maybeSingle();
              if (parentUserError) console.error('Error fetching parent user:', parentUserError.message);
              parent_name = parentUser?.name || parentMsg.sender_wallet || 'Unknown';
              parent_content = parentMsg.content || null;
            }
          }

          return {
            ...msg,
            user_id: senderData?.id || null,
            name: senderData?.name || msg.sender_wallet,
            profile_image: senderData?.image,
            is_writer: senderData?.isWriter || false,
            is_artist: senderData?.isArtist || false,
            is_superuser: senderData?.isSuperuser || false,
            status: msg.status || 'sent',
            parent_name,
            parent_content,
          };
        })
      );

      setPrivateMessages((prev) => {
        const currentMessages = prev[recipientWallet] || [];
        const existingIds = new Set(currentMessages.map((msg) => msg.id || msg.tempId));
        const newMessages = enrichedMessages.filter((msg) => !existingIds.has(msg.id || msg.tempId));
        const combinedMessages = loadMore ? [...newMessages, ...currentMessages] : [...currentMessages, ...newMessages];
        return {
          ...prev,
          [recipientWallet]: combinedMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        };
      });
      setHasMoreMessages(messagesData.length === 50);
      if (enrichedMessages.length > 0) {
        oldestMessageTimestamp.current = enrichedMessages[0].created_at;
      }

      await supabase
        .from('private_messages')
        .update({ status: 'read' })
        .eq('recipient_wallet', walletAddress)
        .eq('sender_wallet', recipientWallet)
        .in('status', ['sent', 'delivered']);
    } catch (error) {
      setError('Failed to load private messages');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchRecentChats();
    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [fetchRecentChats, fetchUsers, searchTerm]);

  useEffect(() => {
    oldestMessageTimestamp.current = null;
    setHasMoreMessages(true);
    if (activeChat === 'group') {
      fetchGroupMessages();
    } else {
      fetchPrivateMessages(activeChat);
    }
  }, [activeChat, fetchGroupMessages, fetchPrivateMessages]);

  useEffect(() => {
    // Clean up previous channel if any
    if (typingChannelRef.current) {
      typingChannelRef.current.unsubscribe();
      typingChannelRef.current = null;
    }
    if (!walletAddress || activeChat === 'group') {
      return;
    }
    // Create and subscribe to new channel
    const channel = supabase.channel(`typing:${activeChat}`);
    typingChannelRef.current = channel;
    channel
      .on('presence', { event: 'typing' }, (payload) => {
        if (payload.user !== walletAddress) {
          setTypingUsers((prev) => ({
            ...prev,
            [activeChat]: payload.typing ? payload.user : null,
          }));
        }
      });
    channel.subscribe();
    return () => {
      if (typingChannelRef.current) {
        typingChannelRef.current.unsubscribe();
        typingChannelRef.current = null;
      }
    };
  }, [walletAddress, activeChat]);

  const handleTyping = useCallback(() => {
    if (!typingChannelRef.current || activeChat === 'group') return;
    typingChannelRef.current.track({ typing: true, user: walletAddress });
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      typingChannelRef.current && typingChannelRef.current.track({ typing: false, user: walletAddress });
    }, 2000);
  }, [activeChat, walletAddress]);

  const handleReply = (id) => setReplyingTo(id);

  const handleScrollToParent = (parentId) => {
    const index = (activeChat === 'group' ? messages : privateMessages[activeChat] || []).findIndex(
      (m) => m.id === parentId
    );
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true });
      hasScrolled.current = true;
    }
  };

  // Cache key helpers
  const getCacheKey = () => `chat_cache_${activeChat}`;

  // Load cached messages on mount or chat switch
  useEffect(() => {
    const loadCachedMessages = async () => {
      try {
        const cacheKey = getCacheKey();
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (activeChat === 'group') setMessages(parsed);
          else setPrivateMessages((prev) => ({ ...prev, [activeChat]: parsed }));
        }
      } catch (e) {
        // Ignore cache errors
      }
      setInitialLoad(false);
    };
    loadCachedMessages();
  }, [activeChat]);

  // Save messages to cache when they change
  useEffect(() => {
    const saveCache = async () => {
      try {
        const cacheKey = getCacheKey();
        if (activeChat === 'group') {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(messages.slice(-50)));
        } else {
          await AsyncStorage.setItem(cacheKey, JSON.stringify((privateMessages[activeChat] || []).slice(-50)));
        }
      } catch (e) {}
    };
    if (!initialLoad) saveCache();
  }, [messages, privateMessages, activeChat, initialLoad]);

  // Scroll to bottom logic
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
      hasScrolled.current = true;
    }
  }, [flatListRef]);

  // Show/hide scroll-to-bottom button based on scroll position
  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 40;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    setShowScrollToBottom(!isAtBottom);
  };

  // Always scroll to bottom when new messages arrive (if user is at bottom or just loaded)
  useEffect(() => {
    if (!showScrollToBottom && (activeChat === 'group' ? messages.length : (privateMessages[activeChat] || []).length)) {
      scrollToBottom();
    }
  }, [messages, privateMessages, activeChat]);

  // FlatList onContentSizeChange handler
  const handleContentSizeChange = () => {
    if (!showScrollToBottom) scrollToBottom();
  };

  // Infinite scroll: only load older messages when user scrolls up
  const handleEndReached = () => {
    if (loading || !hasMoreMessages) return;
    // Only load more if user is near the top
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
    if (activeChat === 'group') {
      fetchGroupMessages(true);
    } else {
      fetchPrivateMessages(activeChat, true);
    }
  };

  const handleFileChange = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
      });
      if (res.type === 'success') {
        setFile(res);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        setError('Error picking file');
      }
    }
  };

  // Switch chat handler for sidebar
  const switchChat = useCallback((walletAddr) => {
    setSidebarOpen(false); // Close sidebar immediately for UX
    setSearchTerm(''); // Clear search to avoid sidebar reopening
    setActiveChat(walletAddr);
    setReplyingTo(null);
    // Optionally reset scroll position
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: false });
      }
    }, 100);
  }, []);

  // Send message handler (stub, implement as needed)
  const handleSend = async () => {
    if (sending || (!input.trim() && !file)) return;
    setSending(true);
    let mediaUrl = null;
    let tempId = `temp-${Date.now()}`;
    try {
      // 1. Handle file upload if present (stub: you may need to implement actual upload logic)
      if (file) {
        // TODO: Implement actual upload logic to Supabase Storage or other
        // For now, just use file.uri as a placeholder
        mediaUrl = file.uri;
      }

      // 2. Prepare optimistic message with parent info if replying
      let parent_name_optimistic = null;
      let parent_content_optimistic = null;
      if (replyingTo) {
        const parentMsg = (activeChat === 'group'
          ? messages
          : privateMessages[activeChat] || []
        ).find((m) => m.id === replyingTo || m.tempId === replyingTo);
        if (parentMsg) {
          parent_name_optimistic = parentMsg.name || parentMsg.wallet_address || parentMsg.sender_wallet || 'Unknown';
          parent_content_optimistic = parentMsg.content || null;
        }
      }
      const newMsg = {
        id: tempId,
        tempId,
        content: input.trim(),
        media_url: mediaUrl,
        created_at: new Date().toISOString(),
        wallet_address: walletAddress,
        sender_wallet: walletAddress,
        status: 'sending',
        parent_id: replyingTo,
        parent_name: parent_name_optimistic,
        parent_content: parent_content_optimistic,
        name: '',
        profile_image: '',
        is_writer: false,
        is_artist: false,
        is_superuser: false,
      };

      if (activeChat === 'group') {
        setMessages((prev) => [...prev, newMsg]);
      } else {
        setPrivateMessages((prev) => ({
          ...prev,
          [activeChat]: [...(prev[activeChat] || []), newMsg],
        }));
      }

      // 3. Send to Supabase
      let result;
      if (activeChat === 'group') {
        result = await supabase
          .from('messages')
          .insert({
            content: input.trim(),
            media_url: mediaUrl,
            wallet_address: walletAddress,
            parent_id: replyingTo,
          })
          .select()
          .maybeSingle();
      } else {
        result = await supabase
          .from('private_messages')
          .insert({
            content: input.trim(),
            media_url: mediaUrl,
            sender_wallet: walletAddress,
            recipient_wallet: activeChat,
            parent_id: replyingTo,
            status: 'sent',
          })
          .select()
          .maybeSingle();
      }

      const { data: savedMsg, error } = result;
      if (error) throw error;

      // 4. Replace optimistic message with real one, and add parent info for reply preview
      let parent_name_saved = null;
      let parent_content_saved = null;
      if (replyingTo) {
        const parentMsg = (activeChat === 'group'
          ? messages
          : privateMessages[activeChat] || []
        ).find((m) => m.id === replyingTo || m.tempId === replyingTo);
        if (parentMsg) {
          parent_name_saved = parentMsg.name || parentMsg.wallet_address || parentMsg.sender_wallet || 'Unknown';
          parent_content_saved = parentMsg.content || null;
        }
      }
      const savedMsgWithParent = { ...savedMsg, status: 'sent', parent_name: parent_name_saved, parent_content: parent_content_saved };
      if (activeChat === 'group') {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? savedMsgWithParent : m))
        );
      } else {
        setPrivateMessages((prev) => ({
          ...prev,
          [activeChat]: (prev[activeChat] || []).map((m) =>
            m.id === tempId ? savedMsgWithParent : m
          ),
        }));
      }
    } catch (err) {
      // On error, mark as failed
      if (activeChat === 'group') {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
        );
      } else {
        setPrivateMessages((prev) => ({
          ...prev,
          [activeChat]: (prev[activeChat] || []).map((m) =>
            m.id === tempId ? { ...m, status: 'failed' } : m
          ),
        }));
      }
      setError('Failed to send message');
    } finally {
      setInput('');
      setFile(null);
      setReplyingTo(null);
      setSending(false);
    }
  };

  // GIF select handler (stub, implement as needed)
  const handleGifSelect = (url) => {
    // Implement your GIF send logic here
    setShowGifPicker(false);
  };

  // Dismiss error banner
  const dismissError = () => setError(null);

  // Message selection handlers
  const isOwnMessage = (msg) => {
    return (activeChat === 'group'
      ? String(msg.wallet_address).toLowerCase() === String(walletAddress).toLowerCase()
      : String(msg.sender_wallet).toLowerCase() === String(walletAddress).toLowerCase()
    );
  };

  const handleLongPressMessage = (msg) => {
    if (!isOwnMessage(msg)) return;
    setSelectionMode(true);
    setSelectedMessages([msg.id || msg.tempId]);
  };

  const handleSelectMessage = (msg) => {
    if (!isOwnMessage(msg)) return;
    setSelectionMode(true);
    setSelectedMessages((prev) => {
      const id = msg.id || msg.tempId;
      if (prev.includes(id)) {
        return prev.filter((mid) => mid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedMessages([]);
  };

  // Delete and edit logic
  const handleDeleteMessages = async () => {
    if (selectedMessages.length === 0) return;
    if (!window.confirm || window.confirm('Delete selected message(s)?')) {
      const ids = selectedMessages;
      if (activeChat === 'group') {
        setMessages((prev) => prev.filter((m) => !ids.includes(m.id || m.tempId)));
        await supabase.from('messages').delete().in('id', ids);
      } else {
        setPrivateMessages((prev) => ({
          ...prev,
          [activeChat]: (prev[activeChat] || []).filter((m) => !ids.includes(m.id || m.tempId)),
        }));
        await supabase.from('private_messages').delete().in('id', ids);
      }
      clearSelection();
    }
  };

  const handleEditMessage = () => {
    if (selectedMessages.length !== 1) return;
    const id = selectedMessages[0];
    const msg = (activeChat === 'group' ? messages : privateMessages[activeChat] || []).find((m) => (m.id || m.tempId) === id);
    if (!msg || msg.status === 'failed' || msg.status === 'sending') return;
    setEditText(msg.content);
    setEditMsgId(id);
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!editMsgId || !editText.trim()) return;
    if (activeChat === 'group') {
      setMessages((prev) => prev.map((m) => (m.id === editMsgId ? { ...m, content: editText } : m)));
      await supabase.from('messages').update({ content: editText }).eq('id', editMsgId);
    } else {
      setPrivateMessages((prev) => ({
        ...prev,
        [activeChat]: (prev[activeChat] || []).map((m) => (m.id === editMsgId ? { ...m, content: editText } : m)),
      }));
      await supabase.from('private_messages').update({ content: editText }).eq('id', editMsgId);
    }
    setEditMode(false);
    setEditMsgId(null);
    setEditText('');
    clearSelection();
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditMsgId(null);
    setEditText('');
    clearSelection();
  };

  // For sidebar overlay
  const renderSidebarOverlay = () => (
    sidebarOpen ? <View style={styles.sidebarOverlay} pointerEvents="auto" /> : null
  );

  // Animated top bar for selection mode
  const selectionBarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(selectionBarAnim, {
      toValue: selectionMode ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [selectionMode]);
  const renderSelectionBar = () => (
    <Animated.View
      style={[
        styles.selectionBar,
        {
          transform: [
            {
              translateY: selectionBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-80, 0],
              }),
            },
          ],
          opacity: selectionBarAnim,
        },
      ]}
    >
      <TouchableOpacity onPress={clearSelection} style={styles.selectionBarCancel}>
        <FontAwesome5 name="times" size={20} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.selectionBarText}>{selectedMessages.length} selected</Text>
      {selectedMessages.length === 1 && (
        <TouchableOpacity style={styles.selectionBarEdit} onPress={handleEditMessage}>
          <FontAwesome5 name="edit" size={20} color="#fff" />
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.selectionBarDelete} onPress={handleDeleteMessages}>
        <FontAwesome5 name="trash" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  // Edit message modal
  const renderEditModal = () => (
    editMode && (
      <Modal isVisible={true} onBackdropPress={handleCancelEdit}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>Edit Message</Text>
          <TextInput
            value={editText}
            onChangeText={setEditText}
            style={{ borderWidth: 1, borderColor: '#F28C38', borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 16 }}
            multiline
            maxLength={1000}
            autoFocus
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity onPress={handleCancelEdit} style={{ marginRight: 16 }}>
              <Text style={{ color: '#EF5350', fontWeight: 'bold', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveEdit}>
              <Text style={{ color: '#F28C38', fontWeight: 'bold', fontSize: 15 }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  );

  const renderMessage = useCallback(
    ({ item }) => {
      const selected = selectedMessages.includes(item.id || item.tempId);
      return (
        <TouchableOpacity
          activeOpacity={selectionMode ? 0.6 : 1}
          onLongPress={() => handleLongPressMessage(item)}
          delayLongPress={500}
          onPress={() => selectionMode ? handleSelectMessage(item) : undefined}
          style={selected ? [styles.selectedMessage] : undefined}
        >
          {selected && (
            <View style={styles.checkmarkOverlay}>
              <FontAwesome5 name="check" size={12} color="#fff" />
            </View>
          )}
          <Message
            msg={item}
            walletAddress={walletAddress}
            onReply={handleReply}
            isPrivate={activeChat !== 'group'}
            onScrollToParent={handleScrollToParent}
          />
        </TouchableOpacity>
      );
    },
    [walletAddress, handleReply, activeChat, handleScrollToParent, selectionMode, selectedMessages]
  );

  const toggleSidebar = () => {
    const toValue = sidebarOpen ? -width : 0;
    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setSidebarOpen(!sidebarOpen);
  };

  const onScrollToIndexFailed = (info) => {
    // Fallback: scroll to end if the index is not found
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {renderEditModal()}
      {renderSidebarOverlay()}
      {selectionMode ? renderSelectionBar() : (
        <View style={styles.header}>
          <TouchableOpacity onPress={toggleSidebar} style={styles.menuButton}>
            <FontAwesome5 name="bars" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.libraryLogo}
            onPress={() => navigation.navigate('Home')}
            accessible={true}
            accessibilityLabel="Go to home"
          >
            <Image
              source={{
                uri:
                  'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' ||
                  'https://placehold.co/50x50/png?text=Logo',
              }}
              style={styles.logo}
              resizeMode="cover"
              defaultSource={{ uri: 'https://placehold.co/50x50/png?text=Logo' }}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeChat === 'group'
              ? 'Group Chat'
              : truncateName(
                  recentChats.find((u) => u.wallet_address === activeChat)?.name ||
                  users.find((u) => u.wallet_address === activeChat)?.name ||
                  activeChat
                )}
          </Text>
        </View>
      )}

      {error && (
        <TouchableWithoutFeedback onPress={dismissError}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <FontAwesome5 name="times" size={14} color="#fff" />
          </View>
        </TouchableWithoutFeedback>
      )}

      {loading && (
        <View style={styles.loadingIndicator}>
          <ActivityIndicator size="small" color="#F28C38" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      <View style={styles.chatArea}>
        <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          <View style={styles.sidebarContent}>
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search users..."
              style={styles.searchInput}
              editable={!!walletAddress}
            />
            <FlatList
              data={[
                { wallet_address: 'group', name: 'Group Chat', image: null },
                ...(searchTerm.trim() ? users : recentChats),
              ]}
              renderItem={({ item }) => (
                <ChatItem
                  item={item}
                  activeChat={activeChat}
                  switchChat={switchChat}
                />
              )}
              keyExtractor={(item) => item.wallet_address}
              ListHeaderComponent={
                searchTerm.trim() && users.length > 0 ? (
                  <Text style={styles.sectionHeader}>Search Results</Text>
                ) : !searchTerm.trim() && recentChats.length > 0 ? (
                  <Text style={styles.sectionHeader}>Recent Chats</Text>
                ) : null
              }
              contentContainerStyle={styles.chatList}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              extraData={sidebarOpen}
            />
            <View style={styles.divider} />
          </View>
        </Animated.View>

        <FlatList
          ref={flatListRef}
          data={activeChat === 'group' ? messages : privateMessages[activeChat] || []}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id?.toString() || item.tempId || `${item.created_at}-${item.sender_wallet || item.wallet_address}-${Math.random()}`}
          contentContainerStyle={styles.messageList}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          onScrollToIndexFailed={onScrollToIndexFailed}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.01}
          inverted={false}
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
        {showScrollToBottom && (
          <TouchableOpacity
            style={styles.scrollToBottomButton}
            onPress={scrollToBottom}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="arrow-down" style={styles.scrollToBottomIcon} />
          </TouchableOpacity>
        )}
        {activeChat !== 'group' && typingUsers[activeChat] && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>Typing...</Text>
          </View>
        )}
      </View>

      {replyingTo && (
        <View style={styles.replyBar}>
          <Text style={styles.replyText} numberOfLines={1}>
            Replying to{' '}
            <Text style={styles.replyName}>
              {truncateName(
                (activeChat === 'group'
                  ? messages
                  : privateMessages[activeChat] || []
                ).find((m) => m.id === replyingTo)?.name || 'Unknown'
              )}
            </Text>
            {': '}
            {(activeChat === 'group'
              ? messages
              : privateMessages[activeChat] || []
            ).find((m) => m.id === replyingTo)?.content?.slice(0, 20) || ''}
          </Text>
          <TouchableOpacity
            onPress={() => setReplyingTo(null)}
            style={styles.cancelReply}
          >
            <FontAwesome5 name="times" size={14} color="#EF5350" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          value={input}
          onChangeText={(text) => {
            setInput(text);
            handleTyping();
          }}
          placeholder="Type a message..."
          style={styles.input}
          editable={!uploading && !!walletAddress}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          onPress={handleFileChange}
          style={styles.inputButton}
          disabled={uploading}
        >
          <FontAwesome5 name="paperclip" size={18} color="#F28C38" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowGifPicker(true)}
          style={styles.inputButton}
          disabled={uploading}
        >
          <FontAwesome5 name="image" size={18} color="#F28C38" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleSend()}
          style={styles.sendButton}
          disabled={uploading || sending || (!input.trim() && !file)}
        >
          <FontAwesome5
            name="paper-plane"
            size={18}
            color={uploading || sending ? '#ccc' : '#fff'}
          />
        </TouchableOpacity>
      </View>

      {showGifPicker && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
};

export default memo(ChatScreen);