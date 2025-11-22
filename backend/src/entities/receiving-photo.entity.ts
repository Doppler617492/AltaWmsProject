import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ReceivingDocument } from './receiving-document.entity';
import { User } from './user.entity';

@Entity('receiving_photos')
export class ReceivingPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  receiving_document_id: number;

  @Column({ nullable: true })
  item_id: number;

  @Column()
  photo_url: string;

  @Column()
  uploaded_by: number;

  @Column('text', { nullable: true })
  caption: string;

  // FAZA 3.B: opciono polje za belešku radnika
  @Column('text', { nullable: true })
  note: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => ReceivingDocument, document => document.photos)
  @JoinColumn({ name: 'receiving_document_id' })
  receivingDocument: ReceivingDocument;

  @ManyToOne(() => User, user => user.receivingPhotos)
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;
}
