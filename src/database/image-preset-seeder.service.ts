import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { IMAGE_SERVER_APP_CONFIG } from '../lib/image-server-app-config.token.js';
import type { ConfigType } from '../types/config.type.js';
import { ImagePreset } from './entities/image-preset.entity.js';

@Injectable()
export class ImagePresetSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(ImagePreset)
    private readonly imagePresetsRepository: Repository<ImagePreset>,
    @Inject(IMAGE_SERVER_APP_CONFIG)
    private readonly config: ConfigType,
  ) {}

  onModuleInit(): void {
    this.config.images.presets.forEach((imagePreset) => {
      this.imagePresetsRepository.save({
        id: imagePreset.alias,
      });
    });
  }
}
