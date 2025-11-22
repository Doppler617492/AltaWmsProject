import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ReceivingDocument } from './receiving-document.entity';
import { Item } from './item.entity';
import { Location } from './location.entity';

export enum ItemStatus {
  PENDING = 'pending',
  SCANNED = 'scanned',
  PLACED = 'placed',
  VERIFIED = 'verified'
}

@Entity('receiving_items')
export class ReceivingItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  receiving_document_id: number;

  @Column()
  item_id: number;

  @Column()
  expected_quantity: number;

  @Column({ default: 0 })
  received_quantity: number;

  @Column({ length: 20, default: 'KOM' })
  quantity_uom: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  barcode: string;

  @Column({ type: 'enum', enum: ItemStatus, default: ItemStatus.PENDING })
  status: ItemStatus;

  @Column({ nullable: true })
  location_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pallet_id: string;

  @Column('text', { nullable: true })
  condition_notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => ReceivingDocument, document => document.items)
  @JoinColumn({ name: 'receiving_document_id' })
  receivingDocument: ReceivingDocument;

  @ManyToOne(() => Item, item => item.receivingItems)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Location, location => location.receivingItems)
  @JoinColumn({ name: 'location_id' })
  location: Location;
}
