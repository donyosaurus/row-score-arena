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

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = z
      .object({
        contestPoolId: z.string().uuid(),
        forceResettle: z.boolean().optional(),
      })
      .parse(await req.json());

    const poolId = body.contestPoolId;
    console.log("[settlement] Admin", user.id, "settling pool:", poolId);

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

    if (pool.status === "settled" && !body.forceResettle) {
      return new Response(JSON.stringify({ error: "Contest already settled. Use forceResettle=true to override." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Settle all sibling pools that finished scoring
    const { data: siblingPools } = await supabaseAdmin
      .from("contest_pools")
      .select("id")
      .eq("contest_template_id", pool.contest_template_id)
      .eq("status", "scoring_completed");

    const poolsToSettle = siblingPools?.map((p) => p.id) || [poolId];
    console.log("[settlement] Settling", poolsToSettle.length, "pool(s)");

    let totalWinnersCount = 0;
    for (const currentPoolId of poolsToSettle) {
      totalWinnersCount += await settlePool(supabaseAdmin, currentPoolId);
    }

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
      JSON.stringify({ success: true, poolsSettled: poolsToSettle.length, winnersCount: totalWinnersCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[settlement] Outer error:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Settlement failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function settlePool(supabaseAdmin: any, contestPoolId: string): Promise<number> {
  console.log("[settlement] Settling pool:", contestPoolId);

  const { data: pool } = await supabaseAdmin
    .from("contest_pools")
    .select("*, contest_templates(*)")
    .eq("id", contestPoolId)
    .single();

  if (!pool) {
    console.error("[settlement] Pool not found:", contestPoolId);
    return 0;
  }

  // Fetch scores — keyed by pool_id (written by updated scoring-logic.ts)
  const { data: scores, error: scoresError } = await supabaseAdmin
    .from("contest_scores")
    .select("*")
    .eq("pool_id", contestPoolId)
    .order("rank", { ascending: true });

  if (scoresError) {
    console.error("[settlement] Error fetching scores:", scoresError.message);
    return 0;
  }

  if (!scores || scores.length === 0) {
    console.log("[settlement] No scores for pool", contestPoolId, "— skipping");
    return 0;
  }

  console.log("[settlement] Found", scores.length, "scored entries");

  const prizePoolCents = pool.prize_pool_cents || 0;
  const payoutStructure: Record<string, number> = pool.payout_structure || { "1": prizePoolCents };

  const winners: { userId: string; entryId: string; rank: number; payoutCents: number }[] = [];

  for (const score of scores) {
    const payoutCents = payoutStructure[String(score.rank)] || 0;
    const isWinner = payoutCents > 0;

    await supabaseAdmin
      .from("contest_scores")
      .update({ payout_cents: payoutCents, is_winner: isWinner })
      .eq("id", score.id);

    if (isWinner) {
      winners.push({ userId: score.user_id, entryId: score.entry_id, rank: score.rank, payoutCents });
    }
  }

  // Credit winners — amount in CENTS (bigint), type must match transaction_type enum
  for (const winner of winners) {
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("user_id", winner.userId)
      .single();

    if (walletError || !wallet) {
      console.error("[settlement] Wallet not found for user:", winner.userId);
      continue;
    }

    const { error: txnError } = await supabaseAdmin.from("transactions").insert({
      user_id: winner.userId,
      wallet_id: wallet.id,
      type: "payout", // valid transaction_type enum value
      amount: winner.payoutCents / 100, // transactions.amount is DECIMAL dollars
      status: "completed",
      reference_id: winner.entryId,
      reference_type: "contest_entry",
      description: `Contest payout — Rank ${winner.rank} (${pool.contest_templates?.regatta_name || "Contest"})`,
      completed_at: new Date().toISOString(),
      metadata: { contest_pool_id: contestPoolId },
    });

    if (txnError) {
      console.error("[settlement] Transaction insert error:", txnError.message);
      continue;
    }

    // update_wallet_balance takes BIGINT cents — do NOT divide by 100
    const { error: walletUpdateError } = await supabaseAdmin.rpc("update_wallet_balance", {
      _wallet_id: wallet.id,
      _available_delta: winner.payoutCents,
      _pending_delta: 0,
      _lifetime_winnings_delta: winner.payoutCents,
    });

    if (walletUpdateError) {
      console.error("[settlement] Wallet update error:", walletUpdateError.message);
    } else {
      console.log("[settlement] Credited", winner.payoutCents, "cents to user", winner.userId);
    }
  }

  // Mark entries settled
  for (const score of scores) {
    await supabaseAdmin.from("contest_entries").update({ status: "settled" }).eq("id", score.entry_id);
  }

  // Mark pool settled
  await supabaseAdmin.from("contest_pools").update({ status: "settled" }).eq("id", contestPoolId);

  console.log("[settlement] Pool", contestPoolId, "done —", winners.length, "winner(s)");
  return winners.length;
}
