import { Controller, Get, Post, UseGuards, Headers, Req, Param, Query, Res, NotFoundException, Inject, Body, Delete } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminImagesService } from "./admin-images.service.js";
import { Image } from "../../database/entities/image.entity.js";
import { TagDefinition } from "../../database/entities/tag-definition.entity.js";
import { ImageTag } from "../../database/entities/image-tag.entity.js";
import { Visibility } from "../../constants/visibility.enum.js";
import { ApiBearerAuth, ApiQuery, ApiTags, ApiParam, ApiBody } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Slug } from "../../database/entities/slug.entity.js";
import { Repository } from "typeorm";
import { ImageDto, ImageTagDto, TagDefinitionDto } from "../../models/image.model.js";
import path from "node:path";
import { getFormatInfoByMimeType } from "../../utils/format-info.utils.js";
import { ImageService } from "../../image/image.service.js";
import sharp from "sharp";
import type { IStorageProvider } from "../../storage/storage-provider.interface.js";
import { DATA_STORAGE_PROVIDER } from "../../storage/storage.module.js";
import { AuthGuard } from "@fsarch/server/auth";
import { Roles } from "@fsarch/server/uac";
import { Role } from "../../constants/role.enum.js";

@ApiTags('admin')
@Controller({
  path: 'admin/images',
  version: '1',
})
@ApiBearerAuth()
export class AdminImagesController {
  constructor(
    private readonly adminImagesService: AdminImagesService,
    @InjectRepository(Slug)
    private slugsRepository: Repository<Slug>,
    private readonly imageService: ImageService,
    @Inject(DATA_STORAGE_PROVIDER)
    private readonly dataStorage: IStorageProvider,
  ) {
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  @ApiQuery({ name: 'embed', type: [String], isArray: true, required: false })
  @ApiQuery({ name: 'isPublic', type: Boolean, required: false })
  @ApiQuery({ name: 'tagKey', type: [String], isArray: true, required: false })
  @ApiQuery({ name: 'tagValue', type: [String], isArray: true, required: false })
  public async getImages(
    @Query('embed') embed: Array<string>,
    @Query('isPublic') isPublic?: boolean,
    @Query('tagKey') tagKeys?: string[],
    @Query('tagValue') tagValues?: string[],
  ): Promise<Array<Image>> {
    const images = await this.adminImagesService.list({
      isPublic,
      tags: tagKeys?.map((key, i) => ({ key, value: tagValues?.[i] }))
    }) as Array<ImageDto>;

    if (embed?.includes('slugs')) {
      await Promise.all(images.map(async (image) => {
        const slugs = await this.slugsRepository.find({
          where: {
            image: image.id as unknown,
          },
        });

        image.slugs = slugs.map((slug) => ({
          slug: slug.slug,
        }));
      }));
    }

    if (embed?.includes('tags')) {
      await Promise.all(images.map(async (image) => {
        const tags = await this.adminImagesService.getTagsForImage(image.id);
        image.tags = tags.map(tag => ({
          id: tag.id,
          key: tag.tagDefinition.key,
          value: tag.value,
        }));
      }));
    }

    return images;
  }

  @Get(':imageId/raw')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  public async getRawImage(
    @Res() res: Response,
    @Param('imageId') id: string,
    @Query('size') size?: string,
  ): Promise<void> {
    const image = await this.adminImagesService.getById(id);

    const filePath = path.join(this.imageService.getImageDirectory(image.creationTime), `${image.id}.${getFormatInfoByMimeType(image.mimeType).extension}`);

    let fileContent: Uint8Array = new Uint8Array(await this.dataStorage.readFile(filePath));

    if (size && !isNaN(parseInt(size, 10))) {
      const sizeNumber = parseInt(size, 10);

      fileContent = new Uint8Array(await sharp(fileContent)
        .resize({
          width: sizeNumber,
          height: sizeNumber,
          fit: 'cover',
        })
        .toFormat(getFormatInfoByMimeType('image/png')?.sharpFormat)
        .toBuffer()
      );
    }

    res.set({
      'Content-Type': image.mimeType,
      'Content-Length': fileContent.length,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    });
    res.send(fileContent);
    res.end();
  }

  @Post('/_actions/upload')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  async createImage(@Headers() headers: Record<string, string | undefined>, @Req() request: Request) {
    const path = headers['x-path'] || headers['x-filename'];
    
    // Visibility: x-visibility header (public|private), default: public
    let visibility: Visibility | undefined;
    const visibilityHeader = headers['x-visibility']?.toLowerCase();
    if (visibilityHeader === 'public' || visibilityHeader === 'private') {
      visibility = visibilityHeader as Visibility;
    }
    
    // external_id: x-external-id header (optional)
    const externalId = headers['x-external-id'];
    
    // tags: x-tags header (optional, JSON string)
    let tags: Array<{ key: string; value: string }> | undefined;
    const tagsHeader = headers['x-tags'];
    if (tagsHeader) {
      try {
        tags = JSON.parse(tagsHeader);
      } catch (e) {
        // Ungültiges JSON - ignorieren oder Fehler werfen?
        // Für jetzt: ignorieren
      }
    }

    return await this.adminImagesService.upload(request, {
      path,
      visibility,
      externalId,
      tags,
    });
  }


  // Tag Definition Endpunkte

  @Get('tags/definitions')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  @ApiQuery({ name: 'embed', type: [String], isArray: true, required: false })
  public async getTagDefinitions(): Promise<Array<TagDefinitionDto>> {
    const tagDefs = await this.adminImagesService.getTagDefinitions();
    return tagDefs.map(def => ({
      id: def.id,
      key: def.key,
      description: def.description,
      creationTime: def.creationTime,
    }));
  }

  @Post('tags/definitions')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  @ApiBody({ type: Object, description: 'Tag definition with key and optional description' })
  public async createTagDefinition(
    @Body() body: { key: string; description?: string }
  ): Promise<TagDefinitionDto> {
    const tagDef = await this.adminImagesService.createTagDefinition(
      body.key,
      body.description
    );
    return {
      id: tagDef.id,
      key: tagDef.key,
      description: tagDef.description,
      creationTime: tagDef.creationTime,
    };
  }

  // Image Tag Endpunkte

  @Get(':imageId/tags')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  @ApiParam({ name: 'imageId', type: String, required: true })
  public async getImageTags(
    @Param('imageId') imageId: string
  ): Promise<Array<ImageTagDto>> {
    const tags = await this.adminImagesService.getTagsForImage(imageId);
    return tags.map(tag => ({
      id: tag.id,
      key: tag.tagDefinition.key,
      value: tag.value,
    }));
  }

  @Post(':imageId/tags')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  @ApiParam({ name: 'imageId', type: String, required: true })
  @ApiBody({ type: Object, description: 'Tag with key and value' })
  public async addImageTag(
    @Param('imageId') imageId: string,
    @Body() body: { key: string; value: string }
  ): Promise<ImageTagDto> {
    const tag = await this.adminImagesService.addTagToImage(
      imageId,
      body.key,
      body.value
    );
    return {
      id: tag.id,
      key: tag.tagDefinition.key,
      value: tag.value,
    };
  }

  @Delete(':imageId/tags/:tagId')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  @ApiParam({ name: 'imageId', type: String, required: true })
  @ApiParam({ name: 'tagId', type: String, required: true })
  public async removeImageTag(
    @Param('imageId') imageId: string,
    @Param('tagId') tagId: string
  ): Promise<void> {
    await this.adminImagesService.removeTagFromImage(imageId, tagId);
  }

  // Delete Image Endpunkt (korrigiert)

  @Delete(':imageId')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  @ApiParam({ name: 'imageId', type: String, required: true })
  public async deleteImage(
    @Param('imageId') id: string,
  ): Promise<void> {
    const image = await this.adminImagesService.getById(id);
    if (!image) {
      throw new NotFoundException();
    }

    await this.adminImagesService.remove(image.id);
  }
}
