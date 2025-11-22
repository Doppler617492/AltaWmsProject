import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80 })
  entity: string;

  @Index('ix_audit_logs_entity_id')
  @Column({ type: 'int' })
  entity_id: number;

  @Column({ type: 'varchar', length: 40 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @Column({ type: 'int', nullable: true })
  actor_id: number | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}


