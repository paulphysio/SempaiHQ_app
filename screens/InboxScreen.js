import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';

const InboxScreen = () => {
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = walletContext?.isWalletConnected || !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getInboxStyles(colors), [isDark]);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMessages();
  }, [activeWalletAddress]);

  const fetchMessages = async (showLoader = true) => {
    if (!activeWalletAddress) {
      setLoading(false);
      return;
    }

    if (showLoader) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('private_messages')
        .select('*')
        .eq('recipient_wallet', activeWalletAddress)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender info for each message
      const messagesWithSenders = await Promise.all(
        (data || []).map(async (message) => {
          const { data: userData } = await supabase
            .from('users')
            .select('name, image, wallet_address')
            .eq('wallet_address', message.sender_wallet)
            .single();
          return { ...message, users: userData };
        })
      );

      setMessages(messagesWithSenders);
    } catch (err) {
      console.error('[InboxScreen] Error fetching messages:', err);
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Pull-to-refresh: silent reload — keeps the list visible, no full-screen loader.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchMessages(false);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textPrimary }]}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { backgroundColor: colors.bgElevated, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Inbox</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {!isWalletConnected ? (
          <View style={styles.centerContainer}>
            <Icon name="wallet" size={60} color={colors.textMuted} />
            <Text style={[styles.promptText, { color: colors.textPrimary }]}>
              Connect your wallet to view messages.
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Icon name="exclamation-circle" size={60} color={colors.accent} />
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centerContainer}>
            <Icon name="envelope-open" size={60} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No messages yet</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View key={message.id} style={[styles.messageCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.messageHeader}>
                <View style={styles.senderInfo}>
                  {message.users?.image && (
                    <Image
                      source={{ uri: message.users.image }}
                      style={styles.senderAvatar}
                    />
                  )}
                  <View>
                    <Text style={[styles.senderName, { color: colors.textPrimary }]}>
                      {message.users?.name || message.sender_wallet?.slice(0, 8)}
                    </Text>
                    <Text style={[styles.messageDate, { color: colors.textMuted }]}>
                      {new Date(message.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.messageContent, { color: colors.textPrimary }]}>
                {message.content}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export const getInboxStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  promptText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  messageCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  messageHeader: {
    marginBottom: 8,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  senderName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageDate: {
    fontSize: 12,
    marginTop: 2,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default InboxScreen;
