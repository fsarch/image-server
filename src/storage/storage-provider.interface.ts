export interface IStorageProvider {
  /**
   * Read a file from storage
   * @param path - Path to the file
   * @returns Buffer containing file data
   */
  readFile(path: string): Promise<Buffer>;

  /**
   * Write a file to storage
   * @param path - Path where the file should be written
   * @param data - Data to write
   */
  writeFile(path: string, data: Buffer): Promise<void>;

  /**
   * Check if a file exists
   * @param path - Path to check
   * @returns true if file exists, false otherwise
   */
  exists(path: string): Promise<boolean>;

  /**
   * Create directory (for filesystem, no-op for S3)
   * @param path - Path to create
   * @param options - Options like recursive
   */
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

  /**
   * Delete a file
   * @param path - Path to delete
   */
  deleteFile(path: string): Promise<void>;
}
