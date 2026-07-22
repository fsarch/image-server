import { Role } from "../constants/role.enum.js";

enum ImageSizingAlgorithm {
  contain = 'contain',
  cover = 'cover',
  inside = 'inside',
  outside = 'outside',
}

enum ImageConversion {
  on_demand = 'on_demand',
}

export enum SignedUrlAlgorithm {
  HMAC_SHA256 = 'HMAC-SHA256',
  ED25519 = 'ED25519',
}

export type ConfigSignedUrlKeyType = {
  id: string;
  algorithm: SignedUrlAlgorithm;
} & (
  | {
      algorithm: SignedUrlAlgorithm.HMAC_SHA256;
      secret: string;
    }
  | {
      algorithm: SignedUrlAlgorithm.ED25519;
      publicKey: string;
    }
);

export type ConfigSignedUrlsType = {
  enabled: boolean;
  keys: Array<ConfigSignedUrlKeyType>;
};

export type ConfigType = {
  auth: ConfigAuthType;
  uac: ConfigStaticUacType;
  images: ConfigImagesType;
  database: ConfigDatabaseType;
  storage: ConfigStorageType;
  naming: ConfigNamingType;
  caching: ConfigCachingType;
  signed_urls?: ConfigSignedUrlsType;
};

type ConfigAuthType = ConfigStaticAuthType;

export type ConfigStaticAuthType = {
  type: 'static';
  secret: string;
  users: Array<ConfigAuthUserType>;
};

type ConfigAuthUserType = {
  id: string;
  username: string;
  password: string;
};

export type ConfigStaticUacType = {
  type: 'static';
  users: Array<ConfigUacUserType>;
};

type ConfigUacUserType = {
  user_id: string;
  permissions: Array<Role>;
};

type ConfigImagesType = {
  presets: Array<ConfigImagePresetType>;
};

export type ConfigImagePresetType = {
  alias: string;
  width: number;
  height: number;
  algorithm: ImageSizingAlgorithm;
  conversion: ImageConversion;
  cached: boolean;
};

export type ConfigDatabaseType = ConfigSqliteDatabaseType | ConfigCockroachdbDatabaseType;

type ConfigSqliteDatabaseType = {
  type: 'sqlite';
  database: string;
};

type ConfigCockroachdbDatabaseType = {
  type: 'cockroachdb';
  host: string;
  username: string;
  password?: string;
  database: string;
  port?: number;
  ssl?: {
    rejectUnauthorized?: boolean;
    ca?: string | {
      path: string;
    };
    cert?: string | {
      path: string;
    };
    key?: string | {
      path: string;
    };
  };
};

import { StorageConfig } from '../storage/storage-config.types.js';

export type ConfigStorageType = {
  data: StorageConfig;
  cache: StorageConfig;
};

export type ConfigNamingType = {
  type: 'named';
  path: string;
};

export type ConfigCachingType = {
  memory: {
    enabled: boolean;
    caches: {
      resolve_path: ConfigMemoryCachingSingleType;
      image_data: ConfigMemoryCachingSingleType;
    };
  };
  client: {
    enabled: boolean;
    options: ConfigCachingClientType;
  }
};

export type ConfigCachingClientType = {
  max_age: number;
  s_max_age: number;
};

export type ConfigMemoryCachingSingleType = {
  ttl: number | 'Infinity';
}
