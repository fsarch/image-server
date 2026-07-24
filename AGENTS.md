# Image Server - Project Summary

## 📁 Project Structure

```
image-server/
├── src/
│   ├── constants/                  # Enums and constants
│   │   ├── role.enum.ts          # Role definitions
│   │   └── visibility.enum.ts    # public/private Visibility
│   │
│   ├── database/                  # Database layer
│   │   ├── entities/              # TypeORM Entities
│   │   │   ├── image.entity.ts           # Main image entity
│   │   │   ├── image-cache.entity.ts    # Cache table
│   │   │   ├── image-preset.entity.ts    # Preset configurations
│   │   │   ├── image-tag.entity.ts       # Image-tag mapping
│   │   │   ├── slug.entity.ts            # URL slugs
│   │   │   └── tag-definition.entity.ts  # Predefined tag keys
│   │   ├── migrations/           # Database migrations
│   │   │   ├── 1719665254677-base-tables.migration.ts
│   │   │   └── 1784408015000-add-image-metadata-and-tags.migration.ts
│   │   └── index.ts              # Entity/Migration registration
│   │
│   ├── models/                   # DTOs and Models
│   │   └── image.model.ts        # ImageDto, ImageTagDto, TagDefinitionDto
│   │
│   ├── admin/images/             # Admin API
│   │   ├── admin-images.controller.ts   # Admin endpoints
│   │   ├── admin-images.service.ts      # Admin service logic
│   │   └── admin-images.module.ts       # Admin module
│   │
│   ├── image/                    # Public API
│   │   ├── image.controller.ts   # Public image delivery
│   │   ├── image.service.ts      # Image resolve logic
│   │   └── image.module.ts       # Image module
│   │
│   ├── signed-url/               # Signed URL functionality
│   │   ├── signed-url.module.ts  # Signed URL module
│   │   └── signed-url.service.ts # Signed URL generation and validation
│   │
│   ├── cache/                    # Caching
│   ├── storage/                  # Storage providers (FS, S3)
│   ├── utils/                    # Utility functions
│   │   └── signed-url.utils.ts  # Payload building, signing, verification
│   └── types/                    # TypeScript types
│
└── docs/
    ├── signed-urls.md            # Signed URLs documentation
    ├── generate-signed-url-keys.js # Key generation script
    └── sign-url.js               # URL signing script
└── package.json
```

---

## 🗃️ Database Schema

### Tables

#### `image` (Main Image Table)
| Column | Type | Nullable | Default | Index | Description |
|--------|-----|----------|---------|-------|--------------|
| `id` | uuid | ❌ | - | PK | Unique ID |
| `file_size` | integer | ❌ | - | - | File size in bytes |
| `width` | integer | ❌ | - | - | Image width |
| `height` | integer | ❌ | - | - | Image height |
| `mime_type` | varchar(128) | ❌ | - | - | MIME type |
| `md5` | varchar(32) | ❌ | - | - | MD5 hash |
| `has_alpha` | boolean | ❌ | - | - | Alpha channel |
| `has_animation` | boolean | ❌ | - | - | Animation |
| `is_public` | boolean | ❌ | true | ✅ | Visibility (public/private) |
| `external_id` | varchar(2048) | ✅ | null | ✅ | External reference ID |
| `creation_time` | timestamp | ❌ | now() | - | Creation timestamp |
| `deletion_time` | timestamp | ✅ | null | - | Soft-delete timestamp |

#### `tag_definition` (Predefined Tag Keys)
| Column | Type | Nullable | Default | Index | Description |
|--------|-----|----------|---------|-------|--------------|
| `id` | uuid | ❌ | - | PK | Unique ID |
| `key` | varchar(2048) | ❌ | - | ✅ UNIQUE | Tag key (unique) |
| `description` | text | ✅ | null | - | Description |
| `creation_time` | timestamp | ❌ | now() | - | Creation timestamp |

#### `image_tag` (Image-Tag Mapping)
| Column | Type | Nullable | Default | Index | Description |
|--------|-----|----------|---------|-------|--------------|
| `id` | uuid | ❌ | - | PK | Unique ID |
| `image_id` | uuid | ❌ | - | ✅ | Foreign key to image |
| `tag_definition_id` | uuid | ❌ | - | ✅ | Foreign key to tag_definition |
| `value` | varchar(4096) | ❌ | - | ✅ | Tag value |
| `creation_time` | timestamp | ❌ | now() | - | Creation timestamp |

**Important:** There is **NO** unique constraint on `(image_id, tag_definition_id)` because a tag key can be assigned multiple times to an image with different values.

