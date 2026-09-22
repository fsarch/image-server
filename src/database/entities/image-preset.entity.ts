import { Entity, PrimaryColumn } from 'typeorm';

@Entity({
  name: 'image_preset',
})
export class ImagePreset {
  @PrimaryColumn('string', { type: 'varchar', length: 128 })
  id: string;
}
