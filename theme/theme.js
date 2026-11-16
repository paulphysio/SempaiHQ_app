import { Dimensions, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { palettes, brand, space as tokenSpace, radius as tokenRadius } from './tokens';

const D = palettes.dark;
const L = palettes.light;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * SempaiHQ "Midnight Ink" design system.
 * Deep indigo-black canvas, vermilion brand accent, sakura + electric-violet secondary,
 * gold for premium. Manga-panel borders and hard offset shadows give the anime feel.
 */
export const colors = {
  bg: D.bg,
  bgDeep: '#06060D',
  surface: D.bgCard,
  surfaceHi: D.bgCardAlt,
  surfaceTop: D.surfaceTop,
  line: D.border,
  lineStrong: D.borderStrong,

  primary: D.accent, // brand vermilion
  primaryHi: D.accentHi,
  primaryDeep: D.accentDeep,
  sakura: D.sakura,
  electric: D.electric,
  gold: D.gold,
  mint: D.success,
  danger: D.danger,
  info: D.info,

  text: D.textPrimary,
  textDim: D.textSecondary,
  textMute: D.textMuted,
  textFaint: D.textFaint,
  onPrimary: D.onAccent,
  scrim: D.scrim,
};

export const gradients = {
  primary: [brand.orangeHi, brand.orange, brand.orangeDeep],
  sakura: ['#FF7AB0', '#FF4D8D', '#C0266B'],
  electric: ['#9B85FF', '#7C5CFF', '#5036E0'],
  gold: ['#FFE08A', brand.gold, '#E29A1B'],
  hero: ['rgba(11,11,20,0)', 'rgba(11,11,20,0.75)', D.bg],
  card: ['rgba(11,11,20,0)', 'rgba(11,11,20,0.92)'],
  banner: ['#2A1456', '#6A1B9A', brand.orange],
};

export const space = tokenSpace;
export const radius = tokenRadius;

/** Display font = your existing 'Yoruka'; body falls back to the system font. */
export const fonts = {
  display: 'Yoruka',
  body: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
};

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.text, letterSpacing: 0.4 },
  h1: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text, letterSpacing: 0.3 },
  h2: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: colors.text },
  h3: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textDim },
  bodyStrong: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.text, fontWeight: '600' },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMute },
  label: {
    fontFamily: fonts.display,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMute,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
};

/** Soft glow shadow in a given color (iOS shadow + Android elevation). */
export const glow = (color = colors.primary, strength = 0.45) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: strength,
  shadowRadius: 14,
  elevation: 8,
});

/** Manga-panel hard offset shadow: a plain bordered view placed behind a card. */
export const panelShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 5,
};

export const layout = {
  SCREEN_W,
  SCREEN_H,
  gutter: space.lg,
  // 2-column poster grid
  gridGap: space.md,
  posterW: (SCREEN_W - space.lg * 2 - space.md) / 2,
  posterH: ((SCREEN_W - space.lg * 2 - space.md) / 2) * 1.5, // 2:3 manga poster
};

export const status = {
  ongoing: { label: 'Ongoing', color: colors.mint, icon: 'broadcast-tower' },
  completed: { label: 'Completed', color: colors.info, icon: 'check-circle' },
  hiatus: { label: 'Hiatus', color: colors.gold, icon: 'pause-circle' },
};

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

/* ───────────────────────── Light palette ("Paper & Current") ─────────────────────────
 * Mirrors the app-wide light theme: warm paper background, white cards,
 * blue brand accent instead of vermilion. Use via useMangaTheme() — the
 * static `colors`/`type`/`gradients` exports above remain the dark defaults. */
const lightColors = {
  bg: L.bg,
  bgDeep: L.bgElevated,
  surface: L.bgCard,
  surfaceHi: L.bgCardAlt,
  surfaceTop: L.surfaceTop,
  line: 'rgba(30, 41, 59, 0.10)',
  lineStrong: L.borderStrong,

  primary: L.accent,
  primaryHi: L.accentHi,
  primaryDeep: L.accentDeep,
  sakura: L.sakura,
  electric: L.electric,
  gold: L.gold, // teal — light mode never uses orange/amber
  mint: L.success,
  danger: L.danger,
  info: L.info,

  text: L.textPrimary,
  textDim: L.textSecondary,
  textMute: L.textMuted,
  textFaint: L.textFaint,
  onPrimary: L.onAccent,
  scrim: L.scrim,
};

const lightGradients = {
  primary: ['#60A5FA', '#3B82F6', '#2563EB'],
  sakura: ['#F472B6', '#DB2777', '#BE185D'],
  electric: ['#A78BFA', '#6D4AFF', '#4F46E5'],
  gold: ['#22D3EE', '#0891B2', '#0E7490'],
  hero: ['rgba(253,251,212,0)', 'rgba(253,251,212,0.8)', L.bg],
  card: ['rgba(253,251,212,0)', 'rgba(253,251,212,0.95)'],
  banner: ['#1E3A8A', '#7C3AED', '#3B82F6'],
};

const buildType = (c) => ({
  hero: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: c.text, letterSpacing: 0.4 },
  h1: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: c.text, letterSpacing: 0.3 },
  h2: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: c.text },
  h3: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: c.text },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: c.textDim },
  bodyStrong: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: c.text, fontWeight: '600' },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: c.textMute },
  label: {
    fontFamily: fonts.display,
    fontSize: 11,
    lineHeight: 14,
    color: c.textMute,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

const lightStatus = {
  ongoing: { label: 'Ongoing', color: lightColors.mint, icon: 'broadcast-tower' },
  completed: { label: 'Completed', color: lightColors.info, icon: 'check-circle' },
  hiatus: { label: 'Hiatus', color: lightColors.gold, icon: 'pause-circle' },
};

const darkMangaTheme = { colors, gradients, type, status, space, radius, fonts, layout, panelShadow, glow, hitSlop };
const lightMangaTheme = {
  colors: lightColors,
  gradients: lightGradients,
  type: buildType(lightColors),
  status: lightStatus,
  space,
  radius,
  fonts,
  layout,
  panelShadow,
  glow,
  hitSlop,
};

/**
 * Theme-aware manga design tokens. Returns the dark "Midnight Ink" palette
 * or the light "Paper & Current" palette to match the app theme.
 * Usage: const { colors, gradients, type, status, ... } = useMangaTheme();
 */
export const useMangaTheme = () => {
  const { isDark } = useTheme();
  return isDark ? darkMangaTheme : lightMangaTheme;
};
