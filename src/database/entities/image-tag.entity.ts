import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm"
import { Image } from "./image.entity.js";
import { TagDefinition } from "./tag-definition.entity.js";

@Entity({ name: 'image_tag' })
@Index(['image'])
@Index(['tagDefinition'])
@Index(['value'])
@Index(['image', 'tagDefinition'])
export class ImageTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'image_id' })
  @ManyToOne(() => Image, (image) => image.id, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'image_id' })
  image: Image;

  @Column({ type: 'uuid', name: 'tag_definition_id' })
  @ManyToOne(() => TagDefinition, (tagDef) => tagDef.id, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tag_definition_id' })
  tagDefinition: TagDefinition;

  @Column({ type: 'varchar', length: 4096, name: 'value' })
  @Index()
  value: string;

  @CreateDateColumn({ name: 'creation_time' })
  creationTime: Date;

  // Optional: Soft-Delete für Konsistenz
  // @DeleteDateColumn({ name: 'deletion_time' })
  // deletionTime?: Date;
}

// Wichtig: Es gibt KEINEN Unique Constraint auf (image_id, tag_definition_id),
// da ein Tag mehrmals einem Bild mit unterschiedlichen Values hinzugefügt werden kann.
