import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { checkLocationEligibility } from '../shared/geo-eligibility.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Geolocation check - block restricted states
    checkLocationEligibility(req);

    // Validate input with Zod schema - picks now include per-crew predicted margins
    const pickSchema = z.object({
      crewId: z.string().min(1, 'Crew ID required'),
      predictedMargin: z.number().min(0, 'Predicted margin must be non-negative')
    });

    const entrySchema = z.object({
      contestPoolId: z.string().uuid('Invalid contest pool ID'),
      picks: z.array(pickSchema)
        .min(2, 'Minimum 2 picks required')
        .max(10, 'Maximum 10 picks allowed')
    });

    let body;
    try {
      const rawBody = await req.json();
      body = entrySchema.parse(rawBody);
    } catch (error) {
      console.error('[contest-enter] Validation error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input parameters',
          details: error instanceof z.ZodError ? error.errors : 'Validation failed'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contestPoolId, picks } = body;

    console.log('[contest-enter] Request:', { userId: user.id, contestPoolId, picksCount: picks.length });

    // Step A: Security Check - Verify all picks are in the allowed crews list
    const { data: allowedCrews, error: crewsError } = await supabase
      .from('contest_pool_crews')
      .select('crew_id, event_id')
      .eq('contest_pool_id', contestPoolId);

    if (crewsError) {
      console.error('[contest-enter] Error fetching allowed crews:', crewsError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate crew selections' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!allowedCrews || allowedCrews.length === 0) {
      console.error('[contest-enter] No allowed crews found for pool:', contestPoolId);
      return new Response(
        JSON.stringify({ error: 'Contest pool has no available crews' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a map of allowed crew_id -> event_id
    const crewToEventMap = new Map<string, string>();
    for (const crew of allowedCrews) {
      crewToEventMap.set(crew.crew_id, crew.event_id);
    }

    // Validate every pick exists in the allowed list (extract crewId from pick objects)
    const invalidPicks: string[] = [];
    const pickedEventIds = new Set<string>();

    for (const pick of picks) {
      const eventId = crewToEventMap.get(pick.crewId);
      if (!eventId) {
        invalidPicks.push(pick.crewId);
      } else {
        pickedEventIds.add(eventId);
      }
    }

    if (invalidPicks.length > 0) {
      console.error('[contest-enter] Invalid picks:', invalidPicks);
      return new Response(
        JSON.stringify({ error: 'Invalid crew selection - Crew not allowed in this contest' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step B: Diversity Rule - Must have at least 2 unique events
    if (pickedEventIds.size < 2) {
      console.error('[contest-enter] Diversity rule violation:', { uniqueEvents: pickedEventIds.size });
      return new Response(
        JSON.stringify({ error: 'You must select crews from at least two separate events' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step C: Per-crew margins already validated by Zod schema

    // Step D: Construct validated roster and call RPC
    // The roster now contains picks with individual predicted margins
    const roster = {
      crews: picks // Array of { crewId, predictedMargin }
    };

    console.log('[contest-enter] Calling RPC with validated roster:', { 
      userId: user.id, 
      contestPoolId, 
      picksCount: picks.length,
      uniqueEvents: pickedEventIds.size 
    });

    const { data, error } = await supabase.rpc('enter_contest_pool', {
      p_user_id: user.id,
      p_contest_pool_id: contestPoolId,
      p_picks: roster
    });

    if (error) {
      console.error('[contest-enter] RPC error:', error);
      
      const errorMessage = error.message || 'Failed to enter contest';
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[contest-enter] Success:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully entered the contest!',
        entryFeeCents: data?.entry_fee_cents
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[contest-enter] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
