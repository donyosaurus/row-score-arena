import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { requireAdmin } from '../shared/auth-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrewInput {
  crew_name: string;
  crew_id: string;
  event_id: string;
}

interface CreateContestRequest {
  regattaName: string;
  entryFeeCents: number;
  maxEntries: number;
  lockTime: string;
  crews: CrewInput[];
}

function validateRequest(body: CreateContestRequest): string | null {
  if (!body.regattaName || body.regattaName.trim() === '') {
    return 'Regatta name is required';
  }
  
  if (typeof body.entryFeeCents !== 'number' || body.entryFeeCents < 0) {
    return 'Entry fee must be a non-negative number';
  }
  
  if (typeof body.maxEntries !== 'number' || body.maxEntries < 2) {
    return 'Max entries must be at least 2';
  }
  
  if (!body.lockTime) {
    return 'Lock time is required';
  }
  
  const lockDate = new Date(body.lockTime);
  if (isNaN(lockDate.getTime())) {
    return 'Invalid lock time format';
  }
  
  if (lockDate <= new Date()) {
    return 'Lock time must be in the future';
  }
  
  if (!Array.isArray(body.crews) || body.crews.length < 2) {
    return 'At least 2 crews are required';
  }
  
  for (let i = 0; i < body.crews.length; i++) {
    const crew = body.crews[i];
    if (!crew.crew_name || !crew.crew_id || !crew.event_id) {
      return `Crew at index ${i} is missing required fields (crew_name, crew_id, event_id)`;
    }
  }
  
  return null;
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

    // Create service client after admin verification
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: CreateContestRequest = await req.json();

    // Validate request
    const validationError = validateRequest(body);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating contest:', { 
      regattaName: body.regattaName, 
      entryFeeCents: body.entryFeeCents,
      maxEntries: body.maxEntries,
      crewCount: body.crews.length,
      admin: user.id 
    });

    // Call the atomic database function
    const { data, error } = await supabaseAdmin.rpc('admin_create_contest', {
      p_regatta_name: body.regattaName,
      p_entry_fee_cents: body.entryFeeCents,
      p_max_entries: body.maxEntries,
      p_lock_time: body.lockTime,
      p_crews: body.crews
    });

    if (error) {
      console.error('Error creating contest:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log compliance event
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'contest_created',
      description: `Admin created contest: ${body.regattaName}`,
      severity: 'info',
      metadata: {
        contest_template_id: data?.contest_template_id,
        contest_pool_id: data?.contest_pool_id,
        entry_fee_cents: body.entryFeeCents,
        max_entries: body.maxEntries,
        crews_count: body.crews.length,
      },
    });

    console.log('Contest created:', data);

    return new Response(
      JSON.stringify({
        success: true,
        contestTemplateId: data?.contest_template_id,
        contestPoolId: data?.contest_pool_id,
        crewsAdded: data?.crews_added,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-create-contest:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
