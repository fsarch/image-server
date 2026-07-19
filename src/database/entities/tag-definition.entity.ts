import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm"

@Entity({ name: 'tag_definition' })
export class TagDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 2048, unique: true })
  @Index({ unique: true })
  key: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'creation_time' })
  creationTime: Date;

  // KEIN deletion_time - Tag-Definitionen werden nicht gelöscht
}
