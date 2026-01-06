import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { requireAdmin } from '../shared/auth-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResultsRequest {
  contestTemplateId: string;
  results: {
    crews: Array<{
      crewId: string;
      finishPosition: number;
      marginSeconds?: number;
    }>;
  };
}

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

    // Require admin role - throws if not admin
    await requireAdmin(supabase, user.id);

    // ONLY NOW create service client after admin verification  
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: ResultsRequest = await req.json();
    const { contestTemplateId, results } = body;

    console.log('Setting contest results:', { contestTemplateId, admin: user.id });

    // Update contest template with results using service client
    const { error: updateError } = await supabaseAdmin
      .from('contest_templates')
      .update({
        results,
        status: 'settled',
      })
      .eq('id', contestTemplateId);

    if (updateError) {
      console.error('Error updating results:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all pools for this contest
    const { data: pools } = await supabaseAdmin
      .from('contest_pools')
      .select('id')
      .eq('contest_template_id', contestTemplateId)
      .eq('status', 'locked');

    // Log compliance event
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'contest_results_set',
      description: `Admin set results for contest ${contestTemplateId}`,
      severity: 'info',
      metadata: {
        contest_template_id: contestTemplateId,
        pools_to_settle: pools?.length || 0,
        results,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Results set successfully',
        poolsToSettle: pools?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-contest-results:', error);
    // Generic error for security
    return new Response(
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});