import { Test, TestingModule } from '@nestjs/testing';
import { S3StorageProvider } from './s3-storage.provider';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

jest.mock('@aws-sdk/client-s3');

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;
  let mockS3Client: any;

  const mockConfig = {
    bucket: 'test-bucket',
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  };

  beforeEach(async () => {
    mockS3Client = {
      send: jest.fn(),
    };

    (S3Client as jest.Mock).mockImplementation(() => mockS3Client);

    provider = new S3StorageProvider(mockConfig);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('readFile', () => {
    it('should read a file from S3', async () => {
      const testData = Buffer.from('test data');
      const mockStream = Readable.from([testData]);
      
      mockS3Client.send.mockResolvedValue({
        Body: mockStream,
      });

      const result = await provider.readFile('test/file.txt');

      expect(result).toEqual(testData);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(GetObjectCommand)
      );
    });

    it('should handle S3 key with prefix', async () => {
      const providerWithPrefix = new S3StorageProvider({
        ...mockConfig,
        prefix: 'my-prefix',
      });
      
      const testData = Buffer.from('test data');
      const mockStream = Readable.from([testData]);
      
      mockS3Client.send.mockResolvedValue({
        Body: mockStream,
      });

      await providerWithPrefix.readFile('test/file.txt');

      expect(mockS3Client.send).toHaveBeenCalled();
    });
  });

  describe('writeFile', () => {
    it('should write a file to S3', async () => {
      const testBuffer = Buffer.from('test data');
      mockS3Client.send.mockResolvedValue({});

      await provider.writeFile('test/file.txt', testBuffer);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );
    });
  });

  describe('exists', () => {
    it('should return true if file exists in S3', async () => {
      mockS3Client.send.mockResolvedValue({});

      const result = await provider.exists('test/file.txt');

      expect(result).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(HeadObjectCommand)
      );
    });

    it('should return false if file does not exist in S3', async () => {
      const notFoundError = new Error('Not Found');
      (notFoundError as any).name = 'NotFound';
      mockS3Client.send.mockRejectedValue(notFoundError);

      const result = await provider.exists('test/file.txt');

      expect(result).toBe(false);
    });

    it('should return false if file does not exist (404 status)', async () => {
      const notFoundError = new Error('Not Found');
      (notFoundError as any).$metadata = { httpStatusCode: 404 };
      mockS3Client.send.mockRejectedValue(notFoundError);

      const result = await provider.exists('test/file.txt');

      expect(result).toBe(false);
    });

    it('should throw error for other errors', async () => {
      const error = new Error('S3 Error');
      mockS3Client.send.mockRejectedValue(error);

      await expect(provider.exists('test/file.txt')).rejects.toThrow('S3 Error');
    });
  });

  describe('mkdir', () => {
    it('should be a no-op for S3', async () => {
      await provider.mkdir('test/dir', { recursive: true });

      expect(mockS3Client.send).not.toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should delete a file from S3', async () => {
      mockS3Client.send.mockResolvedValue({});

      await provider.deleteFile('test/file.txt');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(DeleteObjectCommand)
      );
    });
  });
});
