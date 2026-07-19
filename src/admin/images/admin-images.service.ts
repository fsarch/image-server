import { ConflictException, Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Request } from 'express';
import { In, Repository } from "typeorm";
import { Image } from "../../database/entities/image.entity.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { ConfigService } from "@nestjs/config";
import { ConfigStorageType } from "../../types/config.type.js";
import sharp, { FormatEnum } from "sharp";
import crypto from 'node:crypto';
import { Slug } from "../../database/entities/slug.entity.js";
import { TagDefinition } from "../../database/entities/tag-definition.entity.js";
import { ImageTag } from "../../database/entities/image-tag.entity.js";
import { Visibility } from "../../constants/visibility.enum.js";
import slugify from "slugify";
import { getFormatInfoBySharpFormat } from "../../utils/format-info.utils.js";
import type { IStorageProvider } from "../../storage/storage-provider.interface.js";
import { DATA_STORAGE_PROVIDER } from "../../storage/storage.module.js";
import { FileSystemStorageProvider } from "../../storage/filesystem-storage.provider.js";

@Injectable()
export class AdminImagesService {
  constructor(
    @InjectRepository(Image)
    private imagesRepository: Repository<Image>,
    @InjectRepository(Slug)
    private slugsRepository: Repository<Slug>,
    @InjectRepository(TagDefinition)
    private tagDefinitionsRepository: Repository<TagDefinition>,
    @InjectRepository(ImageTag)
    private imageTagsRepository: Repository<ImageTag>,
    private readonly configService: ConfigService,
    @Inject(DATA_STORAGE_PROVIDER)
    private readonly dataStorage: IStorageProvider,
  ) {
  }
  async list(filter?: { isPublic?: boolean; tags?: Array<{ key: string; value?: string }>; page?: number; limit?: number }) {
    const queryBuilder = this.imagesRepository.createQueryBuilder('image');

    // Filter by is_public
    if (filter?.isPublic !== undefined) {
      queryBuilder.andWhere('image.is_public = :isPublic', { isPublic: filter.isPublic });
    }

    // Filter by tags
    if (filter?.tags && filter.tags.length > 0) {
      filter.tags.forEach((tag, index) => {
        queryBuilder.andWhere(
          `(
            EXISTS (
              SELECT 1 FROM image_tag it_${index}
              JOIN tag_definition td_${index} ON td_${index}.id = it_${index}.tag_definition_id
              WHERE it_${index}.image_id = image.id
              AND td_${index}.key = :key_${index}
              ${tag.value ? `AND it_${index}.value = :value_${index}` : ''}
            )
          )`
        );
        queryBuilder.setParameter(`key_${index}`, tag.key);
        if (tag.value) {
          queryBuilder.setParameter(`value_${index}`, tag.value);
        }
      });
    }

    // Pagination
    const page = filter?.page ?? 1;
    const limit = Math.min(filter?.limit ?? 50, 100); // Max 100 per page

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async remove(id: string) {
    return this.imagesRepository.softDelete({
      id,
    });
  }

  async getById(id: string) {
    return this.imagesRepository.findOne({
      where: {
        id,
      },
    });
  }

  async upload(
    request: Request,
    options: { path?: string; visibility?: Visibility; externalId?: string; tags?: Array<{ key: string; value: string }> }
  ) {
    const id = crypto.randomUUID();
    const creationTime = new Date(Date.now());

    // Visibility: default to public
    const isPublic = options.visibility === Visibility.private ? false : true;

    const slug = options?.path ? slugify.default(options.path, {
      remove: /[^\w\s$*_+~.()'"!\-:@\/]+/g,
    }) : undefined;

    if (options.path) {
      const slugExists = await this.slugsRepository.exists({
        where: {
          slug,
        },
      });
      if (slugExists) {
        throw new ConflictException('slug already exists');
      }
    }

    const basePath = this.getImageDirectory(creationTime);

    await this.dataStorage.mkdir(basePath, {
      recursive: true,
    });

    const buffer = await this.streamToBuffer(request);

    const metadata = await sharp(buffer)
      .metadata();

    const formatInfo = getFormatInfoBySharpFormat(metadata.format);

    const filePath = path.join(basePath, `${id}.${formatInfo.extension}`);

    await this.dataStorage.writeFile(filePath, buffer);

    const hashed = crypto
      .createHash('md5')
      .update(buffer)
      .digest("base64");

    const createdImage = this.imagesRepository.create({
      id,
      mimeType: formatInfo.mimeType,
      fileSize: buffer.length,
      hasAlpha: metadata.hasAlpha ?? false,
      hasAnimation: !!(metadata.pages && metadata.delay?.length > 1),
      width: metadata.width,
      height: metadata.height,
      md5: hashed,
      creationTime,
      isPublic,
      externalId: options.externalId,
    });

    const savedImage = await this.imagesRepository.save(createdImage);

    if (options.path) {
      await this.slugsRepository.save({
        image: savedImage,
        slug,
      });
    }

    // Tags verarbeiten
    if (options.tags && options.tags.length > 0) {
      await this.processTagsForImage(savedImage, options.tags);
    }

    return {
      id,
      slug,
    };
  }

  private async processTagsForImage(image: Image, tags: Array<{ key: string; value: string }>) {
    // Validate tag keys
    const tagKeyRegex = /^[a-zA-Z0-9_-]+$/;
    for (const tag of tags) {
      if (!tagKeyRegex.test(tag.key)) {
        throw new BadRequestException(`Invalid tag key: '${tag.key}'. Only alphanumeric, underscore and hyphen are allowed.`);
      }
    }

    // Get or create all tag definitions
    const tagKeys = tags.map(t => t.key);
    const existingTagDefs = await this.tagDefinitionsRepository.find({
      where: { key: In(tagKeys) },
    });

    const existingTagDefMap = new Map<string, TagDefinition>(
      existingTagDefs.map(def => [def.key, def])
    );

    // Create missing tag definitions
    const newTagDefs: TagDefinition[] = [];
    for (const tag of tags) {
      if (!existingTagDefMap.has(tag.key)) {
        const newDef = this.tagDefinitionsRepository.create({
          key: tag.key,
        });
        newTagDefs.push(newDef);
        existingTagDefMap.set(tag.key, newDef);
      }
    }

    if (newTagDefs.length > 0) {
      await this.tagDefinitionsRepository.save(newTagDefs);
    }

    // Create image tags
    const imageTags = tags.map(tag => {
      const tagDef = existingTagDefMap.get(tag.key)!;
      return this.imageTagsRepository.create({
        image: image,
        tagDefinition: tagDef,
        value: tag.value,
      });
    });

    await this.imageTagsRepository.save(imageTags);
  }

  private async streamToBuffer(request: Request) {
    const buffers = [];

    // node.js readable streams implement the async iterator protocol
    for await (const data of request) {
      buffers.push(data);
    }

    return Buffer.concat(buffers);
  }

  private getImageDirectory(creationTime: Date) {
    const year = creationTime.getUTCFullYear();
    const month = creationTime.getUTCMonth();
    const day = creationTime.getUTCDate();

    const basePath = this.getStorageBasePath();
    return path.join(basePath, year.toString(), month.toString().padStart(2, '0'), day.toString().padStart(2, '0'));
  }

  private getStorageBasePath(): string {
    // For filesystem storage, we can get the base path
    if (this.dataStorage instanceof FileSystemStorageProvider) {
      return this.dataStorage.getBasePath();
    }
    // For S3 or other storage, we use root path
    return '';
  }

  // Tag management methods

  async getTagDefinitions(): Promise<Array<TagDefinition>> {
    return this.tagDefinitionsRepository.find();
  }

  async createTagDefinition(key: string, description?: string): Promise<TagDefinition> {
    // Validation
    const tagKeyRegex = /^[a-zA-Z0-9_-]+$/;
    if (!tagKeyRegex.test(key)) {
      throw new BadRequestException(`Invalid tag key: '${key}'. Only alphanumeric, underscore and hyphen are allowed.`);
    }

    // Check if key already exists
    const existing = await this.tagDefinitionsRepository.findOne({
      where: { key },
    });
    if (existing) {
      throw new ConflictException(`Tag definition with key '${key}' already exists`);
    }

    const tagDef = this.tagDefinitionsRepository.create({
      key,
      description,
    });

    return this.tagDefinitionsRepository.save(tagDef);
  }

  async getTagsForImage(imageId: string): Promise<Array<ImageTag>> {
    return this.imageTagsRepository.find({
      where: { image: { id: imageId } },
      relations: { tagDefinition: true },
    });
  }

  async addTagToImage(imageId: string, key: string, value: string): Promise<ImageTag> {
    const image = await this.imagesRepository.findOne({
      where: { id: imageId },
    });
    if (!image) {
      throw new ConflictException(`Image with id '${imageId}' not found`);
    }

    // Find or create tag definition
    let tagDef = await this.tagDefinitionsRepository.findOne({
      where: { key },
    });

    if (!tagDef) {
      // Validation
      const tagKeyRegex = /^[a-zA-Z0-9_-]+$/;
      if (!tagKeyRegex.test(key)) {
        throw new BadRequestException(`Invalid tag key: '${key}'. Only alphanumeric, underscore and hyphen are allowed.`);
      }

      tagDef = this.tagDefinitionsRepository.create({ key });
      tagDef = await this.tagDefinitionsRepository.save(tagDef);
    }

    const imageTag = this.imageTagsRepository.create({
      image: image,
      tagDefinition: tagDef,
      value,
    });

    return this.imageTagsRepository.save(imageTag);
  }

  async removeTagFromImage(imageId: string, tagId: string): Promise<void> {
    await this.imageTagsRepository.delete({
      id: tagId,
      image: { id: imageId },
    });
  }
}
