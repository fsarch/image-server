# Signed URLs

Signed URLs provide temporary access to **private** images by including cryptographic signatures in the URL query parameters. This allows you to share private images without making them publicly accessible or requiring authentication for each request.

## Overview

The image server can serve both **public** and **private** images. By default, only public images are accessible through the standard endpoints. Signed URLs enable temporary access to private images by appending special query parameters to the URL.

### Use Cases

- Share private images with specific users for a limited time
- Generate time-limited access tokens for private content
- Integrate with CDNs or caching layers that don't support authentication headers
- Embed private images in external systems (emails, third-party websites)

## Configuration

Signed URLs must be enabled and configured in your `config.yaml` file:

```yaml
signed_urls:
  enabled: true
  keys:
    - id: 'key1'
      algorithm: 'HMAC-SHA256'
      secret: 'your-secret-key'
    - id: 'key2'
      algorithm: 'ED25519'
      secret: 'your-private-key-in-hex-or-base64'
      publicKey: 'your-public-key-in-hex-or-base64'
```

### Generating Keys

Use the provided script to generate cryptographically secure keys:

```bash
# Generate a single HMAC-SHA256 key
node docs/generate-signed-url-keys.js

# Generate an ED25519 key pair with custom ID
node docs/generate-signed-url-keys.js -a ED25519 -i my-ed25519-key

# Generate 3 HMAC keys
node docs/generate-signed-url-keys.js -a HMAC-SHA256 -c 3

# Generate keys in JSON format
node docs/generate-signed-url-keys.js -f json

# Append generated keys directly to your config
node docs/generate-signed-url-keys.js >> config.yaml
```

The script outputs YAML by default, which can be directly copied into your `config.yaml` file.

### Signing URLs

Use the provided script to sign URLs with your configured keys:

```bash
# Sign URL with key from config
node docs/sign-url.js "http://localhost:3000/images/123/presets/small" -k my-key

# Sign URL with direct secret
node docs/sign-url.js "http://localhost:3000/images/123" -a HMAC-SHA256 -s my-secret -k my-key

# Sign URL with existing query parameters (they are automatically included in signature)
ode docs/sign-url.js "http://localhost:3000/images/123?format=webp&quality=high" -k my-key

# Sign POST request
node docs/sign-url.js "http://localhost:3000/api/upload" -k my-key -m POST

# Sign with custom expiration (in seconds, default: 3600 = 1 hour)
node docs/sign-url.js "http://localhost:3000/images/123" -k my-key -e 300

# Use custom config file path
node docs/sign-url.js "http://localhost:3000/images/123" -k my-key -c ./config.yaml
```

**Script Options:**
- `<url>` - Complete URL to sign (required)
- `-k, --key-id` - Key ID from config file
- `-a, --algorithm` - Algorithm: HMAC-SHA256 or ED25519
- `-s, --secret` - Secret key (for direct signing without config)
- `-m, --method` - HTTP method: GET, POST, PUT, DELETE, etc. (default: GET)
- `-e, --expires-in` - Expiration time in seconds (default: 3600)
- `-c, --config-path` - Path to config.yaml file (default: ./config.yaml)
- `-h, --help` - Show help message

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `enabled` | boolean | Yes | Enable or disable signed URL functionality |
| `keys` | array | Yes | Array of signing key configurations |

### Key Configuration

Each key object supports the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the key (used in `x-kid` parameter) |
| `algorithm` | string | Yes | Signing algorithm: `HMAC-SHA256` or `ED25519` |
| `secret` | string | Yes | The secret/private key used for signing |
| `publicKey` | string | Yes (for ED25519) | The public key used for verification |

**Note:** For HMAC-SHA256, only `secret` is required. For ED25519, both `secret` (private key) and `publicKey` must be provided.

## Query Parameters

Signed URLs include three special query parameters:

