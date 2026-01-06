import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { requireAdmin } from '../shared/auth-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SettleRequest {
  poolId: string;
}

const FINISH_POINTS: Record<number, number> = {
  1: 100,
  2: 80,
  3: 65,
  4: 50,
  5: 35,
  6: 20,
  7: 10,
};

function getFinishPoints(position: number): number {
  return FINISH_POINTS[position] || 10;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user first
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

    const body: SettleRequest = await req.json();
    const { poolId } = body;

    console.log('Settling pool:', poolId);

    // Get pool with template and results
    const { data: pool, error: poolError } = await supabaseAdmin
      .from('contest_pools')
      .select('*, contest_templates!inner(*)')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return new Response(
        JSON.stringify({ error: 'Pool not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pool.status === 'settled') {
      return new Response(
        JSON.stringify({ error: 'Pool already settled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const template = pool.contest_templates;
    const results = template.results;

    if (!results) {
      return new Response(
        JSON.stringify({ error: 'Contest results not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update pool status to settling
    await supabaseAdmin
      .from('contest_pools')
      .update({ status: 'settling' })
      .eq('id', poolId);

    // Get all entries for this pool
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('contest_entries')
      .select('*')
      .eq('pool_id', poolId)
      .eq('status', 'active');

    if (entriesError || !entries || entries.length === 0) {
      console.error('No entries found:', entriesError);
      return new Response(
        JSON.stringify({ error: 'No entries found for pool' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scoring ${entries.length} entries`);

    // Calculate scores for each entry
    const scoredEntries = entries.map(entry => {
      const picks = entry.picks as Array<any>;
      let totalPoints = 0;
      let marginError = 0;

      for (const pick of picks) {
        // Find crew result
        const crewResult = results.crews?.find((c: any) => c.crewId === pick.crewId);
        if (crewResult && crewResult.finishPosition) {
          totalPoints += getFinishPoints(crewResult.finishPosition);
          
          // Calculate margin error (for tiebreaker)
          if (crewResult.marginSeconds !== undefined && pick.predictedMargin !== undefined) {
            marginError += Math.abs(crewResult.marginSeconds - pick.predictedMargin);
          }
        }
      }

      return {
        ...entry,
        total_points: totalPoints,
        margin_error: marginError,
      };
    });

    // Sort by points (desc) then margin error (asc)
    scoredEntries.sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return a.margin_error - b.margin_error;
    });

    // Assign ranks
    scoredEntries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Update entries with scores and ranks
    for (const entry of scoredEntries) {
      await supabaseAdmin
        .from('contest_entries')
        .update({
          total_points: entry.total_points,
          margin_error: entry.margin_error,
          rank: entry.rank,
        })
        .eq('id', entry.id);
    }

    // Calculate payouts based on prize structure
    const prizeStructure = pool.prize_structure as Record<string, number>;
    const winners: string[] = [];

    for (const [place, prizeCents] of Object.entries(prizeStructure)) {
      const rank = parseInt(place.replace(/\D/g, ''));
      const winner = scoredEntries.find(e => e.rank === rank);
      
      if (winner && prizeCents > 0) {
        winners.push(winner.user_id);
        const payoutAmount = prizeCents / 100;

        // Get wallet
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', winner.user_id)
          .single();

        if (wallet) {
          // Create payout transaction
          await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: winner.user_id,
              wallet_id: wallet.id,
              type: 'payout',
              amount: payoutAmount,
              status: 'completed',
              description: `Contest winnings - Rank ${rank}`,
              reference_type: 'contest_payout',
              reference_id: poolId,
              completed_at: new Date().toISOString(),
            });

          // Update wallet
          await supabaseAdmin
            .from('wallets')
            .update({
              available_balance: parseFloat(wallet.available_balance) + payoutAmount,
              pending_balance: parseFloat(wallet.pending_balance) - (winner.entry_fee_cents / 100),
              lifetime_winnings: parseFloat(wallet.lifetime_winnings) + payoutAmount,
            })
            .eq('id', wallet.id);

          // Update entry payout
          await supabaseAdmin
            .from('contest_entries')
            .update({
              payout_cents: prizeCents,
              status: 'settled',
            })
            .eq('id', winner.id);
        }
      }
    }

    // Release entry fees for non-winners
    for (const entry of scoredEntries) {
      if (!winners.includes(entry.user_id)) {
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', entry.user_id)
          .single();

        if (wallet) {
          // Create entry fee release transaction
          await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: entry.user_id,
              wallet_id: wallet.id,
              type: 'entry_fee_release',
              amount: 0,
              status: 'completed',
              description: 'Entry fee released (no payout)',
              reference_type: 'contest_settlement',
              reference_id: poolId,
              completed_at: new Date().toISOString(),
            });

          // Update wallet (just release pending)
          await supabaseAdmin
            .from('wallets')
            .update({
              pending_balance: parseFloat(wallet.pending_balance) - (entry.entry_fee_cents / 100),
            })
            .eq('id', wallet.id);

          // Update entry status
          await supabaseAdmin
            .from('contest_entries')
            .update({ status: 'settled' })
            .eq('id', entry.id);
        }
      }
    }

    // Update pool status
    await supabaseAdmin
      .from('contest_pools')
      .update({
        status: 'settled',
        winner_ids: winners,
        settled_at: new Date().toISOString(),
      })
      .eq('id', poolId);

    // Log compliance event
    await supabaseAdmin.from('compliance_audit_logs').insert({
      event_type: 'pool_settled',
      description: `Pool ${poolId} settled with ${winners.length} winners`,
      severity: 'info',
      metadata: {
        pool_id: poolId,
        winners,
        total_entries: entries.length,
        prize_pool: pool.prize_pool_cents / 100,
      },
    });

    console.log(`Pool ${poolId} settled successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        poolId,
        winners,
        entries: scoredEntries.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in contest-settle:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});