// Compliance Gating Functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export interface ComplianceCheckResult {
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface ComplianceContext {
  userId: string;
  stateCode: string;
  amountCents: number;
  actionType: 'deposit' | 'withdrawal' | 'entry';
  ipAddress?: string;
}

export async function performComplianceChecks(
  context: ComplianceContext
): Promise<ComplianceCheckResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Check state regulations
  const { data: stateRule, error: stateError } = await supabase
    .from('state_regulation_rules')
    .select('*')
    .eq('state_code', context.stateCode)
    .single();

  if (stateError || !stateRule) {
    await logComplianceEvent(supabase, {
      userId: context.userId,
      eventType: 'state_check_failed',
      severity: 'error',
      description: `State regulation check failed for ${context.stateCode}`,
      stateCode: context.stateCode,
      ipAddress: context.ipAddress,
    });
    
    return {
      allowed: false,
      reason: 'State not supported or regulations unavailable',
    };
  }

  if (stateRule.status === 'prohibited') {
    await logComplianceEvent(supabase, {
      userId: context.userId,
      eventType: 'state_prohibited',
      severity: 'warn',
      description: `Attempted ${context.actionType} from prohibited state ${context.stateCode}`,
      stateCode: context.stateCode,
      ipAddress: context.ipAddress,
    });
    
    return {
      allowed: false,
      reason: `Service not available in ${stateRule.state_name}`,
    };
  }

  // 2. Check user profile and KYC
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', context.userId)
    .single();

  if (profileError || !profile) {
    return {
      allowed: false,
      reason: 'User profile not found',
    };
  }

  if (!profile.is_active) {
    await logComplianceEvent(supabase, {
      userId: context.userId,
      eventType: 'inactive_account',
      severity: 'warn',
      description: 'Inactive account attempted transaction',
      stateCode: context.stateCode,
    });
    
    return {
      allowed: false,
      reason: 'Account is inactive',
    };
  }

  // Check self-exclusion
  if (profile.self_exclusion_until) {
    const exclusionDate = new Date(profile.self_exclusion_until);
    if (exclusionDate > new Date()) {
      await logComplianceEvent(supabase, {
        userId: context.userId,
        eventType: 'self_exclusion_block',
        severity: 'info',
        description: 'Self-excluded user attempted transaction',
        stateCode: context.stateCode,
        metadata: { exclusion_until: profile.self_exclusion_until },
      });
      
      return {
        allowed: false,
        reason: `Account self-excluded until ${exclusionDate.toLocaleDateString()}`,
      };
    }
  }

  // Check employee restriction
  if (profile.is_employee) {
    await logComplianceEvent(supabase, {
      userId: context.userId,
      eventType: 'employee_block',
      severity: 'warn',
      description: 'Employee attempted transaction',
      stateCode: context.stateCode,
    });
    
    return {
      allowed: false,
      reason: 'Employees are not permitted to participate',
    };
  }

  // 3. Check deposit limits for deposits
  if (context.actionType === 'deposit') {
    const depositLimit = profile.deposit_limit_monthly || 250000; // Default $2,500
    
    // Get current month deposits
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyDeposits, error: depositError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', context.userId)
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString());

    if (!depositError && monthlyDeposits) {
      const totalDeposited = monthlyDeposits.reduce(
        (sum, txn) => sum + Number(txn.amount),
        0
      );
      
      if (totalDeposited + context.amountCents / 100 > depositLimit / 100) {
        await logComplianceEvent(supabase, {
          userId: context.userId,
          eventType: 'deposit_limit_exceeded',
          severity: 'warn',
          description: 'Monthly deposit limit exceeded',
          stateCode: context.stateCode,
          metadata: {
            current_total: totalDeposited,
            limit: depositLimit / 100,
            attempted_amount: context.amountCents / 100,
          },
        });
        
        return {
          allowed: false,
          reason: 'Monthly deposit limit exceeded',
          metadata: {
            limit: depositLimit / 100,
            remaining: Math.max(0, depositLimit / 100 - totalDeposited),
          },
        };
      }
    }
  }

  // 4. Check KYC for withdrawals
  if (context.actionType === 'withdrawal') {
    if (profile.kyc_status !== 'verified') {
      await logComplianceEvent(supabase, {
        userId: context.userId,
        eventType: 'kyc_required',
        severity: 'info',
        description: 'KYC verification required for withdrawal',
        stateCode: context.stateCode,
      });
      
      return {
        allowed: false,
        reason: 'Identity verification required before withdrawal',
      };
    }
  }

  // All checks passed
  await logComplianceEvent(supabase, {
    userId: context.userId,
    eventType: 'compliance_passed',
    severity: 'info',
    description: `Compliance checks passed for ${context.actionType}`,
    stateCode: context.stateCode,
    metadata: {
      action: context.actionType,
      amount_cents: context.amountCents,
    },
  });

  return {
    allowed: true,
  };
}

async function logComplianceEvent(
  supabase: any,
  event: {
    userId: string;
    eventType: string;
    severity: string;
    description: string;
    stateCode?: string;
    ipAddress?: string;
    metadata?: Record<string, any>;
  }
) {
  await supabase.from('compliance_audit_logs').insert({
    user_id: event.userId,
    event_type: event.eventType,
    severity: event.severity,
    description: event.description,
    state_code: event.stateCode,
    ip_address: event.ipAddress,
    metadata: event.metadata,
  });
}
