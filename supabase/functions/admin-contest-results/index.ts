import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

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

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ResultsRequest = await req.json();
    const { contestTemplateId, results } = body;

    console.log('Setting contest results:', { contestTemplateId, admin: user.id });

    // Update contest template with results
    const { error: updateError } = await supabase
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
    const { data: pools } = await supabase
      .from('contest_pools')
      .select('id')
      .eq('contest_template_id', contestTemplateId)
      .eq('status', 'locked');

    // Log compliance event
    await supabase.from('compliance_audit_logs').insert({
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});