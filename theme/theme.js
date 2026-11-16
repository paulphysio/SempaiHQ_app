import { Dimensions, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * SempaiHQ "Midnight Ink" design system.
 * Deep indigo-black canvas, vermilion brand accent, sakura + electric-violet secondary,
 * gold for premium. Manga-panel borders and hard offset shadows give the anime feel.
 */
export const colors = {
  bg: '#0A0A14',
  bgDeep: '#06060D',
  surface: '#12121F',
  surfaceHi: '#1A1A2C',
  surfaceTop: '#232338',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.16)',

  primary: '#F36316', // brand vermilion
  primaryHi: '#FF8A3D',
  primaryDeep: '#C2410C',
  sakura: '#FF4D8D',
  electric: '#7C5CFF',
  gold: '#FFC857',
  mint: '#3DDC97',
  danger: '#FF5470',
  info: '#4CC9F0',

  text: '#FFFFFF',
  textDim: '#C7C7DA',
  textMute: '#8A8AA6',
  textFaint: '#5B5B78',
  onPrimary: '#FFFFFF',
  scrim: 'rgba(5,5,12,0.72)',
};

export const gradients = {
  primary: ['#FF8A3D', '#F36316', '#E0430E'],
  sakura: ['#FF7AB0', '#FF4D8D', '#C0266B'],
  electric: ['#9B85FF', '#7C5CFF', '#5036E0'],
  gold: ['#FFE08A', '#FFC857', '#E29A1B'],
  hero: ['rgba(10,10,20,0)', 'rgba(10,10,20,0.75)', '#0A0A14'],
  card: ['rgba(10,10,20,0)', 'rgba(10,10,20,0.92)'],
  banner: ['#2A1456', '#6A1B9A', '#F36316'],
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, huge: 40 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

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
  bg: '#F6F3E4',
  bgDeep: '#EFEAD2',
  surface: '#FFFFFF',
  surfaceHi: '#F5F2E2',
  surfaceTop: '#EBE7CF',
  line: 'rgba(30, 41, 59, 0.10)',
  lineStrong: 'rgba(30, 41, 59, 0.22)',

  primary: '#3B82F6',
  primaryHi: '#60A5FA',
  primaryDeep: '#2563EB',
  sakura: '#DB2777',
  electric: '#6D4AFF',
  gold: '#B45309',
  mint: '#0E9F6E',
  danger: '#E11D48',
  info: '#0284C7',

  text: '#1E293B',
  textDim: '#475569',
  textMute: '#64748B',
  textFaint: '#94A3B8',
  onPrimary: '#FFFFFF',
  scrim: 'rgba(30, 41, 59, 0.5)',
};

const lightGradients = {
  primary: ['#60A5FA', '#3B82F6', '#2563EB'],
  sakura: ['#F472B6', '#DB2777', '#BE185D'],
  electric: ['#A78BFA', '#6D4AFF', '#4F46E5'],
  gold: ['#FBBF24', '#D97706', '#B45309'],
  hero: ['rgba(246,243,228,0)', 'rgba(246,243,228,0.8)', '#F6F3E4'],
  card: ['rgba(246,243,228,0)', 'rgba(246,243,228,0.95)'],
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
