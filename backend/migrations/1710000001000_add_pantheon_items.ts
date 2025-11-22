import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPantheonItems1710000001000 implements MigrationInterface {
  name = 'AddPantheonItems1710000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pantheon_items (
        id SERIAL PRIMARY KEY,
        ident VARCHAR(100) UNIQUE NOT NULL,
        naziv VARCHAR(500) NOT NULL,
        supplier_name VARCHAR(255),
        supplier_code VARCHAR(255),
        primary_classification VARCHAR(255),
        unit VARCHAR(32),
        barcodes JSONB NOT NULL DEFAULT '[]'::jsonb,
        changed_at TIMESTAMPTZ NULL,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pantheon_items_ident ON pantheon_items(ident)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pantheon_items_name ON pantheon_items USING GIN (to_tsvector('simple', naziv))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pantheon_items_barcodes ON pantheon_items USING GIN (barcodes)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pantheon_items_barcodes`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pantheon_items_name`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pantheon_items_ident`);
    await queryRunner.query(`DROP TABLE IF EXISTS pantheon_items`);
  }
}


