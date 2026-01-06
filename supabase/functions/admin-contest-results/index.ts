import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { requireAdmin } from '../shared/auth-helpers.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const ResultItemSchema = z.object({
  crew_id: z.string().min(1),
  finish_order: z.number().int().positive(),
  finish_time: z.string().min(1), // Stored as text, parsed later in scoring engine
});

const RequestSchema = z.object({
  contestPoolId: z.string().uuid(),
  results: z.array(ResultItemSchema).min(1),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize client with user's auth
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

    // Require admin role - throws if not admin
    await requireAdmin(supabase, user.id);

    // Parse and validate input
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contestPoolId, results } = parseResult.data;

    console.log('Admin submitting race results:', { contestPoolId, admin: user.id, resultCount: results.length });

    // ONLY NOW create service client after admin verification  
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call the atomic RPC to update race results
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('admin_update_race_results', {
      p_contest_pool_id: contestPoolId,
      p_results: results,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Failed to update results' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log compliance event
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'race_results_submitted',
      description: `Admin submitted race results for contest pool ${contestPoolId}`,
      severity: 'info',
      metadata: {
        contest_pool_id: contestPoolId,
        results_count: results.length,
        results,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Race results submitted successfully',
        contestPoolId,
        resultsCount: results.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-contest-results:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});