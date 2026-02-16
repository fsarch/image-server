import { Injectable } from '@nestjs/common';
import { IStorageProvider } from './storage-provider.interface.js';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

@Injectable()
export class FileSystemStorageProvider implements IStorageProvider {
  constructor(private readonly basePath: string) {}

  async readFile(path: string): Promise<Buffer> {
    return fs.readFile(path);
  }

  async writeFile(path: string, data: Buffer): Promise<void> {
    await fs.writeFile(path, data);
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(path, options);
  }

  async deleteFile(path: string): Promise<void> {
    await fs.unlink(path);
  }

  getBasePath(): string {
    return this.basePath;
  }
}
