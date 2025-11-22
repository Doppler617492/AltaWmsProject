import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddStoreToUsers1710000000000 implements MigrationInterface {
  name = 'AddStoreToUsers1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('users', 'store_id');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'store_id',
          type: 'int',
          isNullable: true,
        }),
      );
      await queryRunner.createForeignKey(
        'users',
        new TableForeignKey({
          columnNames: ['store_id'],
          referencedTableName: 'stores',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_stores_code" ON "stores" ("code") WHERE "code" IS NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "ux_stores_code"');
    const table = await queryRunner.getTable('users');
    if (table) {
      const foreignKey = table.foreignKeys.find(fk => fk.columnNames.includes('store_id'));
      if (foreignKey) {
        await queryRunner.dropForeignKey('users', foreignKey);
      }
    }
    const hasColumn = await queryRunner.hasColumn('users', 'store_id');
    if (hasColumn) {
      await queryRunner.dropColumn('users', 'store_id');
    }
  }
}


