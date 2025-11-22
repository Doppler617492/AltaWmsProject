import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export enum JobType {
  LOCATION_LABELS = 'LOCATION_LABELS',
  PALLET_LABELS = 'PALLET_LABELS',
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

@Entity('print_jobs')
export class PrintJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: JobType,
  })
  job_type: JobType;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_user_id' })
  requested_by: User;

  @Column()
  requested_by_user_id: number;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  payload_json: any;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.QUEUED,
  })
  status: JobStatus;

  @CreateDateColumn()
  created_at: Date;
}

