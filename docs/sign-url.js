#!/usr/bin/env node

/**
 * Signed URL Generator
 * 
 * Signs URLs for private image access using configured keys.
 * Accepts complete URLs including query parameters as input.
 * 
 * Usage:
 *   node sign-url.js <url> [options]
 * 
 * Arguments:
 *   <url>                      Complete URL to sign (required)
 * 
 * Options:
 *   --key-id, -k              Key ID from config (if using config file)
 *   --algorithm, -a           Algorithm: HMAC-SHA256 or ED25519
 *   --secret, -s              Secret key for signing (if not using config)
 *   --public-key, -p          Public key (for ED25519 verification)
 *   --method, -m              HTTP method: GET, POST, PUT, DELETE, etc. (default: GET)
 *   --expires-in, -e          Expiration time in seconds (default: 3600 = 1 hour)
 *   --config-path, -c         Path to config.yaml file (default: ./config.yaml)
 *   --help, -h                Show this help message
 * 
 * Examples:
 *   # Sign with key from config
 *   node sign-url.js "http://localhost:3000/images/123/presets/small" -k my-key
 * 
 *   # Sign with direct secret
 *   node sign-url.js "http://localhost:3000/images/123" -a HMAC-SHA256 -s my-secret -k my-key
 * 
 *   # Sign POST request
 *   node sign-url.js "http://localhost:3000/api/upload" -k my-key -m POST
 * 
 *   # Sign with custom expiration
 *   node sign-url.js "http://localhost:3000/images/123" -k my-key -e 7200
 * 
 *   # Sign URL with existing query parameters
 *   node sign-url.js "http://localhost:3000/images/123?format=webp&quality=high" -k my-key
 */

import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';

// Parse command line arguments - handle --help/-h first
const args = process.argv.slice(2);

// Check for help flags anywhere in args
const hasHelpFlag = args.some(arg => arg === '--help' || arg === '-h');

if (hasHelpFlag) {
  console.log(`
Signed URL Generator

Signs URLs for private image access using configured keys.
Accepts complete URLs including query parameters as input.

Usage:
  node sign-url.js <url> [options]

Arguments:
  <url>                      Complete URL to sign (required)

Options:
  --key-id, -k              Key ID from config (if using config file)
  --algorithm, -a           Algorithm: HMAC-SHA256 or ED25519
  --secret, -s              Secret key for signing (if not using config)
  --public-key, -p          Public key (for ED25519 verification)
  --method, -m              HTTP method: GET, POST, PUT, DELETE, etc. (default: GET)
  --expires-in, -e          Expiration time in seconds (default: 3600 = 1 hour)
  --config-path, -c         Path to config.yaml file (default: ./config.yaml)
  --help, -h                Show this help message

Examples:
  # Sign with key from config
  node sign-url.js "http://localhost:3000/images/123/presets/small" -k my-key

  # Sign with direct secret
  node sign-url.js "http://localhost:3000/images/123" -a HMAC-SHA256 -s my-secret -k my-key

  # Sign POST request
  node sign-url.js "http://localhost:3000/api/upload" -k my-key -m POST

  # Sign with custom expiration
  node sign-url.js "http://localhost:3000/images/123" -k my-key -e 7200

  # Sign URL with existing query parameters
  node sign-url.js "http://localhost:3000/images/123?format=webp&quality=high" -k my-key
`);
  process.exit(0);
}

// Now parse arguments normally
const options = {
  keyId: null,
  algorithm: null,
  secret: null,
  publicKey: null,
  method: 'GET',
  expiresIn: 3600,
  configPath: './config.yaml',
};

// Find the URL argument (first non-flag argument)
let urlArg = null;
const flagArgs = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg.startsWith('-')) {
    flagArgs.push(arg);
    // Push the next arg as value if it doesn't start with -
    if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
      flagArgs.push(args[i + 1]);
      i++;
    }
  } else if (!urlArg) {
    urlArg = arg;
  }
}

// If we didn't find a URL, error
if (!urlArg) {
  console.error('Error: URL argument is required');
  console.error('Usage: node sign-url.js <url> [options]');
  console.error('Try: node sign-url.js --help');
  process.exit(1);
}

// Parse flag arguments
for (let i = 0; i < flagArgs.length; i++) {
  const arg = flagArgs[i];
  const nextArg = i + 1 < flagArgs.length ? flagArgs[i + 1] : null;
  
  switch (arg) {
    case '--key-id':
    case '-k':
      options.keyId = nextArg;
      i++;
      break;
    case '--algorithm':
    case '-a':
      options.algorithm = nextArg;
      i++;
      break;
    case '--secret':
    case '-s':
      options.secret = nextArg;
      i++;
      break;
    case '--public-key':
    case '-p':
      options.publicKey = nextArg;
      i++;
      break;
    case '--method':
    case '-m':
      options.method = nextArg?.toUpperCase();
      i++;
      break;
    case '--expires-in':
    case '-e':
      options.expiresIn = parseInt(nextArg, 10) || 3600;
      i++;
      break;
    case '--config-path':
    case '-c':
      options.configPath = nextArg;
      i++;
      break;
    case '--help':
    case '-h':
      // Already handled above
      break;
    default:
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
  }
}

