// Health Check - System status and feature flags

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check database connectivity
    let dbStatus = 'ok';
    try {
      // Test basic DB connectivity
      const { error: timeError } = await supabase.rpc('now' as any);
      if (timeError) {
        console.error('DB time check failed:', timeError);
        dbStatus = 'degraded';
      }

      // Test RLS-safe read (canary)
      const { error: canaryError } = await supabase
        .from('state_regulation_rules')
        .select('count', { count: 'exact', head: true });
      
      if (canaryError) {
        console.error('DB canary read failed:', canaryError);
        dbStatus = 'degraded';
      }
    } catch (err) {
      console.error('DB health check error:', err);
      dbStatus = 'error';
    }

    // Fetch feature flags
    const { data: flags, error: flagsError } = await supabase
      .from('feature_flags')
      .select('key, value');

    if (flagsError) {
      console.error('Failed to fetch feature flags:', flagsError);
      return new Response(
        JSON.stringify({
          ok: false,
          db: dbStatus,
          flags: null,
          error: 'Failed to fetch flags',
          timestamp: new Date().toISOString(),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform flags array to object
    const flagsObj = (flags || []).reduce((acc: any, flag: any) => {
      acc[flag.key] = flag.value;
      return acc;
    }, {});

    return new Response(
      JSON.stringify({
        ok: dbStatus === 'ok' || dbStatus === 'degraded',
        db: dbStatus,
        flags: flagsObj,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
