import { Dimensions, Platform } from 'react-native';

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
