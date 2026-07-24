# Image Server - Requirements

This document outlines the functional and non-functional requirements for the Image Server project, including the Signed URLs feature.

## Table of Contents

- [General Requirements](#general-requirements)
- [Image Management Requirements](#image-management-requirements)
- [Signed URLs Requirements](#signed-urls-requirements)
- [Security Requirements](#security-requirements)
- [Performance Requirements](#performance-requirements)
- [Documentation Requirements](#documentation-requirements)

---

## General Requirements

### System Requirements
- **Node.js Version**: >= 18.x (recommended: 20.x or 24.x)
- **TypeScript**: >= 5.x
- **NestJS**: >= 11.x
- **Database**: SQLite, PostgreSQL, or CockroachDB
- **Storage**: Filesystem or S3-compatible object storage

### Framework Requirements
- **Web Framework**: NestJS
- **ORM**: TypeORM
- **Image Processing**: Sharp
- **Configuration**: YAML-based with Joi validation

---

## Image Management Requirements

### Functional Requirements

#### Image Upload
- [x] Users shall be able to upload images via API
- [x] Upload endpoint: `POST /admin/images/_actions/upload`
- [x] Support for metadata extraction (width, height, mime type, file size)
- [x] Support for MD5 hash calculation
- [x] Support for alpha channel detection
- [x] Support for animation detection

#### Image Metadata
- [x] Store image dimensions (width, height)
- [x] Store file size in bytes
- [x] Store MIME type
- [x] Store MD5 hash
- [x] Store creation timestamp
- [x] Support soft-delete with deletion timestamp

#### Visibility Control
- [x] Support public images (accessible without authentication)
- [x] Support private images (accessible only via signed URLs or admin API)
- [x] Visibility controlled via `is_public` boolean field
- [x] Default visibility: public
- [x] Upload header: `x-visibility: public|private`

#### Image Delivery
- [x] Public endpoint: `GET /images/resolve/*slug`
- [x] Public endpoint: `GET /images/{id}/presets/{presetAlias}`
- [x] Support for URL slugs
- [x] Support for preset-based delivery
- [x] Automatic image resizing based on preset
- [x] Dynamic format conversion
- [x] Support for caching of processed images

#### Presets
- [x] Configurable presets with alias, width, height, algorithm
- [x] Support for sizing algorithms: contain, cover, inside, outside
- [x] Support for on-demand conversion
- [x] Support for cached conversion

#### Tagging
- [x] Support for predefined tag keys
- [x] Support for tag values per image
- [x] Support for multiple values per tag key on single image
- [x] Tag filtering on list endpoint
- [x] Upload header: `x-tags` (JSON array)

#### Admin API
- [x] List images: `GET /admin/images`
- [x] Get single image: `GET /admin/images/{id}`
- [x] Get raw image: `GET /admin/images/{id}/raw`
- [x] Upload image: `POST /admin/images/_actions/upload`
- [x] Delete image: `DELETE /admin/images/{id}`
- [x] List tag definitions: `GET /admin/images/tags/definitions`
- [x] Create tag definition: `POST /admin/images/tags/definitions`
- [x] Get image tags: `GET /admin/images/{id}/tags`
- [x] Add tag to image: `POST /admin/images/{id}/tags`
- [x] Remove tag from image: `DELETE /admin/images/{id}/tags/{tagId}`

#### Pagination
- [x] Support for paginated responses
- [x] Configurable page size (default: 50, max: 100)
- [x] Query parameters: `page`, `limit`
- [x] Metadata: `currentPage`, `pageSize`, `totalItems`, `totalPages`

#### Filtering
- [x] Filter by visibility: `isPublic=true|false`
- [x] Filter by tags: `tag=key%3Dvalue` (URL-encoded)
- [x] Multiple tag filters supported
- [x] Embed related data: `embed=tags&embed=slugs`

---

## Signed URLs Requirements

### Functional Requirements

#### Configuration
- [x] Signed URLs shall be configurable via `signed_urls` section in config.yaml
- [x] Support `enabled` flag to enable/disable feature
- [x] Support multiple signing keys
- [x] Each key shall have:
  - [x] Unique `id` identifier
  - [x] `algorithm`: HMAC-SHA256 or ED25519
  - [x] `secret`: signing secret/private key
  - [x] `publicKey`: public key (for ED25519)

#### Key Management
- [x] Support for generating new signing keys via script
- [x] Script: `docs/generate-signed-url-keys.js`
- [x] Support HMAC-SHA256 key generation
- [x] Support ED25519 key pair generation
- [x] Output in YAML format for direct config inclusion
- [x] Output in JSON format for programmatic use

#### URL Signing
- [x] Support for signing complete URLs including query parameters
- [x] Script: `docs/sign-url.js`
- [x] Accept URL as first argument
- [x] Support loading keys from config file
- [x] Support direct key parameters (algorithm, secret)
- [x] Support custom HTTP method (default: GET)
- [x] Support custom expiration time (default: 3600 seconds = 1 hour)
- [x] Automatically extract and include existing query parameters in signature
- [x] Remove existing signature parameters before signing

#### Query Parameters
- [x] Use `x-kid` parameter for key identifier
- [x] Use `x-expires` parameter for expiration timestamp (Unix timestamp in milliseconds)
- [x] Use `x-signature` parameter for hex-encoded signature
- [x] Exclude `x-kid`, `x-expires`, `x-signature` from signature payload

#### Payload Construction
- [x] Payload format: `{method}\n{path}\n{queryString}`
- [x] Query parameters sorted alphabetically by key
- [x] Multiple values for same key joined with commas
- [x] Query parameters URL-encoded
- [x] HTTP method in uppercase

#### Signature Algorithms
- [x] Support HMAC-SHA256
  - [x] Use `crypto.createHmac('sha256', secret)`
  - [x] Output hex-encoded signature
- [x] Support ED25519
  - [x] Use private key for signing
  - [x] Use public key for verification
  - [x] Fallback to HMAC for compatibility

#### Validation
- [x] Validate `x-kid` exists in configured keys
- [x] Validate `x-expires` is a valid numeric Unix timestamp
- [x] Validate `x-expires` is in the future (with clock skew tolerance: 60 seconds)
- [x] Validate signature matches computed signature
- [x] Use constant-time comparison for HMAC to prevent timing attacks

#### Access Control
- [x] Private images shall be accessible via signed URLs
- [x] Signed URLs shall allow temporary access to private images
- [x] Without valid signature, private images shall return 404 (not 403)
- [x] Cache keys shall include signed URL validity to prevent cache poisoning

### Non-Functional Requirements

#### Security
- [x] Signed URL parameters shall not be included in signature payload
- [x] Signature shall cover HTTP method, path, and all query parameters
- [x] Use cryptographically secure random number generation for key generation
- [x] Use constant-time comparison for signature verification
- [x] Allow clock skew tolerance of 60 seconds for expiration validation

#### Performance
- [x] Signature generation shall be fast (< 100ms for typical payloads)
- [x] Signature validation shall be fast (< 100ms for typical payloads)
- [x] Support caching of signed URL validation results

#### Usability
- [x] Provide CLI scripts for key generation
- [x] Provide CLI scripts for URL signing
- [x] Provide comprehensive documentation
- [x] Provide examples in multiple languages (Node.js, Python, Bash)

---

## Security Requirements

### General
- [x] All private image access shall require authentication or valid signed URL
- [x] Signed URLs shall expire after configured time
- [x] Secret keys shall never be logged or exposed in error messages
- [x] Use HTTPS for all signed URL transmissions

### Authentication
- [x] Admin API shall require JWT authentication
- [x] Public endpoints shall not require authentication for public images
- [x] Public endpoints shall require valid signed URL for private images

### Authorization
- [x] Admin API shall check user permissions
- [x] Only users with `manage_images` permission can manage images

### Data Protection
- [x] Image metadata shall be stored securely
- [x] Secret keys shall be stored in configuration files (not in database)
- [x] Configuration files shall not be committed to version control with secrets

---

## Performance Requirements

### Image Delivery
- [x] Response time for cached images: < 100ms
- [x] Response time for uncached images: < 500ms
- [x] Support concurrent requests (minimum 100 concurrent connections)

### Caching
- [x] Support in-memory caching of resolved paths
- [x] Support in-memory caching of image data
- [x] Support configurable TTL for caches
- [x] Support cache invalidation

### Scalability
- [x] Support horizontal scaling with shared storage
- [x] Support S3-compatible storage for scalability
- [x] Stateless design (except for caching)

---

## Documentation Requirements

### Code Documentation
- [x] All public APIs shall have JSDoc comments
- [x] All complex functions shall have inline comments
- [x] All configuration options shall be documented

### User Documentation
- [x] README.md shall contain:
  - [x] Project overview
  - [x] Features list
  - [x] Installation instructions
  - [x] Configuration guide
  - [x] Running the app instructions
  - [x] API endpoint overview
  - [x] Link to detailed documentation
- [x] `docs/signed-urls.md` shall contain:
  - [x] Overview of signed URLs
  - [x] Configuration guide
  - [x] Manual URL building instructions
  - [x] Payload construction details
  - [x] Signature algorithms explanation
  - [x] Code examples in multiple languages
  - [x] Query parameter reference
  - [x] Security considerations
  - [x] Troubleshooting guide

### Script Documentation
- [x] `docs/generate-signed-url-keys.js` shall have:
  - [x] Usage instructions in header comment
  - [x] CLI options documentation
  - [x] Examples in header comment
- [x] `docs/sign-url.js` shall have:
  - [x] Usage instructions in header comment
  - [x] CLI options documentation
  - [x] Examples in header comment

---

## Compliance

This document serves as a living specification. All implemented features shall be marked with [x], and pending features shall be marked with [ ] for tracking purposes.

**Last Updated**: 2025-07-25
**Status**: All Signed URLs requirements implemented and verified
