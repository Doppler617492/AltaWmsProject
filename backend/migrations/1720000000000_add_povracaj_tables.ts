import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPovracajTables1720000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Kreiraj enum za Povraćaj status ako ne postoji
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE povracaj_documents_status_enum AS ENUM ('SUBMITTED', 'RECEIVED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Kreiraj povracaj_documents tabelu
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS povracaj_documents (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(40) UNIQUE NOT NULL,
        store_id INTEGER NOT NULL,
        status povracaj_documents_status_enum NOT NULL DEFAULT 'SUBMITTED',
        created_by INTEGER NOT NULL,
        assigned_to_user_id INTEGER NULL,
        received_by INTEGER NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        received_at TIMESTAMP WITH TIME ZONE NULL,
        note TEXT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_povracaj_documents_store FOREIGN KEY (store_id) REFERENCES stores(id),
        CONSTRAINT fk_povracaj_documents_created_by FOREIGN KEY (created_by) REFERENCES users(id),
        CONSTRAINT fk_povracaj_documents_assigned_to FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
        CONSTRAINT fk_povracaj_documents_received_by FOREIGN KEY (received_by) REFERENCES users(id)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_povracaj_documents_uid ON povracaj_documents(uid)
    `);

    // Kreiraj povracaj_items tabelu
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS povracaj_items (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL,
        code VARCHAR(80) NOT NULL,
        name VARCHAR(255) NOT NULL,
        item_id INTEGER NULL,
        qty NUMERIC(12, 3) NOT NULL,
        reason VARCHAR(120) NOT NULL,
        received_qty NUMERIC(12, 3) NULL,
        note TEXT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_povracaj_items_document FOREIGN KEY (document_id) REFERENCES povracaj_documents(id) ON DELETE CASCADE,
        CONSTRAINT fk_povracaj_items_item FOREIGN KEY (item_id) REFERENCES items(id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_povracaj_items_document_id ON povracaj_items(document_id)
    `);

    // Kreiraj povracaj_photos tabelu
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS povracaj_photos (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL,
        item_id INTEGER NULL,
        path VARCHAR(255) NOT NULL,
        uploaded_by INTEGER NULL,
        uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_povracaj_photos_document FOREIGN KEY (document_id) REFERENCES povracaj_documents(id) ON DELETE CASCADE,
        CONSTRAINT fk_povracaj_photos_item FOREIGN KEY (item_id) REFERENCES povracaj_items(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_povracaj_photos_document_id ON povracaj_photos(document_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_povracaj_photos_item_id ON povracaj_photos(item_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS povracaj_photos`);
    await queryRunner.query(`DROP TABLE IF EXISTS povracaj_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS povracaj_documents`);
    await queryRunner.query(`DROP TYPE IF EXISTS povracaj_documents_status_enum`);
  }
}

