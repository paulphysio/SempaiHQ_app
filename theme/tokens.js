/**
 * SempaiHQ design tokens — the ONE source of truth for colour, type, spacing
 * and radius. ThemeContext (`useTheme().colors`) and theme/theme.js
 * (`useMangaTheme()`) are both derived from this file; style files should
 * read from one of those hooks instead of hardcoding hex values.
 *
 * Dark  — "Ink & Seal": indigo-black ink, vermilion seal, warm gold.
 * Light — "Paper & Current": warm paper, cool blue current, teal accents.
 *         By design light mode never uses orange (matches the web app).
 */

export const brand = {
  orange: '#F36316',
  orangeHi: '#FF8A3D',
  orangeDeep: '#E0430E',
  orangeRgb: '243, 99, 22',
  gold: '#FFC857',
  goldRgb: '255, 200, 87',
  sakura: '#FF4D8D',
  electric: '#7C5CFF',
  blue: '#3B82F6',
  blueHi: '#60A5FA',
  blueDeep: '#2563EB',
  blueRgb: '59, 130, 246',
  teal: '#0891B2',
  tealRgb: '8, 145, 178',
};

export const palettes = {
  dark: {
    // surfaces, back → front
    bg: '#0B0B14',
    bgElevated: '#111219',
    bgCard: '#15161F',
    bgCardAlt: '#1A1B26',
    surfaceTop: '#232333',
    scrim: 'rgba(5, 5, 12, 0.72)',

    // brand
    accent: brand.orange,
    accentHi: brand.orangeHi,
    accentDeep: brand.orangeDeep,
    accentRgb: brand.orangeRgb,
    accentGlow: `rgba(${brand.orangeRgb}, 0.35)`,
    accentSoft: `rgba(${brand.orangeRgb}, 0.12)`,
    gold: brand.gold,
    goldRgb: brand.goldRgb,
    sakura: brand.sakura,
    electric: brand.electric,
    onAccent: '#FFFFFF',
    badgeInk: '#0A0602',

    // text
    textPrimary: '#FFFFFF',
    textSecondary: '#C9C9D6',
    textMuted: '#8A8AA0',
    textFaint: '#5B5B78',

    // lines
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    borderAccent: `rgba(${brand.orangeRgb}, 0.35)`,

    // status
    success: '#3DDC97',
    info: '#4CC9F0',
    danger: '#FF5470',
    warning: '#F59E0B',

    // legacy aliases still read by older screens
    overlayChip: 'rgba(11, 11, 20, 0.78)',
    bgPrimary: '#0B0B14',
    bgSecondary: '#111219',
    inputBg: '#1A1B26',
  },
  light: {
    bg: '#FDFBD4',
    bgElevated: '#F5F0D0',
    bgCard: '#FFFFFF',
    bgCardAlt: '#F8F8E8',
    surfaceTop: '#EBE7CF',
    scrim: 'rgba(30, 41, 59, 0.5)',

    accent: brand.blue,
    accentHi: brand.blueHi,
    accentDeep: brand.blueDeep,
    accentRgb: brand.blueRgb,
    accentGlow: `rgba(${brand.blueRgb}, 0.35)`,
    accentSoft: `rgba(${brand.blueRgb}, 0.12)`,
    gold: brand.teal,
    goldRgb: brand.tealRgb,
    sakura: '#DB2777',
    electric: '#6D4AFF',
    onAccent: '#FFFFFF',
    badgeInk: '#0F2733',

    textPrimary: '#1E293B',
    textSecondary: '#475569',
    textMuted: '#64748B',
    textFaint: '#94A3B8',

    border: `rgba(${brand.blueRgb}, 0.15)`,
    borderStrong: 'rgba(30, 41, 59, 0.22)',
    borderAccent: `rgba(${brand.blueRgb}, 0.35)`,

    success: '#0E9F6E',
    info: '#0284C7',
    danger: '#E11D48',
    warning: '#D97706',

    overlayChip: 'rgba(253, 251, 212, 0.9)',
    bgPrimary: '#FDFBD4',
    bgSecondary: '#F5F0D0',
    inputBg: '#FFFFFF',
  },
};

/**
 * Page-surface palette — the key names used by the profile, novel, chapter,
 * badge and library style files. Derived from the tokens above so every page
 * shares one look (those pages each used to carry a private sepia palette).
 */
export const surfacePalettes = {
  dark: {
    bg: palettes.dark.bg,
    bgCard: palettes.dark.bgCard,
    bgElevated: palettes.dark.bgElevated,
    bgElevated2: palettes.dark.bgCardAlt,
    bgInput: palettes.dark.inputBg,

    accent: palettes.dark.accent,
    accentBright: palettes.dark.accentHi,
    accentSoft: `rgba(${palettes.dark.accentRgb}, 0.16)`,
    accentDim: palettes.dark.accentDeep,

    gold: palettes.dark.gold,
    goldBright: '#FFE08A',
    goldSoft: `rgba(${palettes.dark.goldRgb}, 0.16)`,

    textPrimary: palettes.dark.textPrimary,
    textSecondary: palettes.dark.textSecondary,
    textMuted: palettes.dark.textMuted,
    textOnAccent: palettes.dark.onAccent,
    textOnGold: '#1B1404',

    border: palettes.dark.border,
    borderStrong: palettes.dark.borderStrong,
    divider: 'rgba(255, 255, 255, 0.06)',

    success: palettes.dark.success,
    successSoft: 'rgba(61, 220, 151, 0.14)',
    error: palettes.dark.danger,
    errorSoft: 'rgba(255, 84, 112, 0.14)',
    warning: palettes.dark.warning,
    warningSoft: 'rgba(245, 158, 11, 0.14)',

    overlay: 'rgba(5, 5, 12, 0.88)',
    shadow: '#000000',
    skeleton: palettes.dark.surfaceTop,
  },
  light: {
    bg: palettes.light.bg,
    bgCard: palettes.light.bgCard,
    bgElevated: palettes.light.bgElevated,
    bgElevated2: palettes.light.surfaceTop,
    bgInput: palettes.light.inputBg,

    accent: palettes.light.accent,
    accentBright: palettes.light.accentHi,
    accentSoft: palettes.light.accentSoft,
    accentDim: palettes.light.accentDeep,

    gold: palettes.light.gold,
    goldBright: '#22D3EE',
    goldSoft: `rgba(${palettes.light.goldRgb}, 0.12)`,

    textPrimary: palettes.light.textPrimary,
    textSecondary: palettes.light.textSecondary,
    textMuted: palettes.light.textMuted,
    textOnAccent: palettes.light.onAccent,
    textOnGold: '#FFFFFF',

    border: palettes.light.border,
    borderStrong: palettes.light.borderStrong,
    divider: 'rgba(30, 41, 59, 0.08)',

    success: palettes.light.success,
    successSoft: 'rgba(14, 159, 110, 0.10)',
    error: palettes.light.danger,
    errorSoft: 'rgba(225, 29, 72, 0.10)',
    warning: palettes.light.warning,
    warningSoft: 'rgba(217, 119, 6, 0.10)',

    overlay: palettes.light.scrim,
    shadow: '#1E293B',
    skeleton: palettes.light.surfaceTop,
  },
};


export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, huge: 40 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

/** Bundled brand mark — never load the logo over the network. */
export const LOGO = require('../assets/images/brand-logo.png');
/** Fallback cover for missing/broken artwork (replaces dead placeholder URLs). */
export const COVER_FALLBACK = require('../assets/images/brand-logo.png');

/** Image source for a possibly-empty remote URL. */
export const coverSource = (uri) => (uri ? { uri } : COVER_FALLBACK);
