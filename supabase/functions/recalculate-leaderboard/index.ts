import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req: Request) => {
  try {
    console.log("[recalculate-leaderboard] Starting leaderboard recalculation");

    // 1. Calculate points based on chapters read in past 14 days
    const { error: updateError } = await supabaseAdmin.rpc('recalculate_leaderboard_points');
    if (updateError) {
      console.error("[recalculate-leaderboard] Error recalculating points:", updateError);
      throw new Error(`Failed to recalculate points: ${updateError.message}`);
    }

    console.log("[recalculate-leaderboard] Points recalculated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Leaderboard recalculated successfully" 
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("[recalculate-leaderboard] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
