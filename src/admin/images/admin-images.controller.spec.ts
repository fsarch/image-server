import { AuthGuard } from '@fsarch/server/auth';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Slug } from '../../database/entities/slug.entity.js';
import { ImageService } from '../../image/image.service.js';
import { DATA_STORAGE_PROVIDER } from '../../storage/storage.module.js';
import { AdminImagesController } from './admin-images.controller.js';
import { AdminImagesService } from './admin-images.service.js';

describe('UploadController', () => {
  let controller: AdminImagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminImagesController],
      providers: [
        { provide: AdminImagesService, useValue: {} },
        {
          provide: getRepositoryToken(Slug),
          useValue: { find: vi.fn(), findOne: vi.fn() },
        },
        { provide: ImageService, useValue: {} },
        { provide: DATA_STORAGE_PROVIDER, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminImagesController>(AdminImagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
