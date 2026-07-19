import { Module } from '@nestjs/common';
import { AdminImagesController } from './admin-images.controller.js';
import { AdminImagesService } from './admin-images.service.js';
import { Image } from "../../database/entities/image.entity.js";
import { TagDefinition } from "../../database/entities/tag-definition.entity.js";
import { ImageTag } from "../../database/entities/image-tag.entity.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Slug } from "../../database/entities/slug.entity.js";
import { ImageModule } from "../../image/image.module.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Image]),
    TypeOrmModule.forFeature([Slug]),
    TypeOrmModule.forFeature([TagDefinition]),
    TypeOrmModule.forFeature([ImageTag]),
    ImageModule,
  ],
  controllers: [AdminImagesController],
  providers: [AdminImagesService]
})
export class AdminImagesModule {}
