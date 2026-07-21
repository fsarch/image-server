# Image Server

A NestJS-based image server with support for image uploads, tagging, visibility control, and preset-based delivery.

## Features

- **Image Upload**: Upload images with metadata, visibility settings, and tags
- **Visibility Control**: Public and private images with access control
- **Tag System**: Predefined tag keys with customizable values per image
- **Preset Delivery**: Serve images in different sizes and formats using presets
- **URL Slugs**: Human-readable URLs for images
- **Caching**: Automatic caching of processed images
- **Pagination**: Paginated API responses for image lists
- **Admin API**: Full CRUD operations for images and tags

## Installation

```bash
# Install dependencies
npm install

# Copy example configuration
cp example-data/config.yml config.yaml

# Update configuration in config.yaml as needed
```

## Configuration

The server uses a YAML configuration file (`config.yaml` by default). You can also set the `CONFIG_FILE_PATH` environment variable to use a different file.

### Configuration File Structure

Create a `config.yaml` file (or copy from `example-data/config.yml`):

```yaml
auth:
  type: 'jwt-jwk'
  jwkUrl: 'https://your-auth-provider/realms/your-realm/protocol/openid-connect/certs'

uac:
  type: 'static'
  users:
    - user_id: 'your-user-id'
      permissions:
        - manage_images

images:
  presets:
    - alias: small
      width: 256
      height: 256
      algorithm: contain
      conversion: on_demand
      cached: true

naming:
  type: named
  path: '##id##_##preset_alias##.##ext##'

storage:
  data:
    type: s3
    config:
      region: 'your-region'
      bucket: your-bucket
      accessKeyId: 'your-access-key'
      secretAccessKey: 'your-secret-key'
      endpoint: 'https://your-endpoint'
      prefix: 'images'
  cache: ./data/cache

caching:
  memory:
    enabled: true
    caches:
      resolve_path:
        ttl: 60000
      image_data:
        ttl: Infinity
  client:
    enabled: true
    options:
      max_age: 300000
      s_max_age: 3600000

database:
  type: cockroachdb
  host: 'localhost'
  username: image-server
  password: 'your-password'
  database: image-server
  ssl:
    rejectUnauthorized: false
```

See `example-data/config.yml` for a complete example configuration.

## Running the App

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run start:prod

# Build for production
npm run build
```

## Database Migrations

```bash
# Run pending migrations
npm run migration:run

# Generate new migration
npm run migration:generate -- --name=<migration-name>

# Revert last migration
npm run migration:revert
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/images/resolve/{slug}` | Get image by URL slug |
| GET | `/images/{id}/presets/{presetAlias}` | Get image with specific preset |

### Admin Endpoints

All admin endpoints require authentication and the `manage_images` role.

#### Images

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/images` | List all images (with filters and pagination) |
| GET | `/admin/images/{id}` | Get single image details |
| GET | `/admin/images/{id}/raw` | Get raw image file |
| POST | `/admin/images/_actions/upload` | Upload new image |
| DELETE | `/admin/images/{id}` | Delete image |

#### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/images/tags/definitions` | List all tag definitions |
| POST | `/admin/images/tags/definitions` | Create new tag definition |
| GET | `/admin/images/{id}/tags` | Get tags for specific image |
| POST | `/admin/images/{id}/tags` | Add tag to image |
| DELETE | `/admin/images/{id}/tags/{tagId}` | Remove tag from image |

## Upload Headers

When uploading images via POST `/admin/images/_actions/upload`, you can include the following headers:

- `x-visibility`: `public` or `private` (default: `public`)
- `x-external-id`: External reference ID (optional)
- `x-tags`: JSON array of tags, e.g., `[{"key": "color", "value": "red"}]` (optional)
- `x-path` or `x-filename`: Path for URL slug generation (optional)

## Query Parameters

### List Images (`GET /admin/images`)

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `isPublic`: Filter by visibility (`true`/`false`)
- `tag`: Tag filter (URL-encoded, e.g., `color%3Dred` for key=value). Can be repeated
- `embed`: Embed related data (`tags`, `slugs`). Can be repeated

Example:
```
/admin/images?page=1&limit=20&isPublic=true&tag=color%3Dred&tag=size%3Dlarge&embed=tags
```

### Get Single Image (`GET /admin/images/{id}`)

- `embed`: Embed related data (`tags`, `slugs`). Can be repeated

Example:
```
/admin/images/123e4567-e89b-12d3-a456-426614174000?embed=tags&embed=slugs
```

## Database Schema

### Main Tables

- **image**: Stores image metadata (size, dimensions, MIME type, hash, visibility, external ID)
- **tag_definition**: Predefined tag keys with optional descriptions
- **image_tag**: Maps tags to images with custom values
- **slug**: URL slugs for images
- **image_cache**: Cached versions of processed images
- **image_preset**: Preset configurations for image processing

## Project Structure

```
image-server/
├── src/
│   ├── constants/                  # Enums (Role, Visibility)
│   ├── configuration.ts           # YAML config loader with validation
│   ├── database/
│   │   ├── entities/              # TypeORM entities
│   │   └── migrations/           # Database migrations
│   ├── models/                   # DTOs
│   ├── admin/images/             # Admin API endpoints
│   ├── image/                    # Public image delivery
│   ├── cache/                    # Caching module
│   ├── storage/                  # Storage providers (FS, S3)
│   ├── utils/                    # Utility functions
│   └── types/                    # TypeScript types
├── example-data/
│   └── config.yml                # Example configuration file
├── package.json
└── README.md
```

## Dependencies

- **[NestJS](https://nestjs.com/)** - Web framework
- **[TypeORM](https://typeorm.io/)** - ORM for database access
- **[Sharp](https://sharp.pixelplumbing.com/)** - Image processing
- **[@fsarch/server](https://github.com/fsarch/server)** - Authentication and utilities

## License

This project is [MIT licensed](LICENSE).
