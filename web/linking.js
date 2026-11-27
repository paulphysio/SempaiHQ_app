/*
 * Web addresses for app screens. Paths match the old sempaihq.com website so
 * links people already shared (/novel/123, /novel/123/chapter/4, /manga/…)
 * keep working, and the browser's address bar / back button follow the app.
 */
import { getStateFromPath } from '@react-navigation/native';

// React Native also defines `window` (without `location`), so check for a real browser location.
const LOC = typeof window !== 'undefined' && window.location ? window.location : null;

export const linking = {
  prefixes: LOC ? [LOC.origin] : [],
  config: {
    screens: {
      Welcome: 'welcome',
      SignIn: 'signin',
      Home: '',
      NovelsPage: 'novels',
      NovelDetail: 'novel/:id',
      NovelSummary: 'novel/:id/summary',
      Chapter: 'novel/:novelId/chapter/:chapterId',
      MangaPage: 'manga',
      MangaDetail: 'manga/:id',
      MangaChapter: 'manga/:mangaId/chapter/:chapterId',
      Profile: 'profile/:userId?',
      CreatorsProfile: 'creator/:id',
      Leaderboard: 'leaderboard',
      Feed: 'feed',
      Bazaar: 'bazaar',
      BazaarBook: 'bazaar/:id',
      Wallet: 'wallet',
      Swap: 'swap',
      Ramp: 'ramp',
      Marketplace: 'marketplace',
      Announcements: 'announcements',
      Apply: 'apply',
      Badges: 'badges',
      Stats: 'stat-page',
      DAOGovernance: 'dao-governance',
      KaitoAdventure: 'kaito-adventure',
      KaitoLeaderboard: 'kaito-leaderboard',
      KeepItSimple: 'keep-it-simple',
      Chat: 'chat',
      Inbox: 'notifications',
      Admin: 'admin',
      NovelDashboard: 'novel-creators-dashboard',
      MangaDashboard: 'manga-creators-dashboard',
      CreatorDashboard: 'creator-dashboard',
      BazaarDashboard: 'bazaar-dashboard',
      UploadBook: 'bazaar-upload',
      WalletImport: 'wallet-import',
      AddGif: 'addgifpage',
      Mint: 'mint',
      Kaiji: 'kaiji',
      Download: 'download',
      PrivacyPolicy: 'privacy-policy',
      Terms: 'terms',
      Support: 'support',
      NotificationSettings: 'notification-settings',
      Browser: 'browser',
      HQPass: 'hq-pass',
    },
  },
};

// The address the visitor arrived on (before the app changes it).
export const initialWebPath = LOC
  ? LOC.pathname + LOC.search
  : '/';

export const hasDeepLink = () => {
  const p = (LOC ? LOC.pathname : '/') || '/';
  return p !== '/' && p !== '';
};

// Navigation state for a path, with Home underneath so "back" goes Home.
export function stateForPath(path) {
  const state = getStateFromPath(path, linking.config);
  if (!state?.routes?.length) return null;
  const routes = state.routes[0]?.name === 'Home' ? state.routes : [{ name: 'Home' }, ...state.routes];
  return { index: routes.length - 1, routes };
}
