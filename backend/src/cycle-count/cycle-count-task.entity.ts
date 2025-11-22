import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CycleCountLine } from './cycle-count-line.entity';

export enum CycleCountTaskStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  RECONCILED = 'RECONCILED',
}

@Entity('cycle_count_tasks')
export class CycleCountTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  scope: string; // LOKACIJA | ZONA

  @Column({ length: 50 })
  target_code: string;

  @Column({ type: 'enum', enum: CycleCountTaskStatus, default: CycleCountTaskStatus.OPEN })
  status: CycleCountTaskStatus;

  @Column({ nullable: true })
  assigned_to_user_id: number | null;

  @Column()
  created_by_user_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => CycleCountLine, line => line.task)
  lines: CycleCountLine[];
}

