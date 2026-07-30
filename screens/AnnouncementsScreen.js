import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import AnnouncementsStyles from '../styles/AnnouncementsStyles';

const styles = AnnouncementsStyles || StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', marginTop: 16, fontSize: 16 },
  keyboardContainer: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#667eea' },
  backButton: { marginRight: 12 },
  headerContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerTitle: { color: '#FFF', fontSize: 20,   marginLeft: 12 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  connectPrompt: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  promptText: { color: '#FFF', fontSize: 16, marginTop: 16, textAlign: 'center' },
  accessDenied: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  deniedText: { color: '#E74C3C', fontSize: 24,   marginTop: 16 },
  deniedSubtext: { color: '#FFF', fontSize: 16, marginTop: 8, textAlign: 'center' },
  dashboard: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#9B59B6', fontSize: 18,   marginLeft: 12 },
  form: { marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  label: { color: '#FFF', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#2a2a4e', color: '#FFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#667eea' },
  textarea: { backgroundColor: '#2a2a4e', color: '#FFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#667eea', minHeight: 100 },
  button: { backgroundColor: '#667eea', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

const AnnouncementsScreen = () => {
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
  const [hasAccess, setHasAccess] = useState(false);

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
      Alert.alert('Error', 'Please provide both an announcement title and message.');
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
          Alert.alert('Error', 'You have no works to announce about.');
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
        Alert.alert('Error', 'No users to notify for the selected audience.');
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

      const { error: announcementError } = await supabase
        .from("announcements")
        .insert([announcementData]);

      if (announcementError) throw new Error(`Failed to insert announcement: ${announcementError.message}`);

      const notifications = targetUsers.map((userId) => ({
        user_id: userId,
        type: "announcement",
        message: `${announcementTitle}: ${announcementMessage}`,
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) throw new Error(`Failed to insert notifications: ${notifError.message}`);

      Alert.alert('Success', 'Announcement sent successfully!');
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementReleaseDate(null);
      setAudience("all");
    } catch (err) {
      console.error("Full error details:", err);
      Alert.alert('Error', `Failed to send announcement: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !hasAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#9B59B6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
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

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
