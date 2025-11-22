import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { PovracajDocument } from './povracaj-document.entity';
import { PovracajItem } from './povracaj-item.entity';

@Entity('povracaj_photos')
export class PovracajPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('ix_povracaj_photos_document_id')
  @Column({ type: 'int' })
  document_id: number;

  @ManyToOne(() => PovracajDocument, (document) => document.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: PovracajDocument;

  @Index('ix_povracaj_photos_item_id')
  @Column({ type: 'int', nullable: true })
  item_id: number | null;

  @ManyToOne(() => PovracajItem, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'item_id' })
  item: PovracajItem | null;

  @Column({ type: 'varchar', length: 255 })
  path: string;

  @Column({ type: 'int', nullable: true })
  uploaded_by: number | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  uploaded_at: Date;
}

