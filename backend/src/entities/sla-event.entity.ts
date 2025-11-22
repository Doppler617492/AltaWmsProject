import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sla_events')
export class SlaEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  exception_id: string; // "REC-2025-0012", "LOC-1A0007", etc.

  @Column({ length: 50 })
  type: string; // RECEIVING_DELAY, CAPACITY_OVERLOAD, LATE_SHIPMENT, WORKER_GAP, etc.

  @Column({ length: 20 })
  severity: string; // info, medium, high, critical

  @Column({ type: 'timestamp' })
  started_at: Date; // kada je problem detektovan

  @Column({ type: 'timestamp', nullable: true })
  breached_at: Date | null; // kada je prešao SLA

  @Column({ type: 'timestamp', nullable: true })
  resolved_at: Date | null; // kada je problem rešen

  @Column('numeric', { nullable: true })
  duration_min: number; // resolved_at - started_at

  @Column('numeric')
  sla_limit_min: number; // SLA prag iz FAZA 6.8

  @Column({ nullable: true })
  resolved_by_user_id: number | null; // ko je "preuzeo" problem

  @Column({ length: 50, nullable: true })
  executed_action: string | null; // REASSIGN_WORKER, RELOCATE_STOCK, UNHOLD, PRIORITIZE_PICK

  @Column({ length: 50, nullable: true })
  location_code: string | null;

  @Column({ length: 50, nullable: true })
  zone: string | null;

  @Column({ length: 100, nullable: true })
  item_sku: string | null;

  @Column({ length: 100, nullable: true })
  worker: string | null; // ime radnika koji je bio dodeljen

  @Column('text', { nullable: true })
  comments: string | null; // bilješke korisnika

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

