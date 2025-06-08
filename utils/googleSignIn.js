import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

if (Platform.OS === 'android') {
  GoogleSignin.configure({
    webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
    offlineAccess: true,
  });
}

export const signInWithGoogle = async () => {
  if (Platform.OS !== 'android') {
    console.log('Google Sign-In is only supported on Android');
    return null;
  }

  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    console.log('Google Sign-In Success:', userInfo);
    return userInfo;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    console.error('Error Code:', error.code);
    return null;
  }
};