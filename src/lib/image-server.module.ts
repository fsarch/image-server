import { createServiceModule } from '@fsarch/server';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminImagesController } from '../admin/images/admin-images.controller.js';
import { AdminImagesService } from '../admin/images/admin-images.service.js';
import { CacheService } from '../cache/cache.service.js';
import configuration from '../configuration.js';
import { ImagePresetSeeder } from '../database/image-preset-seeder.service.js';
import { ImageController } from '../image/image.controller.js';
import { ImageService } from '../image/image.service.js';
import { SignedUrlService } from '../signed-url/signed-url.service.js';
import { StorageProviderFactory } from '../storage/storage-provider.factory.js';
import type { IStorageProvider } from '../storage/storage-provider.interface.js';
import {
  CACHE_STORAGE_PROVIDER,
  DATA_STORAGE_PROVIDER,
} from '../storage/storage.tokens.js';
import { DATABASE_OPTIONS } from '../database/index.js';

/**
 * The service's feature module, generated via `@fsarch/server`'s
 * `createServiceModule()` instead of hand-written as `app.module.ts` used
 * to be. Flattens what was previously a multi-module tree (AppModule ->
 * AdminModule -> AdminImagesModule, ImageModule, CacheModule,
 * SignedUrlModule, StorageModule, each with their own imports/exports) into
 * one module — a named connection's `TypeOrmModule.forFeature()` only
 * covers providers/controllers declared *directly* in the module it's
 * attached to, and `createServiceModule()`'s single call only covers this
 * module's own direct providers/controllers, not nested ones.
 *
 * `ConfigModule.forRoot()` is kept inside this module's own `imports`
 * (rather than, as before, loaded globally by `AppModule`) because its
 * `isGlobal` flag — like `@Global()` — makes it a *process-wide* singleton
 * regardless of dynamic options. Mounting this service twice would
 * otherwise mean one `config.yaml` top-level section wins for both mounts.
 * Standalone (no `connectionName`) keeps `isGlobal: true`, i.e. unchanged
 * behavior; a mount gets `isGlobal: false` plus the `connectionName`-scoped
 * `services[].config` section (see `configuration.ts`), scoped to this
 * module only — safe because every consumer of `ConfigService` (storage
 * providers, `CacheService`, `SignedUrlService`, `ImageService`,
 * `AdminImagesService`, `ImagePresetSeeder`) is a sibling *inside* this same
 * flattened module.
 */
export const ImageServerModule = createServiceModule({
  entities: DATABASE_OPTIONS.entities,
  controllers: [ImageController, AdminImagesController],
  providers: [
    ImageService,
    AdminImagesService,
    CacheService,
    SignedUrlService,
    ImagePresetSeeder,
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
  imports: (connectionName) => [
    ConfigModule.forRoot({
      load: [() => configuration(connectionName)],
      isGlobal: !connectionName,
    }),
  ],
  exports: [ImageService, CacheService, SignedUrlService],
});
