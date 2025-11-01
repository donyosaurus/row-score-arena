// Contest Settlement - Calculate and distribute payouts automatically

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // SECURITY: Admin-only endpoint
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NOW create service client after auth check
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Validate input
    const settlementSchema = z.object({
      instanceId: z.string().uuid(),
      forceResettle: z.boolean().optional(),
    });

    const body = settlementSchema.parse(await req.json());

    console.log('[settlement] Admin', user.id, 'processing settlement for instance:', body.instanceId);

    // Get instance
    const { data: instance, error: instanceError } = await supabaseAdmin
      .from('contest_instances')
      .select('*, contest_templates(*)')
      .eq('id', body.instanceId)
      .single();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ error: 'Contest instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IDEMPOTENCY: Check if already settled
    if (instance.settled_at && !body.forceResettle) {
      console.log('[settlement] Instance already settled at', instance.settled_at);
      
      // Log idempotent attempt
      await supabaseAdmin.from('compliance_audit_logs').insert({
        admin_id: user.id,
        event_type: 'settlement_duplicate_attempt',
        severity: 'info',
        description: `Admin attempted duplicate settlement of instance ${body.instanceId}`,
        metadata: { instance_id: body.instanceId, already_settled_at: instance.settled_at },
      });

      return new Response(
        JSON.stringify({ 
          error: 'Contest already settled',
          settled_at: instance.settled_at,
          message: 'Use forceResettle=true to override (admin only)'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get scores (must be calculated first)
    const { data: scores, error: scoresError } = await supabaseAdmin
      .from('contest_scores')
      .select('*')
      .eq('instance_id', body.instanceId)
      .order('rank', { ascending: true });

    if (scoresError || !scores || scores.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No scores found. Run scoring first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[settlement] Found', scores.length, 'entries to settle');

    // Calculate prize pool
    const totalPrizePool = instance.entry_fee_cents * instance.current_entries;
    
    // Prize structure: 60% to 1st, 40% to 2nd (if 2+ entries)
    const firstPlacePayout = Math.floor(totalPrizePool * 0.6);
    const secondPlacePayout = scores.length > 1 ? Math.floor(totalPrizePool * 0.4) : 0;

    console.log('[settlement] Prize pool:', totalPrizePool / 100, 'First:', firstPlacePayout / 100, 'Second:', secondPlacePayout / 100);

    // Update scores with payouts
    const winners = [];
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      let payout = 0;
      let isWinner = false;

      if (score.rank === 1) {
        payout = firstPlacePayout;
        isWinner = true;
      } else if (score.rank === 2 && secondPlacePayout > 0) {
        payout = secondPlacePayout;
        isWinner = true;
      }

      // Update score with payout
      await supabaseAdmin
        .from('contest_scores')
        .update({
          payout_cents: payout,
          is_winner: isWinner,
        })
        .eq('id', score.id);

      if (isWinner) {
        winners.push({
          userId: score.user_id,
          entryId: score.entry_id,
          rank: score.rank,
          payoutCents: payout,
        });
      }
    }

    // Process payouts via wallet transactions
    for (const winner of winners) {
      // Get user wallet
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('id')
        .eq('user_id', winner.userId)
        .single();

      if (!wallet) {
        console.error('[settlement] Wallet not found for user:', winner.userId);
        continue;
      }

      // Create payout transaction
      const { error: txnError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: winner.userId,
          wallet_id: wallet.id,
          type: 'contest_winnings',
          amount: winner.payoutCents / 100,
          status: 'completed',
          reference_id: winner.entryId,
          reference_type: 'contest_entry',
          description: `Contest winnings - Rank ${winner.rank}`,
          completed_at: new Date().toISOString(),
          metadata: {
            instance_id: body.instanceId,
            pool_number: instance.pool_number,
            regatta_name: instance.contest_templates.regatta_name,
          },
        });

      if (txnError) {
        console.error('[settlement] Error creating payout transaction:', txnError);
      }

      // Update wallet balance
      await supabaseAdmin.rpc('update_wallet_balance', {
        _wallet_id: wallet.id,
        _available_delta: winner.payoutCents / 100,
        _pending_delta: 0,
        _lifetime_winnings_delta: winner.payoutCents / 100,
      });

      console.log('[settlement] Paid', winner.payoutCents / 100, 'to user', winner.userId);
    }

    // Release entry fees for non-winners (mark as released)
    for (const score of scores) {
      if (!winners.find(w => w.userId === score.user_id)) {
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('id')
          .eq('user_id', score.user_id)
          .single();

        if (wallet) {
          // Create entry fee release transaction
          await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: score.user_id,
              wallet_id: wallet.id,
              type: 'entry_fee_release',
              amount: 0, // No money movement, just accounting
              status: 'completed',
              reference_id: score.entry_id,
              reference_type: 'contest_entry',
              description: 'Entry fee released (no payout)',
              completed_at: new Date().toISOString(),
            });
        }
      }
    }

    // Update instance as settled
    await supabaseAdmin
      .from('contest_instances')
      .update({
        settled_at: new Date().toISOString(),
        prize_pool_cents: totalPrizePool,
      })
      .eq('id', body.instanceId);

    // Log to compliance
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'contest_settled',
      severity: 'info',
      description: `Contest settled: ${instance.contest_templates.regatta_name} - Pool ${instance.pool_number}`,
      metadata: {
        instance_id: body.instanceId,
        pool_number: instance.pool_number,
        total_entries: scores.length,
        prize_pool: totalPrizePool / 100,
        winners: winners.length,
        payouts: winners.map(w => ({
          user_id: w.userId,
          rank: w.rank,
          payout: w.payoutCents / 100,
        })),
      },
    });

    console.log('[settlement] Settlement complete for instance:', body.instanceId);

    return new Response(
      JSON.stringify({
        instanceId: body.instanceId,
        totalEntries: scores.length,
        prizePool: totalPrizePool / 100,
        winnersCount: winners.length,
        payouts: winners.map(w => ({
          rank: w.rank,
          payout: w.payoutCents / 100,
        })),
        message: 'Settlement completed successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[settlement] Error:', error);
    // Generic error for security
    return new Response(
      JSON.stringify({ error: 'An error occurred during settlement' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
