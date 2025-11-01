// Contest Scoring Engine - Calculate points based on finish order and margin prediction

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { scoreContestInstance } from '../shared/scoring-logic.ts';
import { createErrorResponse } from '../shared/error-handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Scoring rules
const FINISH_POINTS: Record<number, number> = {
  1: 10,
  2: 6,
  3: 3,
  4: 0,
  5: 0,
  6: 0,
  7: 0,
};

function getFinishPoints(position: number): number {
  return FINISH_POINTS[position] || 0;
}

function calculateMarginBonus(predictedMargin: number, actualMargin: number): number {
  const error = Math.abs(predictedMargin - actualMargin);
  const bonus = Math.max(0, 10 - error);
  return Math.min(10, bonus);
}

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
    const scoreSchema = z.object({
      instanceId: z.string().uuid(),
      results: z.array(z.object({
        crewId: z.string(),
        divisionId: z.string(),
        finishPosition: z.number().int().min(1),
        finishTime: z.number().optional(), // For margin calculation
        marginSeconds: z.number().optional(), // Margin to 2nd place
      })),
    });

    const body = scoreSchema.parse(await req.json());

    console.log('[scoring] Admin', user.id, 'processing results for instance:', body.instanceId);

    // Use shared scoring logic with service client
    const result = await scoreContestInstance(supabaseAdmin, body.instanceId, body.results);

    // Log admin action
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: user.id,
      event_type: 'contest_scored',
      severity: 'info',
      description: `Admin scored contest instance ${body.instanceId}`,
      metadata: {
        instance_id: body.instanceId,
        entries_scored: result.entriesScored,
      },
    });

    return new Response(
      JSON.stringify({
        instanceId: body.instanceId,
        entriesScored: result.entriesScored,
        message: 'Scoring completed successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return createErrorResponse(error, 'contest-scoring', corsHeaders);
  }
});
