import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

/**
 * Creates a universal deep link that works across all environments
 * @param {string} path - The path to link to (e.g., '/profile', '/chapter/1')
 * @param {Object} params - Query parameters to add to the URL
 * @returns {string} The universal deep link URL
 */
export const createUniversalLink = (path, params = {}) => {
  const isExpoGo = Constants.appOwnership === 'expo';
  const scheme = 'sempai-hq';
  const webDomain = 'sempaihq.xyz';

  // For Expo Go
  if (isExpoGo) {
    return Linking.createURL(path, {
      queryParams: params
    });
  }

  // For production web
  if (typeof window !== 'undefined' && window.location) {
    return `https://${webDomain}${path}${formatQueryParams(params)}`;
  }

  // For native apps
  return `${scheme}://${path.startsWith('/') ? path.slice(1) : path}${formatQueryParams(params)}`;
};

/**
 * Formats query parameters into a URL-friendly string
 * @param {Object} params - Query parameters object
 * @returns {string} Formatted query string
 */
const formatQueryParams = (params) => {
  if (Object.keys(params).length === 0) return '';
  
  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  
  return `?${queryString}`;
};

/**
 * Opens a deep link in the app
 * @param {string} path - The path to open
 * @param {Object} params - Query parameters to add to the URL
 */
export const openDeepLink = async (path, params = {}) => {
  const url = createUniversalLink(path, params);
  const supported = await Linking.canOpenURL(url);

  if (supported) {
    await Linking.openURL(url);
  } else {
    console.error(`Cannot open URL: ${url}`);
  }
};

/**
 * Predefined deep links for common app destinations
 */
export const AppLinks = {
  home: () => createUniversalLink('/'),
  profile: (userId) => createUniversalLink('/profile', { userId }),
  chapter: (novelId, chapterId) => createUniversalLink('/chapter', { novelId, chapterId }),
  novel: (novelId) => createUniversalLink('/novel', { novelId }),
  wallet: () => createUniversalLink('/wallet'),
  tokenSwap: () => createUniversalLink('/token-swap'),
}; 