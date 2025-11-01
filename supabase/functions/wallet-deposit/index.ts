// Wallet Deposit - Create payment session and return checkout URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getPaymentProvider } from '../shared/payment-providers/factory.ts';
import { performComplianceChecks } from '../shared/compliance-checks.ts';
import { checkGeoEligibility } from '../shared/geo-eligibility.ts';
import { createErrorResponse, mapErrorToClient, ERROR_MESSAGES } from '../shared/error-handler.ts';

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

    // Validate input with Zod schema (stateCode removed - determined server-side)
    const depositSchema = z.object({
      amountCents: z.number().int().positive().min(500).max(1000000), // $5 - $10k
      returnUrl: z.string().url().optional(),
      idempotencyKey: z.string().uuid().optional()
    });

    let body;
    try {
      const rawBody = await req.json();
      body = depositSchema.parse(rawBody);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INVALID_INPUT }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amountCents, returnUrl, idempotencyKey } = body;

    // Determine state from IP geolocation (server-side)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() 
                     || req.headers.get('x-real-ip') 
                     || 'unknown';
    
    const geoResult = await checkGeoEligibility(clientIp, user.id);
    
    if (!geoResult.allowed) {
      return new Response(
        JSON.stringify({ error: geoResult.reason || ERROR_MESSAGES.GEO_BLOCKED }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stateCode = geoResult.stateCode || 'US';

    // Check for existing session with idempotency key
    if (idempotencyKey) {
      const { data: existingSession } = await supabase
        .from('payment_sessions')
        .select('*')
        .eq('metadata->idempotencyKey', idempotencyKey)
        .eq('user_id', user.id)
        .single();

      if (existingSession) {
        console.log('[wallet-deposit] Returning existing session for idempotency key', idempotencyKey);
        return new Response(
          JSON.stringify({
            sessionId: existingSession.id,
            checkoutUrl: existingSession.checkout_url,
            clientToken: existingSession.client_token,
            status: existingSession.status,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Perform compliance checks with verified state
    const complianceResult = await performComplianceChecks({
      userId: user.id,
      stateCode,
      amountCents,
      actionType: 'deposit',
      ipAddress: clientIp,
    });

    if (!complianceResult.allowed) {
      const safeReason = mapErrorToClient({ message: complianceResult.reason });
      return new Response(
        JSON.stringify({ error: safeReason }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create payment session with provider
    const provider = getPaymentProvider();
    const checkout = await provider.createCheckout({
      userId: user.id,
      amountCents,
      stateCode,
      returnUrl: returnUrl || `${req.headers.get('origin')}/profile`,
      metadata: { idempotencyKey },
    });

    // Store payment session in database
    const { data: session, error: sessionError } = await supabase
      .from('payment_sessions')
      .insert({
        user_id: user.id,
        provider: provider.name,
        provider_session_id: checkout.sessionId,
        amount_cents: amountCents,
        state_code: stateCode,
        status: 'pending',
        checkout_url: checkout.checkoutUrl,
        client_token: checkout.clientToken,
        expires_at: checkout.expiresAt.toISOString(),
        metadata: { idempotencyKey, returnUrl },
      })
      .select()
      .single();

    if (sessionError) {
      return createErrorResponse(sessionError, 'wallet-deposit', corsHeaders);
    }

    console.log('[wallet-deposit] Created payment session:', session.id);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        checkoutUrl: checkout.checkoutUrl,
        clientToken: checkout.clientToken,
        expiresAt: checkout.expiresAt.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return createErrorResponse(error, 'wallet-deposit', corsHeaders);
  }
});
