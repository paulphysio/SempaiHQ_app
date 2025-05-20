import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Changed to MaterialCommunityIcons
import { supabase } from '../services/supabaseClient';
import ConnectButton, { EmbeddedWalletContext } from '../components/ConnectButton';
import { styles } from '../styles/CreatorsProfileStyles';

const { width } = Dimensions.get('window');

const CreatorsProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {};
  const { wallet: embeddedWallet } = useContext(EmbeddedWalletContext);
  const [userRole, setUserRole] = useState('writer');
  const [creatorData, setCreatorData] = useState(null);
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [walletReady, setWalletReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isWriter, setIsWriter] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [showCreatorChoice, setShowCreatorChoice] = useState(false);
  const editButtonScale = new Animated.Value(1);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const normalizeWebsiteUrl = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  const getDashboardButtonProps = () => {
    if (isSuperuser || (isWriter && isArtist)) {
      return { text: 'Creator Dashboard', action: () => setShowCreatorChoice(true) };
    } else if (isWriter) {
      return { text: 'Writers Dashboard', action: () => handleNavigation('NovelDashboard') };
    } else if (isArtist) {
      return { text: 'Artist Dashboard', action: () => handleNavigation('MangaDashboard') };
    }
    return { text: 'Creator Dashboard', action: () => handleNavigation('Apply') };
  };

  const handleEditButtonPressIn = () => {
    Animated.spring(editButtonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handleEditButtonPressOut = () => {
    Animated.spring(editButtonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleNavigation = (screen, params) => {
    setLoading(true);
    setMenuOpen(false);
    setShowCreatorChoice(false);
    navigation.navigate(screen, params);
  };

  const handleCreatorChoice = (screen) => {
    setShowCreatorChoice(false);
    handleNavigation(screen);
  };

  useEffect(() => {
    if (embeddedWallet) setWalletReady(true);
  }, [embeddedWallet]);

  useEffect(() => {
    console.log('Route params:', route.params);
    console.log('EmbeddedWallet:', embeddedWallet);

    const fetchProfileDetails = async () => {
      if (!id) {
        setError('No profile ID provided. Please select a profile.');
        setLoading(false);
        setTimeout(() => {
          navigation.navigate('Home');
        }, 2000);
        return;
      }

      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, isWriter, isArtist, isSuperuser, name, wallet_address, image')
          .eq('id', id)
          .single();

        if (userError || !user) throw new Error(`User not found: ${userError?.message || 'No user data'}`);

        setIsWriter(user.isWriter || false);
        setIsArtist(user.isArtist || false);
        setIsSuperuser(user.isSuperuser || false);

        if (user.isSuperuser) setUserRole('superuser');
        else if (user.isWriter && user.isArtist) setUserRole('both');
        else if (user.isArtist) setUserRole('artist');
        else if (user.isWriter) setUserRole('writer');
        else {
          setError('This user is not a creator.');
          setLoading(false);
          return;
        }

        if (walletReady && embeddedWallet?.publicKey === user.wallet_address) {
          setIsOwnProfile(true);
        }

        const { data: profile, error: profileError } = await supabase
          .from('writer_profiles')
          .select('bio, twitter, discord, website')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') console.error('Profile fetch error:', profileError);

        console.log('Fetching novels for user ID:', user.id); // Debug log
        const { data: novelsData, error: novelsError } = await supabase
          .from('novels')
          .select('id, title, image, summary')
          .eq('user_id', user.id);

        if (novelsError) throw new Error(`Novels fetch error: ${novelsError.message}`);

        console.log('Fetched novels:', novelsData);
        setCreatorData({ ...user, ...profile });
        setNovels(novelsData || []);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileDetails();
  }, [id, walletReady, embeddedWallet, navigation, route.params]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F36316" />
      </View>
    );
  }

  const dashboardButton = getDashboardButtonProps();
  const buttonColor = userRole === 'artist' ? '#9333EA' : userRole === 'both' || userRole === 'superuser' ? '#FFD700' : '#F36316';

  return (
    <View style={[styles.container, userRole === 'artist' && styles.containerArtist, (userRole === 'both' || userRole === 'superuser') && styles.containerBoth]}>
      {/* Navbar */}
      <View style={[styles.navbar, userRole === 'artist' && styles.navbarArtist, (userRole === 'both' || userRole === 'superuser') && styles.navbarBoth]}>
        <View style={styles.navContainer}>
          <TouchableOpacity
            style={styles.logoLink}
            onPress={() => handleNavigation('Home')}
            accessibilityLabel="Sempai HQ Home"
          >
            <Image source={{ uri: 'https://via.placeholder.com/40' }} style={styles.logo} />
            <Text style={[styles.logoText, userRole === 'artist' && styles.logoTextArtist, (userRole === 'both' || userRole === 'superuser') && styles.logoTextBoth]}>
              Sempai HQ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuToggle}
            onPress={toggleMenu}
            accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <Icon
              name={menuOpen ? 'close' : 'menu'}
              size={24}
              style={[styles.menuToggleIcon, userRole === 'artist' && styles.menuToggleIconArtist, (userRole === 'both' || userRole === 'superuser') && styles.menuToggleIconBoth]}
            />
          </TouchableOpacity>
        </View>
        {menuOpen && (
          <View style={[styles.navMenu, userRole === 'artist' && styles.navMenuArtist, (userRole === 'both' || userRole === 'superuser') && styles.navMenuBoth]}>
            <TouchableOpacity style={styles.navLink} onPress={() => handleNavigation('Home')} accessibilityLabel="Home">
              <Icon name="home" size={20} color="#fff" />
              <Text style={styles.navText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navLink} onPress={() => handleNavigation('Swap')} accessibilityLabel="Swap">
              <Icon name="swap-horizontal" size={20} color="#fff" />
              <Text style={styles.navText}>Swap</Text>
            </TouchableOpacity>
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => handleNavigation('EditProfile')}
                accessibilityLabel="Edit Profile"
              >
                <Icon name="pencil" size={20} color="#fff" />
                <Text style={styles.navText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
            <ConnectButton />
          </View>
        )}
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.main}>
        <View style={[styles.header, userRole === 'artist' && styles.headerArtist, (userRole === 'both' || userRole === 'superuser') && styles.headerBoth]}>
          <Text style={styles.title}>
            <Icon name="rocket" size={24} color="#fff" /> Creator’s Nexus
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity
              style={styles.novelButton}
              onPress={() => handleNavigation('Home')}
              accessibilityLabel="Go to Home"
            >
              <Icon name="home" size={16} color="#fff" />
              <Text style={styles.novelButtonText}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Profile Card */}
            <View style={[styles.profileCard, userRole === 'artist' && styles.profileCardArtist, (userRole === 'both' || userRole === 'superuser') && styles.profileCardBoth]}>
              <View style={styles.profileHeader}>
                <Image
                  source={{ uri: creatorData?.image || 'https://via.placeholder.com/80' }}
                  style={styles.profileIcon}
                />
                <Text style={styles.sectionTitle}>
                  {creatorData?.name || creatorData?.wallet_address?.slice(0, 8) || 'Unknown'}
                </Text>
              </View>
              <Text style={styles.bio}>{creatorData?.bio || 'No bio provided.'}</Text>
              <View style={styles.socials}>
                {creatorData?.twitter && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://x.com/${creatorData.twitter}`)}
                    style={styles.socialLink}
                    accessibilityLabel={`X: ${creatorData.twitter}`}
                  >
                    <Icon name="twitter" size={20} color="#1DA1F2" />
                    <Text style={styles.socialText}>@{creatorData.twitter}</Text>
                  </TouchableOpacity>
                )}
                {creatorData?.discord && (
                  <View style={styles.socialLink}>
                    <Icon name="discord" size={20} color="#5865F2" />
                    <Text style={styles.socialText}>{creatorData.discord}</Text>
                  </View>
                )}
                {creatorData?.website && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(normalizeWebsiteUrl(creatorData.website))}
                    style={styles.socialLink}
                    accessibilityLabel="Website"
                  >
                    <Icon name="web" size={20} color={buttonColor} />
                    <Text style={styles.socialText}>Website</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.walletInfo}>
                <Icon name="wallet" size={16} color="#fff" /> {creatorData?.wallet_address?.slice(0, 8) || 'N/A'}...
              </Text>
            </View>

            {/* Novels Section */}
            <View style={styles.novelsSection}>
              <Text style={styles.sectionTitle}>
                <Icon name="book" size={20} color={buttonColor} /> Creations
              </Text>
              {novels.length > 0 ? (
                <View style={styles.novelGrid}>
                  {novels.map((novel) => {
                    console.log('Novel ID:', novel.id);
                    return (
                      <View key={novel.id} style={styles.novelCard}>
                        <Image
                          source={{ uri: novel.image || 'https://via.placeholder.com/80x120' }}
                          style={styles.novelImage}
                        />
                        <Text style={styles.novelTitle}>{novel.title || 'Untitled'}</Text>
                        <Text style={styles.novelSummary}>
                          {(novel.summary || 'No summary available.').slice(0, 100)}...
                        </Text>
                        <TouchableOpacity
                          style={[styles.novelButton, { backgroundColor: buttonColor }]}
                          onPress={() => handleNavigation('Novel', { id: novel.id })}
                          accessibilityLabel={`Read more about ${novel.title || 'this novel'}`}
                        >
                          <Icon name="book" size={16} color="#fff" />
                          <Text style={styles.novelButtonText}>Read More</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.placeholder}>No creations yet.</Text>
              )}
            </View>

            {/* Profile Actions */}
            {isOwnProfile && (
              <View style={styles.profileActions}>
                <Animated.View style={{ flex: 1, transform: [{ scale: editButtonScale }] }}>
                  <TouchableOpacity
                    style={[styles.navButton, { backgroundColor: buttonColor, marginRight: 8 }]}
                    onPress={() => handleNavigation('EditProfile')}
                    onPressIn={handleEditButtonPressIn}
                    onPressOut={handleEditButtonPressOut}
                    accessibilityLabel="Edit Profile"
                  >
                    <Image
                      source={{ uri: creatorData?.image || 'https://via.placeholder.com/40' }}
                      style={styles.editProfileIcon}
                    />
                    <Text style={styles.navButtonText}>Edit Profile</Text>
                  </TouchableOpacity>
                </Animated.View>
                <TouchableOpacity
                  style={[styles.navButton, { backgroundColor: buttonColor }]}
                  onPress={dashboardButton.action}
                  accessibilityLabel={dashboardButton.text}
                >
                  <Icon name="rocket" size={16} color="#fff" />
                  <Text style={styles.navButtonText}>{dashboardButton.text}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Creator Choice Modal */}
      <Modal
        isVisible={showCreatorChoice}
        onBackdropPress={() => setShowCreatorChoice(false)}
        style={styles.modal}
      >
        <View style={[styles.creatorChoicePopup, userRole === 'artist' && styles.creatorChoicePopupArtist, (userRole === 'both' || userRole === 'superuser') && styles.creatorChoicePopupBoth]}>
          <TouchableOpacity
            style={styles.closePopupButton}
            onPress={() => setShowCreatorChoice(false)}
            accessibilityLabel="Close dashboard choice"
          >
            <Icon name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.popupTitle}>Choose Your Dashboard</Text>
          <Text style={styles.popupMessage}>
            You have multiple creator roles. Which dashboard would you like to access?
          </Text>
          <View style={{ marginBottom: 8 }}>
            <TouchableOpacity
              style={[styles.choiceButton, { backgroundColor: buttonColor }]}
              onPress={() => handleCreatorChoice('NovelDashboard')}
              accessibilityLabel="Novel Creators Dashboard"
            >
              <Text style={styles.choiceButtonText}>Novel Creators Dashboard</Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity
              style={[styles.choiceButton, { backgroundColor: buttonColor }]}
              onPress={() => handleCreatorChoice('MangaDashboard')}
              accessibilityLabel="Manga Creators Dashboard"
            >
              <Text style={styles.choiceButtonText}>Manga Creators Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CreatorsProfileScreen;