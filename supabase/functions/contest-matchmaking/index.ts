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
    // Verify authorization - require worker token
    const authHeader = req.headers.get('Authorization');
    const expectedToken = Deno.env.get('MATCHMAKING_WORKER_TOKEN');
    
    if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      console.error('[contest-matchmaking] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - worker token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting matchmaking worker...');

    // Get pending queue entries grouped by contest and tier
    const { data: pendingEntries, error: queueError } = await supabaseAdmin
      .from('match_queue')
      .select('*')
      .eq('status', 'pending')
      .order('joined_at', { ascending: true });

    if (queueError) {
      console.error('Error fetching queue:', queueError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingEntries || pendingEntries.length === 0) {
      console.log('No pending entries to process');
      return new Response(
        JSON.stringify({ message: 'No pending entries', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingEntries.length} pending entries`);

    let processed = 0;
    const results = [];

    // Group by contest template and tier
    const groupedEntries = new Map<string, typeof pendingEntries>();
    for (const entry of pendingEntries) {
      const key = `${entry.contest_template_id}-${entry.tier_id}`;
      if (!groupedEntries.has(key)) {
        groupedEntries.set(key, []);
      }
      groupedEntries.get(key)!.push(entry);
    }

    // Process each group
    for (const [key, entries] of groupedEntries) {
      const [contestTemplateId, tierId] = key.split('-');
      
      console.log(`Processing group: ${key} with ${entries.length} entries`);

      // Get contest template to determine max entries per pool
      const { data: template, error: templateError } = await supabaseAdmin
        .from('contest_templates')
        .select('*')
        .eq('id', contestTemplateId)
        .single();

      if (templateError || !template) {
        console.error('Template not found:', contestTemplateId);
        continue;
      }

      // Determine max entries based on tier type
      const entryTiers = template.entry_tiers as Array<any>;
      const tier = entryTiers.find(t => t.id === tierId);
      if (!tier) {
        console.error('Tier not found:', tierId);
        continue;
      }

      const maxEntries = tier.type === 'H2H' ? 2 : 5;
      const entryFeeCents = tier.entryFee * 100;
      const prizePoolCents = tier.prize * 100;

      // Find or create open pool
      let { data: openPools, error: poolsError } = await supabaseAdmin
        .from('contest_pools')
        .select('*')
        .eq('contest_template_id', contestTemplateId)
        .eq('tier_id', tierId)
        .eq('status', 'open')
        .lt('current_entries', maxEntries)
        .order('created_at', { ascending: true });

      if (poolsError) {
        console.error('Error fetching pools:', poolsError);
        continue;
      }

      let currentPool = openPools && openPools.length > 0 ? openPools[0] : null;

      // Process each entry in this group
      for (const entry of entries) {
        // Create new pool if needed
        if (!currentPool || currentPool.current_entries >= maxEntries) {
          const { data: newPool, error: createPoolError } = await supabaseAdmin
            .from('contest_pools')
            .insert({
              contest_template_id: contestTemplateId,
              tier_id: tierId,
              entry_fee_cents: entryFeeCents,
              prize_pool_cents: prizePoolCents,
              max_entries: maxEntries,
              current_entries: 0,
              status: 'open',
              lock_time: template.lock_time,
              prize_structure: tier.type === 'H2H' 
                ? { '1st': prizePoolCents }
                : { '1st': prizePoolCents * 0.5, '2nd': prizePoolCents * 0.3, '3rd': prizePoolCents * 0.2 },
            })
            .select()
            .single();

          if (createPoolError) {
            console.error('Error creating pool:', createPoolError);
            continue;
          }

          currentPool = newPool;
          console.log('Created new pool:', currentPool.id);
        }

        // Create contest entry
        const { error: entryError } = await supabaseAdmin
          .from('contest_entries')
          .insert({
            user_id: entry.user_id,
            pool_id: currentPool.id,
            contest_template_id: contestTemplateId,
            picks: entry.picks,
            entry_fee_cents: entryFeeCents,
            state_code: entry.state_code,
            status: 'active',
          });

        if (entryError) {
          console.error('Error creating entry:', entryError);
          continue;
        }

        // Update queue entry
        await supabaseAdmin
          .from('match_queue')
          .update({
            status: 'matched',
            pool_id: currentPool.id,
            matched_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        // Increment pool count
        currentPool.current_entries += 1;
        await supabaseAdmin
          .from('contest_pools')
          .update({ current_entries: currentPool.current_entries })
          .eq('id', currentPool.id);

        processed++;

        // Check if pool is now full
        if (currentPool.current_entries >= maxEntries) {
          await supabaseAdmin
            .from('contest_pools')
            .update({ status: 'locked' })
            .eq('id', currentPool.id);

          console.log(`Pool ${currentPool.id} is now full and locked`);
          
          // Log compliance event
          await supabaseAdmin.from('compliance_audit_logs').insert({
            event_type: 'pool_filled',
            description: `Pool ${currentPool.id} filled and locked`,
            severity: 'info',
            metadata: {
              pool_id: currentPool.id,
              contest_template_id: contestTemplateId,
              entries: currentPool.current_entries,
            },
          });

          currentPool = null; // Force creation of new pool for next entry
        }
      }

      results.push({
        group: key,
        processed: entries.length,
      });
    }

    console.log(`Matchmaking complete. Processed ${processed} entries`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in contest-matchmaking:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});