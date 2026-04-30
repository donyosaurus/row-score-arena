// Wallet Deposit - Thin wrapper around process_deposit_atomic SQL function

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { MockPaymentAdapter } from '../shared/payment-providers/mock-adapter.ts';
import { getCorsHeaders } from '../shared/cors.ts';
import { authenticateUser, checkRateLimit, getClientIp } from '../shared/auth-helpers.ts';
import { ERROR_MESSAGES, logSecureError, mapErrorToClient } from '../shared/error-handler.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const auth = await authenticateUser(req, SUPABASE_URL, ANON_KEY);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.UNAUTHORIZED }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = auth.user.id;

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    const rateOk = await checkRateLimit(supabaseAdmin, userId, 'wallet-deposit', 10, 1);
    if (!rateOk) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.RATE_LIMIT }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const depositSchema = z.object({
      amount_cents: z.number().int().positive().max(100_000_000),
      payment_method: z.string().min(1).max(50).default('mock'),
      idempotency_key: z.string().uuid().optional(),
    });

    let body: z.infer<typeof depositSchema>;
    try {
      const rawBody = await req.json();
      body = depositSchema.parse(rawBody);
    } catch (_error) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INVALID_INPUT }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up wallet via auth-scoped client (RLS enforced)
    let { data: wallet, error: walletError } = await auth.supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: userId })
        .select('id')
        .single();

      if (createError || !newWallet) {
        const requestId = logSecureError('wallet-deposit', createError ?? new Error('Wallet create failed'));
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.INTERNAL_ERROR, requestId }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      wallet = newWallet;
    }

    // Payment provider call (mock for now; separate refactor)
    const paymentAdapter = new MockPaymentAdapter();
    const paymentResult = await paymentAdapter.processPayment(body.amount_cents, 'USD');

    if (!paymentResult.success) {
      return new Response(
        JSON.stringify({ error: 'Payment processing failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const idempotencyKey = body.idempotency_key ?? crypto.randomUUID();
    const stateCode = req.headers.get('x-user-state') || ''; // placeholder; geofencing not yet wired

    const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_deposit_atomic', {
      _user_id: userId,
      _wallet_id: wallet.id,
      _amount_cents: body.amount_cents,
      _payment_provider_reference: paymentResult.transactionId,
      _payment_method: body.payment_method,
      _idempotency_key: idempotencyKey,
      _state_code: stateCode,
    });

    if (rpcError) {
      const requestId = logSecureError('wallet-deposit', rpcError);
      return new Response(
        JSON.stringify({ error: mapErrorToClient(rpcError), requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deposit = Array.isArray(result) ? result[0] : result;

    if (!deposit) {
      const requestId = logSecureError('wallet-deposit', new Error('Empty result from process_deposit_atomic'));
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INTERNAL_ERROR, requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!deposit.allowed) {
      const errorMap: Record<string, { status: number; message: string }> = {
        per_transaction_limit: { status: 400, message: 'Per-transaction deposit limit is $5 to $500' },
        self_excluded: { status: 403, message: 'Account is self-excluded' },
        monthly_deposit_limit: { status: 400, message: 'Monthly deposit limit exceeded' },
        wallet_not_found: { status: 404, message: ERROR_MESSAGES.NOT_FOUND },
        idempotency_key_in_progress: { status: 409, message: 'A deposit with this idempotency key is already being processed' },
      };

      const mapped = errorMap[deposit.reason] ?? { status: 400, message: ERROR_MESSAGES.INTERNAL_ERROR };

      if (!errorMap[deposit.reason]) {
        logSecureError('wallet-deposit', new Error(`Unknown deposit reason: ${deposit.reason}`));
      }

      return new Response(
        JSON.stringify({ error: mapped.message }),
        { status: mapped.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Best-effort compliance audit log; never fail the request on log error
    try {
      await supabaseAdmin.from('compliance_audit_logs').insert({
        user_id: userId,
        event_type: deposit.was_duplicate ? 'deposit_idempotent_replay' : 'deposit_completed',
        description: deposit.was_duplicate ? 'Idempotent deposit replay returned existing transaction' : 'Deposit completed',
        severity: 'info',
        metadata: {
          amount_cents: body.amount_cents,
          transaction_id: deposit.transaction_id,
          payment_method: body.payment_method,
          payment_provider_reference: paymentResult.transactionId,
          balance_after_cents: deposit.available_balance_cents,
          was_duplicate: deposit.was_duplicate,
        },
      });
    } catch (logError) {
      logSecureError('wallet-deposit', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: deposit.transaction_id,
        depositedAmount: body.amount_cents,
        depositedDisplay: `$${(body.amount_cents / 100).toFixed(2)}`,
        balanceCents: deposit.available_balance_cents,
        balanceDisplay: `$${(Number(deposit.available_balance_cents) / 100).toFixed(2)}`,
        wasDuplicate: deposit.was_duplicate,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[wallet-deposit] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Deposit failed. Please try again.' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
