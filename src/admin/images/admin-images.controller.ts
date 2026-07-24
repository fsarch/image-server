import {
  Controller,
  Get,
  Post,
  UseGuards,
  Headers,
  Req,
  Param,
  Query,
  Res,
  NotFoundException,
  Inject,
  Body,
  Delete,
  Patch,
  ParseBoolPipe,
  ParseIntPipe
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminImagesService } from "./admin-images.service.js";
import { Visibility } from "../../constants/visibility.enum.js";
import { ApiBearerAuth, ApiQuery, ApiTags, ApiParam, ApiBody } from "@nestjs/swagger";
import { PaginationResultDto, ApiOkPaginatedResponse } from '@fsarch/server/pagination';
import { InjectRepository } from "@nestjs/typeorm";
import { Slug } from "../../database/entities/slug.entity.js";
import { Repository } from "typeorm";
import { ImageDto, ImageTagDto, TagDefinitionDto, PatchImageDto, ImageTagInputDto } from "../../models/image.model.js";
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
  @ApiOkPaginatedResponse(ImageDto)
  @ApiQuery({ name: 'embed', type: [String], isArray: true, required: false })
  @ApiQuery({ name: 'isPublic', type: Boolean, required: false })
  @ApiQuery({ name: 'tag', type: [String], isArray: true, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  public async getImages(
    @Query('embed') embed: Array<string>,
    @Query('isPublic', new ParseBoolPipe({ optional: true })) isPublic?: boolean,
    @Query('tag') tags?: string[],
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
  ): Promise<PaginationResultDto<ImageDto>> {
    // Parse tags: "color%3Dred" -> "color=red" -> { key: "color", value: "red" }
    //               "size" -> { key: "size", value: undefined }
    const parsedTags = tags?.map(tag => {
      const decodedTag = decodeURIComponent(tag);
      const [key, value] = decodedTag.split('=');
      return { key: decodeURIComponent(key), value: value ? decodeURIComponent(value) : undefined };
    });

    const { data, total } = await this.adminImagesService.list({
      isPublic,
      tags: parsedTags,
      page,
      limit,
    });

    // Convert to DTO and embed if needed
    const resultData: ImageDto[] = [];
    for (const image of data) {
      const dto: ImageDto = {
        ...image,
      };

      if (embed?.includes('slugs')) {
        const slugs = await this.slugsRepository.find({
          where: {
            image: image.id as unknown,
          },
        });
        dto.slugs = slugs.map((slug) => ({
          slug: slug.slug,
        }));
      }

      if (embed?.includes('tags')) {
        const imageTags = await this.adminImagesService.getTagsForImage(image.id);
        dto.tags = imageTags.map(tag => ({
          id: tag.id,
          key: tag.tagDefinition.key,
          value: tag.value,
        }));
      }

      resultData.push(dto);
    }

    const result = new PaginationResultDto<ImageDto>();
    result.data = resultData;
    result.metadata = {
      currentPage: page,
      pageSize: limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit)
    };
    return result;
  }

  @Get(':imageId')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  @ApiParam({ name: 'imageId', type: String, required: true })
  @ApiQuery({ name: 'embed', type: [String], isArray: true, required: false })
  public async getImage(
    @Param('imageId') id: string,
    @Query('embed') embed?: string[],
  ): Promise<ImageDto> {
    const image = await this.adminImagesService.getById(id);
    if (!image) {
      throw new NotFoundException();
    }

    const result: ImageDto = { ...image };

    if (embed?.includes('tags')) {
      const tags = await this.adminImagesService.getTagsForImage(id);
      result.tags = tags.map(tag => ({
        id: tag.id,
        key: tag.tagDefinition.key,
        value: tag.value,
      }));
    }

    if (embed?.includes('slugs')) {
      const slugs = await this.slugsRepository.find({
        where: { image: id as unknown },
      });
      result.slugs = slugs.map(slug => ({ slug: slug.slug }));
    }

    return result;
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
    let tags: ImageTagInputDto[] | undefined;
    const tagsHeader = headers['x-tags'];
    if (tagsHeader) {
      try {
        tags = JSON.parse(tagsHeader);
      } catch (e) {
        // Invalid JSON - ignore or throw error?
        // For now: ignore
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
  @ApiBody({ type: ImageTagInputDto, description: 'Tag with key and value' })
  public async addImageTag(
    @Param('imageId') imageId: string,
    @Body() body: ImageTagInputDto
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

  @Patch(':imageId')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  @ApiParam({ name: 'imageId', type: String, required: true })
  @ApiBody({ type: PatchImageDto })
  public async patchImage(
    @Param('imageId') id: string,
    @Body() body: PatchImageDto,
  ): Promise<ImageDto> {
    const image = await this.adminImagesService.getById(id);
    if (!image) {
      throw new NotFoundException();
    }

    // Visibility aktualisieren falls im Body enthalten
    if (body.isPublic !== undefined) {
      await this.adminImagesService.updateImageVisibility(id, body.isPublic);
    }

    // Tags aktualisieren falls im Body enthalten
    if (body.tags !== undefined) {
      await this.adminImagesService.setImageTags(id, body.tags);
    }

    // Aktualisiertes Bild zurückgeben
    return { ...(await this.adminImagesService.getById(id)) };
  }
}
