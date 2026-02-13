import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProviderFactory } from './storage-provider.factory.js';
import { IStorageProvider } from './storage-provider.interface.js';

export const DATA_STORAGE_PROVIDER = 'DATA_STORAGE_PROVIDER';
export const CACHE_STORAGE_PROVIDER = 'CACHE_STORAGE_PROVIDER';

@Global()
@Module({
  providers: [
    {
      provide: DATA_STORAGE_PROVIDER,
      useFactory: (configService: ConfigService): IStorageProvider => {
        const storageConfig = configService.get('storage.data');
        return StorageProviderFactory.create(storageConfig);
      },
      inject: [ConfigService],
    },
    {
      provide: CACHE_STORAGE_PROVIDER,
      useFactory: (configService: ConfigService): IStorageProvider => {
        const storageConfig = configService.get('storage.cache');
        return StorageProviderFactory.create(storageConfig);
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATA_STORAGE_PROVIDER, CACHE_STORAGE_PROVIDER],
})
export class StorageModule {}
