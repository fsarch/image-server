import { Controller, Get, Post, UseGuards, Headers, Req, Param, Query, Res, NotFoundException, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { AdminImagesService } from "./admin-images.service.js";
import { Image } from "../../database/entities/image.entity.js";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Slug } from "../../database/entities/slug.entity.js";
import { Repository } from "typeorm";
import { ImageDto } from "../../models/image.model.js";
import { AuthGuard } from "../../fsarch/auth/guards/auth.guard.js";
import { Roles } from "../../fsarch/uac/decorators/roles.decorator.js";
import { Role } from "../../fsarch/auth/role.enum.js";
import fs from "node:fs/promises";
import path from "node:path";
import { getFormatInfoByMimeType } from "../../utils/format-info.utils.js";
import { ImageService } from "../../image/image.service.js";
import sharp from "sharp";
import { IStorageProvider } from "../../storage/storage-provider.interface.js";
import { DATA_STORAGE_PROVIDER } from "../../storage/storage.module.js";

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
  public async getImages(
    @Query('embed') embed: Array<string>,
  ): Promise<Array<Image>> {
    const images = await this.adminImagesService.list() as Array<ImageDto>;

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

    const filePath = path.resolve(this.imageService.getImageDirectory(image.creationTime), `${image.id}.${getFormatInfoByMimeType(image.mimeType).extension}`);

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

    return await this.adminImagesService.upload(request, {
      path,
    });
  }


  @Get(':imageId')
  @UseGuards(AuthGuard)
  @Roles(Role.manage_images)
  public async Delete(
    @Param('imageId') id: string,
  ): Promise<void> {
    const image = await this.adminImagesService.getById(id);
    if (!image) {
      throw new NotFoundException();
    }

    await this.adminImagesService.remove(image.id);
  }
}
