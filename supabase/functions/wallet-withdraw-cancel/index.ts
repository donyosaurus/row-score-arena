// Cancel Pending Withdrawal

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    const { transactionId } = await req.json();

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'Transaction ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get transaction
    const { data: transaction, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single();

    if (txnError || !transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transaction.type !== 'withdrawal') {
      return new Response(
        JSON.stringify({ error: 'Can only cancel withdrawal transactions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transaction.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Can only cancel pending withdrawals' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to bypass RLS for transaction update
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Cancel transaction (transactions are immutable, so we mark as failed)
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'failed', description: 'Cancelled by user' })
      .eq('id', transactionId);

    if (updateError) {
      console.error('[wallet-withdraw-cancel] Error updating transaction:', updateError);
      throw updateError;
    }

    // Restore balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (wallet) {
      const amountToRestore = Math.abs(Number(transaction.amount));
      
      await supabaseAdmin
        .from('wallets')
        .update({
          available_balance: Number(wallet.available_balance) + amountToRestore,
          pending_balance: Number(wallet.pending_balance) - amountToRestore,
        })
        .eq('id', wallet.id);
    }

    console.log('[wallet-withdraw-cancel] Withdrawal cancelled:', transactionId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Withdrawal cancelled successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[wallet-withdraw-cancel] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
