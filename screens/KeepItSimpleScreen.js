import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { styles } from '../styles/HavenStyles';

const { width } = Dimensions.get('window');

const KeepItSimpleScreen = () => {
  const navigation = useNavigation();
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleButtonRef = useRef(null);
  const navLinksAnim = useRef(new Animated.Value(0)).current;

  // Simulate client-side rendering and loading
  useEffect(() => {
    setIsClient(true);
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Handle menu toggle animation
  useEffect(() => {
    if (isClient && !loading) {
      Animated.timing(navLinksAnim, {
        toValue: menuOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [menuOpen, isClient, loading]);

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  if (!isClient || loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#ff6200" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#0d1b2a', '#1b263b']}
      style={styles.page}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.nav}>
          <TouchableOpacity
            style={styles.logoLink}
            onPress={() => navigation.navigate('Home')}
            accessible={true}
            accessibilityLabel="Go to Home"
          >
            <Image
              source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
              style={styles.logo}
              defaultSource={{ uri: 'https://via.placeholder.com/45' }}
            />
            <Text style={styles.logoText}>Sempai HQ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuToggle}
            onPress={toggleMenu}
            ref={toggleButtonRef}
            accessible={true}
            accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <Animated.View
              style={[
                styles.menuIcon,
                {
                  backgroundColor: menuOpen ? 'transparent' : '#ff6200',
                  transform: [
                    {
                      rotate: navLinksAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '0deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.menuIconLine,
                  styles.menuIconBefore,
                  {
                    transform: [
                      {
                        translateY: navLinksAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                      {
                        rotate: navLinksAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '45deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.menuIconLine,
                  styles.menuIconAfter,
                  {
                    transform: [
                      {
                        translateY: navLinksAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0],
                        }),
                      },
                      {
                        rotate: navLinksAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '-45deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
        <Animated.View
          style={[
            styles.navLinks,
            {
              opacity: navLinksAnim,
              transform: [
                {
                  translateY: navLinksAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
              display: menuOpen || width > 768 ? 'flex' : 'none',
            },
          ]}
        >
          {['Home', 'Swap', 'StatPage', 'Profile'].map((screen, index) => (
            <TouchableOpacity
              key={index}
              style={styles.navLink}
              onPress={() => {
                navigation.navigate(screen);
                setMenuOpen(false);
              }}
              accessible={true}
              accessibilityLabel={`Navigate to ${screen}`}
            >
              <Text style={styles.navLinkText}>{screen}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.main}
        showsVerticalScrollIndicator={false}
      >
        {/* How to Use Section */}
        <View style={styles.howTo}>
          <Text style={styles.howToTitle}>How to Use Sempaihq.xyz</Text>
          {[
            'Visit the Dapp in the browser. (Jupiter or Phantom)',
            'Create your account/login by connecting seamlessly.',
            'Create and edit your profile in Profile tab.',
            'Read stories, comment and reply for points against a weekly rewards distribution.',
            'Hold 💎 $Amethyst to get a points multiplier each week, as well as vote and mint NFTs.',
          ].map((step, index) => (
            <View key={index} style={styles.howToListItem}>
              <View style={styles.howToListNumber}>
                <Text style={styles.howToListNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.howToListText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Haven For the Otaku</Text>
          <Text style={styles.heroSubtitle}>
            A professional ecosystem for anime, manga, and web novel enthusiasts.
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.contentText}>
            We've all heard of anime by now. I mean, it’s 2025! Manga too, if you lean far into that. But that's not exactly what this is about.
          </Text>
          <Text style={styles.contentText}>
            It's a thriving culture, with millions upon millions of humans living and existing in the world of books, anime, and manga series. People subscribe to{' '}
            <Text style={styles.highlight}>apps</Text> to watch anime and read web novels, paying for quality content that has changed lives over the years.
          </Text>
          <Text style={styles.contentText}>
            It's a beautiful thing, really, and we cannot overemphasize the importance of anime & books, this kind of media entertainment, and its accompanying subculture to humanity at large.
          </Text>

          <Text style={styles.contentHeading}>The Problem</Text>
          <Text style={styles.contentText}>
            Yet, for all its glory, this sector of entertainment lacks fulfillment in one glaring way—<Text style={styles.highlight}>giving back to the consumers</Text>.
          </Text>
          <Text style={styles.contentText}>
            Otakus, Weebs, and bibliophiles spend copious amounts of dollars on subscriptions to exclusive manga series, streaming anime, and web novel apps where we can't find quality content for free. And what do we get in return? Just personal pleasure.
          </Text>
          <Text style={styles.contentText}>
            <Text style={styles.highlight}>It shouldn't be so.</Text>
          </Text>

          <Text style={styles.contentHeading}>The Sempai Project</Text>
          <Text style={styles.contentText}>
            The <Text style={styles.highlight}>Sempai project</Text> is more than just a collection of beautiful, amazing NFT girlfriends and books. We believe this could be the beginning of a revolution in web novels, manga, and book reading.
          </Text>
          <Text style={styles.contentText}>
            By leveraging blockchain technology, we aim to create a <Text style={styles.highlight}>user-prioritized Read-to-Earn (R2E) model</Text> that combines NFTs, beautiful artwork, and immersive storylines with the power of the Solana blockchain.
          </Text>

          <Text style={styles.contentHeading}>Waifu Lore</Text>
          <Text style={styles.contentText}>
            The <Text style={styles.highlight}>Goddess Waifus</Text> were the first of their kind, created by <Text style={styles.highlight}>Amaterasu</Text> as she smiled down upon the Otakus of this world—those who have stayed true to their love for anime and otaku culture.
          </Text>
          <Text style={styles.contentText}>
            Each owner of a Waifu NFT will have special access to unreleased manga panels, web novel previews, exclusive designs, and governance rights in the ecosystem.
          </Text>

          <Text style={styles.contentHeading}>What Sets Us Apart?</Text>
          <Text style={styles.contentText}>
            We are tapping into an already <Text style={styles.highlight}>established ecosystem</Text>, one with unrivaled potential for growth.
          </Text>

          <Text style={styles.contentHeading}>From Us to You</Text>
          <Text style={styles.contentText}>
            We can't do this without you. If you see potential in this vision—a home for yourself or someone close to you—then join us.
          </Text>
          <Text style={styles.contentText}>
            <Text style={styles.highlight}>It takes just one match to start a forest fire. You know that, right?</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 Sempai HQ. All rights reserved.</Text>
      </View>
    </LinearGradient>
  );
};

export default KeepItSimpleScreen;