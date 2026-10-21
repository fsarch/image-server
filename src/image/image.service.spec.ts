import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Image } from '../database/entities/image.entity.js';
import { ImageCache } from '../database/entities/image-cache.entity.js';
import { ImageTag } from '../database/entities/image-tag.entity.js';
import { Slug } from '../database/entities/slug.entity.js';
import { TagDefinition } from '../database/entities/tag-definition.entity.js';
import { IMAGE_SERVER_APP_CONFIG } from '../lib/image-server-app-config.token.js';
import {
  CACHE_STORAGE_PROVIDER,
  DATA_STORAGE_PROVIDER,
} from '../storage/storage.tokens.js';
import { ImageService } from './image.service.js';

const mockRepository = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
});

describe('ImageService', () => {
  let service: ImageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageService,
        { provide: getRepositoryToken(Image), useFactory: mockRepository },
        { provide: getRepositoryToken(Slug), useFactory: mockRepository },
        {
          provide: getRepositoryToken(ImageCache),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(TagDefinition),
          useFactory: mockRepository,
        },
        { provide: getRepositoryToken(ImageTag), useFactory: mockRepository },
        { provide: IMAGE_SERVER_APP_CONFIG, useValue: {} },
        { provide: DATA_STORAGE_PROVIDER, useValue: {} },
        { provide: CACHE_STORAGE_PROVIDER, useValue: {} },
      ],
    }).compile();

    service = module.get<ImageService>(ImageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
