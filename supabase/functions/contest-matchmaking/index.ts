// Contest Matchmaking - Auto-allocate users to contest pools

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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // SECURITY: Authenticate user first
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

    // Validate input
    const entrySchema = z.object({
      contestTemplateId: z.string().uuid(),
      tierId: z.string(),
      picks: z.array(z.object({
        crewId: z.string(),
        divisionId: z.string(),
        predictedMargin: z.number(),
      })),
      entryFeeCents: z.number().int().positive(),
      stateCode: z.string().optional(),
    });

    const body = entrySchema.parse(await req.json());

    // SECURITY: Enforce userId matches authenticated user
    const userId = user.id; // Use authenticated user's ID, not from request

    console.log('[matchmaking] Processing entry for user:', userId, 'template:', body.contestTemplateId);

    // Create service client for pool operations (after auth)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Get contest template details
    const { data: template, error: templateError } = await supabaseAdmin
      .from('contest_templates')
      .select('*')
      .eq('id', body.contestTemplateId)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: 'Contest template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has an entry for this contest template
    const { data: existingEntry } = await supabase
      .from('contest_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('contest_template_id', body.contestTemplateId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingEntry) {
      return new Response(
        JSON.stringify({ error: 'You have already entered this contest' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find available instance or create new one
    const instance = await findOrCreateInstance(
      supabaseAdmin,
      body.contestTemplateId,
      body.tierId,
      body.entryFeeCents,
      template
    );

    if (!instance) {
      return new Response(
        JSON.stringify({ error: 'Unable to allocate to contest pool' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create contest entry
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('contest_entries')
      .insert({
        user_id: userId,
        pool_id: instance.id, // Legacy field
        instance_id: instance.id,
        contest_template_id: body.contestTemplateId,
        picks: body.picks,
        entry_fee_cents: body.entryFeeCents,
        state_code: body.stateCode,
        status: 'active',
      })
      .select()
      .single();

    if (entryError) {
      console.error('[matchmaking] Error creating entry:', entryError);
      return new Response(
        JSON.stringify({ error: 'Failed to create entry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment instance entry count
    const { error: updateError } = await supabaseAdmin
      .from('contest_instances')
      .update({ current_entries: instance.current_entries + 1 })
      .eq('id', instance.id);

    if (updateError) {
      console.error('[matchmaking] Error updating instance count:', updateError);
    }

    // Log to compliance
    await supabaseAdmin.from('compliance_audit_logs').insert({
      user_id: userId,
      event_type: 'contest_entry_created',
      severity: 'info',
      description: `User entered ${template.regatta_name} - Pool ${instance.pool_number}`,
      state_code: body.stateCode,
      metadata: {
        entry_id: entry.id,
        instance_id: instance.id,
        pool_number: instance.pool_number,
        entry_fee: body.entryFeeCents / 100,
      },
    });

    console.log('[matchmaking] Entry created:', entry.id, 'in pool', instance.pool_number);

    return new Response(
      JSON.stringify({
        entryId: entry.id,
        instanceId: instance.id,
        poolNumber: instance.pool_number,
        currentEntries: instance.current_entries + 1,
        maxEntries: instance.max_entries,
        message: `Successfully entered ${template.regatta_name} - Pool ${instance.pool_number}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[matchmaking] Error:', error);
    // Generic error message for security
    return new Response(
      JSON.stringify({ error: 'An error occurred while processing your entry' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function findOrCreateInstance(
  supabase: any,
  templateId: string,
  tierId: string,
  entryFeeCents: number,
  template: any
) {
  // Find open instances with available space
  const { data: openInstances } = await supabase
    .from('contest_instances')
    .select('*')
    .eq('contest_template_id', templateId)
    .eq('tier_id', tierId)
    .eq('status', 'open')
    .lt('current_entries', supabase.raw('max_entries'))
    .order('created_at', { ascending: true });

  if (openInstances && openInstances.length > 0) {
    console.log('[matchmaking] Found existing pool:', openInstances[0].pool_number);
    return openInstances[0];
  }

  // Need to create a new instance
  console.log('[matchmaking] Creating new pool instance');

  // Find next pool letter
  const { data: existingPools } = await supabase
    .from('contest_instances')
    .select('pool_number')
    .eq('contest_template_id', templateId)
    .eq('tier_id', tierId)
    .order('pool_number', { ascending: false })
    .limit(1);

  let nextPoolNumber = 'A';
  if (existingPools && existingPools.length > 0) {
    const lastPool = existingPools[0].pool_number;
    const lastChar = lastPool.charCodeAt(lastPool.length - 1);
    nextPoolNumber = String.fromCharCode(lastChar + 1);
  }

  // Get tier details from template
  const tier = template.entry_tiers.find((t: any) => t.id === tierId);
  if (!tier) {
    console.error('[matchmaking] Tier not found:', tierId);
    return null;
  }

  // Create new instance
  const { data: newInstance, error: createError } = await supabase
    .from('contest_instances')
    .insert({
      contest_template_id: templateId,
      tier_id: tierId,
      pool_number: nextPoolNumber,
      entry_fee_cents: entryFeeCents,
      max_entries: tier.capacity || 10,
      min_entries: template.min_picks || 2,
      lock_time: template.lock_time,
      status: 'open',
    })
    .select()
    .single();

  if (createError) {
    console.error('[matchmaking] Error creating instance:', createError);
    return null;
  }

  console.log('[matchmaking] Created new pool:', nextPoolNumber);

  // Log instance creation
  await supabase.from('compliance_audit_logs').insert({
    event_type: 'contest_instance_created',
    severity: 'info',
    description: `New contest pool created: ${template.regatta_name} - Pool ${nextPoolNumber}`,
    metadata: {
      instance_id: newInstance.id,
      pool_number: nextPoolNumber,
      tier_id: tierId,
      max_entries: tier.capacity || 10,
    },
  });

  return newInstance;
}
