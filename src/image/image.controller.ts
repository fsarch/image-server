import { Controller, Get, Headers, NotFoundException, Param, Req, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import crypto from 'node:crypto';
import { ConfigService } from "@nestjs/config";
import { ConfigCachingClientType, ConfigNamingType } from "../types/config.type.js";
import { ImageService, ResolveResponseType } from "./image.service.js";
import { getFormatInfoByExtension, getFormatInfoByMimeType } from "../utils/format-info.utils.js";
import sharp from "sharp";
import fs from 'node:fs/promises';
import { CacheService } from "../cache/cache.service.js";
import { CacheType } from "../cache/cache.enum.js";
import { runInBackground } from "../utils/run-in-background.utils.js";
import { ApiParam, ApiTags } from "@nestjs/swagger";
import { Public } from "../fsarch/auth/decorators/public.decorator.js";
import { IStorageProvider } from "../storage/storage-provider.interface.js";
import { DATA_STORAGE_PROVIDER, CACHE_STORAGE_PROVIDER } from "../storage/storage.module.js";

@ApiTags('images')
@Controller({
  path: 'images',
  version: '1',
})
export class ImageController {
  constructor(
    private readonly configService: ConfigService,
    private readonly imageService: ImageService,
    private readonly cacheService: CacheService,
    @Inject(DATA_STORAGE_PROVIDER)
    private readonly dataStorage: IStorageProvider,
    @Inject(CACHE_STORAGE_PROVIDER)
    private readonly cacheStorage: IStorageProvider,
  ) {
  }

  private async getBaseImage(
    res: Response,
    resolveInfo: ResolveResponseType,
    preferredMimeTypes: Array<string>,
  ) {
    const clientCachingOptions = this.configService.get<ConfigCachingClientType>('caching.client.options');
    const cacheControlHeader = `public, max-age=${Math.floor(clientCachingOptions.max_age / 1000)}, s-maxage=${Math.floor(clientCachingOptions.s_max_age / 1000)}, must-revalidate`;

    if (resolveInfo.imageCaches?.[0]?.path) {
      const cachePath = resolveInfo.imageCaches[0].path;

      try {
        const cachedData = await this.cacheService.getOrCreateCache(
          CacheType.ImageData,
          [cachePath],
          async () => {
            const imageBuffer = await this.cacheStorage.readFile(cachePath);
            return {
              buffer: imageBuffer,
              meta: {
                contentType: resolveInfo.imageCaches[0].value.mimeType,
                imageCache: {
                  imageId: resolveInfo.imageCaches[0].value.image.id,
                  imagePresetId: resolveInfo.imageCaches[0].value.imagePreset.id,
                  mimeType: resolveInfo.imageCaches[0].value.mimeType,
                  md5: resolveInfo.imageCaches[0].value.md5,
                },
              },
            };
          },
          {
            calculateSize: (value) => value.buffer.length + JSON.stringify(value.meta).length,
          }
        );

        res.set({
          'Content-Type': cachedData.meta.contentType,
          'Content-Length': cachedData.buffer.length,
          'Cache-Control': cacheControlHeader,
          'ETag': cachedData.meta.imageCache.md5,
        });
        res.send(cachedData.buffer);

        return;
      } catch (error: any) {
        const cacheInfo = {
          image: resolveInfo.image.id,
          imagePreset: resolveInfo.preset.alias,
          mimeType: resolveInfo.imageCaches[0].value.mimeType,
        };

        if (error.code === 'ENOENT' || error.name === 'NoSuchKey') {
          console.error('cached image not found', cacheInfo);

          runInBackground(async () => {
            await this.imageService.removeCached(
              resolveInfo.imageCaches[0].value.image,
              resolveInfo.imageCaches[0].value.imagePreset,
              resolveInfo.imageCaches[0].value.mimeType,
              resolveInfo.imageCaches[0].value.creationTime,
            ).catch((ex) => console.error('error while removing cached image', ex, cacheInfo));
          });
        }

        console.error('error while reading cached image', error, cacheInfo);
      }
    }

    const fileContent = await this.dataStorage.readFile(resolveInfo.imagePath);

    const preferredFormat = preferredMimeTypes
      .map((preferredMimeType) => {
        try {
          return getFormatInfoByMimeType(preferredMimeType);
        } catch {
          return null;
        }
      })
      .find(a => a);

    const convertedImage = await sharp(fileContent)
      .resize({
        width: resolveInfo.preset.width,
        height: resolveInfo.preset.height,
        fit: resolveInfo.preset.algorithm,
      })
      .toFormat(preferredFormat.sharpFormat)
      .toBuffer();

    if (resolveInfo.preset.cached) {
      await this.imageService.saveCached(resolveInfo.image, convertedImage, resolveInfo.preset.alias, preferredFormat.mimeType);
    }

    res.set({
      'Content-Type': preferredFormat.mimeType,
      'Content-Length': convertedImage.length,
      'Cache-Control': cacheControlHeader,
      'ETag': crypto.createHash('md5').update(convertedImage).digest('hex'),
    });
    res.send(convertedImage);
    res.end();
  }


  @Public()
  @Get('resolve/*slug')
  @ApiParam({
    name: 'slug',
    required: true,
    format: 'path',
  })
  public async getImage(
    @Headers() headers,
    @Res() res: Response,
    @Param() params: { slug: Array<string> },
  ) {
    console.log('params', params, params.slug[0]);
    const rawSlug = params.slug?.join('/');

    const namingOptions = this.configService.get<ConfigNamingType>('naming');
    const convertedPath = namingOptions.path
      .replaceAll('/', '\\/')
      .replaceAll('.', '\\.')
      .replace('##id##', '(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
      .replace('##preset_alias##', '(?<preset_alias>[^/]+)')
      .replace('##ext##', '(?<ext>[A-Za-z0-9]+)')
      .replace('##name##', '(?<slug>.*)');

    const regex = new RegExp('^' + convertedPath + '$');
    const matchedSlug = rawSlug.match(regex);
    if (!matchedSlug) {
      throw new NotFoundException();
    }

    const { slug, preset_alias: presetAlias, ext, id } = matchedSlug.groups;
    const preferredMimeTypes = ext ? [getFormatInfoByExtension(ext).mimeType] : headers.accept.split(',').map(a => a.split(';')[0].trim());

    let resolveInfo = await this.cacheService.getOrCreateCache(
      CacheType.ResolvePath,
      [id, slug, presetAlias, preferredMimeTypes.join('_')],
      async () => {
        return await this.imageService.resolveImage({
          slug,
          presetAlias,
          id,
          preferredMimeTypes: preferredMimeTypes,
        });
      },
      {
        calculateSize: (value) => {
          return JSON.stringify(value).length;
        },
      }
    );

    await this.getBaseImage(res, resolveInfo, preferredMimeTypes)
  }

  @Public()
  @Get(':id/presets/:presetAlias')
  @ApiParam({
    name: 'id',
    required: true,
    format: 'path',
  })
  @ApiParam({
    name: 'presetAlias',
    required: true,
    format: 'path',
  })
  public async getImageById(
    @Headers() headers,
    @Res() res: Response,
    @Param('id') id: string,
    @Param('presetAlias') presetAlias: string,
  ) {
    const preferredMimeTypes = headers.accept.split(',').map(a => a.split(';')[0].trim());

    let resolveInfo = await this.cacheService.getOrCreateCache(
      CacheType.ResolvePath,
      [id, '', presetAlias, preferredMimeTypes.join('_')],
      async () => {
        return await this.imageService.resolveImage({
          presetAlias,
          id,
          preferredMimeTypes: preferredMimeTypes,
        });
      },
      {
        calculateSize: (value) => {
          return JSON.stringify(value).length;
        },
      }
    );

    await this.getBaseImage(res, resolveInfo, preferredMimeTypes)
  }
}
