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

  if (loading && !hasAccess) {
    return <ScreenSkeleton variant="list" label="Loading announcements" />;
  }

  if (!isWalletConnected) {
    return <GelGate icon="bullhorn" headerTitle="Announcements" subtitle="Connect a wallet to see announcements from writers you follow." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Icon name="bullhorn" size={24} color="#FFF" />
            <Text style={styles.headerTitle}>Announcements</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9B59B6" colors={['#9B59B6']} />
          }
        >
          {!isWalletConnected ? (
            <View style={styles.connectPrompt}>
              <Icon name="gem" size={60} color="#9B59B6" />
              <Text style={styles.promptText}>Connect your wallet to access the Announcements page.</Text>
            </View>
          ) : !hasAccess ? (
            <View style={styles.accessDenied}>
              <Icon name="times-circle" size={60} color="#E74C3C" />
              <Text style={styles.deniedText}>Access Denied</Text>
              <Text style={styles.deniedSubtext}>Only writers, artists, and superusers may enter.</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Home')}
                style={styles.backButton}
              >
                <Icon name="home" size={20} color="#FFF" />
                <Text style={styles.backButtonText}>Return Home</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.dashboard}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="bullhorn" size={20} color="#9B59B6" />
                  <Text style={styles.sectionTitle}>Create Announcement</Text>
                </View>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Announcement Title</Text>
                    <TextInput
                      style={styles.input}
                      value={announcementTitle}
                      onChangeText={setAnnouncementTitle}
                      placeholder="e.g., Exciting News for Fans!"
                      placeholderTextColor="#888"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Message</Text>
                    <TextInput
                      style={styles.textarea}
                      value={announcementMessage}
                      onChangeText={setAnnouncementMessage}
                      placeholder="Write your announcement here"
                      placeholderTextColor="#888"
                      multiline
                      numberOfLines={5}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Release Date (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={announcementReleaseDate ? announcementReleaseDate.toLocaleDateString() : ''}
                      onChangeText={(text) => {
                        if (text) {
                          const date = new Date(text);
                          if (!isNaN(date.getTime())) {
                            setAnnouncementReleaseDate(date);
                          }
                        } else {
                          setAnnouncementReleaseDate(null);
                        }
                      }}
                      placeholder="MM/DD/YYYY"
                      placeholderTextColor="#888"
                    />
                  </View>

                  {isSuperuser && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Target Audience</Text>
                      <View style={styles.pickerContainer}>
                        {['all', 'writers', 'artists', 'creators'].map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.pickerOption,
                              audience === option && styles.pickerOptionActive,
                            ]}
                            onPress={() => setAudience(option)}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                audience === option && styles.pickerOptionTextActive,
                              ]}
                            >
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleAnnouncementSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <View style={styles.buttonContent}>
                        <Icon name="bullhorn" size={20} color="#FFF" />
                        <Text style={styles.buttonText}>Send Announcement</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AnnouncementsScreen;
