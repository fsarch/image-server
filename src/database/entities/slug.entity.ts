import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Image } from './image.entity.js';

@Entity()
export class Slug {
  @PrimaryColumn({ type: 'varchar', length: 2048 })
  slug: string;

  @Column({ type: 'uuid', name: 'image_id' })
  @ManyToOne(
    () => Image,
    (image) => image.id,
    {
      nullable: false,
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'image_id',
    foreignKeyConstraintName: 'fk__slug__image_id',
  })
  image!: Image;
}
