// Contest Settlement & Payout Engine - Admin-only

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate user first
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const settleSchema = z.object({
      contestPoolId: z.string().uuid(),
    });

    const body = settleSchema.parse(await req.json());
    const { contestPoolId } = body;

    console.log('[settle] Admin', user.id, 'settling pool:', contestPoolId);

    // ONLY NOW create service client after admin verification
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch pool details
    const { data: pool, error: poolError } = await supabaseAdmin
      .from('contest_pools')
      .select('id, status, prize_pool_cents, contest_template_id')
      .eq('id', contestPoolId)
      .single();

    if (poolError || !pool) {
      return new Response(
        JSON.stringify({ error: 'Contest pool not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify status is scoring_completed
    if (pool.status !== 'scoring_completed') {
      return new Response(
        JSON.stringify({ 
          error: `Cannot settle pool with status '${pool.status}'. Must be 'scoring_completed'.`,
          currentStatus: pool.status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Already settled check (idempotency)
    if (pool.status === 'settled') {
      return new Response(
        JSON.stringify({ 
          message: 'Pool has already been settled',
          alreadySettled: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prizePoolCents = pool.prize_pool_cents || 0;

    // Identify winners: Query contest_scores where instance_id = poolId AND rank = 1
    const { data: winners, error: winnersError } = await supabaseAdmin
      .from('contest_scores')
      .select('id, user_id, entry_id, total_points, payout_cents')
      .eq('instance_id', contestPoolId) // instance_id maps to pool_id in our system
      .eq('rank', 1);

    if (winnersError) {
      console.error('[settle] Error fetching winners:', winnersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch winners' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!winners || winners.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No winners found for this pool' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[settle] Found', winners.length, 'winner(s) for pool:', contestPoolId);

    // Split pot equally among winners (handle ties)
    const payoutPerWinnerCents = Math.floor(prizePoolCents / winners.length);
    const totalPayoutCents = payoutPerWinnerCents * winners.length;
    const remainderCents = prizePoolCents - totalPayoutCents; // Platform keeps remainder from rounding

    console.log('[settle] Prize pool:', prizePoolCents, 'cents. Payout per winner:', payoutPerWinnerCents, 'cents');

    // Execute payouts for each winner
    const payoutResults: Array<{
      userId: string;
      entryId: string;
      payoutCents: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const winner of winners) {
      try {
        console.log('[settle] Processing payout for user:', winner.user_id);

        // Get user's wallet
        const { data: wallet, error: walletError } = await supabaseAdmin
          .from('wallets')
          .select('id')
          .eq('user_id', winner.user_id)
          .single();

        if (walletError || !wallet) {
          throw new Error(`Wallet not found for user ${winner.user_id}`);
        }

        // 1. Wallet Update: Call update_wallet_balance RPC (Available +Payout, Lifetime Winnings +Payout)
        const { data: balanceResult, error: balanceError } = await supabaseAdmin.rpc('update_wallet_balance', {
          _wallet_id: wallet.id,
          _available_delta: payoutPerWinnerCents,
          _pending_delta: 0,
          _lifetime_winnings_delta: payoutPerWinnerCents,
          _lifetime_deposits_delta: 0,
          _lifetime_withdrawals_delta: 0,
        });

        if (balanceError) {
          throw new Error(`Failed to update wallet balance: ${balanceError.message}`);
        }

        console.log('[settle] Wallet updated for user:', winner.user_id, 'Result:', balanceResult);

        // 2. Ledger Entry: Insert into ledger_entries
        const { error: ledgerError } = await supabaseAdmin
          .from('ledger_entries')
          .insert({
            user_id: winner.user_id,
            transaction_type: 'PRIZE_PAYOUT',
            amount: payoutPerWinnerCents,
            description: `Contest payout - Pool ${contestPoolId}`,
            reference_id: contestPoolId,
          });

        if (ledgerError) {
          console.error('[settle] Ledger entry error:', ledgerError);
          // Non-fatal - continue with transaction record
        }

        // 3. Transaction Record: Insert into transactions
        const { error: txError } = await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: winner.user_id,
            wallet_id: wallet.id,
            type: 'payout',
            amount: payoutPerWinnerCents,
            status: 'completed',
            completed_at: new Date().toISOString(),
            description: `Contest winnings - Pool ${contestPoolId}`,
            reference_id: winner.entry_id,
            reference_type: 'contest_entry',
            is_taxable: true,
            tax_year: new Date().getFullYear(),
            metadata: {
              contest_pool_id: contestPoolId,
              rank: 1,
              total_points: winner.total_points,
              winners_count: winners.length,
              prize_pool_cents: prizePoolCents,
            },
          });

        if (txError) {
          console.error('[settle] Transaction record error:', txError);
          // Non-fatal - wallet was already updated
        }

        // 4. Update contest_scores with final payout amount
        await supabaseAdmin
          .from('contest_scores')
          .update({ payout_cents: payoutPerWinnerCents })
          .eq('id', winner.id);

        // 5. Update contest_entries with payout amount
        await supabaseAdmin
          .from('contest_entries')
          .update({ 
            payout_cents: payoutPerWinnerCents,
            status: 'settled',
          })
          .eq('id', winner.entry_id);

        payoutResults.push({
          userId: winner.user_id,
          entryId: winner.entry_id,
          payoutCents: payoutPerWinnerCents,
          success: true,
        });

        console.log('[settle] Payout complete for user:', winner.user_id);

      } catch (error: any) {
        console.error('[settle] Payout failed for user:', winner.user_id, error);
        payoutResults.push({
          userId: winner.user_id,
          entryId: winner.entry_id,
          payoutCents: 0,
          success: false,
          error: error.message,
        });
      }
    }

    // Check if all payouts succeeded
    const successfulPayouts = payoutResults.filter(p => p.success);
    const failedPayouts = payoutResults.filter(p => !p.success);

    if (failedPayouts.length > 0) {
      console.error('[settle] Some payouts failed:', failedPayouts);
    }

    // Close Pool: Update contest_pools status to settled
    const { error: updatePoolError } = await supabaseAdmin
      .from('contest_pools')
      .update({
        status: 'settled',
        settled_at: new Date().toISOString(),
      })
      .eq('id', contestPoolId);

    if (updatePoolError) {
      console.error('[settle] Failed to update pool status:', updatePoolError);
    }

    // Log to compliance_audit_logs
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'pool_settled',
      severity: 'info',
      description: `Admin settled contest pool ${contestPoolId}`,
      metadata: {
        contest_pool_id: contestPoolId,
        prize_pool_cents: prizePoolCents,
        winners_count: winners.length,
        payout_per_winner_cents: payoutPerWinnerCents,
        total_payout_cents: totalPayoutCents,
        remainder_cents: remainderCents,
        successful_payouts: successfulPayouts.length,
        failed_payouts: failedPayouts.length,
        payout_results: payoutResults,
      },
    });

    console.log('[settle] Pool settled successfully:', contestPoolId);

    return new Response(
      JSON.stringify({
        success: true,
        contestPoolId,
        prizePoolCents,
        winnersCount: winners.length,
        payoutPerWinnerCents,
        totalPayoutCents,
        remainderCents,
        successfulPayouts: successfulPayouts.length,
        failedPayouts: failedPayouts.length,
        payoutResults,
        message: failedPayouts.length > 0 
          ? `Settlement completed with ${failedPayouts.length} failed payout(s)`
          : 'Settlement completed successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[settle] Error:', error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
