// Payment Webhook Handler - Process provider callbacks securely

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getPaymentProvider } from '../shared/payment-providers/factory.ts';
import { isTimestampValid } from '../shared/crypto-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-signature, webhook-timestamp, webhook-id',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signature = req.headers.get('webhook-signature') || req.headers.get('x-webhook-signature') || '';
    const timestamp = req.headers.get('webhook-timestamp') || req.headers.get('x-webhook-timestamp') || '';
    const webhookId = req.headers.get('webhook-id') || `${Date.now()}-${Math.random()}`;
    const providerType = new URL(req.url).searchParams.get('provider') || 'mock';

    // SECURITY: Validate timestamp (max 5 minutes old)
    if (!isTimestampValid(timestamp, 300)) {
      console.warn('[webhook] Invalid timestamp');
      return new Response(JSON.stringify({ error: 'invalid' }), { status: 401, headers: corsHeaders });
    }

    // SECURITY: Check for replay
    const { data: existing } = await supabase.from('webhook_dedup').select('id').eq('id', webhookId).single();
    if (existing) {
      console.warn('[webhook] Replay detected');
      return new Response(JSON.stringify({ error: 'invalid' }), { status: 409, headers: corsHeaders });
    }

    await supabase.from('webhook_dedup').insert({ id: webhookId, provider: providerType, event_type: 'pending', ip_address: req.headers.get('x-forwarded-for') });

    const rawPayload = await req.text();
    const provider = getPaymentProvider(providerType as any);
    
    // SECURITY: Verify signature
    const isValid = await provider.verifyWebhook({ signature, payload: rawPayload, timestamp });
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'invalid' }), { status: 401, headers: corsHeaders });
    }

    const webhookEvent = await provider.handleWebhook(rawPayload);
    await supabase.from('webhook_dedup').update({ event_type: webhookEvent.eventType }).eq('id', webhookId);

    // Route handlers (simplified for space)
    if (webhookEvent.eventType === 'payment.succeeded') {
      const { sessionId } = webhookEvent.data;
      const { data: session } = await supabase.from('payment_sessions').select('*').eq('provider_session_id', sessionId).single();
      if (session) {
        await supabase.from('payment_sessions').update({ status: 'succeeded', completed_at: new Date().toISOString() }).eq('id', session.id);
        const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', session.user_id).single();
        await supabase.from('transactions').insert({ user_id: session.user_id, wallet_id: wallet.id, type: 'deposit', amount: session.amount_cents / 100, status: 'completed', reference_id: sessionId, completed_at: new Date().toISOString() });
        await supabase.rpc('update_wallet_balance', { _wallet_id: wallet.id, _available_delta: session.amount_cents / 100, _lifetime_deposits_delta: session.amount_cents / 100 });
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'invalid' }), { status: 500, headers: corsHeaders });
  }
});
