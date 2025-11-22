import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('orchestration_action_log')
export class OrchestrationActionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  exception_id: string; // e.g., "REC-2025-0012", "LOC-1A0007"

  @Column({ length: 50 })
  action_type: string; // REASSIGN_WORKER, RELOCATE_STOCK, PRIORITIZE_PICK, etc.

  @Column()
  executed_by_user_id: number;

  @CreateDateColumn()
  executed_at: Date;

  @Column('text', { nullable: true })
  payload_json: string; // JSON string of the request body
}

