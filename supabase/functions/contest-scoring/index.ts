// Contest Scoring Engine - Admin-only pool scoring

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
      .select('crew_id, event_id, crew_name, manual_finish_order, manual_result_time')
      .eq('contest_pool_id', contestPoolId);

    if (crewsError || !crews || crews.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No crew results found for this pool' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group crews by event_id
    const eventGroups = new Map<string, typeof crews>();
    for (const crew of crews) {
      const eventId = crew.event_id;
      if (!eventGroups.has(eventId)) {
        eventGroups.set(eventId, []);
      }
      eventGroups.get(eventId)!.push(crew);
    }

    console.log('[scoring] Found', eventGroups.size, 'events to process');

    // Calculate race results with margins per event
    const results: RaceResult[] = [];

    for (const [eventId, eventCrews] of eventGroups) {
      // Sort by finish order within this event
      const sorted = eventCrews
        .filter(c => c.manual_finish_order !== null)
        .sort((a, b) => (a.manual_finish_order || 0) - (b.manual_finish_order || 0));

      if (sorted.length === 0) continue;

      // Calculate official margin for this event (time between 1st and 2nd)
      const officialMargin = calculateOfficialMargin(sorted);

      console.log('[scoring] Event', eventId, '- Official margin:', officialMargin, 'seconds');

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

    console.log('[scoring] Prepared', results.length, 'race results');

    // Execute scoring using TypeScript logic (no RPC call)
    const scoringResult = await scoreContestPool(supabaseAdmin, contestPoolId, results);

    // Log admin action to compliance
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'pool_scored',
      severity: 'info',
      description: `Admin scored contest pool ${contestPoolId}${forceRescore ? ' (forced rescore)' : ''}`,
      metadata: {
        contest_pool_id: contestPoolId,
        events_processed: eventGroups.size,
        results_count: results.length,
        entries_scored: scoringResult.entriesScored,
        winner_id: scoringResult.winnerId,
        force_rescore: forceRescore,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        contestPoolId,
        eventsProcessed: eventGroups.size,
        resultsCount: results.length,
        entriesScored: scoringResult.entriesScored,
        winnerId: scoringResult.winnerId,
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
      JSON.stringify({ error: error.message || 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
