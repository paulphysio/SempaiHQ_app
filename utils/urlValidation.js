/**
 * URL validation utility to prevent SSRF attacks
 * Validates that URLs are from allowed domains before making fetch requests
 */

// The test project (staging builds) is allowed too.
const STAGING_HOST = (() => {
  try { return new URL(process.env.EXPO_PUBLIC_STAGING_SUPABASE_URL || '').hostname; } catch { return ''; }
})();

const ALLOWED_DOMAINS = [
  ...(STAGING_HOST ? [STAGING_HOST] : []),
  'xqeimsncmnqsiowftdmz.supabase.co',
  'sempaihq.com',
  'api.sempaihq.com',
  'lite-api.jup.ag',
];

/**
 * Validates if a URL is from an allowed domain
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if URL is allowed, false otherwise
 */
export function isUrlAllowed(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check if hostname matches any allowed domain or subdomain
    return ALLOWED_DOMAINS.some(allowedDomain => {
      if (hostname === allowedDomain) return true;
      if (hostname.endsWith(`.${allowedDomain}`)) return true;
      return false;
    });
  } catch (error) {
    console.error('[urlValidation] Invalid URL:', url, error);
    return false;
  }
}

/**
 * Safe fetch wrapper that validates URL before making request
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 * @throws {Error} - If URL is not allowed
 */
export async function safeFetch(url, options) {
  if (!isUrlAllowed(url)) {
    throw new Error(`URL not allowed: ${url}`);
  }
  return fetch(url, options);
}
