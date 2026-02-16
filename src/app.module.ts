import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from "@nestjs/config";
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller.js';
import { AdminModule } from './admin/admin.module.js';
import configuration from "./configuration.js";
import { APP_GUARD } from "@nestjs/core";
import { ConfigImagePresetType } from "./types/config.type.js";

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseTablesMigration } from "./database/migrations/1719665254677-base-tables.migration.js";
import { ImageModule } from './image/image.module.js';
import { ImagePreset } from "./database/entities/image-preset.entity.js";
import { Repository } from "typeorm";
import { CacheModule } from './cache/cache.module.js';
import { FsarchModule } from "./fsarch/fsarch.module.js";
import { Image } from "./database/entities/image.entity.js";
import { ImageCache } from "./database/entities/image-cache.entity.js";
import { Slug } from "./database/entities/slug.entity.js";
import { StorageModule } from './storage/storage.module.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    StorageModule,
    FsarchModule.register({
      auth: {},
      database: {
        entities: [
          Image,
          ImageCache,
          ImagePreset,
          Slug,
        ],
        migrations: [
          BaseTablesMigration,
        ],
      },
    }),
    AdminModule,
    ImageModule,
    TypeOrmModule.forFeature([ImagePreset]),
    CacheModule,
  ],
  controllers: [AppController],
})
export class AppModule {
  constructor(
    @InjectRepository(ImagePreset)
    private imagePresetsRepository: Repository<ImagePreset>,
    private readonly configService: ConfigService,
  ) {
    const imagePresets = configService.get<Array<ConfigImagePresetType>>('images.presets');

    imagePresets.forEach((imagePreset) => {
      this.imagePresetsRepository.save({
        id: imagePreset.alias,
      });
    });
  }
}
