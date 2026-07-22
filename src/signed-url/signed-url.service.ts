import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ParsedQs } from 'qs';
import {
  ConfigSignedUrlKeyType,
  ConfigSignedUrlsType,
  SignedUrlAlgorithm,
} from '../types/config.type.js';
import {
  buildSignaturePayload,
  extractSignedUrlParams,
  sign,
  validateExpiration,
  verify,
} from '../utils/signed-url.utils.js';

/**
 * Options for generating a signed URL.
 */
export interface GenerateSignedUrlOptions {
  /**
   * The key ID to use for signing (must exist in configuration).
   */
  keyId: string;

  /**
   * Expiration time in seconds from now.
   * Default: 3600 (1 hour)
   */
  expiresIn?: number;

  /**
   * Additional query parameters to include in the URL.
   * These will be sorted and included in the signature payload.
   */
  queryParams?: Record<string, string>;
}

/**
 * Result of validating a signed URL request.
 */
export interface SignedUrlValidationResult {
  /**
   * Whether the request has valid signed URL parameters.
   */
  isValid: boolean;

  /**
   * The key ID used for signing (if valid).
   */
  keyId?: string;

  /**
   * The expiration timestamp (if valid).
   */
  expiresAt?: number;

  /**
   * Error message if validation failed.
   */
  error?: string;
}

/**
 * Service for generating and validating signed URLs.
 * 
 * Signed URLs allow temporary access to private resources by including
 * cryptographic signatures in the URL query parameters.
 */
@Injectable()
export class SignedUrlService {
  private readonly signedUrlsConfig: ConfigSignedUrlsType | undefined;

  constructor(private readonly configService: ConfigService) {
    this.signedUrlsConfig = this.configService.get<ConfigSignedUrlsType>('signed_urls');
  }

  /**
   * Checks if signed URLs are enabled in the configuration.
   */
  get isEnabled(): boolean {
    return this.signedUrlsConfig?.enabled === true;
  }

  /**
   * Gets all configured signing keys.
   */
  get keys(): Array<ConfigSignedUrlKeyType> | undefined {
    return this.signedUrlsConfig?.keys;
  }

  /**
   * Finds a signing key by its ID.
   * 
   * @param keyId - The key identifier
   * @returns The key configuration or undefined if not found
   */
  findKeyById(keyId: string): ConfigSignedUrlKeyType | undefined {
    return this.signedUrlsConfig?.keys.find((key) => key.id === keyId);
  }

  /**
   * Finds a signing key by its ID and validates that it exists.
   * 
   * @param keyId - The key identifier
   * @returns The key configuration
   * @throws NotFoundException if the key is not found
   */
  getKeyById(keyId: string): ConfigSignedUrlKeyType {
    const key = this.findKeyById(keyId);
    if (!key) {
      throw new NotFoundException(`Signing key with ID '${keyId}' not found`);
    }
    return key;
  }

  /**
   * Generates a signed URL for the given path.
   * 
   * The URL will include:
   * - x-kid: The key identifier
   * - x-expires: Unix timestamp when the URL expires
   * - x-signature: The computed signature
   * 
   * @param path - The URL path (e.g., '/images/123/presets/small')
   * @param options - Generation options
   * @returns The complete signed URL with query parameters
   */
  generateSignedUrl(
    path: string,
    options: GenerateSignedUrlOptions,
  ): string {
    if (!this.isEnabled) {
      throw new Error('Signed URLs are not enabled in configuration');
    }

    const key = this.getKeyById(options.keyId);
    const expiresAt = Date.now() + (options.expiresIn ?? 3600) * 1000;

    // Build the payload
    const payload = buildSignaturePayload(
      'GET',
      path,
      options.queryParams ?? {},
    );

    // Generate the signature
    const signature = sign(payload, key);

    // Build the URL with query parameters
    const queryParams = new URLSearchParams({
      'x-kid': key.id,
      'x-expires': Math.floor(expiresAt).toString(),
      'x-signature': signature,
    });

    // Add additional query parameters
    for (const [key, value] of Object.entries(options.queryParams ?? {})) {
      queryParams.set(key, value);
    }

    const queryString = queryParams.toString();
    return `${path}?${queryString}`;
  }

  /**
   * Validates a request for signed URL parameters.
   * 
   * This method:
   * 1. Extracts x-kid, x-expires, x-signature from the request
   * 2. Validates that x-kid references a known key
   * 3. Validates that x-expires is a valid timestamp in the future
   * 4. Recomputes the signature and compares it
   * 
   * @param req - The Express request object
   * @returns Validation result with details
   */
  validateRequest(req: Request): SignedUrlValidationResult {
    if (!this.isEnabled) {
      return {
        isValid: false,
        error: 'Signed URLs are not enabled in configuration',
      };
    }

    // Extract signed URL parameters - cast to simpler type
    const query = req.query as unknown as Record<string, string | Array<string>>;
    const params = extractSignedUrlParams(query);
    if (!params) {
      return {
        isValid: false,
        error: 'Missing signed URL parameters (x-kid, x-expires, x-signature)',
      };
    }

    // Validate that the key exists
    const key = this.findKeyById(params.kid);
    if (!key) {
      return {
        isValid: false,
        error: `Unknown signing key ID: ${params.kid}`,
      };
    }

    // Validate expiration
    if (!validateExpiration(params.expires)) {
      return {
        isValid: false,
        error: 'URL has expired or invalid expiration timestamp',
      };
    }

    const expiresAt = Number(params.expires);

    // Recompute the payload (without the signature parameters)
    const payload = buildSignaturePayload(
      req.method,
      req.path,
      query,
    );

    // Verify the signature
    const isSignatureValid = verify(payload, params.signature, key);
    if (!isSignatureValid) {
      return {
        isValid: false,
        error: 'Invalid signature',
      };
    }

    return {
      isValid: true,
      keyId: key.id,
      expiresAt,
    };
  }

  /**
   * Validates a request and returns whether it has a valid signed URL.
   * This is a convenience method that returns a simple boolean.
   * 
   * @param req - The Express request object
   * @returns True if the request has valid signed URL parameters
   */
  isRequestValid(req: Request): boolean {
    return this.validateRequest(req).isValid;
  }

  /**
   * Creates a signed URL for an image endpoint.
   * 
   * This is a convenience method specifically for image URLs.
   * 
   * @param imagePath - The image path (e.g., '/images/123/presets/small' or '/images/resolve/my-slug')
   * @param options - Generation options
   * @returns The complete signed URL
   */
  generateImageSignedUrl(
    imagePath: string,
    options: Omit<GenerateSignedUrlOptions, 'keyId'> & { keyId: string },
  ): string {
    return this.generateSignedUrl(imagePath, options);
  }
}
