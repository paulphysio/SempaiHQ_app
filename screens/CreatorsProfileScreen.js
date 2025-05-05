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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import ConnectButton, { EmbeddedWalletContext } from '../components/ConnectButton';

console.log('Supabase import:', supabase); // Debug import

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

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  // Normalize website URL
  const normalizeWebsiteUrl = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  // Determine dashboard button props
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
    console.log('Route params:', route.params); // Debug log
    console.log('EmbeddedWallet:', embeddedWallet); // Debug log

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

        const { data: novelsData, error: novelsError } = await supabase
          .from('novels')
          .select('id, title, image, summary')
          .eq('user_id', user.id);

        if (novelsError) throw new Error(`Novels fetch error: ${novelsError.message}`);

        console.log('Fetched novels:', novelsData); // Debug log for novels

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E' }}>
        <ActivityIndicator size="large" color="#F36316" />
      </View>
    );
  }

  const dashboardButton = getDashboardButtonProps();

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A2E' }}>
      {/* Navbar */}
      <View style={{ padding: 16, backgroundColor: '#1A1A2E', borderBottomWidth: 1, borderBottomColor: '#444' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => handleNavigation('Home')}
            accessibilityLabel="Sempai HQ Home"
          >
            <Image
              source={{ uri: 'https://via.placeholder.com/40' }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
            />
            <Text style={{ fontSize: 18, color: '#F36316', fontWeight: 'bold', marginLeft: 8 }}>
              Sempai HQ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={toggleMenu}
            accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <Icon name={menuOpen ? 'times' : 'bars'} size={24} color="#F36316" />
          </TouchableOpacity>
        </View>
        {menuOpen && (
          <View style={{ backgroundColor: '#2a2a2a', borderRadius: 8, padding: 12, marginTop: 8 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
              onPress={() => handleNavigation('Home')}
              accessibilityLabel="Home"
            >
              <Icon name="home" size={20} color="#fff" />
              <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                Home
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
              onPress={() => handleNavigation('Swap')}
              accessibilityLabel="Swap"
            >
              <Icon name="exchange-alt" size={20} color="#fff" />
              <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                Swap
              </Text>
            </TouchableOpacity>
            {isOwnProfile && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                onPress={() => handleNavigation('EditProfile')}
                accessibilityLabel="Edit Profile"
              >
                <Icon name="edit" size={20} color="#fff" />
                <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                  Edit Profile
                </Text>
              </TouchableOpacity>
            )}
            <ConnectButton />
          </View>
        )}
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ padding: 16, backgroundColor: '#F36316', borderRadius: 8, marginBottom: 16 }}>
          <Text style={{ fontSize: 24, color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>
            <Icon name="rocket" size={24} color="#fff" /> Creator’s Nexus
          </Text>
        </View>

        {error ? (
          <View style={{ alignItems: 'center', padding: 16, backgroundColor: 'rgba(255, 69, 69, 0.1)', borderRadius: 8 }}>
            <Text style={{ fontSize: 18, color: '#FF4545', textAlign: 'center', marginBottom: 16 }}>
              {error}
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F36316', padding: 12, borderRadius: 8 }}
              onPress={() => handleNavigation('Home')}
              accessibilityLabel="Go to Home"
            >
              <Icon name="home" size={16} color="#fff" />
              <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                Go to Home
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Profile Card */}
            <View style={{ backgroundColor: '#2a2a2a', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Image
                  source={{ uri: creatorData?.image || 'https://via.placeholder.com/80' }}
                  style={{ width: 80, height: 80, borderRadius: 40, marginRight: 12 }}
                />
                <Text style={{ fontSize: 20, color: '#fff', fontWeight: 'bold' }}>
                  {creatorData?.name || creatorData?.wallet_address?.slice(0, 8) || 'Unknown'}
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: '#fff', opacity: 0.8, marginBottom: 12 }}>
                {creatorData?.bio || 'No bio provided.'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                {creatorData?.twitter && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://x.com/${creatorData.twitter}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}
                    accessibilityLabel={`X: ${creatorData.twitter}`}
                  >
                    <Icon name="x" size={20} color="#1DA1F2" />
                    <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8 }}>
                      @{creatorData.twitter}
                    </Text>
                  </TouchableOpacity>
                )}
                {creatorData?.discord && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                    <Icon name="discord" size={20} color="#5865F2" />
                    <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8 }}>
                      {creatorData.discord}
                    </Text>
                  </View>
                )}
                {creatorData?.website && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(normalizeWebsiteUrl(creatorData.website))}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    accessibilityLabel="Website"
                  >
                    <Icon name="globe" size={20} color="#F36316" />
                    <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8 }}>
                      Website
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ fontSize: 16, color: '#fff', opacity: 0.7 }}>
                <Icon name="wallet" size={16} color="#fff" /> {creatorData?.wallet_address?.slice(0, 8) || 'N/A'}...
              </Text>
            </View>

            {/* Novels Section */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 20, color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>
                <Icon name="book" size={20} color="#F36316" /> Creations
              </Text>
              {novels.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {novels.map((novel) => {
                    console.log('Novel ID:', novel.id); // Debug log
                    return (
                      <View
                        key={novel.id}
                        style={{
                          width: width < 360 ? '100%' : (width - 48) / 2,
                          backgroundColor: '#2a2a2a',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 16,
                        }}
                      >
                        <Image
                          source={{ uri: novel.image || 'https://via.placeholder.com/80x120' }}
                          style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 8 }}
                        />
                        <Text style={{ fontSize: 18, color: '#fff', fontWeight: 'bold', marginBottom: 4 }}>
                          {novel.title || 'Untitled'}
                        </Text>
                        <Text style={{ fontSize: 14, color: '#fff', opacity: 0.7, marginBottom: 8 }}>
                          {(novel.summary || 'No summary available.').slice(0, 100)}...
                        </Text>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#F36316',
                            padding: 10,
                            borderRadius: 8,
                          }}
                          onPress={() => handleNavigation('Novel', { id: novel.id })} // Changed novelId to id
                          accessibilityLabel={`Read more about ${novel.title || 'this novel'}`}
                        >
                          <Icon name="book" size={16} color="#fff" />
                          <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                            Read More
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontSize: 16, color: '#fff', opacity: 0.7, textAlign: 'center' }}>
                  No creations yet.
                </Text>
              )}
            </View>

            {/* Profile Actions */}
            {isOwnProfile && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F36316',
                    padding: 12,
                    borderRadius: 8,
                    marginRight: 8,
                  }}
                  onPress={() => handleNavigation('EditProfile')}
                  accessibilityLabel="Edit Profile"
                >
                  <Image
                    source={{ uri: creatorData?.image || 'https://via.placeholder.com/40' }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                  />
                  <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                    Edit Profile
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F36316',
                    padding: 12,
                    borderRadius: 8,
                  }}
                  onPress={dashboardButton.action}
                  accessibilityLabel={dashboardButton.text}
                >
                  <Icon name="rocket" size={16} color="#fff" />
                  <Text style={{ fontSize: 16, color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                    {dashboardButton.text}
                  </Text>
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
        style={{ justifyContent: 'center', margin: 0 }}
      >
        <View style={{ backgroundColor: '#2a2a2a', borderRadius: 8, padding: 16, marginHorizontal: 20 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 8, right: 8 }}
            onPress={() => setShowCreatorChoice(false)}
            accessibilityLabel="Close dashboard choice"
          >
            <Icon name="times" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, color: '#fff', fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>
            Choose Your Dashboard
          </Text>
          <Text style={{ fontSize: 16, color: '#fff', opacity: 0.8, textAlign: 'center', marginBottom: 16 }}>
            You have multiple creator roles. Which dashboard would you like to access?
          </Text>
          <View style={{ marginBottom: 8 }}>
            <TouchableOpacity
              style={{ backgroundColor: '#F36316', padding: 12, borderRadius: 8, alignItems: 'center' }}
              onPress={() => handleCreatorChoice('NovelDashboard')}
              accessibilityLabel="Novel Creators Dashboard"
            >
              <Text style={{ fontSize: 16, color: '#fff', fontWeight: '600' }}>
                Novel Creators Dashboard
              </Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity
              style={{ backgroundColor: '#F36316', padding: 12, borderRadius: 8, alignItems: 'center' }}
              onPress={() => handleCreatorChoice('MangaDashboard')}
              accessibilityLabel="Manga Creators Dashboard"
            >
              <Text style={{ fontSize: 16, color: '#fff', fontWeight: '600' }}>
                Manga Creators Dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CreatorsProfileScreen;