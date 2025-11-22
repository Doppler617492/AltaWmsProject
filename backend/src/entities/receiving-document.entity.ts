import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Supplier } from './supplier.entity';
import { ReceivingItem } from './receiving-item.entity';
import { ReceivingPhoto } from './receiving-photo.entity';
import { User } from './user.entity';

export enum ReceivingStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold'
}

@Entity('receiving_documents')
export class ReceivingDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  document_number: string;

  @Column()
  supplier_id: number;

  @Column({ type: 'varchar', length: 500 })
  pantheon_invoice_number: string;

  @Column({ type: 'enum', enum: ReceivingStatus, default: ReceivingStatus.DRAFT })
  status: ReceivingStatus;

  @Column({ nullable: true })
  assigned_to: number | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column({ nullable: true })
  received_by: number | null;

  @Column({ nullable: true })
  created_by: number | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'date', nullable: true })
  document_date: Date | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  store_name: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  responsible_person: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  invoice_number: string | null;

  @ManyToOne(() => Supplier, supplier => supplier.receivingDocuments)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => User, user => user.receivingDocuments)
  @JoinColumn({ name: 'assigned_to' })
  assignedUser: User;

  @ManyToOne(() => User, user => user.createdReceivingDocuments)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @OneToMany(() => ReceivingItem, item => item.receivingDocument)
  items: ReceivingItem[];

  @OneToMany(() => ReceivingPhoto, photo => photo.receivingDocument)
  photos: ReceivingPhoto[];
}
