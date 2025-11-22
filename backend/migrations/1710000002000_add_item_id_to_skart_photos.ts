import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddItemIdToSkartPhotos1710000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add item_id column
    await queryRunner.addColumn(
      'skart_photos',
      new TableColumn({
        name: 'item_id',
        type: 'int',
        isNullable: true,
      }),
    );

    // Create index
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "ix_skart_photos_item_id" ON "skart_photos" ("item_id")`);

    // Add foreign key
    await queryRunner.createForeignKey(
      'skart_photos',
      new TableForeignKey({
        columnNames: ['item_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'skart_items',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key
    const table = await queryRunner.getTable('skart_photos');
    const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.indexOf('item_id') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('skart_photos', foreignKey);
    }

    // Remove index
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_skart_photos_item_id"`);

    // Remove column
    await queryRunner.dropColumn('skart_photos', 'item_id');
  }
}

