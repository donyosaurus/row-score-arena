// Payment Provider Webhooks Handler

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getPaymentProvider } from '../shared/payment-providers/factory.ts';

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get provider from query param or header
    const url = new URL(req.url);
    const providerType = url.searchParams.get('provider') || 'mock';
    const provider = getPaymentProvider(providerType as any);

    // Verify webhook signature
    const signature = req.headers.get('webhook-signature') || req.headers.get('x-signature') || '';
    const timestamp = req.headers.get('webhook-timestamp') || '';
    const rawPayload = await req.text();

    const isValid = await provider.verifyWebhook({
      signature,
      payload: rawPayload,
      timestamp,
    });

    if (!isValid) {
      console.error('[payments-webhook] Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(rawPayload);
    const webhookEvent = await provider.handleWebhook(payload);

    console.log('[payments-webhook] Received event:', webhookEvent.eventType);

    // Process webhook event based on type
    switch (webhookEvent.eventType) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(supabase, webhookEvent);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(supabase, webhookEvent);
        break;
      
      case 'payout.succeeded':
        await handlePayoutSucceeded(supabase, webhookEvent);
        break;
      
      case 'payout.failed':
        await handlePayoutFailed(supabase, webhookEvent);
        break;
      
      case 'refund.succeeded':
        await handleRefundSucceeded(supabase, webhookEvent);
        break;
      
      default:
        console.log('[payments-webhook] Unhandled event type:', webhookEvent.eventType);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[payments-webhook] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handlePaymentSucceeded(supabase: any, event: any) {
  console.log('[payments-webhook] Processing payment.succeeded');

  // Find payment session
  const { data: session, error: sessionError } = await supabase
    .from('payment_sessions')
    .select('*')
    .eq('provider_session_id', event.providerSessionId)
    .single();

  if (sessionError || !session) {
    console.error('[payments-webhook] Payment session not found:', event.providerSessionId);
    return;
  }

  // Update session status
  await supabase
    .from('payment_sessions')
    .update({ 
      status: 'succeeded',
      completed_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  // Get wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', session.user_id)
    .single();

  if (!wallet) {
    console.error('[payments-webhook] Wallet not found for user:', session.user_id);
    return;
  }

  // Create deposit transaction (idempotent)
  const idempotencyKey = `deposit_${session.id}_${event.providerTransactionId}`;
  
  const { error: txnError } = await supabase
    .from('transactions')
    .insert({
      user_id: session.user_id,
      wallet_id: wallet.id,
      type: 'deposit',
      amount: session.amount_cents / 100,
      status: 'completed',
      reference_id: session.id,
      reference_type: 'payment_session',
      description: 'Deposit via payment provider',
      state_code: session.state_code,
      idempotency_key: idempotencyKey,
      completed_at: new Date().toISOString(),
      metadata: {
        provider_transaction_id: event.providerTransactionId,
        fee_cents: event.feeCents,
      },
    });

  if (txnError && !txnError.message.includes('duplicate key')) {
    console.error('[payments-webhook] Error creating deposit transaction:', txnError);
    return;
  }

  // Update wallet balance
  const depositAmount = session.amount_cents / 100;
  await supabase
    .from('wallets')
    .update({
      available_balance: Number(wallet.available_balance) + depositAmount,
      lifetime_deposits: Number(wallet.lifetime_deposits) + depositAmount,
    })
    .eq('id', wallet.id);

  // Log compliance event
  await supabase.from('compliance_audit_logs').insert({
    user_id: session.user_id,
    event_type: 'deposit_completed',
    severity: 'info',
    description: `Deposit completed: $${depositAmount}`,
    state_code: session.state_code,
    metadata: {
      amount: depositAmount,
      session_id: session.id,
      provider_transaction_id: event.providerTransactionId,
    },
  });

  console.log('[payments-webhook] Deposit processed successfully:', session.id);
}

async function handlePaymentFailed(supabase: any, event: any) {
  console.log('[payments-webhook] Processing payment.failed');

  const { error } = await supabase
    .from('payment_sessions')
    .update({ 
      status: 'failed',
      completed_at: new Date().toISOString(),
    })
    .eq('provider_session_id', event.providerSessionId);

  if (error) {
    console.error('[payments-webhook] Error updating payment session:', error);
  }
}

async function handlePayoutSucceeded(supabase: any, event: any) {
  console.log('[payments-webhook] Processing payout.succeeded');

  // Find transaction by reference_id (payout ID)
  const { data: transaction, error: txnError } = await supabase
    .from('transactions')
    .select('*')
    .eq('reference_id', event.providerTransactionId)
    .eq('type', 'withdrawal')
    .single();

  if (txnError || !transaction) {
    console.error('[payments-webhook] Withdrawal transaction not found:', event.providerTransactionId);
    return;
  }

  // Update transaction status
  await supabase
    .from('transactions')
    .update({ 
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', transaction.id);

  // Update wallet - move from pending to lifetime withdrawals
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('id', transaction.wallet_id)
    .single();

  if (wallet) {
    const withdrawalAmount = Math.abs(Number(transaction.amount));
    
    await supabase
      .from('wallets')
      .update({
        pending_balance: Number(wallet.pending_balance) - withdrawalAmount,
        lifetime_withdrawals: Number(wallet.lifetime_withdrawals) + withdrawalAmount,
      })
      .eq('id', wallet.id);
  }

  console.log('[payments-webhook] Payout completed:', transaction.id);
}

async function handlePayoutFailed(supabase: any, event: any) {
  console.log('[payments-webhook] Processing payout.failed');

  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('reference_id', event.providerTransactionId)
    .eq('type', 'withdrawal')
    .single();

  if (!transaction) {
    console.error('[payments-webhook] Withdrawal transaction not found');
    return;
  }

  // Mark as failed
  await supabase
    .from('transactions')
    .update({ status: 'failed' })
    .eq('id', transaction.id);

  // Restore balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('id', transaction.wallet_id)
    .single();

  if (wallet) {
    const amount = Math.abs(Number(transaction.amount));
    
    await supabase
      .from('wallets')
      .update({
        available_balance: Number(wallet.available_balance) + amount,
        pending_balance: Number(wallet.pending_balance) - amount,
      })
      .eq('id', wallet.id);
  }
}

async function handleRefundSucceeded(supabase: any, event: any) {
  console.log('[payments-webhook] Processing refund.succeeded');
  
  // Create refund transaction and update wallet
  // Implementation similar to deposit but with refund type
}
