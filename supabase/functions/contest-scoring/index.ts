// Contest Scoring Engine - Admin-only scoring with idempotency

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { scoreContestInstance } from '../shared/scoring-logic.ts';
import { authenticateAdmin } from '../shared/auth-helpers.ts';
import { mapErrorToClient, logSecureError, ERROR_MESSAGES } from '../shared/error-handler.ts';

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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // SECURITY: Require admin authentication
    const admin = await authenticateAdmin(req, SUPABASE_URL, ANON_KEY);
    if (!admin) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.FORBIDDEN }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service client ONLY after admin verification
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Validate input
    const scoreSchema = z.object({
      instanceId: z.string().uuid(),
      forceRescore: z.boolean().optional().default(false),
      results: z.array(z.object({
        crewId: z.string(),
        divisionId: z.string(),
        finishPosition: z.number().int().min(1).max(100),
        finishTime: z.number().optional(),
        marginSeconds: z.number().optional(),
      })).min(1).max(100),
    });

    const body = scoreSchema.parse(await req.json());

    console.log('[scoring] Admin', admin.user.id, 'scoring instance:', body.instanceId);

    // Check instance status for idempotency
    const { data: instance } = await supabaseAdmin
      .from('contest_instances')
      .select('status')
      .eq('id', body.instanceId)
      .single();

    if (!instance) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.NOT_FOUND }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency: only score if not already completed (unless force)
    if (instance.status === 'completed' && !body.forceRescore) {
      return new Response(
        JSON.stringify({
          message: 'Instance already scored. Use forceRescore to re-score.',
          alreadyScored: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use shared scoring logic
    const result = await scoreContestInstance(supabaseAdmin, body.instanceId, body.results);

    // Log admin action to compliance
    await supabaseAdmin.from('compliance_audit_logs').insert({
      admin_id: admin.user.id,
      event_type: 'contest_scored',
      severity: 'info',
      description: `Admin scored contest instance ${body.instanceId}${body.forceRescore ? ' (forced rescore)' : ''}`,
      metadata: {
        instance_id: body.instanceId,
        entries_scored: result.entriesScored,
        force_rescore: body.forceRescore || false,
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
    const requestId = logSecureError('contest-scoring', error);
    const clientMessage = mapErrorToClient(error);
    
    return new Response(
      JSON.stringify({ error: clientMessage, requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
