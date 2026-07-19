import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex, TableForeignKey } from "typeorm";
import { getDataType } from "./utils/data-type.mapper.js";

export class AddImageMetadataAndTags1784408015000 implements MigrationInterface {
    name = 'AddImageMetadataAndTags1784408015000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const databaseType = queryRunner.connection.driver.options.type;

        // 1. Add new columns to image table
        await queryRunner.addColumn('image', new TableColumn({
            name: 'is_public',
            type: getDataType(databaseType, 'boolean'),
            isNullable: false,
            default: true,
        }));

        await queryRunner.addColumn('image', new TableColumn({
            name: 'external_id',
            type: 'varchar',
            length: '2048',
            isNullable: true,
        }));

        // 2. Create indexes for image table
        await queryRunner.createIndex('image', new TableIndex({
            name: 'IDX_image_is_public',
            columnNames: ['is_public'],
        }));

        await queryRunner.createIndex('image', new TableIndex({
            name: 'IDX_image_external_id',
            columnNames: ['external_id'],
        }));

        // 3. Create tag_definition table
        await queryRunner.createTable(new Table({
            name: 'tag_definition',
            columns: [{
                name: 'id',
                type: 'uuid',
                isPrimary: true,
                isNullable: false,
            }, {
                name: 'key',
                type: 'varchar',
                length: '2048',
                isNullable: false,
                isUnique: true,
            }, {
                name: 'description',
                type: 'text',
                isNullable: true,
            }, {
                name: 'creation_time',
                type: getDataType(databaseType, 'timestamp'),
                isNullable: false,
                default: 'now()',
            }],
            indices: [{
                name: 'IDX_tag_definition_key',
                columnNames: ['key'],
                isUnique: true,
            }],
        }));

        // 4. Create image_tag table
        await queryRunner.createTable(new Table({
            name: 'image_tag',
            columns: [{
                name: 'id',
                type: 'uuid',
                isPrimary: true,
                isNullable: false,
            }, {
                name: 'image_id',
                type: 'uuid',
                isNullable: false,
            }, {
                name: 'tag_definition_id',
                type: 'uuid',
                isNullable: false,
            }, {
                name: 'value',
                type: 'varchar',
                length: '4096',
                isNullable: false,
            }, {
                name: 'creation_time',
                type: getDataType(databaseType, 'timestamp'),
                isNullable: false,
                default: 'now()',
            }],
            foreignKeys: [
                new TableForeignKey({
                    name: 'fk__image_tag__image_id',
                    columnNames: ['image_id'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'image',
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                }),
                new TableForeignKey({
                    name: 'fk__image_tag__tag_definition_id',
                    columnNames: ['tag_definition_id'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'tag_definition',
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                }),
            ],
            indices: [
                new TableIndex({
                    name: 'IDX_image_tag_image_id',
                    columnNames: ['image_id'],
                }),
                new TableIndex({
                    name: 'IDX_image_tag_tag_definition_id',
                    columnNames: ['tag_definition_id'],
                }),
                new TableIndex({
                    name: 'IDX_image_tag_value',
                    columnNames: ['value'],
                }),
                new TableIndex({
                    name: 'IDX_image_tag_image_id_tag_definition_id',
                    columnNames: ['image_id', 'tag_definition_id'],
                }),
            ],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('image_tag');
        await queryRunner.dropTable('tag_definition');
        await queryRunner.dropIndex('image', 'IDX_image_external_id');
        await queryRunner.dropIndex('image', 'IDX_image_is_public');
        await queryRunner.dropColumn('image', 'external_id');
        await queryRunner.dropColumn('image', 'is_public');
    }
}
