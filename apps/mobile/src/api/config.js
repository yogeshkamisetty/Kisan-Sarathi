/**
 * Mobile runtime configuration.
 *
 * The backend origin is read from the Expo config so each build (dev / staging /
 * production) points at the right server without code changes. No API key or secret is
 * ever shipped in the client bundle — the backend holds the Gnani and JWT secrets.
 */

const DEFAULT_DEV_BASE_URL = 'http://10.0.2.2:3000'; // Android emulator -> host localhost

function resolveApiBaseUrl(extra = null) {
  // Expo exposes app.json's expo.extra via Constants.expoConfig.extra at runtime.
  if (extra && extra.apiBaseUrl) return String(extra.apiBaseUrl);
  if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL) {
    return String(process.env.EXPO_PUBLIC_API_BASE_URL);
  }
  return DEFAULT_DEV_BASE_URL;
}

/**
 * Session token storage backed by expo-secure-store when available.
 * Tokens must never land in plain AsyncStorage or on-disk JSON.
 */
function createSecureTokenStore(secureStore = null) {
  const ACCESS_KEY = 'fasal_access_token';
  const REFRESH_KEY = 'fasal_refresh_token';
  let memoryAccess = null;
  let memoryRefresh = null;

  return {
    async getToken() {
      if (memoryAccess) return memoryAccess;
      if (secureStore && secureStore.getItemAsync) {
        memoryAccess = await secureStore.getItemAsync(ACCESS_KEY);
      }
      return memoryAccess;
    },
    setSession({ accessToken, refreshToken }) {
      memoryAccess = accessToken || null;
      memoryRefresh = refreshToken || null;
      if (secureStore && secureStore.setItemAsync) {
        if (accessToken) secureStore.setItemAsync(ACCESS_KEY, accessToken);
        if (refreshToken) secureStore.setItemAsync(REFRESH_KEY, refreshToken);
      }
    },
    clear() {
      memoryAccess = null;
      memoryRefresh = null;
      if (secureStore && secureStore.deleteItemAsync) {
        secureStore.deleteItemAsync(ACCESS_KEY);
        secureStore.deleteItemAsync(REFRESH_KEY);
      }
    },
  };
}

module.exports = { resolveApiBaseUrl, createSecureTokenStore, DEFAULT_DEV_BASE_URL };
