import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Store } from '../../entities/store.entity';
import { SkartItem } from './skart-item.entity';
import { SkartPhoto } from './skart-photo.entity';

export enum SkartStatus {
  SUBMITTED = 'SUBMITTED',
  RECEIVED = 'RECEIVED',
}

@Entity('skart_documents')
export class SkartDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('ux_skart_documents_uid', { unique: true })
  @Column({ type: 'varchar', length: 40, unique: true })
  uid: string;

  @Column({ type: 'int' })
  store_id: number;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ type: 'enum', enum: SkartStatus, default: SkartStatus.SUBMITTED })
  status: SkartStatus;

  @Column({ type: 'int' })
  created_by: number;

  @Column({ type: 'int', nullable: true })
  assigned_to_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  received_by: number | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  received_at: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @OneToMany(() => SkartItem, (item) => item.document, { cascade: ['insert', 'update'], eager: false })
  items: SkartItem[];

  @OneToMany(() => SkartPhoto, (photo) => photo.document, { cascade: ['insert'], eager: false })
  photos: SkartPhoto[];
}


