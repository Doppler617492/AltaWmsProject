import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { SkartDocument } from './skart-document.entity';

@Entity('skart_items')
export class SkartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('ix_skart_items_document_id')
  @Column({ type: 'int' })
  document_id: number;

  @ManyToOne(() => SkartDocument, (document) => document.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: SkartDocument;

  @Column({ type: 'varchar', length: 80 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int', nullable: true })
  item_id: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  qty: string;

  @Column({ type: 'varchar', length: 120 })
  reason: string;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  received_qty: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}


