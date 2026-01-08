// IP Geolocation & State Eligibility Check with Strict Blocking

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ipbaseApiKey = Deno.env.get('IPBASE_API_KEY')!;

// Blocked states: 5 banned + 23 restricted = 28 total
export const BLOCKED_STATES = [
  // Banned states
  'HI', 'ID', 'MT', 'NV', 'WA',
  // Restricted states  
  'AL', 'AZ', 'AR', 'CO', 'CT', 'DE', 'IN', 'IA', 'LA', 'ME', 
  'MD', 'MI', 'MS', 'MO', 'NH', 'NJ', 'NY', 'OH', 'PA', 'TN', 
  'VT', 'VA', 'WV'
] as const;

export interface GeoEligibilityResult {
  allowed: boolean;
  stateCode?: string;
  stateName?: string;
  reason?: string;
}

// In-memory cache for IP lookups (24-hour TTL)
const ipCache = new Map<string, { stateCode: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Extract user's state from request headers
 * Supports: Vercel, Cloudflare, and custom headers
 */
export function getUserState(req: Request): string | null {
  // Try various geo headers in order of preference
  const stateCode = 
    req.headers.get('x-vercel-ip-country-region') ||
    req.headers.get('cf-region-code') ||
    req.headers.get('x-region') ||
    req.headers.get('x-geo-state');
  
  return stateCode?.toUpperCase() || null;
}

/**
 * Check if a state is blocked
 */
export function isStateBlocked(stateCode: string): boolean {
  return BLOCKED_STATES.includes(stateCode.toUpperCase() as typeof BLOCKED_STATES[number]);
}

/**
 * Strict location eligibility check - throws error if blocked
 * Call this at the top of protected endpoints (contest-enter, wallet-deposit)
 */
export function checkLocationEligibility(req: Request): { allowed: true; stateCode: string | null } {
  const stateCode = getUserState(req);
  
  // Dev mode: If no header is present (localhost), allow access
  if (!stateCode) {
    console.log('[geo-eligibility] No location header detected - allowing access (dev mode)');
    return { allowed: true, stateCode: null };
  }
  
  // Production check: Block if state is in blocked list
  if (isStateBlocked(stateCode)) {
    console.log('[geo-eligibility] Blocking access from restricted state:', stateCode);
    throw new Error(`Location Restricted: RowFantasy is not currently available in ${stateCode}.`);
  }
  
  console.log('[geo-eligibility] Access allowed from state:', stateCode);
  return { allowed: true, stateCode };
}

/**
 * Get location blocking info for UI display
 */
export function getLocationBlockingInfo(req: Request): {
  detectedState: string | null;
  isBlocked: boolean;
  message: string;
} {
  const stateCode = getUserState(req);
  
  if (!stateCode) {
    return {
      detectedState: null,
      isBlocked: false,
      message: 'Unable to detect your location. Please ensure location services are enabled.'
    };
  }
  
  const blocked = isStateBlocked(stateCode);
  
  return {
    detectedState: stateCode,
    isBlocked: blocked,
    message: blocked 
      ? `Daily Fantasy Sports is not yet available in your region (${stateCode}). We're working to expand our coverage.`
      : `RowFantasy is available in ${stateCode}. Enjoy the competition!`
  };
}

// Legacy function - keeping for backward compatibility with existing geo checks
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
  // Check against blocked states list first
  if (isStateBlocked(stateCode)) {
    console.log('[geo-eligibility] State in blocked list:', stateCode);
    await logGeoEvent(supabase, {
      userId,
      ipAddress,
      stateDetected: stateCode,
      isAllowed: false,
      blockedReason: 'State is in blocked list',
      actionType: 'state_blocked',
    });
    return {
      allowed: false,
      stateCode,
      reason: `RowFantasy is not currently available in ${stateCode}`,
    };
  }

  // Fetch state regulation rules for additional info
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
