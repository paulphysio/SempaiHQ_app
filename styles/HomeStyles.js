import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Design tokens — one source of truth for the manga/dark-orange system so
// values stay consistent across every card, chip, and modal below instead
// of each block inventing its own radius/shadow/spacing.
// ---------------------------------------------------------------------------
const COLOR = {
  bg: '#0B0B14',
  bgElevated: '#111219',
  bgCard: '#15161F',
  bgCardAlt: '#1A1B26',
  accent: '#FF5733',
  accentDeep: '#F36316',
  accentGlow: 'rgba(255, 87, 51, 0.35)',
  accentSoft: 'rgba(255, 87, 51, 0.12)',
  sakura: '#E94560',
  gold: '#FFD700',
  textPrimary: '#FFFFFF',
  textSecondary: '#C9C9D1',
  textMuted: '#8A8A99',
  border: 'rgba(255, 255, 255, 0.08)',
  borderAccent: 'rgba(255, 87, 51, 0.35)',
  danger: '#FF6B6B',
};

const RADIUS = { sm: 6, md: 10, lg: 16, xl: 20, pill: 999 };
const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28 };
const FONT = 'Yoruka';

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 6,
};

const glowShadow = {
  shadowColor: COLOR.accent,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 10,
  elevation: 6,
};

// Poster-card geometry — book-cover proportions (~1:1.45) instead of the
// old squat landscape thumbnail. CARD_STEP is exported so Home.js can pass
// the *exact* same number to snapToInterval — previously that was a
// hardcoded 276 that didn't match the actual (responsive) card width,
// which is what made the carousel scroll feel misaligned/janky.
const CARD_IMAGE_WIDTH = width < 360 ? 128 : width < 420 ? 140 : 152;
const CARD_IMAGE_HEIGHT = Math.round(CARD_IMAGE_WIDTH * 1.45);
const CARD_MARGIN = 8;

