import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkartTables1709999999999 implements MigrationInterface {
  name = 'AddSkartTables1709999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_stores_code ON stores(code) WHERE code IS NOT NULL`);

    await queryRunner.query(`CREATE TYPE skart_documents_status_enum AS ENUM ('SUBMITTED', 'RECEIVED')`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS skart_documents (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(40) NOT NULL UNIQUE,
        store_id INTEGER NOT NULL REFERENCES stores(id),
        status skart_documents_status_enum NOT NULL DEFAULT 'SUBMITTED',
        created_by INTEGER NOT NULL REFERENCES users(id),
        received_by INTEGER NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        received_at TIMESTAMP WITH TIME ZONE NULL,
        note TEXT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_skart_documents_store ON skart_documents(store_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS skart_items (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES skart_documents(id) ON DELETE CASCADE,
        code VARCHAR(80) NOT NULL,
        name VARCHAR(255) NOT NULL,
        item_id INTEGER NULL REFERENCES items(id),
        qty NUMERIC(12,3) NOT NULL,
        reason VARCHAR(120) NOT NULL,
        received_qty NUMERIC(12,3) NULL,
        note TEXT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_skart_items_document_id ON skart_items(document_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_skart_items_code ON skart_items(code)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS skart_photos (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES skart_documents(id) ON DELETE CASCADE,
        path VARCHAR(255) NOT NULL,
        uploaded_by INTEGER NULL REFERENCES users(id),
        uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_skart_photos_document_id ON skart_photos(document_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        entity VARCHAR(80) NOT NULL,
        entity_id INTEGER NOT NULL,
        action VARCHAR(40) NOT NULL,
        payload JSONB NULL,
        actor_id INTEGER NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON audit_logs(entity, entity_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_audit_logs_entity`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_skart_photos_document_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS skart_photos`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_skart_items_code`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_skart_items_document_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS skart_items`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_skart_documents_store`);
    await queryRunner.query(`DROP TABLE IF EXISTS skart_documents`);
    await queryRunner.query(`DROP TYPE IF EXISTS skart_documents_status_enum`);
  }
}


