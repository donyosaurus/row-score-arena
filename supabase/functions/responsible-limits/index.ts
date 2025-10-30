import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const limitSchema = z.object({
  type: z.enum(['deposit_limit', 'cooling_off', 'self_exclusion']),
  value: z.number().optional(),
  duration: z.string().optional()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = limitSchema.parse(await req.json());

    let updateData: any = {};
    let eventType = '';
    let description = '';

    if (body.type === 'deposit_limit') {
      updateData.deposit_limit_monthly = body.value;
      eventType = 'limit_changed';
      description = `Deposit limit set to $${body.value}`;
    } else if (body.type === 'self_exclusion') {
      const duration = body.duration;
      let until: Date | null = null;
      let exclusionType = '';

      if (duration === 'permanent') {
        until = new Date('2099-12-31');
        exclusionType = 'permanent';
      } else {
        const days = parseInt(duration!);
        until = new Date();
        until.setDate(until.getDate() + days);
        exclusionType = `${days}_days`;
      }

      updateData.self_exclusion_until = until.toISOString();
      updateData.self_exclusion_type = exclusionType;
      eventType = 'self_exclude_enabled';
      description = `Self-exclusion enabled for ${duration}`;
    }

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update limits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log to compliance audit
    await supabase.from('compliance_audit_logs').insert({
      user_id: user.id,
      event_type: eventType,
      description: description,
      severity: 'info',
      metadata: body
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in responsible-limits:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});