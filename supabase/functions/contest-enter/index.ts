import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

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

    // Validate input with Zod schema
    const entrySchema = z.object({
      contestPoolId: z.string().uuid('Invalid contest pool ID'),
      picks: z.array(z.object({
        crewId: z.string().uuid('Invalid crew ID'),
        divisionId: z.string().min(1, 'Division ID required'),
        predictedMargin: z.number()
      })).min(2, 'Minimum 2 picks required').max(10, 'Maximum 10 picks allowed')
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

    console.log('[contest-enter] Request:', { userId: user.id, contestPoolId });

    // Call the atomic enter_contest_pool function
    const { data, error } = await supabase.rpc('enter_contest_pool', {
      p_user_id: user.id,
      p_contest_pool_id: contestPoolId,
      p_picks: picks
    });

    if (error) {
      console.error('[contest-enter] RPC error:', error);
      
      // Map database exceptions to user-friendly messages
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
