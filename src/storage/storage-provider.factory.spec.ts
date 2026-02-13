import { Test, TestingModule } from '@nestjs/testing';
import { StorageProviderFactory } from './storage-provider.factory';
import { FileSystemStorageProvider } from './filesystem-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageConfig } from './storage-config.types';

describe('StorageProviderFactory', () => {
  describe('create', () => {
    it('should create FileSystemStorageProvider for string config', () => {
      const config: StorageConfig = '/path/to/storage';
      const provider = StorageProviderFactory.create(config);

      expect(provider).toBeInstanceOf(FileSystemStorageProvider);
    });

    it('should create FileSystemStorageProvider for filesystem type', () => {
      const config: StorageConfig = {
        type: 'filesystem',
        config: {
          path: '/path/to/storage',
        },
      };
      const provider = StorageProviderFactory.create(config);

      expect(provider).toBeInstanceOf(FileSystemStorageProvider);
    });

    it('should create S3StorageProvider for s3 type', () => {
      const config: StorageConfig = {
        type: 's3',
        config: {
          bucket: 'test-bucket',
          region: 'us-east-1',
        },
      };
      const provider = StorageProviderFactory.create(config);

      expect(provider).toBeInstanceOf(S3StorageProvider);
    });

    it('should throw error for unknown storage type', () => {
      const config: any = {
        type: 'unknown',
        config: {},
      };

      expect(() => StorageProviderFactory.create(config)).toThrow('Unknown storage type: unknown');
    });
  });
});
