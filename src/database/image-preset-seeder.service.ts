import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { ConfigImagePresetType } from '../types/config.type.js';
import { ImagePreset } from './entities/image-preset.entity.js';

@Injectable()
export class ImagePresetSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(ImagePreset)
    private readonly imagePresetsRepository: Repository<ImagePreset>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const imagePresets =
      this.configService.get<Array<ConfigImagePresetType>>('images.presets');

    imagePresets.forEach((imagePreset) => {
      this.imagePresetsRepository.save({
        id: imagePreset.alias,
      });
    });
  }
}
