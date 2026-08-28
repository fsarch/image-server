import { Injectable } from '@nestjs/common';
import { IStorageProvider } from './storage-provider.interface.js';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { StorageConfigS3 } from './storage-config.types.js';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(config: StorageConfigS3['config']) {
    this.bucket = config.bucket;
    this.prefix = config.prefix || '';

    this.client = new S3Client({
      region: config.region,
      credentials: config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
      endpoint: config.endpoint,
    });
  }

  private getS3Key(path: string): string {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return this.prefix ? `${this.prefix}/${cleanPath}` : cleanPath;
  }

  async readFile(path: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.getS3Key(path),
    });

    const response = await this.client.send(command);
    const stream = response.Body;

    if (!stream) {
      throw new Error('No body in S3 response');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async writeFile(path: string, data: Buffer): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.getS3Key(path),
      Body: data,
    });

    await this.client.send(command);
  }

  async exists(path: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.getS3Key(path),
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    // No-op for S3 as directories don't exist
    return Promise.resolve();
  }

  async deleteFile(path: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.getS3Key(path),
    });

    await this.client.send(command);
  }
}
