import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignedToUserIdToSkartDocuments1711000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Proveri da li kolona već postoji
    const table = await queryRunner.getTable('skart_documents');
    const hasColumn = table?.columns.find(col => col.name === 'assigned_to_user_id');
    
    if (!hasColumn) {
      await queryRunner.query(`
        ALTER TABLE skart_documents 
        ADD COLUMN assigned_to_user_id INTEGER NULL
      `);
      
      // Dodaj index za brže pretrage
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS ix_skart_documents_assigned_to_user_id 
        ON skart_documents(assigned_to_user_id)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS ix_skart_documents_assigned_to_user_id
    `);
    
    await queryRunner.query(`
      ALTER TABLE skart_documents 
      DROP COLUMN IF EXISTS assigned_to_user_id
    `);
  }
}

