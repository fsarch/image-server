import { IStorageProvider } from './storage-provider.interface.js';
import { StorageConfig } from './storage-config.types.js';
import { FileSystemStorageProvider } from './filesystem-storage.provider.js';
import { S3StorageProvider } from './s3-storage.provider.js';

export class StorageProviderFactory {
  static create(config: StorageConfig): IStorageProvider {
    // Handle legacy string configuration (filesystem path)
    if (typeof config === 'string') {
      return new FileSystemStorageProvider(config);
    }

    // Handle object configuration
    if (config.type === 'filesystem') {
      return new FileSystemStorageProvider(config.config.path);
    }

    if (config.type === 's3') {
      return new S3StorageProvider(config.config);
    }

    throw new Error(`Unknown storage type: ${(config as any).type}`);
  }
}
