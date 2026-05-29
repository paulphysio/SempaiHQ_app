import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

serve(async (req) => {
  try {
    console.log("[weekly-points-reset] Starting weekly points reset");

    // Verify this is a scheduled job or authorized request
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${Deno.env.get("WEEKLY_RESET_SECRET") || "weekly-reset-secret"}`) {
      throw new Error("Unauthorized");
    }

    // Call the reset function
    const { data, error } = await supabaseAdmin.rpc('reset_weekly_points');

    if (error) {
      console.error("[weekly-points-reset] Error resetting points:", error);
      throw error;
    }

    const resetCount = data || 0;
    console.log(`[weekly-points-reset] Reset weekly points for ${resetCount} users`);

    // Update leaderboard for current week
    const { data: leaderboardData, error: leaderboardError } = await supabaseAdmin
      .from("users")
      .select("id, weekly_points, amethyst_count")
      .not("amethyst_count", "is", "null")
      .order("amethyst_count", { ascending: false })
      .limit(50);

    if (leaderboardError) {
      console.error("[weekly-points-reset] Error updating leaderboard:", leaderboardError);
    } else {
      // Clear current week's leaderboard and rebuild
      await supabaseAdmin
        .from("weekly_leaderboard")
        .delete()
        .eq("week_start", new Date().toISOString().split('T')[0]);

      if (leaderboardData && leaderboardData.length > 0) {
        const leaderboardEntries = leaderboardData.map((user, index) => ({
          user_id: user.id,
          week_start: new Date().toISOString().split('T')[0],
          weekly_points: 0, // Just reset
          amethyst_count: user.amethyst_count || 0,
          effective_points: (user.amethyst_count || 0) * 2, // Only Amethyst bonus
          rank: index + 1,
          updated_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabaseAdmin
          .from("weekly_leaderboard")
          .insert(leaderboardEntries);

        if (insertError) {
          console.error("[weekly-points-reset] Error inserting leaderboard:", insertError);
        } else {
          console.log(`[weekly-points-reset] Updated leaderboard for ${leaderboardData.length} users`);
        }
      }
    }

    return Response.json({
      success: true,
      resetCount,
      message: `Weekly points reset completed for ${resetCount} users`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[weekly-points-reset] Error:", error.message);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
});
