import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from "@nestjs/config";
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';

import { AdminModule } from './admin/admin.module.js';
import configuration from "./configuration.js";
import { ConfigImagePresetType } from "./types/config.type.js";

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImageModule } from './image/image.module.js';
import { ImagePreset } from "./database/entities/image-preset.entity.js";
import { Repository } from "typeorm";
import { CacheModule } from './cache/cache.module.js';
import { StorageModule } from './storage/storage.module.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    StorageModule,
    AdminModule,
    ImageModule,
    TypeOrmModule.forFeature([ImagePreset]),
    CacheModule,
  ],
  controllers: [],
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
