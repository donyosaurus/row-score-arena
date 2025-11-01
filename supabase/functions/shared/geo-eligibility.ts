// IP Geolocation & State Eligibility Check using IPBase API

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ipbaseApiKey = Deno.env.get('IPBASE_API_KEY')!;

export interface GeoEligibilityResult {
  allowed: boolean;
  stateCode?: string;
  stateName?: string;
  reason?: string;
}

// In-memory cache for IP lookups (24-hour TTL)
const ipCache = new Map<string, { stateCode: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function checkGeoEligibility(
  ipAddress: string,
  userId?: string
): Promise<GeoEligibilityResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Clean IP address
    const cleanIp = ipAddress.split(',')[0].trim();
    
    // Check cache first
    const cached = ipCache.get(cleanIp);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[geo-eligibility] Using cached state for IP:', cleanIp, cached.stateCode);
      return await checkStateEligibility(supabase, cached.stateCode, userId);
    }

    // Call IPBase API
    console.log('[geo-eligibility] Fetching geolocation for IP:', cleanIp);
    const response = await fetch(
      `https://api.ipbase.com/v2/info?apikey=${ipbaseApiKey}&ip=${cleanIp}`
    );

    if (!response.ok) {
      console.error('[geo-eligibility] IPBase API error:', response.status);
      // If API fails, allow access but log the issue
      await logGeoEvent(supabase, {
        userId,
        ipAddress: cleanIp,
        isAllowed: true,
        actionType: 'api_failure',
        metadata: { error: 'IPBase API unavailable', status: response.status },
      });
      return { allowed: true, reason: 'Geolocation service unavailable' };
    }

    const data = await response.json();
    const stateCode = data?.data?.location?.region?.code || null;

    if (!stateCode) {
      console.warn('[geo-eligibility] No state code found for IP:', cleanIp);
      return { allowed: true, reason: 'Unable to determine state' };
    }

    // Cache the result
    ipCache.set(cleanIp, { stateCode, timestamp: Date.now() });
    console.log('[geo-eligibility] State detected:', stateCode);

    // Check state eligibility
    return await checkStateEligibility(supabase, stateCode, userId, cleanIp);

  } catch (error: any) {
    console.error('[geo-eligibility] Error:', error);
    await logGeoEvent(supabase, {
      userId,
      ipAddress,
      isAllowed: true,
      actionType: 'error',
      metadata: { error: error.message },
    });
    return { allowed: true, reason: 'Geolocation check failed' };
  }
}

async function checkStateEligibility(
  supabase: any,
  stateCode: string,
  userId?: string,
  ipAddress?: string
): Promise<GeoEligibilityResult> {
  // Fetch state regulation rules
  const { data: stateRule, error: stateError } = await supabase
    .from('state_regulation_rules')
    .select('*')
    .eq('state_code', stateCode)
    .single();

  if (stateError || !stateRule) {
    console.error('[geo-eligibility] State rule not found:', stateCode);
    await logGeoEvent(supabase, {
      userId,
      ipAddress,
      stateDetected: stateCode,
      isAllowed: false,
      blockedReason: 'State not in database',
      actionType: 'state_check',
    });
    return {
      allowed: false,
      stateCode,
      reason: 'State regulations unavailable',
    };
  }

  // Check if state is restricted or prohibited
  if (stateRule.status === 'restricted' || stateRule.status === 'prohibited') {
    console.log('[geo-eligibility] State blocked:', stateCode, stateRule.status);
    await logGeoEvent(supabase, {
      userId,
      ipAddress,
      stateDetected: stateCode,
      isAllowed: false,
      blockedReason: `State is ${stateRule.status}`,
      actionType: 'state_blocked',
    });
    return {
      allowed: false,
      stateCode,
      stateName: stateRule.state_name,
      reason: `Service not available in ${stateRule.state_name}`,
    };
  }

  // State is permitted or unregulated
  console.log('[geo-eligibility] State allowed:', stateCode, stateRule.status);
  await logGeoEvent(supabase, {
    userId,
    ipAddress,
    stateDetected: stateCode,
    isAllowed: true,
    actionType: 'state_allowed',
  });

  return {
    allowed: true,
    stateCode,
    stateName: stateRule.state_name,
  };
}

async function logGeoEvent(
  supabase: any,
  event: {
    userId?: string;
    ipAddress?: string;
    stateDetected?: string;
    isAllowed: boolean;
    blockedReason?: string;
    actionType: string;
    metadata?: Record<string, any>;
  }
) {
  try {
    await supabase.from('geofence_logs').insert({
      user_id: event.userId,
      ip_address: event.ipAddress,
      state_detected: event.stateDetected,
      is_allowed: event.isAllowed,
      blocked_reason: event.blockedReason,
      action_type: event.actionType,
      metadata: event.metadata,
    });
  } catch (error) {
    console.error('[geo-eligibility] Error logging geo event:', error);
  }
}
