import React, { useState, useEffect, useContext, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, Modal, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { readerAction } from '../services/readerActions';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { getAnnouncementsStyles } from '../styles/AnnouncementsStyles';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';
import ScreenSkeleton from '../components/ScreenSkeleton';
import { GelGate } from '../components/gel/GelGate';
import GelOrb from '../components/nav/GelOrb';
import { GelGlass, GelInput, GelButton, GelChips } from '../components/gel/GelKit';

const AnnouncementsScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getAnnouncementsStyles(colors), [isDark]);
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = walletContext?.isWalletConnected || !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementReleaseDate, setAnnouncementReleaseDate] = useState(null);
  const [audience, setAudience] = useState('all');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isWriter, setIsWriter] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await handleAccessCheck();
    } finally {
      setRefreshing(false);
    }
  };

  const handleAccessCheck = async () => {
    if (!isWalletConnected || !activeWalletAddress) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, isWriter, isArtist, isSuperuser")
        .eq("wallet_address", activeWalletAddress)
        .single();

      if (error) throw new Error(`Access check failed: ${error.message}`);
      if (!data) throw new Error("No user data found");

      if (!data.isWriter && !data.isArtist && !data.isSuperuser) {
        setHasAccess(false);
        return;
      }

      setCurrentUserId(data.id);
      setIsWriter(data.isWriter);
      setIsArtist(data.isArtist);
      setIsSuperuser(data.isSuperuser);
      setHasAccess(true);
    } catch (err) {
      console.error("Error checking access:", err);
      setHasAccess(false);
    } finally {
      setLoading(false);
      setAccessChecked(true);
    }
  };

  useEffect(() => {
    handleAccessCheck();
  }, [isWalletConnected, activeWalletAddress]);

  const handleAnnouncementSubmit = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      toast.error('Please provide both an announcement title and message.');
      return;
    }

    setLoading(true);
    try {
      let targetUsers = [];

      if (isSuperuser) {
        let query = supabase.from("users").select("id, isWriter, isArtist");

        if (audience === "writers") {
          query = query.eq("isWriter", true);
        } else if (audience === "artists") {
          query = query.eq("isArtist", true);
        } else if (audience === "creators") {
          query = query.or("isWriter.eq.true,isArtist.eq.true");
        }

        const { data: allUsers, error: usersError } = await query;

        if (usersError) throw new Error(`Failed to fetch users: ${usersError.message}`);
        if (!allUsers || allUsers.length === 0) throw new Error(`No users found for audience: ${audience}`);

        targetUsers = allUsers.map((user) => user.id);
        console.log("Target users (superuser):", targetUsers);
      } else if (isWriter || isArtist) {
        const { data: works, error: worksError } = await supabase
          .from(isWriter ? "novels" : "manga")
          .select("id")
          .eq("user_id", currentUserId);

        if (worksError) throw new Error(`Failed to fetch works: ${worksError.message}`);
        if (!works || works.length === 0) {
          toast.error('You have no works to announce about.');
          setLoading(false);
          return;
        }

        const workIds = works.map((work) => work.id);
        const { data: interactions, error: interactionsError } = await supabase
          .from(isWriter ? "novel_interactions" : "manga_interactions")
          .select("user_id")
          .in(isWriter ? "novel_id" : "manga_id", workIds)
          .neq("user_id", currentUserId);

        if (interactionsError) throw new Error(`Failed to fetch interactions: ${interactionsError.message}`);

        targetUsers = [...new Set(interactions?.map((interaction) => interaction.user_id) || [])];
        console.log("Target users (writer/artist):", targetUsers);
      }

      if (targetUsers.length === 0) {
        toast.error('No users to notify for the selected audience.');
        setLoading(false);
        return;
      }

      const announcementData = {
        user_id: currentUserId,
        title: announcementTitle,
        message: announcementMessage,
        release_date: announcementReleaseDate ? announcementReleaseDate.toISOString() : null,
        is_superuser_announcement: isSuperuser,
        audience: isSuperuser ? audience : null,
      };

      const { data: saved, error: announcementError } = await supabase
        .from("announcements")
        .insert([announcementData])
        .select("id")
        .single();

      if (announcementError) throw new Error(`Failed to insert announcement: ${announcementError.message}`);

      // The server delivers it (in-app + push) after checking who may send to whom.
      const sent = await readerAction("announcement_notify", { announcementId: saved.id });
      if (!sent.ok) throw new Error(`Announcement saved, but delivery failed: ${sent.error}`);

      toast.success(sent.notified ? `Announcement sent to ${sent.notified} reader${sent.notified === 1 ? '' : 's'}!` : 'Announcement posted!');
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementReleaseDate(null);
      setAudience("all");
    } catch (err) {
      console.error("Full error details:", err);
      toast.error(`Failed to send announcement: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (isWalletConnected && !hasAccess && (loading || !accessChecked)) {
    return <ScreenSkeleton variant="list" label="Loading announcements" />;
  }

  if (!isWalletConnected) {
    return <GelGate icon="bullhorn" headerTitle="Announcements" subtitle="Connect a wallet to post announcements to your readers." />;
  }

  if (!hasAccess) {
    return (
      <GelGate
        icon="lock"
        headerTitle="Announcements"
        title="Creators only"
        subtitle="Writers, artists and admins can post announcements. Apply to become a creator."
        action="Become a creator"
        onAction={() => navigation.navigate('Apply')}
      />
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 16 }}>
          <View pointerEvents="none"><GelOrb icon="bullhorn" size={60} lit breathe={false} /></View>
          <Text style={{ fontFamily: 'Yoruka', fontSize: 28, color: colors.textPrimary, marginTop: 12 }}>New announcement</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6, maxWidth: 340 }}>
            Tell your readers what's coming — it lands in their notifications.
          </Text>
        </View>
        <GelGlass radius={28} glow={false} padding={18}>
          <GelInput label="Title" value={announcementTitle} onChangeText={setAnnouncementTitle} placeholder="e.g. Chapter 40 drops Friday!" style={{ marginTop: 0 }} />
          <GelInput label="Message" value={announcementMessage} onChangeText={setAnnouncementMessage} placeholder="Write your announcement" multiline />
          <GelInput
            label="Release date (optional)"
            value={announcementReleaseDate ? announcementReleaseDate.toLocaleDateString() : ''}
            onChangeText={(text) => {
              if (!text) { setAnnouncementReleaseDate(null); return; }
              const date = new Date(text);
              if (!isNaN(date.getTime())) setAnnouncementReleaseDate(date);
            }}
            placeholder="MM/DD/YYYY"
            hint="Leave empty to post now"
          />
          {isSuperuser ? (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 14, marginLeft: 4 }}>Who gets it</Text>
              <GelChips
                options={[{ value: 'all', label: 'All' }, { value: 'writers', label: 'Writers' }, { value: 'artists', label: 'Artists' }, { value: 'creators', label: 'Creators' }]}
                value={audience}
                onChange={setAudience}
                style={{ marginTop: 8 }}
              />
            </>
          ) : null}
          <GelButton label="Send announcement" icon="bullhorn" loading={loading} disabled={!announcementTitle.trim() || !announcementMessage.trim()} onPress={handleAnnouncementSubmit} style={{ marginTop: 18 }} />
        </GelGlass>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AnnouncementsScreen;
