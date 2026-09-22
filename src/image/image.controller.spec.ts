import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { CacheService } from '../cache/cache.service.js';
import { SignedUrlService } from '../signed-url/signed-url.service.js';
import {
  CACHE_STORAGE_PROVIDER,
  DATA_STORAGE_PROVIDER,
} from '../storage/storage.module.js';
import { ImageController } from './image.controller.js';
import { ImageService } from './image.service.js';

describe('ImageController', () => {
  let controller: ImageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImageController],
      providers: [
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: ImageService, useValue: {} },
        { provide: CacheService, useValue: {} },
        { provide: SignedUrlService, useValue: {} },
        { provide: DATA_STORAGE_PROVIDER, useValue: {} },
        { provide: CACHE_STORAGE_PROVIDER, useValue: {} },
      ],
    }).compile();

    controller = module.get<ImageController>(ImageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
