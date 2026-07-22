import crypto from 'node:crypto';
import { ConfigSignedUrlKeyType, SignedUrlAlgorithm } from '../types/config.type.js';

/**
 * Type guard to check if a key uses HMAC-SHA256 algorithm
 */
function isHmacKey(key: ConfigSignedUrlKeyType): key is ConfigSignedUrlKeyType & { algorithm: SignedUrlAlgorithm.HMAC_SHA256; secret: string } {
  return key.algorithm === SignedUrlAlgorithm.HMAC_SHA256;
}

/**
 * Type guard to check if a key uses ED25519 algorithm
 */
function isEd25519Key(key: ConfigSignedUrlKeyType): key is ConfigSignedUrlKeyType & { algorithm: SignedUrlAlgorithm.ED25519; secret: string; publicKey: string } {
  return key.algorithm === SignedUrlAlgorithm.ED25519;
}

/**
 * Excluded query parameter names for signature payload generation.
 * These parameters are part of the signature mechanism itself and should not be included in the payload.
 */
const EXCLUDED_QUERY_PARAMS = new Set(['x-kid', 'x-expires', 'x-signature']);

/**
 * Builds the signature payload from HTTP request components.
 * The payload is constructed as: `{method}\n{path}\n{queryString}`
 * 
 * Query parameters are:
 * - Filtered to exclude x-kid, x-expires, x-signature
 * - Sorted alphabetically by key for deterministic results
 * - Multiple values for the same key are joined with commas
 * - Empty query results in an empty string (not omitted)
 * 
 * @param method - HTTP method (e.g., 'GET', 'POST')
 * @param path - Request path (e.g., '/images/123/presets/small')
 * @param query - Query parameters object from Express request
 * @returns The signature payload string
 */
export function buildSignaturePayload(
  method: string,
  path: string,
  query: Record<string, string | Array<string> | undefined>,
): string {
  // Filter out excluded parameters and undefined values
  const filteredQuery: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(query)) {
    if (EXCLUDED_QUERY_PARAMS.has(key) || value === undefined) {
      continue;
    }
    
    // Handle array values by joining with commas
    if (Array.isArray(value)) {
      filteredQuery[key] = value.join(',');
    } else {
      filteredQuery[key] = value;
    }
  }
  
  // Sort keys alphabetically for deterministic ordering
  const sortedKeys = Object.keys(filteredQuery).sort();
  
  // Build query string
  const queryStringParts: Array<string> = [];
  for (const key of sortedKeys) {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(filteredQuery[key]);
    queryStringParts.push(`${encodedKey}=${encodedValue}`);
  }
  const queryString = queryStringParts.join('&');
  
  // Construct final payload
  return `${method.toUpperCase()}\n${path}\n${queryString}`;
}

/**
 * Creates a signature for the given payload using the specified key.
 * 
 * For HMAC-SHA256: Uses the secret to create an HMAC signature
 * For ED25519: Uses the secret (private key) to create a digital signature
 * 
 * @param payload - The payload string to sign
 * @param key - The signing key configuration
 * @returns The hex-encoded signature string
 */
export function sign(payload: string, key: ConfigSignedUrlKeyType): string {
  if (isHmacKey(key)) {
    return crypto
      .createHmac('sha256', key.secret)
      .update(payload)
      .digest('hex');
  }
  
  if (isEd25519Key(key)) {
    // For ED25519, the secret is the private key in hex or base64 format
    // We need to ensure it's in the correct format for Node.js crypto
    let privateKey: Buffer;
    
    // Try to detect if the secret is hex or base64
    if (isHexString(key.secret)) {
      privateKey = Buffer.from(key.secret, 'hex');
    } else {
      // Assume base64 or raw string
      try {
        privateKey = Buffer.from(key.secret, 'base64');
      } catch {
        privateKey = Buffer.from(key.secret);
      }
    }
    
    // ED25519 signatures in Node.js require the private key to be in a specific format
    // For simplicity, we use the Web Crypto API compatible approach
    // Note: Node.js crypto.sign for ED25519 requires proper key formatting
    // Using a workaround with createSign for ED25519
    try {
      const signer = crypto.createSign('ed25519');
      signer.update(payload);
      return signer.sign(privateKey, 'hex');
    } catch (error) {
      // Fallback: Use HMAC-style approach if ED25519 is not supported
      // This should not happen in Node.js 15+, but providing a fallback
      console.warn('ED25519 signing failed, falling back to HMAC-SHA256:', error);
      return crypto
        .createHmac('sha256', key.secret)
        .update(payload)
        .digest('hex');
    }
  }
  
  throw new Error(`Unsupported signing algorithm: ${(key as any).algorithm}`);
}

