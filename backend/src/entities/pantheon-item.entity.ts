import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pantheon_items')
export class PantheonItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  ident: string;

  @Column({ type: 'varchar', length: 500 })
  naziv: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  supplier_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  supplier_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  primary_classification: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  barcodes: string[];

  @Column({ type: 'timestamp with time zone', nullable: true })
  changed_at: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  synced_at: Date;
}


