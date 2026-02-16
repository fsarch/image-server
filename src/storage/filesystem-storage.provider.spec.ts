import { Test, TestingModule } from '@nestjs/testing';
import { FileSystemStorageProvider } from './filesystem-storage.provider';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

jest.mock('node:fs/promises');
jest.mock('node:fs');

describe('FileSystemStorageProvider', () => {
  let provider: FileSystemStorageProvider;
  const basePath = '/test/path';

  beforeEach(async () => {
    provider = new FileSystemStorageProvider(basePath);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('readFile', () => {
    it('should read a file', async () => {
      const testBuffer = Buffer.from('test data');
      (fs.readFile as jest.Mock).mockResolvedValue(testBuffer);

      const result = await provider.readFile('/test/file.txt');

      expect(result).toBe(testBuffer);
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt');
    });
  });

  describe('writeFile', () => {
    it('should write a file', async () => {
      const testBuffer = Buffer.from('test data');
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await provider.writeFile('/test/file.txt', testBuffer);

      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.txt', testBuffer);
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);

      const result = await provider.exists('/test/file.txt');

      expect(result).toBe(true);
      expect(existsSync).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false if file does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);

      const result = await provider.exists('/test/file.txt');

      expect(result).toBe(false);
    });
  });

  describe('mkdir', () => {
    it('should create a directory', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await provider.mkdir('/test/dir', { recursive: true });

      expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await provider.deleteFile('/test/file.txt');

      expect(fs.unlink).toHaveBeenCalledWith('/test/file.txt');
    });
  });

  describe('getBasePath', () => {
    it('should return the base path', () => {
      expect(provider.getBasePath()).toBe(basePath);
    });
  });
});
