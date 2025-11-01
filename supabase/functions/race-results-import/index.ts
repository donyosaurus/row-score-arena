// Race Results CSV Import - Admin tool to upload race results

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

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

    // Trigger scoring for each instance (could be done async)
    const scoringResults = [];
    if (instances) {
      for (const instance of instances) {
        console.log('[race-results-import] Triggering scoring for instance:', instance.id);
        
        // Call scoring function
        const scoringResponse = await fetch(
          `${supabaseUrl}/functions/v1/contest-scoring`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify({
              instanceId: instance.id,
              results: body.results,
            }),
          }
        );

        if (scoringResponse.ok) {
          scoringResults.push({ instanceId: instance.id, status: 'scored' });
        } else {
          scoringResults.push({ instanceId: instance.id, status: 'error' });
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
        importId: importRecord.id,
        resultsProcessed: body.results.length,
        instancesScored: scoringResults.length,
        scoringResults,
        message: 'Results imported and scoring initiated successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[race-results-import] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown error',
        details: error instanceof z.ZodError ? error.errors : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
