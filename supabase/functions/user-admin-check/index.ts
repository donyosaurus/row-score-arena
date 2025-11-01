// Secure Admin Status Check - Server-Side Verification
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { authenticateUser, verifyAdmin } from '../shared/auth-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Authenticate user
    const auth = await authenticateUser(req, supabaseUrl, supabaseAnonKey);
    if (!auth) {
      return new Response(
        JSON.stringify({ isAdmin: false, authenticated: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin status
    const isAdmin = await verifyAdmin(auth.supabase, auth.user.id);

    return new Response(
      JSON.stringify({ 
        isAdmin,
        authenticated: true,
        userId: auth.user.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[user-admin-check] Error:', error);
    return new Response(
      JSON.stringify({ isAdmin: false, authenticated: false, error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
