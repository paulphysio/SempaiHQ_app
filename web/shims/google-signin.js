// Web: Google sign-in happens through Supabase's browser redirect instead
// (see GoogleAuthProvider: Platform.OS === 'web'). These keep imports working.
export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};
export const GoogleSignin = {
  configure: () => {},
  hasPlayServices: async () => true,
  signIn: async () => { throw Object.assign(new Error('Use web sign-in'), { code: statusCodes.SIGN_IN_REQUIRED }); },
  signInSilently: async () => { throw Object.assign(new Error('Use web sign-in'), { code: statusCodes.SIGN_IN_REQUIRED }); },
  signOut: async () => {},
  revokeAccess: async () => {},
  isSignedIn: async () => false,
  getCurrentUser: () => null,
  getTokens: async () => { throw new Error('Not available on web'); },
};
export const GoogleSigninButton = () => null;
export default GoogleSignin;
