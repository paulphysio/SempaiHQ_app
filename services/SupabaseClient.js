import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

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

// now safe to create your client
export const supabase = createClient(supabaseUrl, supabaseKey);
