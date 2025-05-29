// services/supabaseClient.js
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill';

const extras =
  Constants.expoConfig?.extra ??
  Constants.manifest?.extra ??
  {};

const { supabaseUrl, supabaseKey } = extras;

// Debug logging
console.log('Supabase config:', {
  supabaseUrl,
  supabaseKey,
  extras,
});

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Config Error] supabaseUrl or supabaseKey is missing from app config.',
    extras
  );
  throw new Error('Missing Supabase URL or Key');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});