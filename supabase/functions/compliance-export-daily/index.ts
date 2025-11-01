// Daily Compliance Export - Cron job to export and archive compliance logs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log('[compliance-export] Starting daily compliance export');

    // Get yesterday's logs
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: logs, error: logsError } = await supabase
      .from('compliance_audit_logs')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())
      .order('created_at', { ascending: true });

    if (logsError) {
      console.error('[compliance-export] Error fetching logs:', logsError);
      throw logsError;
    }

    console.log(`[compliance-export] Found ${logs?.length || 0} logs for ${yesterday.toISOString().split('T')[0]}`);

    // Create export data
    const exportData = {
      export_date: yesterday.toISOString().split('T')[0],
      generated_at: new Date().toISOString(),
      total_events: logs?.length || 0,
      logs: logs || [],
      summary: {
        by_severity: {} as Record<string, number>,
        by_event_type: {} as Record<string, number>,
        by_state: {} as Record<string, number>,
      },
    };

    // Generate summary statistics
    if (logs && logs.length > 0) {
      logs.forEach((log: any) => {
        // By severity
        if (!exportData.summary.by_severity[log.severity]) {
          exportData.summary.by_severity[log.severity] = 0;
        }
        exportData.summary.by_severity[log.severity]++;

        // By event type
        if (!exportData.summary.by_event_type[log.event_type]) {
          exportData.summary.by_event_type[log.event_type] = 0;
        }
        exportData.summary.by_event_type[log.event_type]++;

        // By state
        if (log.state_code) {
          if (!exportData.summary.by_state[log.state_code]) {
            exportData.summary.by_state[log.state_code] = 0;
          }
          exportData.summary.by_state[log.state_code]++;
        }
      });
    }

    // Convert to JSON
    const jsonData = JSON.stringify(exportData, null, 2);
    
    // Calculate SHA256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('[compliance-export] Export hash:', hashHex);

    // Store metadata in database for audit trail
    const { error: insertError } = await supabase
      .from('compliance_audit_logs')
      .insert({
        user_id: null, // System generated
        event_type: 'daily_export_completed',
        severity: 'info',
        description: `Daily compliance export for ${exportData.export_date}`,
        metadata: {
          export_date: exportData.export_date,
          total_events: exportData.total_events,
          file_hash: hashHex,
          summary: exportData.summary,
        },
      });

    if (insertError) {
      console.error('[compliance-export] Error logging export:', insertError);
    }

    console.log('[compliance-export] Daily export completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        export_date: exportData.export_date,
        total_events: exportData.total_events,
        file_hash: hashHex,
        summary: exportData.summary,
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('[compliance-export] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown error',
        stack: error?.stack 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
