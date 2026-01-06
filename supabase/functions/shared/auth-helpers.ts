// Authentication and Authorization Helpers

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

export interface AuthResult {
  user: any;
  supabase: any;
}

export interface AdminCheckResult {
  isAdmin: boolean;
  user: any;
}

/**
 * Authenticate user and return user + client
 */
export async function authenticateUser(
  req: Request,
  supabaseUrl: string,
  anonKey: string
): Promise<AuthResult | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }

  return { user, supabase };
}

/**
 * Verify user is admin
 */
export async function verifyAdmin(
  supabase: any,
  userId: string
): Promise<boolean> {
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin');

  return roles && roles.length > 0;
}

/**
 * Authenticate and verify admin in one call
 */
export async function authenticateAdmin(
  req: Request,
  supabaseUrl: string,
  anonKey: string
): Promise<AdminCheckResult | null> {
  const auth = await authenticateUser(req, supabaseUrl, anonKey);
  if (!auth) {
    return null;
  }

  const isAdmin = await verifyAdmin(auth.supabase, auth.user.id);
  if (!isAdmin) {
    return null;
  }

  return { isAdmin: true, user: auth.user };
}

/**
 * Check rate limit for identifier (IP or user ID)
 */
export async function checkRateLimit(
  supabase: any,
  identifier: string,
  endpoint: string,
  maxRequests: number = 100,
  windowMinutes: number = 1
): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

  // Try to increment existing counter
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('request_count')
    .eq('identifier', identifier)
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart.toISOString())
    .single();

  if (existing) {
    if (existing.request_count >= maxRequests) {
      return false; // Rate limit exceeded
    }

    // Increment counter
    await supabase
      .from('rate_limits')
      .update({ request_count: existing.request_count + 1 })
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart.toISOString());
  } else {
    // Create new counter
    await supabase
      .from('rate_limits')
      .insert({
        identifier,
        endpoint,
        request_count: 1,
        window_start: new Date().toISOString(),
      });
  }

  return true;
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(supabase: any, userId: string): Promise<void> {
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin');

  if (error || !roles || roles.length === 0) {
    throw new Error('Forbidden: Admin access required');
  }
}

/**
 * Check if real money transactions are enabled
 */
export async function isRealMoneyEnabled(supabase: any): Promise<boolean> {
  const { data: flag } = await supabase
    .from('feature_flags')
    .select('value')
    .eq('key', 'real_money_enabled')
    .single();

  return flag?.value?.enabled ?? false;
}

/**
 * Extract client IP from request
 */
export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() 
    || req.headers.get('x-real-ip') 
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
}
