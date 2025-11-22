import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

export type CompletionPolicy = 'ANY_DONE' | 'ALL_DONE';

@Entity({ name: 'task_assignment_info' })
@Unique(['task_type', 'task_id'])
@Index(['task_type', 'task_id'])
export class TaskAssignmentInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  task_type: 'RECEIVING' | 'SHIPPING' | 'PUTAWAY' | 'CYCLE_COUNT';

  @Column()
  task_id: number;

  @Column({ type: 'varchar', length: 16, default: 'ANY_DONE' })
  policy: CompletionPolicy;

  @Column({ type: 'integer', nullable: true })
  team_id?: number | null;

  @Column({ type: 'integer', nullable: true })
  created_by_user_id?: number | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  all_done_at?: Date | null;
}
