import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { requireAdmin } from '../shared/auth-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VoidRequest {
  poolId: string;
  reason: string;
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

    // Require admin role - throws if not admin
    await requireAdmin(supabase, user.id);

    // ONLY NOW create service client after admin verification
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: VoidRequest = await req.json();
    const { poolId, reason } = body;

    console.log('Voiding pool:', { poolId, reason, admin: user.id });

    // Get pool
    const { data: pool, error: poolError } = await supabaseAdmin
      .from('contest_pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return new Response(
        JSON.stringify({ error: 'Pool not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pool.status === 'settled' || pool.status === 'voided') {
      return new Response(
        JSON.stringify({ error: 'Pool cannot be voided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all active entries
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('contest_entries')
      .select('*')
      .eq('pool_id', poolId)
      .eq('status', 'active');

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch entries' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let refundCount = 0;

    // Refund all entries
    for (const entry of entries || []) {
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', entry.user_id)
        .single();

      if (wallet) {
        const refundAmount = entry.entry_fee_cents / 100;

        // Create refund transaction
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: entry.user_id,
            wallet_id: wallet.id,
            type: 'refund',
            amount: refundAmount,
            status: 'completed',
            description: `Contest voided: ${reason}`,
            reference_type: 'contest_void',
            reference_id: poolId,
            completed_at: new Date().toISOString(),
          });

        // Update wallet using atomic operation
        const { error: walletError } = await supabaseAdmin
          .rpc('update_wallet_balance', {
            _wallet_id: wallet.id,
            _available_delta: refundAmount,
            _pending_delta: -refundAmount
          });

        if (walletError) {
          console.error('Error updating wallet for entry refund:', walletError);
          continue; // Skip this entry but continue with others
        }

        // Update entry status
        await supabaseAdmin
          .from('contest_entries')
          .update({ status: 'refunded' })
          .eq('id', entry.id);

        refundCount++;
      }
    }

    // Update pool status
    await supabaseAdmin
      .from('contest_pools')
      .update({ status: 'voided' })
      .eq('id', poolId);

    // Log compliance event
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'pool_voided',
      description: `Admin voided pool ${poolId}: ${reason}`,
      severity: 'warning',
      metadata: {
        pool_id: poolId,
        reason,
        refunds_processed: refundCount,
      },
    });

    console.log(`Pool ${poolId} voided. Refunded ${refundCount} entries`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pool voided and refunds processed',
        refundCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-contest-void:', error);
    // Generic error for security
    return new Response(
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});