// Validate method
const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
if (options.method && !validMethods.includes(options.method)) {
  console.error(`Invalid HTTP method: ${options.method}. Valid methods: ${validMethods.join(', ')}`);
  process.exit(1);
}

// Parse the input URL to extract path and query parameters
function parseUrl(url) {
  // Add protocol if missing (assume http)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://placeholder.local${url.startsWith('/') ? '' : '/'}${url}`;
  }
  
  const urlObj = new URL(url);
  
  // Extract path
  const path = urlObj.pathname;
  
  // Parse query parameters
  const queryParams = {};
  urlObj.searchParams.forEach((value, key) => {
    if (queryParams[key]) {
      // Handle multiple values for same key
      if (Array.isArray(queryParams[key])) {
        queryParams[key].push(value);
      } else {
        queryParams[key] = [queryParams[key], value];
      }
    } else {
      queryParams[key] = value;
    }
  });
  
  return { path, queryParams, urlObj };
}

// Build signature payload
function buildSignaturePayload(method, path, queryParams) {
  const EXCLUDED_QUERY_PARAMS = new Set(['x-kid', 'x-expires', 'x-signature']);
  
  // Filter out excluded parameters
  const filteredQuery = {};
  for (const [key, value] of Object.entries(queryParams)) {
    if (EXCLUDED_QUERY_PARAMS.has(key) || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      filteredQuery[key] = value.join(',');
    } else {
      filteredQuery[key] = value;
    }
  }
  
  // Sort keys alphabetically
  const sortedKeys = Object.keys(filteredQuery).sort();
  
  // Build query string
  const queryStringParts = [];
  for (const key of sortedKeys) {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(filteredQuery[key]);
    queryStringParts.push(`${encodedKey}=${encodedValue}`);
  }
  const queryString = queryStringParts.join('&');
  
  return `${method}\n${path}\n${queryString}`;
}

// Sign payload
function signPayload(payload, key) {
  if (key.algorithm === 'HMAC-SHA256') {
    return crypto
      .createHmac('sha256', key.secret)
      .update(payload)
      .digest('hex');
  }
  
  if (key.algorithm === 'ED25519') {
    // For this script, we use HMAC as fallback for ED25519
    // since Node.js crypto has limited ED25519 support
    console.warn('Note: Using HMAC-style signing for ED25519. For production ED25519, use a proper library.');
    return crypto
      .createHmac('sha256', key.secret)
      .update(payload)
      .digest('hex');
  }
  
  throw new Error(`Unsupported algorithm: ${key.algorithm}`);
}

// Load keys from config file
function loadKeysFromConfig(configPath) {
  try {
    const configPathResolved = resolve(process.cwd(), configPath);
    const configContent = readFileSync(configPathResolved, 'utf8');
    const config = yaml.load(configContent);
    
    if (config?.signed_urls?.keys) {
      return config.signed_urls.keys;
    }
    return [];
  } catch (error) {
    console.warn(`Warning: Could not load config from ${configPath}: ${error.message}`);
    return [];
  }
}

// Find key by ID
function findKeyById(keys, keyId) {
  return keys.find(k => k.id === keyId);
}

// Main function
async function main() {
  // Parse the URL
  const { path, queryParams, urlObj } = parseUrl(urlArg);
  
  let key = null;
  
  // If algorithm and secret are provided directly, use them
  if (options.algorithm && options.secret) {
    key = {
      id: options.keyId || crypto.randomUUID(),
      algorithm: options.algorithm,
      secret: options.secret,
      publicKey: options.publicKey,
    };
  } else if (options.keyId) {
    // Otherwise, try to load from config
    const keys = loadKeysFromConfig(options.configPath);
    key = findKeyById(keys, options.keyId);
    
    if (!key) {
      console.error(`Error: Key with ID '${options.keyId}' not found in ${options.configPath}`);
      process.exit(1);
    }
  }
  
  // If still no key, error
  if (!key) {
    console.error('Error: Either --key-id (with config) or --algorithm and --secret are required');
    process.exit(1);
  }
  
  // Validate key
  if (!key.secret) {
    console.error('Error: Key secret is required');
    process.exit(1);
  }
  
  // Validate algorithm
  if (key.algorithm !== 'HMAC-SHA256' && key.algorithm !== 'ED25519') {
    console.error(`Error: Unsupported algorithm: ${key.algorithm}. Supported: HMAC-SHA256, ED25519`);
    process.exit(1);
  }
  
  // Build signature payload
  const payload = buildSignaturePayload(options.method, path, queryParams);
  
  // Generate signature
  const signature = signPayload(payload, key);
  
  // Calculate expiration timestamp (in milliseconds for compatibility with server)
  const expiresAt = Date.now() + (options.expiresIn * 1000);
  
  // Build the signed URL
  // Remove existing signature parameters
  urlObj.searchParams.delete('x-kid');
  urlObj.searchParams.delete('x-expires');
  urlObj.searchParams.delete('x-signature');
  
  // Add signature parameters
  urlObj.searchParams.set('x-kid', key.id);
  urlObj.searchParams.set('x-expires', Math.floor(expiresAt).toString());
  urlObj.searchParams.set('x-signature', signature);
  
  // Output the signed URL
  console.log(urlObj.toString());
}

// Run
main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
