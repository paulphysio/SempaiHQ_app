import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill';

const extras =
  // EAS builds & bare–managed workflow
  Constants.expoConfig?.extra
  // Web & older Expo SDKs
  ?? Constants.manifest?.extra
  // default empty
  ?? {};

const { supabaseUrl, supabaseKey } = extras;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Config Error] supabaseUrl or supabaseKey is missing from app config.',
    extras
  );
}

// Create client with enhanced configuration
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