#### `slug` (URL Slugs)
| Column | Type | Nullable | Default | Index | Description |
|--------|-----|----------|---------|-------|--------------|
| `slug` | varchar(2048) | ❌ | - | PK | URL slug |
| `image_id` | uuid | ❌ | - | ✅ | Foreign key to image |

#### `image_cache` (Cache Table)
| Column | Type | Nullable | Default | Index | Description |
|--------|-----|----------|---------|-------|--------------|
| `image_id` | uuid | ❌ | - | PK | Foreign key to image |
| `image_preset_id` | varchar(128) | ❌ | - | PK | Foreign key to image_preset |
| `mime_type` | varchar(128) | ❌ | - | PK | MIME type |
| `file_size` | integer | ❌ | - | - | Cache file size |
| `md5` | varchar(32) | ❌ | - | - | MD5 hash |
| `creation_time` | timestamp | ❌ | now() | - | Creation timestamp |

#### `image_preset` (Preset Configurations)
| Column | Type | Nullable | Default | Index | Description |
|--------|-----|----------|---------|-------|--------------|
| `id` | varchar(128) | ❌ | - | PK | Preset ID |

---

## 🎯 Important Decisions & Conventions

### Visibility
- **Enum:** `Visibility.public` / `Visibility.private`
- **Database:** `is_public: boolean` (default: true)
- **Upload:** `x-visibility` header (public/private)
- **Access Control:** Private images are not delivered in public endpoints (404)
- **Signed URLs:** Private images can be accessed via signed URLs with valid `x-kid`, `x-expires`, `x-signature` parameters

### External ID
- **Field:** `external_id: varchar(2048), nullable: true`
- **Unique:** ❌ NO (can be duplicated)
- **Upload:** `x-external-id` header (optional)

### Tags
- **Structure:** Two tables (`tag_definition`, `image_tag`)
- **Tag Key:** Unique in `tag_definition`
- **Tag Value:** Can differ per image
- **Duplicate Tags:** A key can be assigned multiple times to an image with different values
- **Upload:** `x-tags` header (JSON: `[{key: "color", value: "red"}]`)
- **Filter:** `tag[]=key%3Dvalue` (URL-encoded, e.g., `color%3Dred`)

### Pagination
- **Utils:** `@fsarch/server/pagination`
- **Return:** `PaginationResultDto<T>` with `data` and `metadata`
- **Metadata:** `currentPage`, `pageSize`, `totalItems`, `totalPages`
- **Decorator:** `@ApiOkPaginatedResponse(ImageDto)` for Swagger

### Database
- **ORM:** TypeORM
- **Migrations:** Database-independent (no custom SQL, only TypeORM functions)
- **Timestamp:** JavaScript timestamp in milliseconds for migration class names
- **Soft-Delete:** `deletion_time` for Image entity

---

## 🔌 API Endpoints

### Public Endpoints (no Auth)
| Method | Route | Description |
|---------|-------|--------------|
| GET | `/images/resolve/*slug` | Get image via slug |
| GET | `/images/{id}/presets/{presetAlias}` | Get image with preset |

**Security:** Both endpoints check `is_public` and do not deliver private images (404). **Exception:** Private images can be accessed with valid signed URL parameters (`x-kid`, `x-expires`, `x-signature`).

---

### Admin Endpoints (AuthGuard + Roles)

#### Images
| Method | Route | Description |
|---------|-------|--------------|
| GET | `/admin/images` | List all images (with filter & pagination) |
| GET | `/admin/images/{id}` | Get single image |
| GET | `/admin/images/{id}/raw` | Get raw image |
| POST | `/admin/images/_actions/upload` | Upload image |
| DELETE | `/admin/images/{id}` | Delete image |

**Query Parameters for GET /admin/images:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)
- `isPublic` - Filter by visibility (true/false)
- `tag` - Tag filter (URL-encoded, e.g., `color%3Dred`). Can be repeated: `?tag=color%3Dred&tag=size%3Dlarge`
- `embed` - Embedded data (`tags`, `slugs`). Can be repeated: `?embed=tags&embed=slugs`

**Headers for POST /admin/images/_actions/upload:**
- `x-visibility` - public/private (default: public)
- `x-external-id` - External ID (optional)
- `x-tags` - Tags as JSON string (optional)

#### Tag Management
| Method | Route | Description |
|---------|-------|--------------|
| GET | `/admin/images/tags/definitions` | Get all tag definitions |
| POST | `/admin/images/tags/definitions` | Create new tag definition |
| GET | `/admin/images/{id}/tags` | Get tags of an image |
| POST | `/admin/images/{id}/tags` | Add tag to image |
| DELETE | `/admin/images/{id}/tags/{tagId}` | Remove tag from image |

---

## 🔧 Technical Details

