export type StorageConfigFilesystem = {
  type: 'filesystem';
  config: {
    path: string;
  };
};

export type StorageConfigS3 = {
  type: 's3';
  config: {
    bucket: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
    prefix?: string;
  };
};

export type StorageConfig = string | StorageConfigFilesystem | StorageConfigS3;
