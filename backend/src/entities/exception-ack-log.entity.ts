import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('exception_ack_log')
export class ExceptionAckLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  exception_key: string; // e.g., "REC-2025-0012", "LOC-1A0007", "SHIP-88314"

  @Column()
  ack_by_user_id: number;

  @CreateDateColumn()
  ack_at: Date;
}

