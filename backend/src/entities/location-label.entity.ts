import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export enum BarcodeType {
  CODE128 = 'CODE128',
  QR = 'QR',
}

export enum LabelStatus {
  NEW = 'NEW',
  PRINTED = 'PRINTED',
  PLACED = 'PLACED',
}

@Entity('location_labels')
export class LocationLabel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  location_code: string;

  @Column({ nullable: true })
  zone_code: string;

  @Column({ nullable: true })
  rack_id: string;

  @Column({ nullable: true })
  aisle_id: string;

  @Column({ nullable: true })
  level: string;

  @Column({
    type: 'enum',
    enum: BarcodeType,
    default: BarcodeType.CODE128,
  })
  barcode_type: BarcodeType;

  @Column({
    type: 'enum',
    enum: LabelStatus,
    default: LabelStatus.NEW,
  })
  status: LabelStatus;

  @Column({ nullable: true })
  last_printed_at: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'last_printed_by_user_id' })
  last_printed_by: User;

  @Column({ nullable: true })
  last_printed_by_user_id: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'placed_by_user_id' })
  placed_by: User;

  @Column({ nullable: true })
  placed_by_user_id: number;

  @Column({ nullable: true })
  placed_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;
}

