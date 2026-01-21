// Contest Settlement & Payout Engine - Admin-only
// Ensures ALL entries are settled and contests move to History

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayoutStructure {
  [rank: string]: number; // rank -> cents
}

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

    // ========== STEP 1: FETCH ALL DATA ==========
    
    // 1a. Fetch pool details
    const { data: pool, error: poolError } = await supabaseAdmin
      .from('contest_pools')
      .select('id, status, prize_pool_cents, contest_template_id, payout_structure, entry_fee_cents, current_entries')
      .eq('id', contestPoolId)
      .single();

    if (poolError || !pool) {
      console.error('[settle] Pool not found:', poolError);
      return new Response(
        JSON.stringify({ error: 'Contest pool not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[settle] Pool fetched:', { id: pool.id, status: pool.status, entries: pool.current_entries });

    // 1b. Fetch ALL contest_entries for this pool (regardless of status)
    const { data: allEntries, error: entriesError } = await supabaseAdmin
      .from('contest_entries')
      .select('id, user_id, status, payout_cents')
      .eq('pool_id', contestPoolId);

    if (entriesError) {
      console.error('[settle] Error fetching entries:', entriesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch contest entries' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[settle] Found', allEntries?.length || 0, 'total entries in pool');

    // 1c. Fetch ALL contest_scores for this pool
    const { data: allScores, error: scoresError } = await supabaseAdmin
      .from('contest_scores')
      .select('id, entry_id, user_id, rank, total_points, payout_cents')
      .eq('instance_id', contestPoolId)
      .order('rank', { ascending: true });

    if (scoresError) {
      console.error('[settle] Error fetching scores:', scoresError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch contest scores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[settle] Found', allScores?.length || 0, 'scored entries');

    // ========== STEP 2: VALIDATE ==========
    
    // Idempotency: Already settled
    if (pool.status === 'settled') {
      console.log('[settle] Pool already settled, returning success');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Pool has already been settled',
          alreadySettled: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    if (!allEntries || allEntries.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No entries found for this pool' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== STEP 3: PROCESS WINNERS ==========
    
    const payoutStructure = pool.payout_structure as PayoutStructure | null;
    const collectedRevenue = pool.entry_fee_cents * pool.current_entries;
    const processedEntryIds = new Set<string>();
    
    const payoutResults: Array<{
      userId: string;
      entryId: string;
      rank: number;
      payoutCents: number;
      success: boolean;
      error?: string;
    }> = [];

    let totalPayoutCents = 0;

    // Create a map of entry_id -> score for quick lookup
    const scoreByEntryId = new Map<string, { id: string; user_id: string; rank: number; total_points: number }>();
    for (const score of (allScores || [])) {
      scoreByEntryId.set(score.entry_id, score);
    }

    if (payoutStructure && Object.keys(payoutStructure).length > 0) {
      // Multi-tier fixed payouts from payout_structure
      console.log('[settle] Using payout structure:', payoutStructure);

      // Group scores by rank to handle ties
      const scoresByRank: Record<number, typeof allScores> = {};
      for (const score of (allScores || [])) {
        const rank = score.rank || 999;
        if (!scoresByRank[rank]) {
          scoresByRank[rank] = [];
        }
        scoresByRank[rank].push(score);
      }

      // Process each rank that has a payout defined
      for (const [rankStr, payoutAmountCents] of Object.entries(payoutStructure)) {
        const rank = parseInt(rankStr);
        const scoresAtRank = scoresByRank[rank] || [];

        if (scoresAtRank.length === 0) {
          console.log(`[settle] No entries at rank ${rank}, skipping payout of ${payoutAmountCents} cents`);
          continue;
        }

        // Split this rank's prize among tied entries
        const payoutPerEntry = Math.floor(payoutAmountCents / scoresAtRank.length);
        console.log(`[settle] Rank ${rank}: ${scoresAtRank.length} entries split ${payoutAmountCents} cents (${payoutPerEntry} each)`);

        for (const winner of scoresAtRank) {
          try {
            // Get user's wallet
            const { data: wallet, error: walletError } = await supabaseAdmin
              .from('wallets')
              .select('id')
              .eq('user_id', winner.user_id)
              .single();

            if (walletError || !wallet) {
              throw new Error(`Wallet not found for user ${winner.user_id}`);
            }

            // 1. Update wallet balance via RPC
            const { error: balanceError } = await supabaseAdmin.rpc('update_wallet_balance', {
              _wallet_id: wallet.id,
              _available_delta: payoutPerEntry,
              _pending_delta: 0,
              _lifetime_winnings_delta: payoutPerEntry,
              _lifetime_deposits_delta: 0,
              _lifetime_withdrawals_delta: 0,
            });

            if (balanceError) {
              throw new Error(`Failed to update wallet balance: ${balanceError.message}`);
            }

            // 2. Insert ledger entry
            await supabaseAdmin.from('ledger_entries').insert({
              user_id: winner.user_id,
              transaction_type: 'PRIZE_PAYOUT',
              amount: payoutPerEntry,
              description: `Contest payout - Rank ${rank} - Pool ${contestPoolId}`,
              reference_id: contestPoolId,
            });

            // 3. Insert transaction record
            await supabaseAdmin.from('transactions').insert({
              user_id: winner.user_id,
              wallet_id: wallet.id,
              type: 'payout',
              amount: payoutPerEntry,
              status: 'completed',
              completed_at: new Date().toISOString(),
              description: `Contest winnings - Rank ${rank}`,
              reference_id: winner.entry_id,
              reference_type: 'contest_entry',
              is_taxable: true,
              tax_year: new Date().getFullYear(),
              metadata: {
                contest_pool_id: contestPoolId,
                rank: rank,
                total_points: winner.total_points,
              },
            });

            // 4. Update contest_scores
            await supabaseAdmin
              .from('contest_scores')
              .update({ payout_cents: payoutPerEntry })
              .eq('id', winner.id);

            // 5. Update contest_entries - mark as settled with payout
            await supabaseAdmin
              .from('contest_entries')
              .update({ 
                payout_cents: payoutPerEntry, 
                status: 'settled' 
              })
              .eq('id', winner.entry_id);

            // Track this entry as processed
            processedEntryIds.add(winner.entry_id);
            totalPayoutCents += payoutPerEntry;

            payoutResults.push({
              userId: winner.user_id,
              entryId: winner.entry_id,
              rank: rank,
              payoutCents: payoutPerEntry,
              success: true,
            });

            console.log(`[settle] Paid ${payoutPerEntry} cents to user ${winner.user_id} (rank ${rank})`);

          } catch (error: any) {
            console.error(`[settle] Payout failed for user ${winner.user_id}:`, error);
            payoutResults.push({
              userId: winner.user_id,
              entryId: winner.entry_id,
              rank: rank,
              payoutCents: 0,
              success: false,
              error: error.message,
            });
            // Still mark as processed to avoid double processing
            processedEntryIds.add(winner.entry_id);
          }
        }
      }
    } else {
      // Legacy: split entire prize pool among rank 1 winners
      console.log('[settle] No payout structure, using legacy winner-takes-all');
      const prizePoolCents = pool.prize_pool_cents || 0;
      const winners = (allScores || []).filter(s => s.rank === 1);

      if (winners.length > 0) {
        const payoutPerWinner = Math.floor(prizePoolCents / winners.length);

        for (const winner of winners) {
          try {
            const { data: wallet } = await supabaseAdmin
              .from('wallets')
              .select('id')
              .eq('user_id', winner.user_id)
              .single();

            if (!wallet) throw new Error('Wallet not found');

            await supabaseAdmin.rpc('update_wallet_balance', {
              _wallet_id: wallet.id,
              _available_delta: payoutPerWinner,
              _pending_delta: 0,
              _lifetime_winnings_delta: payoutPerWinner,
              _lifetime_deposits_delta: 0,
              _lifetime_withdrawals_delta: 0,
            });

            await supabaseAdmin.from('ledger_entries').insert({
              user_id: winner.user_id,
              transaction_type: 'PRIZE_PAYOUT',
              amount: payoutPerWinner,
              description: `Contest payout - Pool ${contestPoolId}`,
              reference_id: contestPoolId,
            });

            await supabaseAdmin.from('transactions').insert({
              user_id: winner.user_id,
              wallet_id: wallet.id,
              type: 'payout',
              amount: payoutPerWinner,
              status: 'completed',
              completed_at: new Date().toISOString(),
              description: `Contest winnings`,
              reference_id: winner.entry_id,
              reference_type: 'contest_entry',
              is_taxable: true,
              tax_year: new Date().getFullYear(),
            });

            await supabaseAdmin.from('contest_scores').update({ payout_cents: payoutPerWinner }).eq('id', winner.id);
            await supabaseAdmin.from('contest_entries').update({ payout_cents: payoutPerWinner, status: 'settled' }).eq('id', winner.entry_id);

            processedEntryIds.add(winner.entry_id);
            totalPayoutCents += payoutPerWinner;
            payoutResults.push({ userId: winner.user_id, entryId: winner.entry_id, rank: 1, payoutCents: payoutPerWinner, success: true });
          } catch (error: any) {
            payoutResults.push({ userId: winner.user_id, entryId: winner.entry_id, rank: 1, payoutCents: 0, success: false, error: error.message });
            processedEntryIds.add(winner.entry_id);
          }
        }
      }
    }

    // ========== STEP 4: PROCESS NON-WINNERS (ALL REMAINING ENTRIES) ==========
    
    // Find all entries that were NOT processed as winners
    const nonWinnerEntries = allEntries.filter(entry => !processedEntryIds.has(entry.id));
    
    console.log(`[settle] Processing ${nonWinnerEntries.length} non-winning entries`);

    if (nonWinnerEntries.length > 0) {
      // Get all non-winner entry IDs
      const nonWinnerIds = nonWinnerEntries.map(e => e.id);
      
      // Batch update ALL non-winner entries to settled with payout_cents = 0
      const { error: nonWinnerUpdateError } = await supabaseAdmin
        .from('contest_entries')
        .update({ 
          status: 'settled', 
          payout_cents: 0 
        })
        .in('id', nonWinnerIds);

      if (nonWinnerUpdateError) {
        console.error('[settle] Error updating non-winners:', nonWinnerUpdateError);
      } else {
        console.log(`[settle] Successfully settled ${nonWinnerIds.length} non-winning entries`);
      }
    }

    // ========== STEP 5: FINALIZE POOL ==========
    
    const { error: poolUpdateError } = await supabaseAdmin
      .from('contest_pools')
      .update({
        status: 'settled',
        settled_at: new Date().toISOString(),
      })
      .eq('id', contestPoolId);

    if (poolUpdateError) {
      console.error('[settle] Error updating pool status:', poolUpdateError);
    }

    // ========== STEP 6: LOG TO COMPLIANCE ==========
    
    const adminProfit = collectedRevenue - totalPayoutCents;

    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'pool_settled',
      severity: 'info',
      description: `Admin settled contest pool ${contestPoolId}`,
      metadata: {
        contest_pool_id: contestPoolId,
        payout_structure: payoutStructure,
        collected_revenue_cents: collectedRevenue,
        total_payout_cents: totalPayoutCents,
        admin_profit_cents: adminProfit,
        total_entries: allEntries.length,
        winners_paid: payoutResults.filter(p => p.success).length,
        non_winners_settled: nonWinnerEntries.length,
        failed_payouts: payoutResults.filter(p => !p.success).length,
        payout_results: payoutResults,
      },
    });

    console.log('[settle] ===== SETTLEMENT COMPLETE =====');
    console.log('[settle] Pool:', contestPoolId);
    console.log('[settle] Total Entries:', allEntries.length);
    console.log('[settle] Winners Paid:', payoutResults.filter(p => p.success).length);
    console.log('[settle] Non-Winners Settled:', nonWinnerEntries.length);
    console.log('[settle] Revenue:', collectedRevenue, 'Payouts:', totalPayoutCents, 'Profit:', adminProfit);

    return new Response(
      JSON.stringify({
        success: true,
        contestPoolId,
        collectedRevenueCents: collectedRevenue,
        totalPayoutCents,
        adminProfitCents: adminProfit,
        totalEntries: allEntries.length,
        winnersCount: payoutResults.filter(p => p.success).length,
        nonWinnersSettled: nonWinnerEntries.length,
        failedPayouts: payoutResults.filter(p => !p.success).length,
        payoutResults,
        message: payoutResults.some(p => !p.success)
          ? `Settlement completed with ${payoutResults.filter(p => !p.success).length} failed payout(s)`
          : 'Settlement completed successfully - all entries marked as settled',
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
      JSON.stringify({ error: error.message || 'An error occurred during settlement' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
