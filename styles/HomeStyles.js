import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B14', // deeper sumi-ink base for manga feel
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12, // tighter
    paddingVertical: 10,
    backgroundColor: '#111218',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243,99,22,0.5)',
    zIndex: 1000,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Brand and grouped actions
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
    fontFamily: 'AnimeAce',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAuthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF5733',
  },
  headerSignInIcon: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  headerSignInText: {
    color: '#FF5733',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    fontFamily: 'AnimeAce',
  },
  headerAction: {
    padding: 8,
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF5733',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'AnimeAce',
  },
  authLauncher: {
    backgroundColor: '#FF5733',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  authDropdown: {
    position: 'absolute',
    top: 56,
    right: 12,
    width: Math.min(width * 0.8, 280),
    backgroundColor: '#111218',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    zIndex: 1001,
  },
  authItem: {
    marginVertical: 6,
  },

  // Compact sign out button in header
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 87, 51, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 51, 0.25)',
  },
  signOutText: {
    color: '#FF5733',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontFamily: 'AnimeAce',
  },

  // Compact header wallet chip
  headerWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FF5733',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerWalletText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontFamily: 'AnimeAce',
  },

  // Header wallet dropdown
  headerWalletDropdown: {
    position: 'absolute',
    top: 56, // just below header
    right: 12,
    width: Math.min(width * 0.8, 240),
    backgroundColor: '#111218',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    zIndex: 1002,
  },
  headerWalletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  headerWalletItemText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontFamily: 'AnimeAce',
  },
  headerWalletDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 6,
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
    fontFamily: 'AnimeAce',
  },

  scrollContainer: {
    flex: 1,
  },

  contentContainer: {
    paddingBottom: 100,
  },

  heroSection: {
    width: '100%',
    height: height * 0.22,
    backgroundColor: 'rgba(233, 69, 96, 0.18)', // sakura glaze
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    zIndex: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(233,69,96,0.35)',
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: width < 380 ? 22 : width < 480 ? 24 : 28,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
    marginBottom: 12,
    letterSpacing: 0.5,
    fontFamily: 'AnimeAce',
  },

  heroButtons: {
    flexDirection: 'row',
    gap: width < 380 ? 8 : width < 480 ? 10 : 14,
  },

  heroButton: {
    backgroundColor: '#FF5733',
    paddingVertical: width < 380 ? 8 : 10,
    paddingHorizontal: width < 380 ? 14 : 18,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  heroButtonText: {
    color: '#fff',
    fontSize: width < 380 ? 12 : width < 480 ? 13 : 14,
    fontWeight: '800',
    fontFamily: 'AnimeAce',
    letterSpacing: 0.4,
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
    fontFamily: 'AnimeAce',
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
    fontFamily: 'AnimeAce',
  },

  notificationDetails: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4,
    fontFamily: 'AnimeAce',
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
    fontFamily: 'AnimeAce',
  },

  noNotifications: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    padding: 16,
    fontFamily: 'AnimeAce',
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
    fontFamily: 'AnimeAce',
  },

  announcementMessage: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'AnimeAce',
  },

  announcementDetails: {
    fontSize: 14,
    color: '#aaa',
    fontFamily: 'AnimeAce',
  },

  announcementLink: {
    color: '#FF5733',
    textDecorationLine: 'underline',
    fontWeight: '600',
    fontFamily: 'AnimeAce',
  },

  announcementAuthor: {
    color: '#FF5733',
    marginRight: 8,
    fontFamily: 'AnimeAce',
  },

  announcementDate: {
    marginTop: 4,
    fontFamily: 'AnimeAce',
  },

  noAnnouncements: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    padding: 16,
    fontFamily: 'AnimeAce',
  },

  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 87, 51, 0.1)',
    marginVertical: 3,
  },

  navLinkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'AnimeAce',
  },

  navIcon: {
    fontSize: 16,
    marginRight: 6,
  },

  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 280,
    height: '100%',
    backgroundColor: '#1D1D1D',
    zIndex: 1000,
    paddingTop: 60,
    paddingHorizontal: 12,
    paddingBottom: 70,
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
    paddingTop: 10,
  },

  sidebarProfileSection: {
    padding: 8,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 87, 51, 0.1)',
  },

  sidebarButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
    gap: 6,
  },

  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 87, 51, 0.2)',
    marginVertical: 8,
    marginHorizontal: 4,
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
    marginBottom: 22,
    paddingHorizontal: 12,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: width < 380 ? 16 : width < 480 ? 18 : 20,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    fontFamily: 'AnimeAce',
    letterSpacing: 0.5,
  },

  carouselContainer: {
    paddingHorizontal: 8,
  },

  contentCard: {
    width: width < 360 ? 210 : width < 420 ? 230 : 250,
    backgroundColor: '#0F0F18',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  contentImage: {
    width: '100%',
    height: width < 380 ? 130 : 150,
    resizeMode: 'cover',
  },

  contentOverlay: {
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },

  contentTitle: {
    color: '#fff',
    fontSize: width < 380 ? 13 : 14,
    fontWeight: '800',
    marginBottom: 2,
    fontFamily: 'AnimeAce',
    letterSpacing: 0.3,
  },

  contentSummary: {
    color: '#C9C9D1',
    fontSize: width < 380 ? 11 : 12,
    marginBottom: 6,
    lineHeight: 16,
    opacity: 1,
    fontFamily: 'AnimeAce',
  },

  adultWarning: {
    color: '#ff7575',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: 'AnimeAce',
    letterSpacing: 0.6,
  },

  contentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  viewers: {
    color: '#fff',
    fontSize: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'AnimeAce',
  },

  rating: {
    color: '#fff',
    fontSize: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'AnimeAce',
  },

  writerName: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  writerNameText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'AnimeAce',
    letterSpacing: 0.4,
  },

  writerIcon: {
    color: '#FF5733',
  },

  featuresSection: {
    marginBottom: 20,
    paddingHorizontal: 12,
  },

  featuresGrid: {
    paddingHorizontal: 6,
    justifyContent: 'center',
  },

  featureCard: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    maxWidth: width / 2 - 20,
    backgroundColor: '#131420',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  featureCardInner: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },

  featureImage: {
    width: '100%',
    height: width < 380 ? 110 : 120,
    resizeMode: 'cover',
    backgroundColor: '#202234',
  },

  featureOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  featureTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    fontFamily: 'AnimeAce',
    letterSpacing: 0.4,
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
  // Header wallet connect modal inputs/errors
  headerInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginBottom: 10,
  },
  headerModalError: {
    color: '#ff4d4f',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'AnimeAce',
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