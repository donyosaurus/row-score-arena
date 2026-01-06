// Contest Settlement & Payout Engine - Admin-only

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { requireAdmin } from '../shared/auth-helpers.ts';

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

    // SECURITY: Require admin role
    await requireAdmin(supabase, user.id);

    // Validate input
    const settleSchema = z.object({
      contestPoolId: z.string().uuid(),
    });

    const body = settleSchema.parse(await req.json());
    const { contestPoolId } = body;

    console.log('[settle] Admin', user.id, 'settling pool:', contestPoolId);

    // ONLY NOW create service client after admin verification
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Call the atomic RPC to settle payouts
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('settle_pool_payouts', {
      p_contest_pool_id: contestPoolId,
    });

    if (rpcError) {
      console.error('[settle] RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Failed to settle pool' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log compliance event
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'pool_settled',
      severity: 'info',
      description: `Admin settled contest pool ${contestPoolId}`,
      metadata: {
        contest_pool_id: contestPoolId,
        winners_count: rpcResult?.winners_count || 0,
        total_payout: rpcResult?.total_payout || 0,
        gross_pot: rpcResult?.gross_pot || 0,
        platform_fee: rpcResult?.platform_fee || 0,
        payout_per_winner: rpcResult?.payout_per_winner || 0,
      },
    });

    console.log('[settle] Pool settled successfully:', rpcResult);

    return new Response(
      JSON.stringify({
        success: true,
        contestPoolId,
        winnersCount: rpcResult?.winners_count || 0,
        totalPayoutCents: rpcResult?.total_payout || 0,
        grossPotCents: rpcResult?.gross_pot || 0,
        platformFeeCents: rpcResult?.platform_fee || 0,
        payoutPerWinnerCents: rpcResult?.payout_per_winner || 0,
        message: 'Settlement completed successfully',
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
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
