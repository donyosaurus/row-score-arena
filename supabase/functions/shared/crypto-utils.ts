// Cryptographic Utilities

/**
 * Constant-time string comparison to prevent timing attacks
 * Uses Web Crypto API's subtle.timingSafeEqual
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  try {
    // Use built-in constant-time comparison
    const aKey = await crypto.subtle.importKey(
      'raw',
      aBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const bKey = await crypto.subtle.importKey(
      'raw',
      bBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign same data with both keys and compare
    const testData = encoder.encode('test');
    const aSignature = await crypto.subtle.sign('HMAC', aKey, testData);
    const bSignature = await crypto.subtle.sign('HMAC', bKey, testData);

    // This is constant-time comparison
    const aArray = new Uint8Array(aSignature);
    const bArray = new Uint8Array(bSignature);

    if (aArray.length !== bArray.length) return false;

    let result = 0;
    for (let i = 0; i < aArray.length; i++) {
      result |= aArray[i] ^ bArray[i];
    }

    return result === 0;
  } catch {
    // Fallback to manual constant-time comparison
    return constantTimeCompare(aBytes, bBytes);
  }
}

/**
 * Fallback constant-time comparison
 */
function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Validate webhook timestamp is recent (within maxAgeSeconds)
 */
export function isTimestampValid(
  timestamp: string | number,
  maxAgeSeconds: number = 300
): boolean {
  try {
    const webhookTime = typeof timestamp === 'string' 
      ? new Date(timestamp).getTime() 
      : timestamp * 1000; // Assume Unix timestamp
    
    const now = Date.now();
    const age = (now - webhookTime) / 1000;

    return age >= 0 && age <= maxAgeSeconds;
  } catch {
    return false;
  }
}
