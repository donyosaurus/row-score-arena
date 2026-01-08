// Secure Error Handler - Maps internal errors to safe client messages
// CRITICAL: Never expose internal database errors, table names, or system details to clients

export const ERROR_MESSAGES = {
  DUPLICATE_ENTRY: 'You have already entered this contest',
  INSUFFICIENT_FUNDS: 'Insufficient balance',
  GEO_BLOCKED: 'Service not available in your location',
  INVALID_INPUT: 'Invalid request parameters',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  CONTEST_LOCKED: 'Contest is no longer accepting entries',
  CONTEST_FULL: 'Contest pool is full',
  BALANCE_MISMATCH: 'Transaction amount mismatch',
  RATE_LIMIT: 'Too many requests. Please try again later',
  INTERNAL_ERROR: 'An error occurred. Please try again later',
  STATE_RESTRICTED: 'Service not available in your state',
  AGE_REQUIREMENT: 'Age verification required',
  KYC_REQUIRED: 'Identity verification required',
  SELF_EXCLUDED: 'Account is currently self-excluded',
  WITHDRAWAL_COOLDOWN: 'Please wait before requesting another withdrawal',
  DAILY_LIMIT: 'Daily limit exceeded',
  LOCATION_RESTRICTED: 'RowFantasy is not available in your location',
  POOL_NOT_FOUND: 'Contest not found',
  ENTRY_NOT_FOUND: 'Entry not found',
  ALREADY_SETTLED: 'Contest has already been settled',
  SCORING_REQUIRED: 'Contest must be scored before settlement',
  DEPOSIT_LIMIT_EXCEEDED: 'Deposit would exceed your monthly limit',
} as const;

// Patterns that indicate sensitive data that should NEVER be exposed
const SENSITIVE_PATTERNS = [
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /table ".*"/i,
  /schema ".*"/i,
  /function ".*"/i,
  /role ".*"/i,
  /password/i,
  /secret/i,
  /token/i,
  /api.key/i,
  /SUPABASE_/i,
  /service_role/i,
  /auth\.users/i,
];

/**
 * Check if an error message contains sensitive information
 */
function containsSensitiveData(message: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Map internal errors to safe client-facing messages
 * NEVER exposes database structure, column names, or system internals
 */
export function mapErrorToClient(error: any): string {
  const msg = error.message?.toLowerCase() || '';
  
  // First check if message contains sensitive data - if so, always return generic error
  if (error.message && containsSensitiveData(error.message)) {
    return ERROR_MESSAGES.INTERNAL_ERROR;
  }
  
  // Database constraint errors - use generic messages
  if (error.code === '23505') return ERROR_MESSAGES.DUPLICATE_ENTRY;
  if (error.code === '23503') return ERROR_MESSAGES.NOT_FOUND;
  if (error.code === '42P01') return ERROR_MESSAGES.INTERNAL_ERROR; // relation does not exist
  if (error.code === '42703') return ERROR_MESSAGES.INTERNAL_ERROR; // column does not exist
  if (error.code?.startsWith('28')) return ERROR_MESSAGES.UNAUTHORIZED; // auth errors
  if (error.code?.startsWith('42')) return ERROR_MESSAGES.INTERNAL_ERROR; // syntax/schema errors
  
  // Location/geo errors
  if (msg.includes('location restricted') || msg.includes('not currently available in')) {
    return error.message; // These are already user-safe messages
  }
  
  // Safe message-based detection
  if (msg.includes('insufficient') || msg.includes('balance')) {
    return ERROR_MESSAGES.INSUFFICIENT_FUNDS;
  }
  if (msg.includes('unauthorized') || msg.includes('not authenticated')) {
    return ERROR_MESSAGES.UNAUTHORIZED;
  }
  if (msg.includes('forbidden') || msg.includes('access denied')) {
    return ERROR_MESSAGES.FORBIDDEN;
  }
  if (msg.includes('not found')) {
    return ERROR_MESSAGES.NOT_FOUND;
  }
  if (msg.includes('state') && (msg.includes('restricted') || msg.includes('prohibited'))) {
    return ERROR_MESSAGES.STATE_RESTRICTED;
  }
  if (msg.includes('self-excluded') || msg.includes('self_exclusion')) {
    return ERROR_MESSAGES.SELF_EXCLUDED;
  }
  if (msg.includes('deposit') && msg.includes('limit')) {
    return ERROR_MESSAGES.DEPOSIT_LIMIT_EXCEEDED;
  }
  if (msg.includes('daily') && msg.includes('limit')) {
    return ERROR_MESSAGES.DAILY_LIMIT;
  }
  if (msg.includes('age') || msg.includes('18')) {
    return ERROR_MESSAGES.AGE_REQUIREMENT;
  }
  if (msg.includes('kyc') || msg.includes('verification')) {
    return ERROR_MESSAGES.KYC_REQUIRED;
  }
  if (msg.includes('pool is full')) {
    return ERROR_MESSAGES.CONTEST_FULL;
  }
  if (msg.includes('locked') || msg.includes('entry period')) {
    return ERROR_MESSAGES.CONTEST_LOCKED;
  }
  if (msg.includes('already entered')) {
    return ERROR_MESSAGES.DUPLICATE_ENTRY;
  }
  if (msg.includes('cooldown') || msg.includes('wait')) {
    return ERROR_MESSAGES.WITHDRAWAL_COOLDOWN;
  }
  
  // Default safe message - NEVER expose internal error details
  return ERROR_MESSAGES.INTERNAL_ERROR;
}

/**
 * Log error details server-side only (never sent to client)
 * Generates a request ID for support correlation
 */
export function logSecureError(
  functionName: string,
  error: any,
  context?: Record<string, any>
): string {
  const requestId = crypto.randomUUID();
  
  // Log full details server-side only - these are NOT sent to the client
  console.error(`[${functionName}] Error [${requestId}]:`, {
    requestId,
    errorCode: error.code,
    errorName: error.name,
    // Log message for debugging but NEVER send to client
    errorMessage: error.message,
    stack: error.stack?.split('\n').slice(0, 3), // First 3 lines only
    context: context ? sanitizeContext(context) : undefined,
  });
  
  return requestId;
}

/**
 * Remove any sensitive data from context before logging
 */
function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
  
  for (const [key, value] of Object.entries(context)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Create a safe error response for the client
 * NEVER exposes internal error details
 */
export function createErrorResponse(
  error: any,
  functionName: string,
  corsHeaders: Record<string, string>,
  statusCode: number = 500
): Response {
  const requestId = logSecureError(functionName, error);
  const clientMessage = mapErrorToClient(error);
  
  return new Response(
    JSON.stringify({
      error: clientMessage,
      requestId, // For support tickets - allows lookup without exposing details
    }),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Wrap an async handler with global error catching
 * Ensures no unhandled errors leak sensitive data
 */
export function withErrorHandling(
  functionName: string,
  corsHeaders: Record<string, string>,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error: any) {
      // Determine appropriate status code
      let statusCode = 500;
      const msg = error.message?.toLowerCase() || '';
      
      if (msg.includes('unauthorized') || msg.includes('authentication')) {
        statusCode = 401;
      } else if (msg.includes('forbidden') || msg.includes('access denied')) {
        statusCode = 403;
      } else if (msg.includes('not found')) {
        statusCode = 404;
      } else if (msg.includes('location restricted')) {
        statusCode = 403;
      } else if (msg.includes('invalid') || error.name === 'ZodError') {
        statusCode = 400;
      }
      
      return createErrorResponse(error, functionName, corsHeaders, statusCode);
    }
  };
}
