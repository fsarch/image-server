import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn
} from "typeorm"

@Entity({
  name: 'image',
})
export class Image {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: 'file_size',
  })
  fileSize: number;

  @Column()
  width: number;

  @Column()
  height: number;

  @Column({
    name: 'mime_type',
    length: '128',
  })
  mimeType: string;

  @Column({
    name: 'md5',
    length: '32',
  })
  md5: string;

  @Column({
    name: 'has_alpha',
  })
  hasAlpha: boolean;

  @Column({
    name: 'has_animation',
  })
  hasAnimation: boolean;

  @Column({
    name: 'is_public',
    type: 'boolean',
    default: true,
  })
  @Index()
  isPublic: boolean;

  @Column({
    name: 'external_id',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  @Index()
  externalId?: string;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time'
  })
  deletionTime: Date;
}