| Parameter | Description |
|-----------|-------------|
| `x-kid` | Key identifier - references a key in the configuration |
| `x-expires` | Expiration timestamp - Unix timestamp in milliseconds |
| `x-signature` | Cryptographic signature - hex-encoded signature of the request |

### Example URL

```
https://your-image-server.com/images/123e4567-e89b-12d3-a456-426614174000/presets/small?x-kid=key1&x-expires=1712345678900&x-signature=abc123def456...
```

## Building Signed URLs Manually

To build a signed URL manually, you need to:

1. **Construct the signature payload**
2. **Sign the payload** with your secret key
3. **Build the final URL** with query parameters

### Step 1: Construct the Signature Payload

The payload is constructed as:

```
{METHOD}\n{PATH}\n{QUERY_STRING}
```

**Rules:**
- `METHOD` is the HTTP method in uppercase (typically `GET`)
- `PATH` is the URL path (e.g., `/images/123/presets/small`)
- `QUERY_STRING` is the URL-encoded query string **excluding** `x-kid`, `x-expires`, and `x-signature`
- Query parameters are **sorted alphabetically by key**
- Multiple values for the same key are **joined with commas**

#### Example

Request:
```
GET /images/123/presets/small?quality=high&format=webp
```

Payload:
```
GET
/images/123/presets/small
format=webp&quality=high
```

### Step 2: Sign the Payload

Use your secret key to create a signature of the payload.

#### HMAC-SHA256 (Recommended)

**Node.js:**
```javascript
import crypto from 'node:crypto';

const payload = 'GET\n/images/123/presets/small\nformat=webp&quality=high';
const secret = 'your-secret-key';

const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

console.log(signature); // e.g., "abc123def456..."
```

**Python:**
```python
import hmac
import hashlib

payload = b'GET\n/images/123/presets/small\nformat=webp&quality=high'
secret = b'your-secret-key'

signature = hmac.new(secret, payload, hashlib.sha256).hexdigest()
print(signature)  # e.g., "abc123def456..."
```

**Bash:**
```bash
echo -n 'GET
/images/123/presets/small
format=webp&quality=high' | openssl dgst -sha256 -hmac "your-secret-key" -hex
```

#### ED25519 (Advanced)

ED25519 requires proper key formatting and is more complex to use directly. We recommend using HMAC-SHA256 unless you have specific requirements for ED25519.

### Step 3: Build the Final URL

Combine the path with the three required query parameters:

```
{path}?x-kid={keyId}&x-expires={timestamp}&x-signature={signature}&{otherParams}
```

#### Example

```
/images/123/presets/small?x-kid=key1&x-expires=1712345678900&x-signature=abc123def456...&quality=high&format=webp
```

**Complete Code Example (Node.js):**

```javascript
import crypto from 'node:crypto';

function buildSignedUrl(path, keyId, secret, expiresIn = 3600, additionalParams = {}) {
  const method = 'GET';
  
  // Sort additional params alphabetically
  const sortedParams = Object.entries(additionalParams)
    .sort(([a], [b]) => a.localeCompare(b));
  
  // Build query string
  const queryParts = [];
  for (const [key, value] of sortedParams) {
    queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  const queryString = queryParts.join('&');
  
  // Build payload
  const payload = `${method}\n${path}\n${queryString}`;
  
  // Sign payload
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  // Build URL
  const expiresAt = Date.now() + expiresIn * 1000;
  const urlParams = new URLSearchParams({
    'x-kid': keyId,
    'x-expires': Math.floor(expiresAt).toString(),
    'x-signature': signature,
    ...additionalParams,
  });
  
  return `${path}?${urlParams.toString()}`;
}

// Usage
const url = buildSignedUrl(
  '/images/123/presets/small',
  'key1',
  'your-secret-key',
  3600, // 1 hour
  { quality: 'high', format: 'webp' }
);

console.log(url);
// /images/123/presets/small?x-kid=key1&x-expires=1712345678900&x-signature=abc123...&format=webp&quality=high
```

