import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sla_compliance_cache')
export class SlaComplianceCache {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: Date; // YYYY-MM-DD

  @Column('numeric')
  compliance_score: number; // % SLA poštovanja

  @Column()
  total_events: number;

  @Column()
  breaches: number;

  @Column('numeric')
  avg_resolution_min: number;

  @Column({ length: 50, nullable: true })
  top_issue_type: string | null;

  @CreateDateColumn()
  created_at: Date;
}

