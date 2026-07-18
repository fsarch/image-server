import { Image } from './entities/image.entity.js';
import { ImageCache } from "./entities/image-cache.entity.js";
import { ImagePreset } from "./entities/image-preset.entity.js";
import { Slug } from "./entities/slug.entity.js";
import { BaseTablesMigration } from "./migrations/1719665254677-base-tables.migration.js";

export const DATABASE_OPTIONS = {
  entities: [
    Image,
    ImageCache,
    ImagePreset,
    Slug,
  ],
  migrations: [
    BaseTablesMigration,
  ],
};
