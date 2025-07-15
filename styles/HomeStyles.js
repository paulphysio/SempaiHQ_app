import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#FF5733',
    zIndex: 1000,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    padding: 8,
  },
  backgroundAnimation: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    overflow: 'hidden',
  },
  gradientLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  waveLayer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: width * 2,
    height: height * 2,
    opacity: 0.6,
  },
  waveGradient: {
    width: '100%',
    height: '100%',
    borderRadius: width,
  },
  pulseLayer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: width,
    height: width,
    transform: [{ translateX: -width / 2 }, { translateY: -width / 2 }],
  },
  circle1: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    borderWidth: 2,
    borderColor: '#F36316',
    opacity: 0.3,
    transform: [{ translateX: -width * 0.4 }, { translateY: -width * 0.4 }],
  },
  circle2: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    borderWidth: 2,
    borderColor: '#F36316',
    opacity: 0.3,
    transform: [{ translateX: -width * 0.35 }, { translateY: -width * 0.35 }],
  },
  circle3: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    borderWidth: 2,
    borderColor: '#F36316',
    opacity: 0.3,
    transform: [{ translateX: -width * 0.3 }, { translateY: -width * 0.3 }],
  },
  logoContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1001,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoText: {
    color: '#FF5733',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    fontFamily: 'AnimeAce', // Already has AnimeAce, kept for clarity
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  heroSection: {
    width: '100%',
    height: height * 0.3,
    backgroundColor: 'rgba(255, 87, 51, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 1,
    borderBottomWidth: 2,
    borderBottomColor: '#FF5733',
  },
  heroTitle: {
    color: '#fff',
    fontSize: width < 480 ? 28 : 36,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
    marginBottom: 20,
    fontFamily: 'AnimeAce', // Added
  },
  heroButtons: {
    flexDirection: 'row',
    gap: width < 480 ? 12 : 20,
  },
  heroButton: {
    backgroundColor: '#FF5733',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  heroButtonText: {
    color: '#fff',
    fontSize: width < 480 ? 16 : 18,
    fontWeight: '700',
    fontFamily: 'AnimeAce', // Added
  },
  bottomNavbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderTopWidth: 1,
    borderTopColor: '#FF5733',
    height: 80,
  },
  bottomNavButton: {
    width: width < 480 ? 50 : 60,
    height: width < 480 ? 50 : 60,
    borderRadius: width < 480 ? 25 : 30,
    backgroundColor: '#FF5733',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  notificationWrapper: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF5733',
  },
  badgeText: {
    color: '#FF5733',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'AnimeAce', // Added
  },
  announcementToggleWrapper: {
    position: 'relative',
  },
  announcementBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF5733',
  },
  notificationDropdown: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    width: width < 480 ? width * 0.85 : 320,
    maxHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 9999,
  },
  notificationList: {
    flexGrow: 0,
  },
  notificationItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 87, 51, 0.2)',
  },
  notificationMessage: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    fontFamily: 'AnimeAce', // Added
  },
  notificationDetails: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4,
    fontFamily: 'AnimeAce', // Added
  },
  markReadButton: {
    backgroundColor: '#FF5733',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  markReadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'AnimeAce', // Added
  },
  noNotifications: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    padding: 16,
    fontFamily: 'AnimeAce', // Added
  },
  announcementDropdown: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    width: width < 480 ? width * 0.85 : 320,
    maxHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 9999,
  },
  closeAnnouncementButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
  },
  announcementCarousel: {
    flexGrow: 0,
  },
  announcementCard: {
    backgroundColor: 'rgba(255, 87, 51, 0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF5733',
    marginBottom: 8,
    fontFamily: 'AnimeAce', // Added
  },
  announcementMessage: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'AnimeAce', // Added
  },
  announcementDetails: {
    fontSize: 14,
    color: '#aaa',
    fontFamily: 'AnimeAce', // Added
  },
  announcementLink: {
    color: '#FF5733',
    textDecorationLine: 'underline',
    fontWeight: '600',
    fontFamily: 'AnimeAce', // Added
  },
  announcementAuthor: {
    color: '#FF5733',
    marginRight: 8,
    fontFamily: 'AnimeAce', // Added
  },
  announcementDate: {
    marginTop: 4,
    fontFamily: 'AnimeAce', // Added
  },
  noAnnouncements: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    padding: 16,
    fontFamily: 'AnimeAce', // Added
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Reduced from 12
    paddingVertical: 10, // Reduced from 10
    paddingHorizontal: 14, // Reduced from 16
    borderRadius: 8,
    backgroundColor: 'rgba(255, 87, 51, 0.1)',
    marginVertical: 3, // Reduced from 5
  },
  navLinkText: {
    color: '#fff',
    fontSize: 16, // Reduced from 14
    fontWeight: '600',
    fontFamily: 'AnimeAce', // Keep existing font
  },
  navIcon: {
    fontSize: 16, // Reduced from 18
    marginRight: 6, // Reduced from 8
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 280,
    height: '100%',
    backgroundColor: '#1D1D1D',
    zIndex: 1000,
    paddingTop: 60, // Reduced from 80
    paddingHorizontal: 12, // Reduced from 16
    paddingBottom: 70, // Reduced from 80
    borderLeftWidth: 2,
    borderLeftColor: '#FF5733',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  sidebarContent: {
    flex: 1,
    paddingTop: 10, // Reduced from 20
  },
  sidebarProfileSection: {
    padding: 8, // Reduced from 16
    marginBottom: 8, // Reduced from 12
    borderRadius: 12,
    backgroundColor: 'rgba(255, 87, 51, 0.1)',
  },
  sidebarButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 6, // Reduced from 6
    marginBottom: 6, // Reduced from 6
    gap: 6, // Added gap to control spacing between buttons
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 87, 51, 0.2)',
    marginVertical: 8, // Reduced from 12
    marginHorizontal: 4, // Reduced from 8
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 900,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    fontFamily: 'AnimeAce', // Added
  },
  carouselContainer: {
    paddingHorizontal: 8,
  },
  contentCard: {
    width: 260,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    marginHorizontal: 8,
  },
  contentImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  contentOverlay: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  contentTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: 'AnimeAce', // Added
  },
  contentSummary: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 18,
    opacity: 1,
    fontFamily: 'AnimeAce', // Added
  },
  adultWarning: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'AnimeAce', // Added
  },
  contentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewers: {
    color: '#fff',
    fontSize: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'AnimeAce', // Added
  },
  rating: {
    color: '#fff',
    fontSize: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'AnimeAce', // Added
  },
  writerName: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  writerNameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'AnimeAce', // Added
  },
  writerIcon: {
    color: '#FF5733',
  },
  featuresSection: {
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  featuresGrid: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  featureCard: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    maxWidth: width / 2 - 24,
    backgroundColor: '#1e1e1e',
  },
  featureCardInner: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  featureImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
    backgroundColor: '#2a2a2a',
  },
  featureOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    fontFamily: 'AnimeAce', // Added
  },
  premiumBadge: {
    backgroundColor: '#FF5733',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  premiumBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    fontFamily: 'AnimeAce', // Added
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  footerText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'AnimeAce', // Added
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 12,
    fontWeight: '600',
    fontFamily: 'AnimeAce', // Added
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'AnimeAce', // Added
  },
  noContent: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    padding: 16,
    fontFamily: 'AnimeAce', // Added
  },
  // Popup Modal Styles
  popupModal: {
    justifyContent: 'center',
    margin: 0,
  },
  popupContainer: {
    backgroundColor: '#1A1A2E',
    padding: 20,
    borderRadius: 12,
    width: width * 0.8,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  popupTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'AnimeAce', // Added
  },
  popupButton: {
    backgroundColor: '#F36316',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  popupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'AnimeAce', // Added
  },
  popupCancelButton: {
    backgroundColor: 'rgba(255, 87, 51, 0.2)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F36316',
  },
  popupCancelButtonText: {
    color: '#F36316',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'AnimeAce', // Added
  },
  googleSignInImage: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLinksContainer: {
    paddingTop: 5,
    paddingBottom: 15,
  },
});