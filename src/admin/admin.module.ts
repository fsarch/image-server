import { Module } from '@nestjs/common';
import { AdminImagesModule } from './images/admin-images.module.js';

@Module({
  imports: [AdminImagesModule],
})
export class AdminModule {}