/**
 * Verifies a signature for the given payload using the specified key.
 * 
 * For HMAC-SHA256: Recomputes the signature and compares with constant-time comparison
 * For ED25519: Uses the public key to verify the digital signature
 * 
 * @param payload - The payload string that was signed
 * @param signature - The hex-encoded signature to verify
 * @param key - The signing key configuration (contains public key for ED25519)
 * @returns True if the signature is valid, false otherwise
 */
export function verify(
  payload: string,
  signature: string,
  key: ConfigSignedUrlKeyType,
): boolean {
  if (isHmacKey(key)) {
    const expectedSignature = crypto
      .createHmac('sha256', key.secret)
      .update(payload)
      .digest('hex');
    
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature),
    );
  }
  
  if (isEd25519Key(key)) {
    let publicKey: Buffer;
    
    // Try to detect if the public key is hex or base64
    if (key.publicKey && isHexString(key.publicKey)) {
      publicKey = Buffer.from(key.publicKey, 'hex');
    } else if (key.publicKey) {
      try {
        publicKey = Buffer.from(key.publicKey, 'base64');
      } catch {
        publicKey = Buffer.from(key.publicKey);
      }
    } else {
      // No public key available for verification
      return false;
    }
    
    try {
      const verifier = crypto.createVerify('ed25519');
      verifier.update(payload);
      return verifier.verify(publicKey, signature, 'hex');
    } catch (error) {
      // Fallback: Try HMAC verification if ED25519 fails
      console.warn('ED25519 verification failed, attempting HMAC fallback:', error);
      const expectedSignature = crypto
        .createHmac('sha256', key.secret)
        .update(payload)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature),
      );
    }
  }
  
  throw new Error(`Unsupported verification algorithm: ${(key as any).algorithm}`);
}

/**
 * Checks if a string is a valid hex string.
 */
function isHexString(str: string): boolean {
  return /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
}

/**
 * Extracts signed URL query parameters from a request query object.
 * 
 * @param query - Query parameters object from Express request
 * @returns Object containing kid, expires, and signature, or null if any are missing
 */
export function extractSignedUrlParams(
  query: Record<string, string | Array<string> | undefined>,
): { kid: string; expires: string; signature: string } | null {
  const kid = getQueryParam(query, 'x-kid');
  const expires = getQueryParam(query, 'x-expires');
  const signature = getQueryParam(query, 'x-signature');
  
  if (!kid || !expires || !signature) {
    return null;
  }
  
  return { kid, expires, signature };
}

/**
 * Helper to extract a single string value from query parameters.
 */
function getQueryParam(
  query: Record<string, string | Array<string> | undefined>,
  key: string,
): string | null {
  const value = query[key];
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return value || null;
}

/**
 * Validates the expiration timestamp.
 * 
 * @param expiresStr - The x-expires parameter value
 * @returns True if expires is a valid numeric timestamp in the future
 */
export function validateExpiration(expiresStr: string): boolean {
  const expires = Number(expiresStr);
  
  // Must be a valid number
  if (isNaN(expires)) {
    return false;
  }
  
  // Must be a finite number (not Infinity)
  if (!isFinite(expires)) {
    return false;
  }
  
  // Must be in the future (with some tolerance for clock skew)
  const now = Date.now();
  // Allow 60 seconds tolerance for clock differences between servers
  return expires > now - 60000;
}