## Validation Process

When a request is received, the server:

1. **Extracts** `x-kid`, `x-expires`, and `x-signature` from the query parameters
2. **Validates** that `x-kid` references a known key in the configuration
3. **Validates** that `x-expires` is a valid Unix timestamp in the future
4. **Reconstructs** the payload from the request (excluding signature parameters)
5. **Verifies** the signature using the key's secret/public key
6. **Grants access** to private images if all validations pass

## Security Considerations

### Key Management

- **Keep secrets secure**: Never commit secret keys to version control
- **Rotate keys**: Use multiple keys and rotate them periodically
- **Key IDs**: Use meaningful but non-sensitive IDs for keys

### URL Expiration

- **Short-lived URLs**: Use short expiration times (minutes to hours, not days)
- **Clock skew**: The server allows up to 60 seconds of clock difference between servers
- **Past timestamps**: URLs with past timestamps are immediately rejected

### Signature Security

- **Constant-time comparison**: HMAC signatures use constant-time comparison to prevent timing attacks
- **Payload integrity**: The signature covers the method, path, and all query parameters
- **Excluded parameters**: `x-kid`, `x-expires`, and `x-signature` are NOT included in the payload to prevent circular dependencies

### Best Practices

1. **Use HTTPS**: Always use HTTPS to prevent interception of signed URLs
2. **Short expiration**: Keep expiration times as short as possible
3. **Limit key exposure**: Don't share secret keys; generate URLs server-side when possible
4. **Monitor usage**: Log signed URL accesses for auditing
5. **Rate limiting**: Consider adding rate limiting to prevent brute-force attacks

## API Integration

### Generating Signed URLs (Server-side)

The image server provides a service for generating signed URLs programmatically:

```typescript
import { SignedUrlService } from './signed-url/signed-url.service';

// In your service
const signedUrl = this.signedUrlService.generateSignedUrl(
  '/images/123/presets/small',
  {
    keyId: 'key1',
    expiresIn: 3600, // 1 hour in seconds
    queryParams: { quality: 'high' }
  }
);
```

### Validating Requests

The server automatically validates signed URL parameters for image requests. If a request has valid signed URL parameters, it can access private images.

## Error Handling

When a signed URL is invalid, the server returns a 404 Not Found response (same as for non-existent images). This prevents information leakage about whether an image exists or not.

Common validation failures:
- Missing required parameters (`x-kid`, `x-expires`, `x-signature`)
- Unknown key ID
- Expired timestamp
- Invalid signature

## Troubleshooting

### "Image not found" errors

If you're getting 404 errors for private images:
1. Verify signed URLs are enabled in configuration
2. Check that `x-kid` references a valid key
3. Verify the timestamp is in the future
4. Ensure the signature is computed correctly
5. Confirm the payload construction matches the server's expectations

### Signature mismatch

If signatures don't match:
1. Ensure the payload is constructed identically on both sides
2. Check that query parameters are sorted alphabetically
3. Verify that special characters in query parameters are URL-encoded
4. Ensure you're using the same secret key for signing and verification
5. Check that `x-kid`, `x-expires`, and `x-signature` are excluded from the payload

### Testing

You can test your signed URL generation by:

1. Generating a signed URL
2. Making a GET request to that URL
3. Verifying you receive the image (200 response)

Example using curl:

```bash
curl "https://your-image-server.com/images/123/presets/small?x-kid=key1&x-expires=1712345678900&x-signature=abc123def456..."
```

## Migration Notes

### From Previous Versions

If you're upgrading from a version without signed URL support:
1. Add the `signed_urls` configuration to your `config.yaml`
2. Private images remain inaccessible until you generate signed URLs
3. Existing public images continue to work without changes

## Reference

- [HMAC on Wikipedia](https://en.wikipedia.org/wiki/HMAC)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [RFC 2104: HMAC](https://www.rfc-editor.org/rfc/rfc2104)
