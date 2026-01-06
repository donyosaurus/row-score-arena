// Wallet Deposit - Process deposit using ledger system

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { MockPaymentAdapter } from '../shared/payment-providers/mock-adapter.ts';

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    // User client for auth
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

    // Validate input
    const depositSchema = z.object({
      amount: z.number().int().positive().min(100).max(10000000), // $1 - $100k in cents
    });

    let body;
    try {
      const rawBody = await req.json();
      body = depositSchema.parse(rawBody);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid input: amount must be a positive integer in cents' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount } = body;

    // Process payment with mock adapter
    const paymentAdapter = new MockPaymentAdapter();
    const paymentResult = await paymentAdapter.processPayment(amount, 'USD');

    if (!paymentResult.success) {
      return new Response(
        JSON.stringify({ error: 'Payment processing failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client to insert ledger entry
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: ledgerError } = await adminClient
      .from('ledger_entries')
      .insert({
        user_id: user.id,
        amount: amount, // Positive for deposit
        transaction_type: 'DEPOSIT',
        description: 'Deposit via Mock Adapter',
        reference_id: null,
      });

    if (ledgerError) {
      console.error('[wallet-deposit] Ledger insert error:', ledgerError);
      return new Response(
        JSON.stringify({ error: 'Failed to record deposit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get new balance
    const { data: balanceData, error: balanceError } = await adminClient
      .rpc('get_user_balance', { target_user_id: user.id });

    if (balanceError) {
      console.error('[wallet-deposit] Balance fetch error:', balanceError);
    }

    const balanceCents = Number(balanceData) || 0;
    const balanceDisplay = `$${(balanceCents / 100).toFixed(2)}`;

    console.log('[wallet-deposit] Deposit successful:', { userId: user.id, amount, transactionId: paymentResult.transactionId });

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: paymentResult.transactionId,
        depositedAmount: amount,
        balanceCents,
        balanceDisplay,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[wallet-deposit] Error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
