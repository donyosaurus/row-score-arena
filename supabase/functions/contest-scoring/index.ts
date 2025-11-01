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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

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

    console.log('[scoring] Processing results for instance:', body.instanceId);

    // Use shared scoring logic
    const result = await scoreContestInstance(supabase, body.instanceId, body.results);

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
