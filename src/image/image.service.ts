import { Injectable, NotFoundException, NotImplementedException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Image } from "../database/entities/image.entity.js";
import { In, Repository } from "typeorm";
import { Slug } from "../database/entities/slug.entity.js";
import { ImageCache } from "../database/entities/image-cache.entity.js";
import { TagDefinition } from "../database/entities/tag-definition.entity.js";
import { ImageTag } from "../database/entities/image-tag.entity.js";
import { ConfigService } from "@nestjs/config";
import { ConfigImagePresetType } from "../types/config.type.js";
import path, { dirname } from "node:path";
import crypto from 'node:crypto';
import { getFormatInfoByMimeType } from "../utils/format-info.utils.js";
import { ImagePreset } from "../database/entities/image-preset.entity.js";
import type { IStorageProvider } from "../storage/storage-provider.interface.js";
import { DATA_STORAGE_PROVIDER, CACHE_STORAGE_PROVIDER } from "../storage/storage.module.js";
import { FileSystemStorageProvider } from "../storage/filesystem-storage.provider.js";

export type ResolveResponseType = {
  imagePath: string;
  image: Image;
  imageCaches: Array<{ value: ImageCache, priority: number, path: string }>;
  preset: ConfigImagePresetType
};

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    @InjectRepository(Image)
    private imagesRepository: Repository<Image>,
    @InjectRepository(Slug)
    private slugsRepository: Repository<Slug>,
    @InjectRepository(ImageCache)
    private imageCachesRepository: Repository<ImageCache>,
    @InjectRepository(TagDefinition)
    private tagDefinitionsRepository: Repository<TagDefinition>,
    @InjectRepository(ImageTag)
    private imageTagsRepository: Repository<ImageTag>,
    private readonly configService: ConfigService,
    @Inject(DATA_STORAGE_PROVIDER)
    private readonly dataStorage: IStorageProvider,
    @Inject(CACHE_STORAGE_PROVIDER)
    private readonly cacheStorage: IStorageProvider,
  ) {
  }

  async getImageById(id: string): Promise<Image | null> {
    return this.imagesRepository.findOneBy({ id });
  }

  async resolveImage(options: {
    slug?: string;
    id?: string;
    presetAlias: string;
    preferredMimeTypes: Array<string>;
    /**
     * Allow access to private images when true.
     * This should only be set when the request has a valid signed URL signature.
     */
    allowPrivate?: boolean;
  }): Promise<ResolveResponseType> {
    let image: Image | undefined;

    const presets = this.configService.get<Array<ConfigImagePresetType>>('images.presets');
    const preset = presets.find((p) => options.presetAlias === p.alias);
    if (!preset) {
      this.logger.warn(`Invalid image preset alias: {presetAlias}`, {
        presetAlias: options.presetAlias,
      });
      throw new NotFoundException();
    }

    if (options.id) {
      image = await this.imagesRepository.findOneBy({
        id: options.id,
      });
    } else if (options.slug) {
      const slug = await this.slugsRepository.findOne({
        where: {
          slug: options.slug,
        },
      });

      const imageId = slug.image as unknown as string;

      image = await this.imagesRepository.findOneBy({
        id: imageId,
      });
    }

    if (!image) {
      this.logger.warn(`Image not found for slug: {slug} or id: {id}`, {
        slug: options.slug,
        id: options.id,
      });
      throw new NotFoundException();
    }

    // Check if image is public (for non-admin endpoints)
    // Allow access if explicitly permitted (e.g., via signed URL)
    if (!image.isPublic && !options.allowPrivate) {
      throw new NotFoundException();
    }

    const imageCache = await this.imageCachesRepository.find({
      where: {
        image: image.id as unknown,
        imagePreset: options.presetAlias as unknown,
        mimeType: In(options.preferredMimeTypes),
      },
    });

    const sortedCaches = imageCache
      .map(imageCache => ({
        value: imageCache,
        priority: options.preferredMimeTypes.length - options.preferredMimeTypes.findIndex((mimeType) => mimeType === imageCache.mimeType),
        path: this.getImageCacheFile(image.id, image.creationTime, imageCache.creationTime, options.presetAlias, imageCache.mimeType),
      }))
      .sort((a, b) => a.priority - b.priority);

    return {
      imagePath: path.join(this.getImageDirectory(image.creationTime), `${image.id}.${getFormatInfoByMimeType(image.mimeType).extension}`),
      image,
      preset,
      imageCaches: sortedCaches,
    };
  }

  async saveCached(image: Image, convertedImage: Buffer, alias: string, mimeType: string) {
    const cacheCreationTime = new Date(Date.now());

    const path = this.getImageCacheFile(image.id, image.creationTime, cacheCreationTime, alias, mimeType);
    const pathDir = dirname(path);

    await this.cacheStorage.mkdir(pathDir, {
      recursive: true,
    });

    await this.cacheStorage.writeFile(path, convertedImage);

    await this.imageCachesRepository.save({
      image,
      imagePreset: {
        id: alias,
      },
      mimeType,
      fileSize: convertedImage.length,
      md5: crypto.createHash('md5')
        .update(convertedImage)
        .digest('hex'),
      creationTime: cacheCreationTime,
    });
  }

  async removeCached(image: Image, imagePreset: ImagePreset, mimeType: string, creationTime: Date) {
    await this.imageCachesRepository.delete({
      image,
      imagePreset,
      mimeType,
      creationTime,
    });
  }

  public getImageDirectory(creationTime: Date) {
    const year = creationTime.getUTCFullYear();
    const month = creationTime.getUTCMonth();
    const day = creationTime.getUTCDate();

    const basePath = this.getStorageBasePath(this.dataStorage);
    return path.join(basePath, year.toString(), month.toString().padStart(2, '0'), day.toString().padStart(2, '0'));
  }

  private getImageCacheFile(imageId: string, imageCreationTime: Date, cacheCreationTime: Date, presetAlias: string, mimeType: string) {
    const imageYear = imageCreationTime.getUTCFullYear().toString();
    const imageMonth = imageCreationTime.getUTCMonth().toString().padStart(2, '0');
    const imageDay = imageCreationTime.getUTCDate().toString().padStart(2, '0');

    const cacheYear = cacheCreationTime.getUTCFullYear().toString();
    const cacheMonth = cacheCreationTime.getUTCMonth().toString().padStart(2, '0');
    const cacheDay = cacheCreationTime.getUTCDate().toString().padStart(2, '0');
    const cacheHour = cacheCreationTime.getUTCHours().toString();
    const cacheMinute = cacheCreationTime.getUTCMinutes().toString().padStart(2, '0');
    const cacheSeconds = cacheCreationTime.getUTCSeconds().toString().padStart(2, '0');

    const formatInfo = getFormatInfoByMimeType(mimeType);

    const basePath = this.getStorageBasePath(this.cacheStorage);

    const fileName = `${presetAlias}_${cacheYear}-${cacheMonth}-${cacheDay}_${cacheHour}-${cacheMinute}-${cacheSeconds}.${formatInfo.extension}`;

    return path.join(basePath, imageYear, imageMonth, imageDay, imageId, fileName);
  }

  private getStorageBasePath(storage: IStorageProvider): string {
    // For filesystem storage, we can get the base path
    if (storage instanceof FileSystemStorageProvider) {
      return storage.getBasePath();
    }
    // For S3 or other storage, we use root path
    return '';
  }
}
