import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, Unique, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export type TaskType = 'RECEIVING' | 'SHIPPING' | 'PUTAWAY' | 'CYCLE_COUNT';
export type AssigneeStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'DONE';

@Entity({ name: 'task_assignees' })
@Unique(['task_type', 'task_id', 'user_id'])
@Index(['task_type', 'task_id'])
@Index(['user_id', 'status'])
export class TaskAssignee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  task_type: TaskType;

  @Column()
  task_id: number;

  @Column()
  user_id: number;

  @Column({ type: 'varchar', length: 16, default: 'ASSIGNED' })
  status: AssigneeStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  started_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completed_at?: Date | null;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