export const CARD_STEP = CARD_IMAGE_WIDTH + CARD_MARGIN * 2;
export { CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT };

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },

  // -------------------------------------------------------------------------
  // Header — brand mark, live status actions (announcements/notifications/
  // wallet/auth), and the sidebar toggle. Sits above everything, blurred-
  // glass feel via translucent elevated background + bottom accent hairline.
  // -------------------------------------------------------------------------
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACE.m,
    paddingVertical: 10,
    backgroundColor: 'rgba(17, 18, 25, 0.94)',
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borderAccent,
    zIndex: 1000,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.m,
  },

  // Brand and grouped actions
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
  },
  brandLogo: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
  },
  brandText: {
    color: COLOR.textPrimary,
    fontSize: 17,
    
    letterSpacing: 0.8,
    fontFamily: FONT,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
  },
  headerAuthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
  },
  headerSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
    paddingVertical: 7,
    paddingHorizontal: SPACE.m,
    borderRadius: RADIUS.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLOR.accent,
  },
  headerSignInIcon: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  headerSignInText: {
    color: COLOR.accent,
    fontSize: 12,
    
    letterSpacing: 0.3,
    fontFamily: FONT,
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: COLOR.border,
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: COLOR.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLOR.bgElevated,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 9,
    
    fontFamily: FONT,
  },
  authLauncher: {
    backgroundColor: COLOR.accent,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.lg,
    ...cardShadow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  authDropdown: {
    position: 'absolute',
    top: 58,
    right: 12,
    width: Math.min(width * 0.82, 280),
    backgroundColor: COLOR.bgElevated,
    borderRadius: RADIUS.lg,
    padding: SPACE.m,
    ...cardShadow,
    borderWidth: 1,
    borderColor: COLOR.border,
    zIndex: 1001,
    alignItems: 'center',
  },
  authItem: {
    marginVertical: 6,
    width: '100%',
    alignItems: 'center',
  },

  // Compact sign out button in header
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: SPACE.m,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 51, 0.3)',
  },
  signOutText: {
    color: COLOR.accent,
    fontSize: 12,
    
    letterSpacing: 0.3,
    fontFamily: FONT,
  },

  // Compact header wallet chip
  headerWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: SPACE.m,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.accent,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    ...glowShadow,
  },
  headerWalletText: {
    color: '#fff',
    fontSize: 12,
    
    letterSpacing: 0.3,
    fontFamily: FONT,
  },

  // Header wallet dropdown
  headerWalletDropdown: {
    position: 'absolute',
    top: 58,
    right: 12,
    width: Math.min(width * 0.8, 250),
    backgroundColor: COLOR.bgElevated,
    borderRadius: RADIUS.lg,
    padding: SPACE.s,
    ...cardShadow,
    borderWidth: 1,
    borderColor: COLOR.border,
    zIndex: 1002,
  },
  headerWalletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
    paddingVertical: 10,
    paddingHorizontal: SPACE.s,
    borderRadius: RADIUS.sm,
  },
  headerWalletItemText: {
    color: '#fff',
    fontSize: 13,
    
    letterSpacing: 0.3,
    fontFamily: FONT,
  },
  headerWalletDivider: {
    height: 1,
    backgroundColor: COLOR.border,
    marginVertical: 4,
  },

  menuButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: COLOR.border,
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
    borderColor: COLOR.accentDeep,
    opacity: 0.25,
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
    borderColor: COLOR.accentDeep,
    opacity: 0.25,
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
    borderColor: COLOR.accentDeep,
    opacity: 0.25,
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
    ...cardShadow,
  },

  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  logoText: {
    color: COLOR.accent,
    fontSize: 20,
    
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    fontFamily: FONT,
  },

  scrollContainer: {
    flex: 1,
  },

  contentContainer: {
    paddingBottom: 100,
  },

  // -------------------------------------------------------------------------
  // Hero — layered gradient with a small eyebrow line above the headline so
  // the section reads as a designed moment, not just a colored box.
  // -------------------------------------------------------------------------
  heroSection: {
    width: '100%',
    height: height * 0.24,
    backgroundColor: 'rgba(233, 69, 96, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.m,
    zIndex: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(233, 69, 96, 0.3)',
  },

  heroEyebrow: {
    color: COLOR.gold,
    fontSize: 11,
    
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: FONT,
  },

  heroTitle: {
    color: COLOR.textPrimary,
    fontSize: width < 380 ? 23 : width < 480 ? 25 : 29,
    
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
    marginBottom: 16,
    letterSpacing: 0.5,
    fontFamily: FONT,
  },

  heroButtons: {
    flexDirection: 'row',
    gap: width < 380 ? 10 : width < 480 ? 12 : 14,
  },

  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLOR.accent,
    paddingVertical: width < 380 ? 9 : 11,
    paddingHorizontal: width < 380 ? 16 : 20,
    borderRadius: RADIUS.pill,
    ...glowShadow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  heroButtonText: {
    color: '#fff',
    fontSize: width < 380 ? 12 : width < 480 ? 13 : 14,
    
    fontFamily: FONT,
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
    borderTopColor: COLOR.accent,
    height: 80,
  },

  bottomNavButton: {
    width: width < 480 ? 50 : 60,
    height: width < 480 ? 50 : 60,
    borderRadius: width < 480 ? 25 : 30,
    backgroundColor: COLOR.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...glowShadow,
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
    borderColor: COLOR.accent,
  },

  badgeText: {
    color: COLOR.accent,
    fontSize: 12,
    
    fontFamily: FONT,
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
    borderColor: COLOR.accent,
  },

  notificationDropdown: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: COLOR.bgElevated,
    borderRadius: RADIUS.lg,
    padding: SPACE.l,
    width: width < 480 ? width * 0.85 : 320,
    maxHeight: height * 0.5,
    ...cardShadow,
    borderWidth: 1,
    borderColor: COLOR.border,
    zIndex: 9999,
  },

  notificationList: {
    flexGrow: 0,
  },

  notificationItem: {
    padding: SPACE.m,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },

  notificationMessage: {
    fontSize: 15,
    color: '#fff',
    
    fontFamily: FONT,
  },

  notificationDetails: {
    fontSize: 13,
    color: COLOR.textMuted,
    marginTop: 4,
    fontFamily: FONT,
  },

  markReadButton: {
    backgroundColor: COLOR.accent,
    padding: 12,
    borderRadius: RADIUS.md,
    marginTop: SPACE.m,
    alignItems: 'center',
    ...glowShadow,
  },

  markReadButtonText: {
    color: '#fff',
    fontSize: 15,
    
    fontFamily: FONT,
  },

  noNotifications: {
    fontSize: 15,
    color: COLOR.textMuted,
    textAlign: 'center',
    padding: SPACE.l,
    fontFamily: FONT,
  },

  announcementDropdown: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: COLOR.bgElevated,
    borderRadius: RADIUS.lg,
    padding: SPACE.l,
    width: width < 480 ? width * 0.85 : 320,
    maxHeight: height * 0.5,
    ...cardShadow,
    borderWidth: 1,
    borderColor: COLOR.border,
    zIndex: 9999,
  },

  closeAnnouncementButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  announcementCarousel: {
    flexGrow: 0,
  },

  announcementCard: {
    backgroundColor: COLOR.accentSoft,
    borderRadius: RADIUS.md,
    padding: SPACE.m,
    marginBottom: SPACE.s,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 51, 0.18)',
  },

  announcementTitle: {
    fontSize: 16,
    
    color: COLOR.accent,
    marginBottom: 6,
    fontFamily: FONT,
  },

  announcementMessage: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
    lineHeight: 19,
    fontFamily: FONT,
  },

  announcementDetails: {
    fontSize: 12,
    color: COLOR.textMuted,
    fontFamily: FONT,
  },

  announcementLink: {
    color: COLOR.accent,
    textDecorationLine: 'underline',
    
    fontFamily: FONT,
  },

  announcementAuthor: {
    color: COLOR.accent,
    marginRight: 8,
    fontFamily: FONT,
  },

  announcementDate: {
    marginTop: 4,
    color: COLOR.textMuted,
    fontFamily: FONT,
  },

  noAnnouncements: {
    fontSize: 15,
    color: COLOR.textMuted,
    textAlign: 'center',
    padding: SPACE.l,
    fontFamily: FONT,
  },

  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.sm,
    backgroundColor: COLOR.accentSoft,
    marginVertical: 3,
  },

  navLinkText: {
    color: '#fff',
    fontSize: 16,
    
    fontFamily: FONT,
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
    backgroundColor: '#17171f',
    zIndex: 1000,
    paddingTop: 60,
    paddingHorizontal: SPACE.m,
    paddingBottom: 70,
    borderLeftWidth: 2,
    borderLeftColor: COLOR.accent,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },

  sidebarContent: {
    flex: 1,
    paddingTop: 10,
  },

  sidebarProfileSection: {
    padding: SPACE.s,
    marginBottom: SPACE.s,
    borderRadius: RADIUS.lg,
    backgroundColor: COLOR.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 51, 0.18)',
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
    backgroundColor: COLOR.border,
    marginVertical: SPACE.s,
    marginHorizontal: 4,
  },

  navGroup: {
    marginBottom: 6,
  },

  navGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACE.m,
    paddingHorizontal: SPACE.l,
    backgroundColor: COLOR.bgCardAlt,
    borderRadius: RADIUS.md,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLOR.border,
  },

  navGroupText: {
    color: '#FFFFFF',
    fontSize: 15,
    
    fontFamily: FONT,
    marginLeft: 12,
  },

  dropdownIcon: {
    marginLeft: 8,
  },

  dropdown: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: RADIUS.md,
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 8,
    overflow: 'hidden',
    borderLeftWidth: 2,
    borderLeftColor: COLOR.accent,
  },

  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    paddingHorizontal: SPACE.l,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },

  dropdownItemText: {
    color: '#EDEDF2',
    fontSize: 13,
    
    fontFamily: FONT,
    marginLeft: 12,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 900,
  },

  // -------------------------------------------------------------------------
  // Sections — accent bar + icon-style header, with an optional "See all"
  // action to the right instead of a bare title floating alone.
  // -------------------------------------------------------------------------
  section: {
    marginBottom: 26,
    paddingHorizontal: SPACE.m,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.m,
  },

  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
  },

  sectionAccentBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: COLOR.accent,
  },

  sectionTitle: {
    color: COLOR.textPrimary,
    fontSize: width < 380 ? 16 : width < 480 ? 18 : 20,
    
    textAlign: 'left',
    fontFamily: FONT,
    letterSpacing: 0.5,
  },

  sectionSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  sectionSeeAllText: {
    color: COLOR.textSecondary,
    fontSize: 12,
    
    fontFamily: FONT,
  },

  carouselContainer: {
    paddingHorizontal: 8,
  },

  // -------------------------------------------------------------------------
  // Content cards (novel/manga) — poster-style: image reads as a book/manga
  // cover (tall aspect, not a squashed landscape thumbnail), rank + rating
  // float as small badges *on* the image, and title/metadata live in normal
  // flow underneath instead of crammed into a gradient overlay. This is the
  // single biggest change from the old card — legibility no longer depends
  // on text surviving over an arbitrary photo.
  // -------------------------------------------------------------------------
  contentCard: {
    width: CARD_IMAGE_WIDTH,
    marginHorizontal: CARD_MARGIN,
  },

  contentImageWrap: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLOR.bgCardAlt,
    ...cardShadow,
  },

  contentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  rankBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: 'rgba(11, 11, 20, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLOR.accentGlow,
  },

  rankBadgeText: {
    color: COLOR.accent,
    fontSize: 11,
    
    fontFamily: FONT,
  },

  ratingFloatBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(11, 11, 20, 0.78)',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },

  ratingFloatText: {
    color: '#fff',
    fontSize: 11,
    
    fontFamily: FONT,
  },

  adultRibbon: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    backgroundColor: COLOR.danger,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
  },

  contentInfo: {
    paddingTop: 9,
    paddingHorizontal: 1,
  },

  contentTitle: {
    color: COLOR.textPrimary,
    fontSize: 13,
    
    fontFamily: FONT,
    lineHeight: 17,
    letterSpacing: 0.1,
  },

  contentSummary: {
    // Kept (unused on the card itself now) in case a detail-page or list
    // view still wants the same summary typography as before.
    color: '#D8D8E2',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT,
  },

  adultWarning: {
    color: '#fff',
    fontSize: 9,
    
    letterSpacing: 0.4,
    fontFamily: FONT,
  },

  contentStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },

  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  viewers: {
    color: COLOR.textMuted,
    fontSize: 11,
    fontFamily: FONT,
  },

  rating: {
    color: COLOR.textMuted,
    fontSize: 11,
    fontFamily: FONT,
  },

  writerName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    flexShrink: 1,
  },

  writerNameText: {
    color: COLOR.textMuted,
    fontSize: 11,
    
    fontFamily: FONT,
    flexShrink: 1,
  },

  writerIcon: {
    color: COLOR.accent,
  },

  // -------------------------------------------------------------------------
  // Cinematic card expansion — the small poster's image morphs into this
  // panel in place (see CinematicCardOverlay). Kept separate from the
  // regular card styles since geometry here is screen-relative, not
  // card-relative.
  // -------------------------------------------------------------------------
  cinematicBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },

  cinematicLetterbox: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#000',
  },

  cinematicPanel: {
    position: 'absolute',
    backgroundColor: COLOR.bgCard,
    ...cardShadow,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },

  cinematicGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '68%',
  },

  cinematicContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACE.xl,
  },

  cinematicBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
    marginBottom: SPACE.s,
  },

  cinematicRankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLOR.accentSoft,
    borderWidth: 1,
    borderColor: COLOR.accentGlow,
    borderRadius: RADIUS.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  cinematicRankPillText: {
    color: COLOR.accent,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FONT,
  },

  cinematicRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  cinematicRatingPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONT,
  },

  cinematicTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: FONT,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  cinematicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.m,
    marginBottom: SPACE.m,
  },

  cinematicMetaText: {
    color: COLOR.textSecondary,
    fontSize: 12,
    fontFamily: FONT,
  },

  cinematicSummaryScroll: {
    maxHeight: 132,
    marginBottom: SPACE.l,
  },

  cinematicSummaryText: {
    color: '#E4E4EC',
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: FONT,
  },

  cinematicCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLOR.accent,
    borderRadius: RADIUS.pill,
    paddingVertical: 13,
    ...glowShadow,
  },

  cinematicCTAText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONT,
    letterSpacing: 0.4,
  },

  cinematicCloseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  cinematicHint: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: RADIUS.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },

  cinematicHintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontFamily: FONT,
  },

  // Shimmer skeleton — shown in place of the carousel while data loads,
  // sized to match the real poster card exactly so nothing reflows once
  // real content swaps in.
  skeletonCard: {
    width: CARD_IMAGE_WIDTH,
    marginHorizontal: CARD_MARGIN,
  },

  skeletonImage: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    borderRadius: RADIUS.lg,
    backgroundColor: COLOR.bgCardAlt,
  },

  skeletonLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: COLOR.bgCardAlt,
    marginTop: 9,
  },

  skeletonLineShort: {
    width: '55%',
  },

  // -------------------------------------------------------------------------
  // Feature grid
  // -------------------------------------------------------------------------
  featuresSection: {
    marginBottom: 22,
    paddingHorizontal: SPACE.m,
  },

  featuresGrid: {
    paddingHorizontal: 6,
    justifyContent: 'center',
  },

  featureCard: {
    flex: 1,
    margin: 6,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...cardShadow,
    maxWidth: width / 2 - 20,
    backgroundColor: COLOR.bgCardAlt,
    borderWidth: 1,
    borderColor: COLOR.border,
  },

  featureCardInner: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },

  featureImage: {
    width: '100%',
    height: width < 380 ? 116 : 128,
    resizeMode: 'cover',
    backgroundColor: '#202234',
  },

  featureImageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },

  featureOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACE.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  featureTitle: {
    color: '#fff',
    fontSize: 13,
    
    flex: 1,
    fontFamily: FONT,
    letterSpacing: 0.4,
  },

  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLOR.accent,
    borderRadius: RADIUS.pill,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  premiumBadgeText: {
    color: '#fff',
    fontSize: 10,
    
    textTransform: 'uppercase',
    fontFamily: FONT,
    letterSpacing: 0.4,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: COLOR.bgElevated,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
  },
  footerText: {
    color: COLOR.textMuted,
    fontSize: 13,
    
    fontFamily: FONT,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 17,
    marginTop: 14,
    
    fontFamily: FONT,
    letterSpacing: 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: COLOR.danger,
    fontSize: 16,
    textAlign: 'center',
    
    fontFamily: FONT,
  },
  noContent: {
    color: COLOR.textMuted,
    fontSize: 15,
    textAlign: 'center',
    padding: SPACE.l,
    fontFamily: FONT,
  },
  // Popup Modal Styles
  popupModal: {
    justifyContent: 'center',
    margin: 0,
  },
  popupContainer: {
    backgroundColor: COLOR.bgElevated,
    padding: SPACE.xl,
    borderRadius: RADIUS.xl,
    width: width * 0.85,
    alignSelf: 'center',
    ...cardShadow,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  popupTitle: {
    color: '#fff',
    fontSize: 19,
    
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: FONT,
    letterSpacing: 0.3,
  },
  popupButton: {
    backgroundColor: COLOR.accentDeep,
    padding: 13,
    borderRadius: RADIUS.md,
    marginBottom: 10,
    alignItems: 'center',
    ...glowShadow,
  },
  popupButtonText: {
    color: '#fff',
    fontSize: 15,
    
    fontFamily: FONT,
  },
  popupCancelButton: {
    backgroundColor: COLOR.accentSoft,
    padding: 13,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLOR.accentDeep,
  },
  popupCancelButtonText: {
    color: COLOR.accentDeep,
    fontSize: 15,
    
    fontFamily: FONT,
  },
  // Header wallet connect modal inputs/errors
  headerInput: {
    backgroundColor: COLOR.bgCardAlt,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: SPACE.m,
    width: '100%',
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: COLOR.border,
    marginBottom: 10,
  },
  headerModalError: {
    color: COLOR.danger,
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: FONT,
  },
  googleSignInImage: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLinksContainer: {
    paddingTop: 5,
    paddingBottom: 15,
  },
});

// Exported so Home.js can build LinearGradient overlays that match the
// palette exactly instead of guessing at hex values inline.
export const HOME_GRADIENTS = {
  cardImage: ['transparent', 'rgba(11,11,20,0.55)', 'rgba(11,11,20,0.96)'],
  featureImage: ['transparent', 'rgba(19,20,32,0.6)', 'rgba(19,20,32,0.95)'],
};

export const HOME_COLORS = COLOR;