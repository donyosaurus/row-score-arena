// Wallet Withdrawal - Initiate payout with compliance checks

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

    // Validate input with Zod schema
    const withdrawSchema = z.object({
      amountCents: z.number().int().positive().min(500).max(20000), // $5 - $200
      destinationToken: z.string().min(1),
      idempotencyKey: z.string().uuid().optional()
    });

    let body;
    try {
      const rawBody = await req.json();
      body = withdrawSchema.parse(rawBody);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INVALID_INPUT }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amountCents, destinationToken, idempotencyKey } = body;

    // Check for duplicate withdrawal (idempotency)
    if (idempotencyKey) {
      const { data: existingTxn } = await supabase
        .from('transactions')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .eq('user_id', user.id)
        .single();

      if (existingTxn) {
        console.log('[wallet-withdraw] Duplicate withdrawal attempt with idempotency key', idempotencyKey);
        return new Response(
          JSON.stringify({
            transactionId: existingTxn.id,
            status: existingTxn.status,
            message: 'Withdrawal already processed',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get user's wallet and profile for state
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.NOT_FOUND }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for state verification
    const { data: profile } = await supabase
      .from('profiles')
      .select('state, kyc_status')
      .eq('id', user.id)
      .single();

    // Determine state from IP geolocation
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

    // Use profile state if KYC verified, otherwise use detected state
    const stateCode = profile?.kyc_status === 'verified' && profile?.state 
                      ? profile.state 
                      : (geoResult.stateCode || 'US');

    // Check sufficient balance
    const availableCents = Math.floor(Number(wallet.available_balance) * 100);
    if (availableCents < amountCents) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INSUFFICIENT_FUNDS }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform compliance checks with verified state
    const complianceResult = await performComplianceChecks({
      userId: user.id,
      stateCode,
      amountCents,
      actionType: 'withdrawal',
      ipAddress: clientIp,
    });

    if (!complianceResult.allowed) {
      const safeReason = mapErrorToClient({ message: complianceResult.reason });
      return new Response(
        JSON.stringify({ error: safeReason }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initiate payout with provider
    const provider = getPaymentProvider();
    const payout = await provider.initiatePayout({
      userId: user.id,
      amountCents,
      destinationToken: destinationToken || 'default', // Payment method token
      metadata: { idempotencyKey },
    });

    // Create pending withdrawal transaction
    const { data: transaction, error: txnError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        type: 'withdrawal',
        amount: -(amountCents / 100), // Negative for withdrawal
        status: 'pending',
        reference_id: payout.payoutId,
        reference_type: 'payout',
        description: 'Withdrawal to bank account',
        state_code: stateCode,
        idempotency_key: idempotencyKey,
        metadata: {
          provider: provider.name,
          estimated_arrival: payout.estimatedArrival?.toISOString(),
        },
      })
      .select()
      .single();

    if (txnError) {
      console.error('[wallet-withdraw] Error creating transaction:', txnError);
      throw txnError;
    }

    // Use atomic wallet update to prevent race conditions
    const { data: walletUpdate, error: updateError } = await supabase
      .rpc('update_wallet_balance', {
        _wallet_id: wallet.id,
        _available_delta: -(amountCents / 100),
        _pending_delta: amountCents / 100,
        _lifetime_withdrawals_delta: amountCents / 100
      })
      .single();

    if (updateError || !walletUpdate || !(walletUpdate as any).success) {
      console.error('[wallet-withdraw] Error updating wallet:', updateError || 'Insufficient balance');
      return new Response(
        JSON.stringify({ error: 'Failed to process withdrawal - insufficient balance or concurrent operation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[wallet-withdraw] Withdrawal initiated:', transaction.id);

    return new Response(
      JSON.stringify({
        transactionId: transaction.id,
        payoutId: payout.payoutId,
        status: 'pending',
        estimatedArrival: payout.estimatedArrival?.toISOString(),
        message: 'Withdrawal initiated successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return createErrorResponse(error, 'wallet-withdraw', corsHeaders);
  }
});
