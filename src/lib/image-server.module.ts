import { createServiceModule } from '@fsarch/server';
import { Module } from '@nestjs/common';
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
import type { ConfigType } from '../types/config.type.js';
import { IMAGE_SERVER_APP_CONFIG } from './image-server-app-config.token.js';
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
 * `IMAGE_SERVER_APP_CONFIG` provides this service's own validated
 * `images`/`naming`/`storage`/`caching`/`signed_urls` config (everything
 * `configuration.ts` reads and validates) as a plain value, instead of
 * routing it through `@nestjs/config`'s `ConfigModule`. All six consumers
 * (storage providers, `CacheService`, `SignedUrlService`, `ImageService`,
 * `AdminImagesService`, `ImagePresetSeeder`, `ImageController`) inject this
 * token directly rather than a generic `ConfigService`.
 *
 * This used to be `ConfigModule.forRoot({ load: [...], isGlobal:
 * !connectionName })`, later `ConfigModule.forFeature(() =>
 * configuration(connectionName))` - both were empirically found to corrupt
 * Nest's module-token bookkeeping for *every other concurrently mounted
 * service's* own `AuthModule.register(id)`, reproduced with this service
 * mounted alongside *any* other one (calendar-server, image-editor-server,
 * ...), each failing with "Nest can't resolve dependencies of the
 * AuthGuard ... AuthService" - regardless of whether the second
 * `ConfigModule` registration was async (`forRoot`) or sync (`forFeature`).
 * Not calling `@nestjs/config`'s `ConfigModule` a second time at all, in
 * any form, is what actually fixes it - this module now has nothing to do
 * with `ConfigHostModule`'s shared/global state, so there's nothing left
 * to corrupt.
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
      useFactory: (config: ConfigType): IStorageProvider => {
        return StorageProviderFactory.create(config.storage.data);
      },
      inject: [IMAGE_SERVER_APP_CONFIG],
    },
    {
      provide: CACHE_STORAGE_PROVIDER,
      useFactory: (config: ConfigType): IStorageProvider => {
        return StorageProviderFactory.create(config.storage.cache);
      },
      inject: [IMAGE_SERVER_APP_CONFIG],
    },
  ],
  imports: (connectionName) => {
    @Module({
      providers: [
        {
          provide: IMAGE_SERVER_APP_CONFIG,
          useFactory: (): ConfigType => configuration(connectionName),
        },
      ],
      exports: [IMAGE_SERVER_APP_CONFIG],
    })
    class ImageServerAppConfigModule {}

    return [ImageServerAppConfigModule];
  },
  exports: [ImageService, CacheService, SignedUrlService],
});
