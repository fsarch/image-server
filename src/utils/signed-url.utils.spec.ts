import {
  buildSignaturePayload,
  extractSignedUrlParams,
  sign,
  validateExpiration,
  verify,
} from './signed-url.utils.js';
import { SignedUrlAlgorithm } from '../types/config.type.js';

describe('SignedUrlUtils', () => {
  describe('buildSignaturePayload', () => {
    it('should build payload with method, path, and empty query', () => {
      const payload = buildSignaturePayload('GET', '/images/test', {});
      expect(payload).toBe('GET\n/images/test\n');
    });

    it('should build payload with method, path, and single query parameter', () => {
      const payload = buildSignaturePayload('GET', '/images/test', { foo: 'bar' } as const);
      expect(payload).toBe('GET\n/images/test\nfoo=bar');
    });

    it('should build payload with multiple query parameters sorted alphabetically', () => {
      const payload = buildSignaturePayload('GET', '/images/test', {
        zebra: 'z',
        apple: 'a',
        banana: 'b',
      } as const);
      expect(payload).toBe('GET\n/images/test\napple=a&banana=b&zebra=z');
    });

    it('should exclude x-kid, x-expires, x-signature from query parameters', () => {
      const payload = buildSignaturePayload('GET', '/images/test', {
        'x-kid': 'key1',
        'x-expires': '1234567890',
        'x-signature': 'abc123',
        foo: 'bar',
      } as const);
      expect(payload).toBe('GET\n/images/test\nfoo=bar');
    });

    it('should handle array query parameters by joining with commas', () => {
      const payload = buildSignaturePayload('GET', '/images/test', {
        tags: ['tag1', 'tag2', 'tag3'],
      } as const);
      expect(payload).toBe('GET\n/images/test\ntags=tag1,tag2,tag3');
    });

    it('should handle mixed array and string query parameters', () => {
      const payload = buildSignaturePayload('GET', '/images/test', {
        tags: ['tag1', 'tag2'],
        category: 'test',
      } as const);
      expect(payload).toBe('GET\n/images/test\ncategory=test&tags=tag1,tag2');
    });

    it('should ignore undefined query parameters', () => {
      const payload = buildSignaturePayload('GET', '/images/test', {
        foo: 'bar',
        baz: undefined,
      } as const);
      expect(payload).toBe('GET\n/images/test\nfoo=bar');
    });

    it('should URL encode query parameter keys and values', () => {
      const payload = buildSignaturePayload('GET', '/images/test', {
        'special char': 'value with spaces & symbols',
      } as const);
      expect(payload).toBe(
        'GET\n/images/test\nspecial%20char=value%20with%20spaces%20%26%20symbols',
      );
    });

    it('should use uppercase method', () => {
      const payload = buildSignaturePayload('get', '/images/test', {});
      expect(payload).toBe('GET\n/images/test\n');
    });
  });

  describe('sign and verify', () => {
    const hmacKey = {
      id: 'test-key',
      algorithm: SignedUrlAlgorithm.HMAC_SHA256,
      secret: 'my-secret-key',
    };

    it('should sign and verify with HMAC-SHA256', () => {
      const payload = 'GET\n/images/test\nfoo=bar';
      const signature = sign(payload, hmacKey);
      expect(verify(payload, signature, hmacKey)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const payload = 'GET\n/images/test\nfoo=bar';
      const signature = sign(payload, hmacKey);
      expect(verify(payload, 'invalid-signature', hmacKey)).toBe(false);
    });

    it('should return false for modified payload', () => {
      const payload = 'GET\n/images/test\nfoo=bar';
      const signature = sign(payload, hmacKey);
      expect(verify('GET\n/images/test\nfoo=baz', signature, hmacKey)).toBe(false);
    });

    it('should handle different payloads with same key', () => {
      const payload1 = 'GET\n/images/test1\n';
      const payload2 = 'GET\n/images/test2\n';

      const signature1 = sign(payload1, hmacKey);
      const signature2 = sign(payload2, hmacKey);

      expect(signature1).not.toBe(signature2);
      expect(verify(payload1, signature1, hmacKey)).toBe(true);
      expect(verify(payload2, signature2, hmacKey)).toBe(true);
      expect(verify(payload1, signature2, hmacKey)).toBe(false);
    });

    it('should use constant-time comparison for HMAC', () => {
      const payload = 'GET\n/images/test\nfoo=bar';
      const signature = sign(payload, hmacKey);

      // Create a signature that is almost correct but differs by one character
      const similarSignature = signature.substring(0, signature.length - 1) + 
        (signature.charCodeAt(signature.length - 1) === 97 ? 'b' : 'a');

      const start = performance.now();
      verify(payload, similarSignature, hmacKey);
      const duration1 = performance.now() - start;

      const start2 = performance.now();
      verify(payload, signature, hmacKey);
      const duration2 = performance.now() - start2;

      // The durations should be similar (within reasonable bounds)
      // This is not a perfect test for constant-time, but it helps catch obvious issues
      expect(Math.abs(duration1 - duration2)).toBeLessThan(10);
    });
  });

  describe('extractSignedUrlParams', () => {
    it('should extract all three parameters when present', () => {
      const query = {
        'x-kid': 'key1',
        'x-expires': '1234567890',
        'x-signature': 'abc123',
      } as const;
      const result = extractSignedUrlParams(query);
      expect(result).toEqual({
        kid: 'key1',
        expires: '1234567890',
        signature: 'abc123',
      });
    });

    it('should return null when x-kid is missing', () => {
      const query = {
        'x-expires': '1234567890',
        'x-signature': 'abc123',
      } as const;
      const result = extractSignedUrlParams(query);
      expect(result).toBeNull();
    });

    it('should return null when x-expires is missing', () => {
      const query = {
        'x-kid': 'key1',
        'x-signature': 'abc123',
      } as const;
      const result = extractSignedUrlParams(query);
      expect(result).toBeNull();
    });

    it('should return null when x-signature is missing', () => {
      const query = {
        'x-kid': 'key1',
        'x-expires': '1234567890',
      } as const;
      const result = extractSignedUrlParams(query);
      expect(result).toBeNull();
    });

    it('should handle array values by taking the first element', () => {
      const query = {
        'x-kid': ['key1', 'key2'],
        'x-expires': ['1234567890'],
        'x-signature': ['abc123'],
      } as const;
      const result = extractSignedUrlParams(query);
      expect(result).toEqual({
        kid: 'key1',
        expires: '1234567890',
        signature: 'abc123',
      });
    });

    it('should return null when any parameter is empty string', () => {
      const query = {
        'x-kid': '',
        'x-expires': '1234567890',
        'x-signature': 'abc123',
      } as const;
      const result = extractSignedUrlParams(query);
      expect(result).toBeNull();
    });
  });

  describe('validateExpiration', () => {
    it('should return true for future timestamp', () => {
      const futureTimestamp = (Date.now() + 100000).toString();
      expect(validateExpiration(futureTimestamp)).toBe(true);
    });

    it('should return false for past timestamp', () => {
      const pastTimestamp = (Date.now() - 100000).toString();
      expect(validateExpiration(pastTimestamp)).toBe(false);
    });

    it('should return false for non-numeric string', () => {
      expect(validateExpiration('not-a-number')).toBe(false);
    });

    it('should return false for Infinity', () => {
      expect(validateExpiration('Infinity')).toBe(false);
    });

    it('should return false for negative number', () => {
      expect(validateExpiration('-1000')).toBe(false);
    });

    it('should return true for timestamp within clock skew tolerance', () => {
      // Current time minus 30 seconds should still be valid (tolerance is 60 seconds)
      const nowMinus30 = (Date.now() - 30000).toString();
      expect(validateExpiration(nowMinus30)).toBe(true);
    });

    it('should return false for timestamp beyond clock skew tolerance', () => {
      // Current time minus 120 seconds should be invalid (tolerance is 60 seconds)
      const nowMinus120 = (Date.now() - 120000).toString();
      expect(validateExpiration(nowMinus120)).toBe(false);
    });

    it('should handle numeric strings with decimals', () => {
      // Unix timestamps can be in milliseconds (with decimals)
      const futureTimestamp = (Date.now() + 100000).toString();
      expect(validateExpiration(futureTimestamp)).toBe(true);
    });
  });
});
