// Contest Settlement - Calculate and distribute payouts automatically

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Accept contestPoolId (works with contest_pools table)
    const settlementSchema = z.object({
      contestPoolId: z.string().uuid(),
      forceResettle: z.boolean().optional(),
    });

    const body = settlementSchema.parse(await req.json());
    const poolId = body.contestPoolId;

    console.log("[settlement] Admin", user.id, "processing settlement for pool:", poolId);

    // Get the pool and its template
    const { data: pool, error: poolError } = await supabaseAdmin
      .from("contest_pools")
      .select("*, contest_templates(*)")
      .eq("id", poolId)
      .single();

    if (poolError || !pool) {
      return new Response(JSON.stringify({ error: "Contest pool not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency check
    if (pool.status === "settled" && !body.forceResettle) {
      return new Response(JSON.stringify({ error: "Contest already settled. Use forceResettle=true to override." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find ALL sibling pools with scoring completed
    const { data: siblingPools } = await supabaseAdmin
      .from("contest_pools")
      .select("id")
      .eq("contest_template_id", pool.contest_template_id)
      .eq("status", "scoring_completed");

    const poolsToSettle = siblingPools?.map((p) => p.id) || [poolId];
    console.log("[settlement] Settling", poolsToSettle.length, "sibling pool(s)");

    let totalWinnersCount = 0;
    for (const currentPoolId of poolsToSettle) {
      const winnersInPool = await settlePool(supabaseAdmin, currentPoolId);
      totalWinnersCount += winnersInPool;
    }

    // Compliance log
    await supabaseAdmin.from("compliance_audit_logs").insert({
      admin_id: user.id,
      event_type: "contest_batch_settled",
      severity: "info",
      description: `Batch settlement: ${pool.contest_templates?.regatta_name} — ${poolsToSettle.length} pool(s)`,
      metadata: {
        contest_template_id: pool.contest_template_id,
        pools_settled: poolsToSettle.length,
        winners: totalWinnersCount,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        poolsSettled: poolsToSettle.length,
        winnersCount: totalWinnersCount,
        message: "Settlement completed successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[settlement] Error:", error);
    return new Response(JSON.stringify({ error: "An error occurred during settlement" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---------------------------------------------------------------------------
// Settle a single pool: pay winners, mark entries settled, update pool status
// ---------------------------------------------------------------------------
async function settlePool(supabaseAdmin: any, contestPoolId: string): Promise<number> {
  const { data: pool } = await supabaseAdmin
    .from("contest_pools")
    .select("*, contest_templates(*)")
    .eq("id", contestPoolId)
    .single();

  if (!pool) return 0;

  // Fetch scores ordered by rank
  const { data: scores, error: scoresError } = await supabaseAdmin
    .from("contest_scores")
    .select("*")
    .eq("instance_id", contestPoolId)
    .order("rank", { ascending: true });

  if (scoresError || !scores || scores.length === 0) {
    console.log("[settlement] No scores found for pool", contestPoolId, "— skipping");
    return 0;
  }

  console.log("[settlement] Settling", scores.length, "entries in pool", contestPoolId);

  // Use payout_structure from pool (set by admin when creating contest)
  const prizePoolCents = pool.prize_pool_cents || 0;
  const payoutStructure: Record<string, number> = pool.payout_structure || { "1": prizePoolCents };

  const winners = [];

  for (const score of scores) {
    const payoutCents = payoutStructure[String(score.rank)] || 0;
    const isWinner = payoutCents > 0;

    await supabaseAdmin
      .from("contest_scores")
      .update({ payout_cents: payoutCents, is_winner: isWinner })
      .eq("id", score.id);

    if (isWinner) {
      winners.push({
        userId: score.user_id,
        entryId: score.entry_id,
        rank: score.rank,
        payoutCents,
      });
    }
  }

  // Credit winners' wallets
  for (const winner of winners) {
    const { data: wallet } = await supabaseAdmin.from("wallets").select("id").eq("user_id", winner.userId).single();

    if (!wallet) {
      console.error("[settlement] Wallet not found for user:", winner.userId);
      continue;
    }

    await supabaseAdmin.from("transactions").insert({
      user_id: winner.userId,
      wallet_id: wallet.id,
      type: "contest_winnings",
      amount: winner.payoutCents / 100,
      status: "completed",
      reference_id: winner.entryId,
      reference_type: "contest_entry",
      description: `Contest winnings — Rank ${winner.rank} (${pool.contest_templates?.regatta_name || "Contest"})`,
      completed_at: new Date().toISOString(),
      metadata: { contest_pool_id: contestPoolId },
    });

    await supabaseAdmin.rpc("update_wallet_balance", {
      _wallet_id: wallet.id,
      _available_delta: winner.payoutCents / 100,
      _pending_delta: 0,
      _lifetime_winnings_delta: winner.payoutCents / 100,
    });

    console.log("[settlement] Paid", winner.payoutCents / 100, "to user", winner.userId, "rank", winner.rank);
  }

  // Mark all entries as settled
  for (const score of scores) {
    await supabaseAdmin.from("contest_entries").update({ status: "settled" }).eq("id", score.entry_id);
  }

  // Mark pool as settled
  await supabaseAdmin.from("contest_pools").update({ status: "settled" }).eq("id", contestPoolId);

  console.log("[settlement] Pool", contestPoolId, "settled —", winners.length, "winner(s)");
  return winners.length;
}
