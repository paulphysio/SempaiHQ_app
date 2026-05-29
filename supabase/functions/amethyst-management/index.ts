import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

serve(async (req) => {
  try {
    console.log("[amethyst-management] Request received");

    const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jwt) throw new Error("Authorization header missing");

    const jwtBody = JSON.parse(new TextDecoder().decode(atob(jwt.split(".")[1])));
    if (typeof jwtBody?.email !== "string") throw new Error("JWT missing email");

    const { method } = req;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Get user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, amethyst_count")
      .eq("email", jwtBody.email)
      .single();

    if (userError || !userData) {
      throw new Error("User not found");
    }

    console.log("[amethyst-management] User data loaded:", { userId: userData.id, amethystCount: userData.amethyst_count });

    if (method === "GET" && action === "inventory") {
      // Get user's Amethyst inventory
      const { data: inventory, error: inventoryError } = await supabaseAdmin
        .from("amethyst_inventory")
        .select("*")
        .eq("user_id", userData.id)
        .order("acquired_at", { ascending: false });

      if (inventoryError) throw inventoryError;

      return Response.json({
        success: true,
        amethystCount: userData.amethyst_count || 0,
        inventory: inventory || []
      });
    }

    if (method === "POST" && action === "spend") {
      const body = await req.json();
      const { quantity, reason } = body ?? {};

      if (!quantity || quantity <= 0) {
        throw new Error("Invalid quantity");
      }

      const currentAmethyst = userData.amethyst_count || 0;
      if (currentAmethyst < quantity) {
        throw new Error("Insufficient Amethyst");
      }

      // Deduct Amethyst
      const { error: deductError } = await supabaseAdmin.rpc('award_amethyst', {
        p_user_id: userData.id,
        p_quantity: -quantity, // Negative to deduct
        p_amethyst_type: 'standard',
        p_source: 'spend',
        p_metadata: {
          reason: reason || 'User spending',
          spent_at: new Date().toISOString()
        }
      });

      if (deductError) throw deductError;

      // Record spending transaction
      const { error: historyError } = await supabaseAdmin
        .from("points_history")
        .insert({
          user_id: userData.id,
          points_awarded: -quantity,
          points_type: 'amethyst_spent',
          reference_id: `spend_${Date.now()}`,
          metadata: {
            reason: reason || 'User spending',
            quantity_spent: quantity
          }
        });

      if (historyError) {
        console.error("[amethyst-management] Error recording spending:", historyError);
      }

      return Response.json({
        success: true,
        newAmethystCount: currentAmethyst - quantity,
        spent: quantity
      });
    }

    if (method === "POST" && action === "bonus") {
      const body = await req.json();
      const { quantity, source } = body ?? {};

      if (!quantity || quantity <= 0) {
        throw new Error("Invalid quantity");
      }

      // Award bonus Amethyst
      const { error: bonusError } = await supabaseAdmin.rpc('award_amethyst', {
        p_user_id: userData.id,
        p_quantity: quantity,
        p_amethyst_type: 'bonus',
        p_source: source || 'admin_bonus',
        p_metadata: {
          bonus_type: source || 'admin_bonus',
          awarded_at: new Date().toISOString()
        }
      });

      if (bonusError) throw bonusError;

      return Response.json({
        success: true,
        bonusAwarded: quantity,
        newAmethystCount: (userData.amethyst_count || 0) + quantity
      });
    }

    if (method === "GET" && action === "stats") {
      // Get user's Amethyst statistics
      const { data: stats, error: statsError } = await supabaseAdmin
        .from("points_history")
        .select("points_awarded, points_type, created_at")
        .eq("user_id", userData.id)
        .in("points_type", ["amethyst_bonus", "amethyst_spent"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (statsError) throw statsError;

      const earned = stats?.filter(s => s.points_type === "amethyst_bonus").reduce((sum, s) => sum + s.points_awarded, 0) || 0;
      const spent = Math.abs(stats?.filter(s => s.points_type === "amethyst_spent").reduce((sum, s) => sum + s.points_awarded, 0) || 0);

      return Response.json({
        success: true,
        currentAmethyst: userData.amethyst_count || 0,
        totalEarned: earned,
        totalSpent: spent,
        recentTransactions: stats || []
      });
    }

    throw new Error("Invalid action");

  } catch (error: any) {
    console.error("[amethyst-management] Error:", error.message);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: error.message.includes("not found") || error.message.includes("requires") ? 400 : 500 }
    );
  }
});
