import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Handle both GET and POST requests
    let stateCode: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      stateCode = url.searchParams.get('state');
    } else {
      const body = await req.json();
      stateCode = body.state;
    }

    if (!stateCode) {
      return new Response(
        JSON.stringify({ error: 'State code required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get state regulation rules
    const { data: stateRule, error: stateError } = await supabase
      .from('state_regulation_rules')
      .select('*')
      .eq('state_code', stateCode.toUpperCase())
      .maybeSingle();

    if (stateError) {
      console.error('Error fetching state rules:', stateError);
      return new Response(
        JSON.stringify({ error: 'State not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get license info if applicable
    let license = null;
    if (stateRule.status === 'regulated' || stateRule.license_required) {
      const { data: licenseData } = await supabase
        .from('license_registry')
        .select('*')
        .eq('state_code', stateCode.toUpperCase())
        .eq('status', 'active')
        .order('issued_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      license = licenseData;
    }

    return new Response(
      JSON.stringify({ 
        state: stateRule,
        license 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in legal-state-banner:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});