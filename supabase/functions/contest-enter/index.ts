import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { performComplianceChecks } from '../shared/compliance-checks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EntryRequest {
  contestTemplateId: string;
  tierId: string;
  picks: Array<{
    crewId: string;
    divisionId: string;
    predictedMargin: number;
  }>;
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

    const body: EntryRequest = await req.json();
    const { contestTemplateId, tierId, picks } = body;

    console.log('Contest entry request:', { userId: user.id, contestTemplateId, tierId });

    // Validate picks
    if (!picks || picks.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Minimum 2 picks required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get contest template
    const { data: template, error: templateError } = await supabase
      .from('contest_templates')
      .select('*')
      .eq('id', contestTemplateId)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: 'Contest template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (template.status !== 'open') {
      return new Response(
        JSON.stringify({ error: 'Contest is not open for entry' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if contest is locked
    if (new Date(template.lock_time) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Contest entry period has ended' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find entry tier
    const entryTiers = template.entry_tiers as Array<any>;
    const tier = entryTiers.find(t => t.id === tierId);
    if (!tier) {
      return new Response(
        JSON.stringify({ error: 'Invalid entry tier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entryFeeCents = tier.entryFee * 100;

    // Get user profile and state
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('state, is_active, self_exclusion_until, is_employee')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform compliance checks
    const complianceResult = await performComplianceChecks({
      userId: user.id,
      stateCode: profile.state,
      amountCents: entryFeeCents,
      actionType: 'entry',
    });

    if (!complianceResult.allowed) {
      return new Response(
        JSON.stringify({ error: complianceResult.reason || 'Contest entry not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user wallet
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

    // Check sufficient balance
    const availableBalance = parseFloat(wallet.available_balance);
    const entryFee = entryFeeCents / 100;

    if (availableBalance < entryFee) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          required: entryFee,
          available: availableBalance
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already entered this contest
    const { data: existingEntry } = await supabase
      .from('contest_entries')
      .select('id')
      .eq('user_id', user.id)
      .eq('contest_template_id', contestTemplateId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingEntry) {
      return new Response(
        JSON.stringify({ error: 'Already entered this contest' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create fund hold transaction
    const { error: holdError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        type: 'entry_fee_hold',
        amount: -entryFee,
        status: 'completed',
        description: `Entry fee hold for ${template.regatta_name}`,
        state_code: profile.state,
        reference_type: 'contest_entry',
        reference_id: contestTemplateId,
        completed_at: new Date().toISOString(),
      });

    if (holdError) {
      console.error('Error creating hold transaction:', holdError);
      return new Response(
        JSON.stringify({ error: 'Failed to process entry fee' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update wallet balances
    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({
        available_balance: availableBalance - entryFee,
        pending_balance: parseFloat(wallet.pending_balance) + entryFee,
      })
      .eq('id', wallet.id);

    if (walletUpdateError) {
      console.error('Error updating wallet:', walletUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add to match queue
    const { data: queueEntry, error: queueError } = await supabase
      .from('match_queue')
      .insert({
        user_id: user.id,
        contest_template_id: contestTemplateId,
        tier_id: tierId,
        entry_fee_cents: entryFeeCents,
        state_code: profile.state,
        picks: picks,
        status: 'pending',
      })
      .select()
      .single();

    if (queueError) {
      console.error('Error adding to queue:', queueError);
      return new Response(
        JSON.stringify({ error: 'Failed to queue entry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log compliance event
    await supabase.from('compliance_audit_logs').insert({
      user_id: user.id,
      event_type: 'contest_entry',
      description: `User entered contest ${template.regatta_name}`,
      state_code: profile.state,
      severity: 'info',
      metadata: {
        contest_template_id: contestTemplateId,
        tier_id: tierId,
        entry_fee: entryFee,
        queue_entry_id: queueEntry.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        queueId: queueEntry.id,
        message: 'Entry successful! Matching you with other players...',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in contest-enter:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});