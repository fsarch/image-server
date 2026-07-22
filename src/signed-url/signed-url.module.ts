import { Module } from '@nestjs/common';
import { SignedUrlService } from './signed-url.service.js';

/**
 * Module for signed URL functionality.
 * 
 * This module provides services for generating and validating signed URLs,
 * which allow temporary access to private resources.
 */
@Module({
  providers: [SignedUrlService],
  exports: [SignedUrlService],
})
export class SignedUrlModule {}
