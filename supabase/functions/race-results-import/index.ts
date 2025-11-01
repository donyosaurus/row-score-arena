// Race Results Import - Admin function to import race results and trigger scoring

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { scoreContestInstance } from '../shared/scoring-logic.ts';
import { createErrorResponse, ERROR_MESSAGES } from '../shared/error-handler.ts';

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
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Authenticate and verify admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const importSchema = z.object({
      contestTemplateId: z.string().uuid(),
      regattaName: z.string(),
      results: z.array(z.object({
        crewId: z.string(),
        crewName: z.string(),
        divisionId: z.string(),
        divisionName: z.string(),
        finishPosition: z.number().int().min(1),
        finishTime: z.string().optional(),
        marginSeconds: z.number().optional(),
      })),
    });

    const body = importSchema.parse(await req.json());

    console.log('[race-results-import] Processing', body.results.length, 'results for', body.regattaName);

    // Validate contest template exists
    const { data: template, error: templateError } = await supabase
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

    // Calculate hash for deduplication
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(body.results));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check for duplicate import
    const { data: existingImport } = await supabase
      .from('race_results_imports')
      .select('id')
      .eq('file_hash', fileHash)
      .maybeSingle();

    if (existingImport) {
      return new Response(
        JSON.stringify({ 
          error: 'These results have already been imported',
          importId: existingImport.id,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validation checks
    const errors = [];
    const validCrews = new Set(template.crews.map((c: any) => c.id));
    const validDivisions = new Set(template.divisions.map((d: any) => d.id));

    for (const result of body.results) {
      if (!validCrews.has(result.crewId)) {
        errors.push(`Invalid crew ID: ${result.crewId} (${result.crewName})`);
      }
      if (!validDivisions.has(result.divisionId)) {
        errors.push(`Invalid division ID: ${result.divisionId} (${result.divisionName})`);
      }
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed',
          validationErrors: errors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store import record
    const { data: importRecord, error: importError } = await supabase
      .from('race_results_imports')
      .insert({
        contest_template_id: body.contestTemplateId,
        admin_id: user.id,
        regatta_name: body.regattaName,
        results_data: body.results,
        rows_processed: body.results.length,
        status: 'completed',
        file_hash: fileHash,
        errors: [],
      })
      .select()
      .single();

    if (importError) {
      console.error('[race-results-import] Error creating import record:', importError);
      return new Response(
        JSON.stringify({ error: 'Failed to save import record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update contest template with results
    await supabase
      .from('contest_templates')
      .update({ 
        results: body.results,
        status: 'locked', // Lock contest when results are posted
      })
      .eq('id', body.contestTemplateId);

    // Get all instances for this template that are completed
    const { data: instances } = await supabase
      .from('contest_instances')
      .select('id')
      .eq('contest_template_id', body.contestTemplateId)
      .eq('status', 'completed');

    // Trigger scoring for all completed instances directly (no HTTP calls)
    console.log('[race-results] Triggering scoring for', instances?.length || 0, 'instances');
    
    const scoringResults = [];
    if (instances) {
      for (const instance of instances) {
        try {
          const result = await scoreContestInstance(
            supabase,
            instance.id,
            body.results
          );
          
          scoringResults.push({
            instanceId: instance.id,
            success: true,
            entriesScored: result.entriesScored,
          });
          
          console.log('[race-results] Scoring completed for instance:', instance.id);
        } catch (error: any) {
          console.error('[race-results] Scoring failed for instance:', instance.id, error);
          scoringResults.push({
            instanceId: instance.id,
            success: false,
            error: error.message,
          });
        }
      }
    }

    // Log to compliance
    await supabase.from('compliance_audit_logs').insert({
      user_id: user.id,
      event_type: 'race_results_imported',
      severity: 'info',
      description: `Race results imported for ${body.regattaName}`,
      metadata: {
        import_id: importRecord.id,
        contest_template_id: body.contestTemplateId,
        results_count: body.results.length,
        instances_scored: scoringResults.length,
      },
    });

    console.log('[race-results-import] Import complete:', importRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        importId: importRecord.id,
        rowsProcessed: body.results.length,
        instancesScored: instances?.length || 0,
        scoringResults,
        message: 'Results imported and scoring completed successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return createErrorResponse(error, 'race-results-import', corsHeaders);
  }
});
