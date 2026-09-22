import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Image } from './image.entity.js';
import { ImagePreset } from './image-preset.entity.js';

@Entity({
  name: 'image_cache',
})
export class ImageCache {
  @Column({
    type: 'uuid',
    name: 'image_id',
    primary: true,
    primaryKeyConstraintName: 'pk__image_cache',
  })
  @ManyToOne(
    () => Image,
    (image) => image.id,
    {
      nullable: false,
      onUpdate: 'NO ACTION',
      onDelete: 'NO ACTION',
    },
  )
  @JoinColumn({
    name: 'image_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk__image_cache__image_id',
  })
  image!: Image;

  @Column({
    type: 'varchar',
    length: 128,
    name: 'image_preset_id',
    primary: true,
    primaryKeyConstraintName: 'pk__image_cache',
  })
  @ManyToOne(
    () => ImagePreset,
    (imagePreset) => imagePreset.id,
    {
      nullable: false,
      onUpdate: 'NO ACTION',
      onDelete: 'NO ACTION',
    },
  )
  @JoinColumn({
    name: 'image_preset_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk__image_cache__image_preset_id',
  })
  imagePreset!: ImagePreset;

  @Column({
    type: 'varchar',
    length: 128,
    name: 'mime_type',
    primary: true,
    primaryKeyConstraintName: 'pk__image_cache',
  })
  mimeType: string;

  @Column({
    name: 'file_size',
  })
  fileSize: number;

  @Column({ type: 'varchar', length: 32 })
  md5: string;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;
}
