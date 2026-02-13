# Storage Configuration

The image server supports multiple storage backends for both data (original images) and cache (processed images). Each can be configured independently.

## Filesystem Storage

### Legacy format (string path)
Backward compatible with existing configurations:

```yaml
storage:
  data: ./data
  cache: ./cache
```

### Object format
New explicit format:

```yaml
storage:
  data:
    type: filesystem
    config:
      path: ./data
  cache:
    type: filesystem
    config:
      path: ./cache
```

## S3 Storage

Configure S3 storage for original images and/or cache:

```yaml
storage:
  data:
    type: s3
    config:
      bucket: my-images-bucket
      region: us-east-1
      accessKeyId: YOUR_ACCESS_KEY_ID      # Optional if using IAM roles
      secretAccessKey: YOUR_SECRET_KEY     # Optional if using IAM roles
      endpoint: https://s3.amazonaws.com   # Optional, for custom S3 endpoints
      prefix: images/                      # Optional, prefix for all keys
  cache:
    type: s3
    config:
      bucket: my-cache-bucket
      region: us-east-1
```

### S3 Configuration Options

- `bucket` (required): The S3 bucket name
- `region` (required): AWS region (e.g., `us-east-1`, `eu-west-1`)
- `accessKeyId` (optional): AWS access key ID. If not provided, uses default AWS credentials (IAM roles, environment variables, etc.)
- `secretAccessKey` (optional): AWS secret access key. Required if `accessKeyId` is provided
- `endpoint` (optional): Custom S3 endpoint URL for S3-compatible services (e.g., MinIO, DigitalOcean Spaces)
- `prefix` (optional): Prefix to add to all S3 keys. Useful for organizing objects within a bucket

## Mixed Storage Configuration

You can mix storage types. For example, use S3 for original images and filesystem for cache:

```yaml
storage:
  data:
    type: s3
    config:
      bucket: my-images-bucket
      region: us-east-1
  cache:
    type: filesystem
    config:
      path: ./cache
```

Or the reverse - filesystem for data and S3 for cache:

```yaml
storage:
  data:
    type: filesystem
    config:
      path: ./data
  cache:
    type: s3
    config:
      bucket: my-cache-bucket
      region: us-east-1
```

## Environment Variables

For legacy filesystem storage, paths can be overridden using environment variables:

- `DATA_PATH` - Path to data storage
- `CACHE_PATH` - Path to cache storage

**Note:** Environment variable overrides only work with string-based filesystem configuration.

## Best Practices

1. **S3 for Production**: Use S3 for production deployments to avoid data loss and enable horizontal scaling
2. **Filesystem for Development**: Use filesystem storage for local development to avoid AWS costs
3. **Separate Buckets**: Consider using separate buckets for data and cache to apply different lifecycle policies
4. **IAM Roles**: In production, use IAM roles instead of hardcoding credentials
5. **Prefixes**: Use prefixes to organize objects within a bucket, especially when sharing buckets across environments

## Examples

### Development Setup
```yaml
storage:
  data: ./example-data/data
  cache: ./example-data/cache
```

### Production with S3
```yaml
storage:
  data:
    type: s3
    config:
      bucket: prod-images
      region: us-east-1
      prefix: originals/
  cache:
    type: s3
    config:
      bucket: prod-cache
      region: us-east-1
      prefix: processed/
```

### Hybrid Setup (S3 for data, local cache)
```yaml
storage:
  data:
    type: s3
    config:
      bucket: prod-images
      region: us-east-1
  cache:
    type: filesystem
    config:
      path: /mnt/cache
```

### Using S3-Compatible Service (MinIO)
```yaml
storage:
  data:
    type: s3
    config:
      bucket: my-bucket
      region: us-east-1
      endpoint: http://minio:9000
      accessKeyId: minioadmin
      secretAccessKey: minioadmin
```
