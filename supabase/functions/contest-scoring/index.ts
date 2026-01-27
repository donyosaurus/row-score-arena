// Contest Scoring Engine - Admin-only pool scoring with batch sibling support

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { 
  scoreContestPool, 
  calculateOfficialMargin,
  type RaceResult 
} from '../shared/scoring-logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Score a single pool - extracted for batch processing
async function scoreSinglePool(
  supabaseAdmin: any,
  contestPoolId: string,
  forceRescore: boolean
): Promise<{
  success: boolean;
  poolId: string;
  eventsProcessed?: number;
  resultsCount?: number;
  entriesScored?: number;
  winnerId?: string;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}> {
  try {
    // Check pool status for idempotency
    const { data: pool, error: poolError } = await supabaseAdmin
      .from('contest_pools')
      .select('status')
      .eq('id', contestPoolId)
      .single();

    if (poolError || !pool) {
      return { success: false, poolId: contestPoolId, error: 'Pool not found' };
    }

    // Idempotency: skip if already completed (unless force)
    if (pool.status === 'scoring_completed' && !forceRescore) {
      return {
        success: true,
        poolId: contestPoolId,
        skipped: true,
        skipReason: 'Already scored',
      };
    }

    // Validate pool is ready for scoring
    const validScoringStatuses = ['results_entered', 'locked', 'settling'];
    if (!validScoringStatuses.includes(pool.status) && !forceRescore) {
      return {
        success: true,
        poolId: contestPoolId,
        skipped: true,
        skipReason: `Status '${pool.status}' not ready for scoring`,
      };
    }

    // Fetch crew results from contest_pool_crews
    const { data: crews, error: crewsError } = await supabaseAdmin
      .from('contest_pool_crews')
      .select('crew_id, event_id, crew_name, manual_finish_order, manual_result_time')
      .eq('contest_pool_id', contestPoolId);

    if (crewsError || !crews || crews.length === 0) {
      return { success: false, poolId: contestPoolId, error: 'No crew results found' };
    }

    // Define crew type for type safety
    type PoolCrew = {
      crew_id: string;
      event_id: string;
      crew_name: string;
      manual_finish_order: number | null;
      manual_result_time: string | null;
    };

    // Group crews by event_id
    const eventGroups = new Map<string, PoolCrew[]>();
    for (const crew of crews as PoolCrew[]) {
      const eventId = crew.event_id;
      if (!eventGroups.has(eventId)) {
        eventGroups.set(eventId, []);
      }
      eventGroups.get(eventId)!.push(crew);
    }

    // Calculate race results with margins per event
    const results: RaceResult[] = [];

    for (const [eventId, eventCrews] of eventGroups) {
      // Sort by finish order within this event
      const sorted = eventCrews
        .filter(c => c.manual_finish_order !== null)
        .sort((a, b) => (a.manual_finish_order || 0) - (b.manual_finish_order || 0));

      if (sorted.length === 0) continue;

      // Calculate official margin for this event
      const officialMargin = calculateOfficialMargin(sorted);

      // Create result entries for each crew in this event
      for (const crew of sorted) {
        const result: RaceResult = {
          crewId: crew.crew_id,
          eventId: eventId,
          finishOrder: crew.manual_finish_order!,
        };

        // Only 1st place gets the actualMargin for margin bonus calculation
        if (crew.manual_finish_order === 1) {
          result.actualMargin = officialMargin;
        }

        results.push(result);
      }
    }

    // Execute scoring using TypeScript logic
    const scoringResult = await scoreContestPool(supabaseAdmin, contestPoolId, results);

    return {
      success: true,
      poolId: contestPoolId,
      eventsProcessed: eventGroups.size,
      resultsCount: results.length,
      entriesScored: scoringResult.entriesScored,
      winnerId: scoringResult.winnerId,
    };
  } catch (error: any) {
    console.error('[scoring] Error scoring pool', contestPoolId, error);
    return { success: false, poolId: contestPoolId, error: error.message };
  }
}

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

    // SECURITY: Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Fetch the requested pool to get template and tier info
    const { data: requestedPool, error: requestedPoolError } = await supabaseAdmin
      .from('contest_pools')
      .select('contest_template_id, tier_id, status')
      .eq('id', contestPoolId)
      .single();

    if (requestedPoolError || !requestedPool) {
      return new Response(
        JSON.stringify({ error: 'Contest pool not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find ALL sibling pools (same template + tier) for batch processing
    const { data: siblingPools, error: siblingsError } = await supabaseAdmin
      .from('contest_pools')
      .select('id, status')
      .eq('contest_template_id', requestedPool.contest_template_id)
      .eq('tier_id', requestedPool.tier_id);

    if (siblingsError) {
      console.error('[scoring] Error fetching sibling pools:', siblingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sibling pools' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to scorable pools (results_entered, locked, settling, or already scoring_completed for idempotency)
    const scorableStatuses = ['results_entered', 'locked', 'settling', 'scoring_completed'];
    const poolsToScore = siblingPools?.filter(p => scorableStatuses.includes(p.status)) || [];

    console.log('[scoring] Found', poolsToScore.length, 'sibling pools to score out of', siblingPools?.length);

    // Batch score all sibling pools
    const scoringResults = [];
    let totalEntriesScored = 0;
    let poolsSuccessfullyScored = 0;
    let poolsSkipped = 0;

    for (const pool of poolsToScore) {
      const result = await scoreSinglePool(supabaseAdmin, pool.id, forceRescore);
      scoringResults.push(result);

      if (result.success && !result.skipped) {
        poolsSuccessfullyScored++;
        totalEntriesScored += result.entriesScored || 0;
      } else if (result.skipped) {
        poolsSkipped++;
      }
    }

    // Log admin action to compliance
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'batch_pool_scoring',
      severity: 'info',
      description: `Admin batch-scored ${poolsSuccessfullyScored} sibling pools for template ${requestedPool.contest_template_id}`,
      metadata: {
        requested_pool_id: contestPoolId,
        contest_template_id: requestedPool.contest_template_id,
        tier_id: requestedPool.tier_id,
        pools_found: poolsToScore.length,
        pools_scored: poolsSuccessfullyScored,
        pools_skipped: poolsSkipped,
        total_entries_scored: totalEntriesScored,
        force_rescore: forceRescore,
        results: scoringResults,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        poolsScored: poolsSuccessfullyScored,
        poolsSkipped,
        totalEntriesScored,
        message: `Batch scoring completed: ${poolsSuccessfullyScored} pool(s) scored, ${poolsSkipped} skipped`,
        details: scoringResults,
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
      JSON.stringify({ error: error.message || 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
