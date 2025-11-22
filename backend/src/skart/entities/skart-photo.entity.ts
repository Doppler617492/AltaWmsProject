import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { SkartDocument } from './skart-document.entity';
import { SkartItem } from './skart-item.entity';

@Entity('skart_photos')
export class SkartPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('ix_skart_photos_document_id')
  @Column({ type: 'int' })
  document_id: number;

  @ManyToOne(() => SkartDocument, (document) => document.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: SkartDocument;

  @Index('ix_skart_photos_item_id')
  @Column({ type: 'int', nullable: true })
  item_id: number | null;

  @ManyToOne(() => SkartItem, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'item_id' })
  item: SkartItem | null;

  @Column({ type: 'varchar', length: 255 })
  path: string;

  @Column({ type: 'int', nullable: true })
  uploaded_by: number | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  uploaded_at: Date;
}