### Entity Relationships
```
Image 1──┬─── many Slug
         ├── many ImageTag
         └── many ImageCache

TagDefinition 1──┬─── many ImageTag
                 └── (no further relationship)

ImageTag Many────1 Image
ImageTag Many────1 TagDefinition
```

### Indexes
| Table | Index | Column(s) | Type |
|---------|-------|----------|-----|
| image | IDX_image_is_public | is_public | Standard |
| image | IDX_image_external_id | external_id | Standard |
| tag_definition | IDX_tag_definition_key | key | UNIQUE |
| image_tag | IDX_image_tag_image_id | image_id | Standard |
| image_tag | IDX_image_tag_tag_definition_id | tag_definition_id | Standard |
| image_tag | IDX_image_tag_value | value | Standard |
| image_tag | IDX_image_tag_image_id_tag_definition_id | (image_id, tag_definition_id) | Standard |

### Validation
- **Tag Keys:** `^[a-zA-Z0-9_-]+$` (alphanumeric + underscore + hyphen)
- **Tag Values:** Arbitrary, max 4096 characters
- **Pagination Limit:** Max 100 per page

---

## 📦 Dependencies

### External Packages
- `@nestjs/common`, `@nestjs/core`, `@nestjs/typeorm` - NestJS Framework
- `typeorm` - ORM for database access
- `sharp` - Image processing
- `@fsarch/server` - Auth, Pagination Utils, etc.

### Internal Modules
- `DatabaseModule` - TypeORM Configuration
- `StorageModule` - Storage providers (FS, S3)
- `CacheModule` - Caching

---

## 💡 Best Practices & Patterns

1. **Database Independence:** Migrations use only TypeORM functions, no custom SQL
2. **Soft-Delete:** Images are not physically deleted, but marked with `deletion_time`
3. **Security through Obscurity:** Private images return 404 (not 403) in public endpoints
4. **Prefix Indexes:** For long VARCHAR fields, prefix indexes can be used
5. **Transactions:** Upload operations should be executed in a transaction
6. **Validation:** Tag keys are validated before saving
7. **Error Handling:** Clear error codes (400 for validation, 404 for not found, 409 for conflicts)
8. **Documentation:** Any changes to signed URL signature generation or validation **MUST** be documented in `docs/signed-urls.md`

---

## 🔄 Migrations

### Base Migration (1719665254677)
- Creates the base tables: `image`, `image_preset`, `slug`, `image_cache`

### Tag Migration (1784408015000)
- Adds `is_public` and `external_id` to the `image` table
- Creates `tag_definition` and `image_tag` tables
- Creates all necessary indexes and foreign keys

**Note:** Migration class names use JavaScript timestamp in milliseconds.

---

## 📝 Changelog (Recent Changes)

### Added
- **Signed URLs:** Temporary access to private images via cryptographically signed URLs with `x-kid`, `x-expires`, `x-signature` parameters
- **Signed URL Utilities:** `buildSignaturePayload()`, `sign()`, `verify()` functions for manual URL generation
- **Signed URL Service:** `SignedUrlService` for server-side generation and validation
- **Signed URL Documentation:** Complete guide in `docs/signed-urls.md`
- **Key Generation Script:** `docs/generate-signed-url-keys.js` for generating HMAC-SHA256 and ED25519 keys
- **URL Signing Script:** `docs/sign-url.js` for signing URLs with existing keys (accepts complete URLs with query params, supports custom method)
- **Visibility System:** `is_public` field with `x-visibility` header
- **External ID:** `external_id` field with `x-external-id` header
- **Tag System:** Predefined tags with `tag_definition` and `image_tag` tables
- **Tag Filtering:** URL-encoded tag filter (`tag[]=key%3Dvalue`)
- **Pagination:** `@fsarch/server/pagination` integration
- **Single Image Endpoint:** GET `/admin/images/{id}` with embed support
- **Embed Tags:** `embed=tags` for list and single endpoints

### Changed
- **Config Types:** Added `signed_urls` configuration with `ConfigSignedUrlsType` and `ConfigSignedUrlKeyType`
- **Image Entity:** Two new fields (`is_public`, `external_id`) with indexes
- **Upload Logic:** Extended with visibility, external ID and tags
- **List Endpoint:** Now with pagination and tag filtering
- **Database:** New tables and indexes
- **Image Service:** Added `allowPrivate` option to `resolveImage()` for signed URL access

---

## 🎯 Next Steps / Open Tasks

- [ ] Run migrations
- [ ] Write tests for new endpoints
- [ ] Write tests for tag filtering and pagination
- [ ] Performance tests with many tags
- [ ] Optional: Prefix indexes for long VARCHAR fields
- [ ] Optional: Full-text search for tag values
