// Contest Scoring Engine - Admin-only pool scoring

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { requireAdmin } from '../shared/auth-helpers.ts';
import { parseRaceTime, calculateOfficialMargin } from '../shared/scoring-logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Initialize client with user's auth
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Require admin authentication
    await requireAdmin(supabase, user.id);

    // Validate input
    const scoreSchema = z.object({
      contestPoolId: z.string().uuid(),
      forceRescore: z.boolean().optional().default(false),
    });

    const body = scoreSchema.parse(await req.json());
    const { contestPoolId, forceRescore } = body;

    console.log('[scoring] Admin', user.id, 'scoring pool:', contestPoolId);

    // Create service client ONLY after admin verification
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check pool status for idempotency
    const { data: pool, error: poolError } = await supabaseAdmin
      .from('contest_pools')
      .select('status')
      .eq('id', contestPoolId)
      .single();

    if (poolError || !pool) {
      return new Response(
        JSON.stringify({ error: 'Contest pool not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency: only score if not already completed (unless force)
    if (pool.status === 'scoring_completed' && !forceRescore) {
      return new Response(
        JSON.stringify({
          message: 'Pool already scored. Use forceRescore to re-score.',
          alreadyScored: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch crew results from contest_pool_crews
    const { data: crews, error: crewsError } = await supabaseAdmin
      .from('contest_pool_crews')
      .select('crew_id, manual_finish_order, manual_result_time')
      .eq('contest_pool_id', contestPoolId);

    if (crewsError || !crews || crews.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No crew results found for this pool' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate official margin using TypeScript (easier to parse string times)
    const officialMarginSeconds = calculateOfficialMargin(crews);

    console.log('[scoring] Official margin calculated:', officialMarginSeconds, 'seconds');

    // Call the atomic RPC to calculate and assign scores
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('calculate_pool_scores', {
      p_contest_pool_id: contestPoolId,
      p_official_margin_seconds: officialMarginSeconds,
    });

    if (rpcError) {
      console.error('[scoring] RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Failed to calculate scores' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log admin action to compliance
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'pool_scored',
      severity: 'info',
      description: `Admin scored contest pool ${contestPoolId}${forceRescore ? ' (forced rescore)' : ''}`,
      metadata: {
        contest_pool_id: contestPoolId,
        official_margin_seconds: officialMarginSeconds,
        entries_processed: rpcResult?.entries_processed || 0,
        force_rescore: forceRescore,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        contestPoolId,
        officialMarginSeconds,
        entriesProcessed: rpcResult?.entries_processed || 0,
        message: 'Scoring completed successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[scoring] Error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
