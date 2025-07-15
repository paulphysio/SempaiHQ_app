import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xqeimsncmnqsiowftdmz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZWltc25jbW5xc2lvd2Z0ZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgwNDExOTYsImV4cCI6MjA1MzYxNzE5Nn0.B8mZGxtUDp5jC-SwqBj1G5BjZE_A6RC-ZeJtmkq76iY';
 // Get from Supabase Dashboard > Settings > API

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function generateUserJwt() {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'obinnap350@gmail.com'
  });
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('User Data:', data);
  // Use Supabase CLI or manually sign in to get JWT after generating link
}

generateUserJwt();