// Wallet Deposit Init - Create mock deposit session (placeholder)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount_cents } = await req.json();

    if (!amount_cents || amount_cents <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check profile for self-exclusion
    const { data: profile } = await supabase
      .from('profiles')
      .select('self_exclusion_until, is_active, state')
      .eq('id', user.id)
      .single();

    if (!profile?.is_active) {
      return new Response(
        JSON.stringify({ error: 'Account is inactive' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.self_exclusion_until && new Date(profile.self_exclusion_until) > new Date()) {
      return new Response(
        JSON.stringify({ error: 'Account is self-excluded' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create mock payment session
    const { data: session, error: sessionError } = await supabase
      .from('payment_sessions')
      .insert({
        user_id: user.id,
        amount_cents,
        provider: 'mock',
        status: 'pending',
        state_code: profile.state,
        checkout_url: 'https://mock-checkout.example.com',
        client_token: 'mock_token_' + crypto.randomUUID(),
      })
      .select()
      .single();

    if (sessionError) {
      throw sessionError;
    }

    // Log compliance event
    await supabase
      .from('compliance_audit_logs')
      .insert({
        user_id: user.id,
        event_type: 'deposit_initiated',
        description: 'User initiated deposit',
        severity: 'info',
        state_code: profile.state,
        metadata: { amount_cents, session_id: session.id },
      });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        checkoutUrl: session.checkout_url,
        clientToken: session.client_token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[wallet-deposit-init] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to initialize deposit' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
