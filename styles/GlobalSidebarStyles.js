// ./styles/GlobalSidebarStyles.js
//
// Global slide-in menu — accordion groups of gel-orb sections on a glowing
// glass panel. All colours come from theme/tokens.js.

import { StyleSheet, Dimensions } from 'react-native';
import { palettes, radius, space } from '../theme/tokens';

const { width } = Dimensions.get('window');
export const SIDEBAR_WIDTH = Math.min(330, width * 0.88);

export const getGlobalSidebarStyles = (isDark = true) => {
  const c = isDark ? palettes.dark : palettes.light;

  return StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: c.scrim, zIndex: 900 },
    sidebar: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: SIDEBAR_WIDTH,
      borderTopLeftRadius: 28,
      borderBottomLeftRadius: 28,
      overflow: 'hidden',
      backgroundColor: c.bgElevated,
      zIndex: 1000,
      elevation: 24,
    },
    shadowCaster: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: SIDEBAR_WIDTH,
      borderTopLeftRadius: 28,
      borderBottomLeftRadius: 28,
      backgroundColor: c.bgElevated,
      shadowColor: isDark ? c.accent : '#000',
      shadowOffset: { width: -8, height: 0 },
      shadowOpacity: isDark ? 0.35 : 0.18,
      shadowRadius: 28,
      zIndex: 999,
    },
    edgeLight: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2 },
    edgeGlow: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 40 },
    content: { flex: 1 },

    // Hero
    hero: { paddingHorizontal: space.lg, paddingBottom: space.lg },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    logoRing: {
      width: 54,
      height: 54,
      borderRadius: 27,
      padding: 2.5,
      shadowColor: c.accent,
      shadowOpacity: 0.8,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    },
    logoInner: {
      flex: 1,
      borderRadius: 25,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: c.bgElevated,
      backgroundColor: c.bgCard,
    },
    logo: { width: '100%', height: '100%' },
    title: {
      fontSize: 24,
      fontFamily: 'Yoruka',
      letterSpacing: 0.6,
      color: c.textPrimary,
      textShadowColor: isDark ? `rgba(${c.accentRgb}, 0.6)` : 'transparent',
      textShadowRadius: 12,
      textShadowOffset: { width: 0, height: 0 },
    },
    eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 2.2, color: c.accent, marginTop: 1 },

    // Wallet card
    walletCard: {
      marginTop: space.lg,
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.borderAccent,
      padding: space.md,
    },
    walletRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    walletDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      shadowOpacity: 1,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 0 },
    },
    walletLabel: { fontSize: 10, color: c.textMuted, fontWeight: '800', letterSpacing: 1.4 },
    walletAddress: { fontSize: 17, color: c.textPrimary, fontWeight: '700', marginTop: 6, letterSpacing: 0.3 },
    walletActions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
    chip: {
      flex: 1,
      height: 38,
      borderRadius: 19,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    chipFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    chipGloss: { position: 'absolute', top: 1, left: 10, right: 10, height: 16, borderRadius: 19 },
    chipText: { fontSize: 13, color: c.textPrimary, fontWeight: '700' },

    // Groups
    scroll: { paddingHorizontal: space.md, paddingBottom: space.xl },
    group: { marginBottom: 6 },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingRight: space.md,
      paddingLeft: 2,
      borderRadius: radius.lg,
      minHeight: 52,
    },
    groupHeaderOpen: { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(30,41,59,0.04)' },
    groupTitle: { flex: 1, fontSize: 16, fontFamily: 'Yoruka', letterSpacing: 0.4, color: c.textPrimary },
    countChip: {
      minWidth: 22,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accentSoft,
      marginRight: 8,
    },
    countText: { fontSize: 11, fontWeight: '800', color: c.accent },

    items: { marginLeft: 30, marginTop: 2, marginBottom: 8, paddingLeft: 14 },
    rail: { position: 'absolute', left: 0, top: 6, bottom: 6, width: 2, borderRadius: 1 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: radius.md,
    },
    itemActive: { backgroundColor: c.accentSoft },
    itemPressed: { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(30,41,59,0.05)' },
    itemIcon: { width: 20, alignItems: 'center' },
    itemText: { flex: 1, fontSize: 15, color: c.textSecondary },
    itemTextActive: { color: c.accent, fontWeight: '700' },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.accent,
      shadowColor: c.accent,
      shadowOpacity: 1,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 0 },
    },

    // Footer
    footer: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    signOut: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 4 },
    signOutText: { fontSize: 15, color: c.danger, fontWeight: '700' },
    version: { fontSize: 11, color: c.textFaint, letterSpacing: 0.5 },
  });
};

export default getGlobalSidebarStyles;
