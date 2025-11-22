import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Store } from '../../entities/store.entity';
import { PovracajItem } from './povracaj-item.entity';
import { PovracajPhoto } from './povracaj-photo.entity';

export enum PovracajStatus {
  SUBMITTED = 'SUBMITTED',
  RECEIVED = 'RECEIVED',
}

@Entity('povracaj_documents')
export class PovracajDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('ux_povracaj_documents_uid', { unique: true })
  @Column({ type: 'varchar', length: 40, unique: true })
  uid: string;

  @Column({ type: 'int' })
  store_id: number;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ type: 'enum', enum: PovracajStatus, default: PovracajStatus.SUBMITTED })
  status: PovracajStatus;

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

  @OneToMany(() => PovracajItem, (item) => item.document, { cascade: ['insert', 'update'], eager: false })
  items: PovracajItem[];

  @OneToMany(() => PovracajPhoto, (photo) => photo.document, { cascade: ['insert'], eager: false })
  photos: PovracajPhoto[];
}

