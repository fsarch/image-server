import { Module } from '@nestjs/common';
import { ImageService } from './image.service.js';
import { ImageController } from './image.controller.js';
import { TypeOrmModule } from "@nestjs/typeorm";
import { Image } from "../database/entities/image.entity.js";
import { Slug } from "../database/entities/slug.entity.js";
import { ImageCache } from "../database/entities/image-cache.entity.js";
import { TagDefinition } from "../database/entities/tag-definition.entity.js";
import { ImageTag } from "../database/entities/image-tag.entity.js";
import { CacheModule } from "../cache/cache.module.js";
import { SignedUrlModule } from "../signed-url/signed-url.module.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Image]),
    TypeOrmModule.forFeature([Slug]),
    TypeOrmModule.forFeature([ImageCache]),
    TypeOrmModule.forFeature([TagDefinition]),
    TypeOrmModule.forFeature([ImageTag]),
    CacheModule,
    SignedUrlModule,
  ],
  providers: [ImageService],
  exports: [ImageService],
  controllers: [ImageController]
})
export class ImageModule {}
