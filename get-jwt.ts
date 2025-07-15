import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// --- CONFIGURATION ---
const supabaseUrl = "https://xqeimsncmnqsiowftdmz.supabase.co";
// This is your public anon key, it's safe to use here.
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZWltc25jbW5xc2lvd2Z0ZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgwNDExOTYsImV4cCI6MjA1MzYxNzE5Nn0.B8mZGxtUDp5jC-SwqBj1G5BjZE_A6RC-ZeJtmkq76iY";

// --- USER CREDENTIALS ---
// !!! IMPORTANT: Replace with the credentials of a real test user in your Supabase project !!!
const userEmail = "YOUR_TEST_USER@example.com";
const userPassword = "YOUR_TEST_USER_PASSWORD";

// --- SCRIPT ---
async function getJwt() {
  if (userEmail === 'YOUR_TEST_USER@example.com') {
    console.error("Please update the userEmail and userPassword in get-jwt.ts before running the script.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  console.log(`Attempting to sign in as ${userEmail}...`);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: userEmail,
    password: userPassword,
  });

  if (error) {
    console.error("\nError signing in:", error.message);
    return;
  }

  if (data.session) {
    console.log("\n--- Successfully signed in! ---");
    console.log("\nYour JWT Access Token is:\n");
    console.log(data.session.access_token);
    console.log("\nUse this token in the Authorization header for your curl command.");
  } else {
    console.log("Could not get a session. Please check your credentials.");
  }
}

getJwt();
