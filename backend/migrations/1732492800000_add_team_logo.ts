import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeamLogo1732492800000 implements MigrationInterface {
  name = 'AddTeamLogo1732492800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE teams 
      ADD COLUMN IF NOT EXISTS logo VARCHAR(10) NULL
    `);
    
    // Set default emoji logos for existing teams
    await queryRunner.query(`
      UPDATE teams 
      SET logo = CASE 
        WHEN id = 1 THEN '🚀'
        WHEN id = 2 THEN '⚡'
        WHEN id = 3 THEN '🔥'
        WHEN id = 4 THEN '💎'
        WHEN id = 5 THEN '⭐'
        ELSE '👥'
      END
      WHERE logo IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE teams 
      DROP COLUMN IF EXISTS logo
    `);
  }
}
