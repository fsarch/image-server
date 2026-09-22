import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import {
  ConfigCachingType,
  type ConfigMemoryCachingSingleType,
} from '../types/config.type.js';
import { CacheType } from './cache.enum.js';

const imageDataCache = new LRUCache<string, { size: number; value: unknown }>({
  max: 500,
  maxSize: 250 * 1024 * 1024,
  sizeCalculation: (value) => {
    return value.size;
  },
});

const resolvePathCache = new LRUCache<string, { size: number; value: unknown }>(
  {
    max: 500,
    maxSize: 250 * 1024 * 1024,
    sizeCalculation: (value) => {
      return JSON.stringify(value).length;
    },
  },
);

@Injectable()
export class CacheService {
  constructor(private readonly configService: ConfigService) {}

  async getOrCreateCache<T>(
    cacheType: CacheType,
    key: Array<string>,
    cb: () => Promise<T>,
    options: { calculateSize: (value: T) => number },
  ): Promise<T> {
    const cache = this.getCacheByType(cacheType);

    const cacheKey = `${cacheType}:${key.join(':')}`;

    let cacheValue = await cache.get(cacheKey);
    if (!cacheValue) {
      const generatedValue = await cb();
      cacheValue = {
        value: await cb(),
        size: options.calculateSize(generatedValue),
      };

      const cacheConfig = this.configService.get<ConfigMemoryCachingSingleType>(
        `caching.memory.caches.${cacheType}`,
      );
      const cacheTtl =
        cacheConfig.ttl === 'Infinity' ? undefined : cacheConfig.ttl;

      await cache.set(cacheKey, cacheValue, {
        ttl: cacheTtl,
      });
    }

    return cacheValue.value as T;
  }

  private getCacheByType(cacheType: CacheType) {
    switch (cacheType) {
      case CacheType.ImageData:
        return imageDataCache;
      case CacheType.ResolvePath:
        return resolvePathCache;
      default:
        throw new Error('unknown cache type');
    }
  }
}
