import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WithdrawRequest {
  entryId: string;
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

    const body: WithdrawRequest = await req.json();
    const { entryId } = body;

    console.log('Contest withdrawal request:', { userId: user.id, entryId });

    // Get entry details
    const { data: entry, error: entryError } = await supabase
      .from('contest_entries')
      .select('*, contest_pools!inner(*)')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single();

    if (entryError || !entry) {
      return new Response(
        JSON.stringify({ error: 'Entry not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (entry.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Entry cannot be withdrawn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if contest is locked
    const pool = entry.contest_pools;
    if (pool.status !== 'open') {
      return new Response(
        JSON.stringify({ error: 'Cannot withdraw from locked contest' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if lock time has passed
    if (new Date(pool.lock_time) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Contest entry period has ended' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get wallet
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

    const refundAmount = entry.entry_fee_cents / 100;

    // Create refund transaction (entry_fee_release)
    const { error: refundError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        type: 'entry_fee_release',
        amount: refundAmount,
        status: 'completed',
        description: `Entry withdrawal refund`,
        reference_type: 'contest_entry',
        reference_id: entryId,
        completed_at: new Date().toISOString(),
      });

    if (refundError) {
      console.error('Error creating refund transaction:', refundError);
      return new Response(
        JSON.stringify({ error: 'Failed to process refund' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update wallet balances
    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({
        available_balance: parseFloat(wallet.available_balance) + refundAmount,
        pending_balance: parseFloat(wallet.pending_balance) - refundAmount,
      })
      .eq('id', wallet.id);

    if (walletUpdateError) {
      console.error('Error updating wallet:', walletUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update entry status
    const { error: entryUpdateError } = await supabase
      .from('contest_entries')
      .update({ status: 'withdrawn' })
      .eq('id', entryId);

    if (entryUpdateError) {
      console.error('Error updating entry:', entryUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update entry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update pool current entries count
    await supabase
      .from('contest_pools')
      .update({ current_entries: pool.current_entries - 1 })
      .eq('id', pool.id);

    // Log compliance event
    await supabase.from('compliance_audit_logs').insert({
      user_id: user.id,
      event_type: 'contest_withdrawal',
      description: 'User withdrew from contest',
      severity: 'info',
      metadata: {
        entry_id: entryId,
        pool_id: pool.id,
        refund_amount: refundAmount,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Entry withdrawn and funds refunded',
        refundAmount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in contest-withdraw:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});