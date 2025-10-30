import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const consentSchema = z.object({
  doc_slug: z.string().min(1).max(100),
  version: z.number().int().positive()
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

    // Handle POST - create consent
    if (req.method === 'POST') {
      const body = consentSchema.parse(await req.json());

      // Get first IP from x-forwarded-for header
      const forwardedFor = req.headers.get('x-forwarded-for');
      const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : null;

      // Record consent
      const { error: insertError } = await supabase
        .from('user_consents')
        .insert({
          user_id: user.id,
          doc_slug: body.doc_slug,
          version: body.version,
          ip_address: ipAddress,
          user_agent: req.headers.get('user-agent') || null
        });

      if (insertError) {
        console.error('Error recording consent:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to record consent' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log to compliance audit
      await supabase.from('compliance_audit_logs').insert({
        user_id: user.id,
        event_type: 'consent_' + body.doc_slug,
        description: `User consented to ${body.doc_slug} v${body.version}`,
        severity: 'info',
        metadata: { doc_slug: body.doc_slug, version: body.version }
      });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle GET - check consent status
    let docSlug: string | null = null;
    
    const url = new URL(req.url);
    docSlug = url.searchParams.get('doc_slug');
    
    if (!docSlug) {
      // Try to get from body if it's a POST-like request
      try {
        const body = await req.json();
        docSlug = body.doc_slug;
      } catch {
        // Not JSON, that's ok
      }
    }

    if (!docSlug) {
      return new Response(
        JSON.stringify({ error: 'doc_slug parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: consent } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user.id)
      .eq('doc_slug', docSlug)
      .order('consented_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return new Response(
      JSON.stringify({ consent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in user-consents:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});