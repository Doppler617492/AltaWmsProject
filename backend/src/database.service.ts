import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedDatabase } from './seeds/seed';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    try {
      // Ensure auxiliary tables (teams, task_assignees) exist
      await this.applySqlIfPresent('sql/2025-10-31-team-task-assignees.sql');
      // Create performance views if provided
      await this.applySqlIfPresent('src/performance/entities/performance-worker.view.sql');
      await this.applySqlIfPresent('src/performance/entities/performance-team.view.sql');
      // Seed database
      await seedDatabase(this.dataSource);
      console.log('✅ DB OK - Connected to PostgreSQL');
    } catch (error) {
      console.log('❌ DB not ready:', error.message);
    }
  }

  private async applySqlIfPresent(relPath: string) {
    // In Docker image, source is copied to /app; SQL is at /app/sql/...
    // Use CWD + relative path without hardcoding 'backend'.
    const abs = join(process.cwd(), relPath);
    if (!fs.existsSync(abs)) return;
    try {
      const sql = fs.readFileSync(abs, 'utf8');
      if (!sql.trim()) return;
      await this.dataSource.query(sql);
      console.log(`✅ Applied SQL: ${relPath}`);
    } catch (e: any) {
      console.log(`ℹ️ SQL apply skipped (${relPath}):`, e?.message || e);
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
