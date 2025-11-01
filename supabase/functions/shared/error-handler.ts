// Secure Error Handler - Maps internal errors to safe client messages

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
} as const;

export function mapErrorToClient(error: any): string {
  // Database errors
  if (error.code === '23505') return ERROR_MESSAGES.DUPLICATE_ENTRY;
  if (error.code === '23503') return ERROR_MESSAGES.NOT_FOUND;
  
  // Message-based detection (safe patterns only)
  const msg = error.message?.toLowerCase() || '';
  
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
  if (msg.includes('age') || msg.includes('18')) {
    return ERROR_MESSAGES.AGE_REQUIREMENT;
  }
  if (msg.includes('kyc') || msg.includes('verification')) {
    return ERROR_MESSAGES.KYC_REQUIRED;
  }
  
  // Default safe message
  return ERROR_MESSAGES.INTERNAL_ERROR;
}

export function logSecureError(
  functionName: string,
  error: any,
  context?: Record<string, any>
) {
  const requestId = crypto.randomUUID();
  
  // Log full details server-side only
  console.error(`[${functionName}] Error:`, {
    requestId,
    errorCode: error.code,
    errorName: error.name,
    // Don't log full error.message or error.details - might contain sensitive data
    hasMessage: !!error.message,
    hasDetails: !!error.details,
    context,
  });
  
  return requestId;
}

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
      requestId, // For support tickets
    }),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
