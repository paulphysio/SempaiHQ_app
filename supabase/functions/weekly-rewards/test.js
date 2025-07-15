// Test script for weekly-rewards function
// Run with: node test.js

const fetch = require('node-fetch');
require('dotenv').config();

async function testWeeklyRewards() {
  console.log('Testing weekly-rewards function...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
    process.exit(1);
  }
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/weekly-rewards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Test successful!');
    } else {
      console.log('❌ Test failed:', data.message);
    }
  } catch (error) {
    console.error('Error calling function:', error);
  }
}

testWeeklyRewards(); 