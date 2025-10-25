// Wallet Withdrawal - Initiate payout with compliance checks

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getPaymentProvider } from '../shared/payment-providers/factory.ts';
import { performComplianceChecks } from '../shared/compliance-checks.ts';

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

    const { amountCents, destinationToken, stateCode, idempotencyKey } = await req.json();

    if (!amountCents || amountCents < 1000) {
      return new Response(
        JSON.stringify({ error: 'Minimum withdrawal is $10.00' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get user wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check sufficient balance
    const availableCents = Math.floor(Number(wallet.available_balance) * 100);
    if (availableCents < amountCents) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          available: availableCents / 100,
          requested: amountCents / 100,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform compliance checks
    const complianceResult = await performComplianceChecks({
      userId: user.id,
      stateCode: stateCode || wallet.state_code || 'US',
      amountCents,
      actionType: 'withdrawal',
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    });

    if (!complianceResult.allowed) {
      return new Response(
        JSON.stringify({ error: complianceResult.reason }),
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

    // Deduct from available balance (move to pending)
    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        available_balance: Number(wallet.available_balance) - (amountCents / 100),
        pending_balance: Number(wallet.pending_balance) + (amountCents / 100),
      })
      .eq('id', wallet.id);

    if (updateError) {
      console.error('[wallet-withdraw] Error updating wallet:', updateError);
      throw updateError;
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
    console.error('[wallet-withdraw] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
