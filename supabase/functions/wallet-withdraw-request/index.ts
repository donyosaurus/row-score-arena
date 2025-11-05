// Wallet Withdraw Request - Create pending withdrawal with Phase 4 checks

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

    // Fetch wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountDollars = amount_cents / 100;

    // Check per-transaction limit ($200)
    if (amountDollars > 200) {
      return new Response(
        JSON.stringify({ error: 'Per-transaction withdrawal limit is $200' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check available balance
    if (Number(wallet.available_balance) < amountDollars) {
      return new Response(
        JSON.stringify({ error: 'Insufficient balance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for pending withdrawals
    const { data: pendingWithdrawals } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'withdrawal')
      .eq('status', 'pending');

    if (pendingWithdrawals && pendingWithdrawals.length > 0) {
      return new Response(
        JSON.stringify({ error: 'You have a pending withdrawal. Please wait for it to complete.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check 10-minute cooldown
    const { data: lastWithdrawal } = await supabase
      .from('transactions')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('type', 'withdrawal')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastWithdrawal) {
      const timeSince = Date.now() - new Date(lastWithdrawal.created_at).getTime();
      const minutesSince = timeSince / (1000 * 60);
      if (minutesSince < 10) {
        return new Response(
          JSON.stringify({ error: 'Please wait 10 minutes between withdrawal requests' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check daily limit ($500)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayWithdrawals } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'withdrawal')
      .eq('status', 'completed')
      .gte('created_at', todayStart.toISOString());

    const todayTotal = todayWithdrawals?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

    if (todayTotal + amountDollars > 500) {
      return new Response(
        JSON.stringify({ error: 'Daily withdrawal limit of $500 exceeded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check 24-hour deposit hold
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { data: recentDeposits } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'deposit')
      .gte('created_at', oneDayAgo.toISOString());

    const recentDepositTotal = recentDeposits?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    if (recentDepositTotal > 0) {
      return new Response(
        JSON.stringify({ error: 'Deposits must be held for 24 hours before withdrawal' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pending withdrawal transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        type: 'withdrawal',
        amount: -amountDollars,
        status: 'pending',
        description: 'Withdrawal request',
        metadata: { amount_cents },
      })
      .select()
      .single();

    if (txError) {
      throw txError;
    }

    // Log compliance event
    await supabase
      .from('compliance_audit_logs')
      .insert({
        user_id: user.id,
        event_type: 'withdrawal_requested',
        description: 'User requested withdrawal',
        severity: 'info',
        metadata: { amount_cents, transaction_id: transaction.id },
      });

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transaction.id,
        status: 'pending',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[wallet-withdraw-request] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to request withdrawal' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
