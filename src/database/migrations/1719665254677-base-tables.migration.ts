import { type MigrationInterface, type QueryRunner, Table } from 'typeorm';
import { getDataType } from './utils/data-type.mapper.js';

export class BaseTablesMigration implements MigrationInterface {
  name = 'BaseTables1719665254677';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.driver.options.type;

    await queryRunner.createTable(
      new Table({
        name: 'image_preset',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            length: '128',
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'image',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'file_size',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'width',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'height',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'mime_type',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'md5',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'has_alpha',
            type: getDataType(databaseType, 'boolean'),
            isNullable: false,
          },
          {
            name: 'has_animation',
            type: getDataType(databaseType, 'boolean'),
            isNullable: false,
          },
          {
            name: 'creation_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'deletion_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'slug',
        columns: [
          {
            name: 'slug',
            type: 'varchar',
            isPrimary: true,
            length: '2048',
            isNullable: false,
          },
          {
            name: 'image_id',
            type: 'uuid',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            name: 'fk__slug__image_id',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            columnNames: ['image_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'image',
          },
        ],
        indices: [
          {
            name: 'IDX_ae7aeeb8518f91ff9ab5a76809',
            columnNames: ['image_id'],
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'image_cache',
        columns: [
          {
            name: 'image_id',
            type: 'uuid',
            isNullable: false,
            isPrimary: true,
            primaryKeyConstraintName: 'pk__image_cache',
          },
          {
            name: 'image_preset_id',
            type: 'varchar',
            length: '128',
            isNullable: false,
            isPrimary: true,
            primaryKeyConstraintName: 'pk__image_cache',
          },
          {
            name: 'mime_type',
            type: 'varchar',
            length: '128',
            isNullable: false,
            isPrimary: true,
            primaryKeyConstraintName: 'pk__image_cache',
          },
          {
            name: 'file_size',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'md5',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'creation_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            name: 'fk__image_cache__image_id',
            onUpdate: 'NO ACTION',
            onDelete: 'NO ACTION',
            columnNames: ['image_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'image',
          },
          {
            name: 'fk__image_cache__image_preset_id',
            onUpdate: 'NO ACTION',
            onDelete: 'NO ACTION',
            columnNames: ['image_preset_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'image_preset',
          },
        ],
        indices: [
          {
            name: 'IDX_3ef8bd654de085644d4bb63f38',
            columnNames: ['image_id'],
          },
          {
            name: 'IDX_99b2377643784d228b1582ccac',
            columnNames: ['image_preset_id'],
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('image_cache');
    await queryRunner.dropTable('slug');
    await queryRunner.dropTable('image');
    await queryRunner.dropTable('image_preset');
  }
}
