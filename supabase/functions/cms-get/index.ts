import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Handle both GET and POST requests
    let slug: string | null = null;
    let includeVersions = false;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      slug = url.searchParams.get('slug');
      includeVersions = url.searchParams.get('versions') === 'true';
    } else {
      const body = await req.json();
      slug = body.slug;
      includeVersions = body.versions === true;
    }

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Slug parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get latest version
    const { data: page, error } = await supabase
      .from('cms_pages')
      .select('*')
      .eq('slug', slug)
      .not('published_at', 'is', null)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching CMS page:', error);
      return new Response(
        JSON.stringify({ error: 'Page not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all versions if requested
    let versions = null;
    if (includeVersions) {
      const { data: allVersions } = await supabase
        .from('cms_pages')
        .select('id, version, published_at, updated_at')
        .eq('slug', slug)
        .not('published_at', 'is', null)
        .order('version', { ascending: false });
      
      versions = allVersions;
    }

    return new Response(
      JSON.stringify({ page, versions }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cms-get:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});