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
      ? msg.sender_wallet === walletAddress
      : msg.wallet_address === walletAddress;
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
                <Image source={{ uri: image.url }} style={styles.gifImage} />
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
  const [typingChannel, setTypingChannel] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const flatListRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const hasScrolled = useRef(false);
  const oldestMessageTimestamp = useRef(null);

  useEffect(() => {
    const syncWallet = async () => {
      try {
        if (wallet && wallet.publicKey && isWalletConnected) {
          setWalletAddress(wallet.publicKey);
          await AsyncStorage.setItem('walletAddress', wallet.publicKey);
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
      const { data, error } = await supabase
        .from('private_messages')
        .select('sender_wallet, recipient_wallet, created_at')
        .or(`sender_wallet.eq.${walletAddress},recipient_wallet.eq.${walletAddress}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const uniqueContacts = new Set();
      const contacts = [];
      for (const msg of data) {
        const contactWallet = msg.sender_wallet === walletAddress ? msg.recipient_wallet : msg.sender_wallet;
        if (!uniqueContacts.has(contactWallet)) {
          uniqueContacts.add(contactWallet);
          const { data: userData } = await supabase
            .from('users')
            .select('id, name, wallet_address, image, isWriter, isArtist, isSuperuser')
            .eq('wallet_address', contactWallet)
            .single();
          contacts.push({
            id: userData?.id || null,
            name: userData?.name || contactWallet,
            wallet_address: userData?.wallet_address || contactWallet,
            image: userData?.image,
            isWriter: userData?.isWriter || false,
            isArtist: userData?.isArtist || false,
            isSuperuser: userData?.isSuperuser || false,
          });
        }
      }
      setRecentChats(contacts.slice(0, 10));
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
            .single();
          if (userError) console.error('Error fetching user for message:', userError.message);

          let parent_name = null;
          let parent_content = null;
          if (msg.parent_id) {
            const { data: parentMsg, error: parentError } = await supabase
              .from('messages')
              .select('wallet_address, content')
              .eq('id', msg.parent_id)
              .single();
            if (parentError) console.error('Error fetching parent message:', parentError.message);
            else if (parentMsg) {
              const { data: parentUser, error: parentUserError } = await supabase
                .from('users')
                .select('name')
                .eq('wallet_address', parentMsg.wallet_address)
                .single();
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
            .single();
          if (senderError) console.error('Error fetching sender:', senderError.message);

          let parent_name = null;
          let parent_content = null;
          if (msg.parent_id) {
            const { data: parentMsg, error: parentError } = await supabase
              .from('private_messages')
              .select('sender_wallet, content')
              .eq('id', msg.parent_id)
              .single();
            if (parentError) console.error('Error fetching parent private message:', parentError.message);
            else if (parentMsg) {
              const { data: parentUser, error: parentUserError } = await supabase
                .from('users')
                .select('name')
                .eq('wallet_address', parentMsg.sender_wallet)
                .single();
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
    if (!walletAddress || activeChat === 'group') {
      if (typingChannel) {
        typingChannel.unsubscribe();
        setTypingChannel(null);
      }
      return;
    }

    const channel = supabase.channel(`typing:${activeChat}`);
    channel
      .on('presence', { event: 'typing' }, (payload) => {
        if (payload.user !== walletAddress) {
          setTypingUsers((prev) => ({
            ...prev,
            [activeChat]: payload.typing ? payload.user : null,
          }));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setTypingChannel(channel);
        }
      });

    return () => {
      if (channel) {
        channel.unsubscribe();
        setTypingChannel(null);
      }
    };
  }, [walletAddress, activeChat]);

  const handleTyping = useCallback(() => {
    if (!typingChannel || activeChat === 'group') return;
    typingChannel.track({ typing: true, user: walletAddress });
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      typingChannel.track({ typing: false, user: walletAddress });
    }, 2000);
  }, [typingChannel, activeChat, walletAddress]);

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && !hasScrolled.current && (messages.length > 0 || privateMessages[activeChat]?.length > 0)) {
      flatListRef.current.scrollToEnd({ animated: false });
      hasScrolled.current = true;
    }
  }, [messages, privateMessages, activeChat]);

  useEffect(() => {
    hasScrolled.current = false;
    scrollToBottom();
  }, [activeChat, messages, privateMessages, scrollToBottom]);

  const handleSend = useCallback(
    async (gifUrl = null) => {
      if ((!input.trim() && !file && !gifUrl) || !walletAddress || uploading) return;
      setUploading(true);
      setSending(true);
      let mediaUrl = gifUrl;

      if (file && !gifUrl) {
        const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('chat-media').upload(fileName, file);
        if (!error) {
          const { data } = supabase.storage.from('chat-media').getPublicUrl(fileName);
          mediaUrl = data.publicUrl;
        } else {
          setError('Failed to upload file');
          setUploading(false);
          setSending(false);
          return;
        }
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('wallet_address', walletAddress)
        .single();
      if (userError || !userData) {
        setError('User not found');
        setUploading(false);
        setSending(false);
        return;
      }

      let parent_name = null;
      let parent_content = null;
      let parent_wallet = null;
      if (replyingTo) {
        if (activeChat === 'group') {
          const parentMsg = messages.find((m) => m.id === replyingTo) || 
            (await supabase
              .from('messages')
              .select('wallet_address, content')
              .eq('id', replyingTo)
              .single())?.data;
          if (parentMsg) {
            const { data: parentUser, error: parentUserError } = await supabase
              .from('users')
              .select('name, wallet_address')
              .eq('wallet_address', parentMsg.wallet_address)
              .single();
            if (parentUserError) console.error('Error fetching parent user:', parentUserError.message);
            parent_name = parentUser?.name || parentMsg.wallet_address || 'Unknown';
            parent_content = parentMsg.content || null;
            parent_wallet = parentMsg.wallet_address;
          }
        } else {
          const parentMsg = (privateMessages[activeChat] || []).find((m) => m.id === replyingTo) || 
            (await supabase
              .from('private_messages')
              .select('sender_wallet, content')
              .eq('id', replyingTo)
              .single())?.data;
          if (parentMsg) {
            const { data: parentUser, error: parentUserError } = await supabase
              .from('users')
              .select('name, wallet_address')
              .eq('wallet_address', parentMsg.sender_wallet)
              .single();
            if (parentUserError) console.error('Error fetching parent user:', parentUserError.message);
            parent_name = parentUser?.name || parentMsg.sender_wallet || 'Unknown';
            parent_content = parentMsg.content || null;
            parent_wallet = parentMsg.sender_wallet;
          }
        }
      }

      let newMessageId = null;
      const tempId = `${Date.now()}-${Math.random()}`;
      if (activeChat === 'group') {
        const newMessage = {
          wallet_address: walletAddress,
          user_id: userData.id,
          content: input.trim() || null,
          media_url: mediaUrl,
          parent_id: replyingTo,
          created_at: new Date().toISOString(),
          name: userData.name,
          parent_name,
          parent_content,
          tempId,
        };
        setMessages((prev) => [...prev, newMessage]);
        hasScrolled.current = false;

        const { data, error } = await supabase
          .from('messages')
          .insert({
            wallet_address: walletAddress,
            user_id: userData.id,
            content: input.trim() || null,
            media_url: mediaUrl,
            parent_id: replyingTo,
          })
          .select()
          .single();

        if (error) {
          setError('Failed to send group message');
          setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
        } else {
          newMessageId = data.id;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.tempId === tempId ? { ...msg, id: data.id, tempId: undefined } : msg
            )
          );

          if (replyingTo && parent_wallet && parent_wallet !== walletAddress) {
            const { data: recipientData } = await supabase
              .from('users')
              .select('id')
              .eq('wallet_address', parent_wallet)
              .single();
            if (recipientData) {
              await supabase.from('notifications').insert({
                user_id: recipientData.id,
                recipient_wallet_address: parent_wallet,
                sender_wallet_address: walletAddress,
                message: `${userData.name || walletAddress} replied to you in group chat: "${input.trim() || 'Media'}"`,
                type: 'group_reply',
                chat_id: data.id,
                is_read: false,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      } else {
        const newMessage = {
          sender_wallet: walletAddress,
          recipient_wallet: activeChat,
          content: input.trim() || null,
          media_url: mediaUrl,
          parent_id: replyingTo,
          status: 'sending',
          created_at: new Date().toISOString(),
          name: userData.name || walletAddress,
          user_id: userData.id,
          profile_image: null,
          is_writer: false,
          is_artist: false,
          is_superuser: false,
          parent_name,
          parent_content,
          tempId,
        };

        setPrivateMessages((prev) => ({
          ...prev,
          [activeChat]: [...(prev[activeChat] || []), newMessage],
        }));
        hasScrolled.current = false;

        const { data, error } = await supabase
          .from('private_messages')
          .insert({
            sender_wallet: walletAddress,
            recipient_wallet: activeChat,
            content: input.trim() || null,
            media_url: mediaUrl,
            parent_id: replyingTo,
            status: 'sent',
          })
          .select()
          .single();

        if (error) {
          setError('Failed to send private message');
          setPrivateMessages((prev) => ({
            ...prev,
            [activeChat]: (prev[activeChat] || []).filter((msg) => msg.tempId !== tempId),
          }));
        } else {
          newMessageId = data.id;
          setPrivateMessages((prev) => {
            const currentMessages = prev[activeChat] || [];
            return {
              ...prev,
              [activeChat]: currentMessages.map((msg) =>
                msg.tempId === tempId
                  ? {
                      ...msg,
                      id: data.id,
                      status: 'sent',
                      tempId: undefined,
                      created_at: data.created_at,
                      sender_wallet: data.sender_wallet,
                      recipient_wallet: data.recipient_wallet,
                      content: data.content,
                      media_url: data.media_url,
                      parent_id: data.parent_id,
                    }
                  : msg
              ),
            };
          });

          const { data: recipientData, error: recipientError } = await supabase
            .from('users')
            .select('id, wallet_address')
            .eq('wallet_address', activeChat)
            .single();
          if (recipientError) console.error('Error fetching recipient:', recipientError.message);

          if (recipientData && recipientData.wallet_address !== walletAddress) {
            await supabase.from('notifications').insert({
              user_id: recipientData.id,
              recipient_wallet_address: activeChat,
              sender_wallet_address: walletAddress,
              message: `${userData.name || walletAddress} sent you a message: "${input.trim() || 'Media'}"`,
              type: 'private_message',
              chat_id: data.id,
              is_read: false,
              created_at: new Date().toISOString(),
            });
          }
          fetchRecentChats();
        }
      }

      setInput('');
      setFile(null);
      setReplyingTo(null);
      setShowGifPicker(false);
      setUploading(false);
      setSending(false);
    },
    [input, file, walletAddress, uploading, replyingTo, activeChat, fetchRecentChats, messages, privateMessages]
  );

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

  const handleReply = (id) => setReplyingTo(id);
  const handleGifSelect = (url) => handleSend(url);
  const switchChat = (chatId) => {
    setActiveChat(chatId);
    if (chatId !== 'group' && !privateMessages[chatId]) fetchPrivateMessages(chatId);
    setReplyingTo(null);
    setSidebarOpen(false);
    Animated.timing(slideAnim, {
      toValue: -width,
      duration: 200,
      useNativeDriver: true,
    }).start();
    hasScrolled.current = false;
  };

  const handleScrollToParent = (parentId) => {
    const index = (activeChat === 'group' ? messages : privateMessages[activeChat] || []).findIndex(
      (m) => m.id === parentId
    );
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true });
      hasScrolled.current = true;
    }
  };

  const onScrollToIndexFailed = (info) => {
    console.warn('Scroll to index failed:', info);
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const loadMoreMessages = useCallback(() => {
    if (loading || !hasMoreMessages) return;
    if (activeChat === 'group') {
      fetchGroupMessages(true);
    } else {
      fetchPrivateMessages(activeChat, true);
    }
  }, [loading, hasMoreMessages, activeChat, fetchGroupMessages, fetchPrivateMessages]);

  const toggleSidebar = () => {
    const toValue = sidebarOpen ? -width : 0;
    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setSidebarOpen(!sidebarOpen);
  };

  const dismissError = () => setError(null);

  const renderMessage = useCallback(
    ({ item }) => (
      <Message
        msg={item}
        walletAddress={walletAddress}
        onReply={handleReply}
        isPrivate={activeChat !== 'group'}
        onScrollToParent={handleScrollToParent}
      />
    ),
    [walletAddress, handleReply, activeChat, handleScrollToParent]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
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
            />
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
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.1}
          inverted={false}
        />
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
            color={uploading || sending ? '#ccc' : '#F28C38'}
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