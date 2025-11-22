import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CycleCountTask } from './cycle-count-task.entity';

export enum CycleCountLineStatus {
  PENDING = 'PENDING',
  COUNTED = 'COUNTED',
  APPROVED = 'APPROVED',
}

@Entity('cycle_count_lines')
export class CycleCountLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  task_id: number;

  @Column()
  location_id: number;

  @Column()
  item_id: number;

  @Column('numeric', { precision: 14, scale: 3, default: 0 })
  system_qty: string;

  @Column('numeric', { precision: 14, scale: 3, nullable: true })
  counted_qty: string | null;

  @Column('numeric', { precision: 14, scale: 3, nullable: true })
  difference: string | null;

  @Column({ type: 'enum', enum: CycleCountLineStatus, default: CycleCountLineStatus.PENDING })
  status: CycleCountLineStatus;

  @Column({ nullable: true })
  approved_by_user_id: number | null;

  @ManyToOne(() => CycleCountTask, task => task.lines)
  @JoinColumn({ name: 'task_id' })
  task: CycleCountTask;
}

