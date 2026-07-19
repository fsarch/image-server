import { Image } from './entities/image.entity.js';
import { ImageCache } from "./entities/image-cache.entity.js";
import { ImagePreset } from "./entities/image-preset.entity.js";
import { Slug } from "./entities/slug.entity.js";
import { TagDefinition } from "./entities/tag-definition.entity.js";
import { ImageTag } from "./entities/image-tag.entity.js";
import { BaseTablesMigration } from "./migrations/1719665254677-base-tables.migration.js";
import { AddImageMetadataAndTags1784408015000 } from "./migrations/1784408015000-add-image-metadata-and-tags.migration.js";

export const DATABASE_OPTIONS = {
  entities: [
    Image,
    ImageCache,
    ImagePreset,
    Slug,
    TagDefinition,
    ImageTag,
  ],
  migrations: [
    BaseTablesMigration,
    AddImageMetadataAndTags1784408015000,
  ],
};
