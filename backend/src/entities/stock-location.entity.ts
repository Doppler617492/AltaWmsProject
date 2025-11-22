import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Item } from './item.entity';
import { Location } from './location.entity';

@Entity('stock_locations')
export class StockLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  item_id: number;

  @Column({ nullable: true })
  location_id: number;

  @Column()
  location_code: string;

  @Column()
  pallet_id: string;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity_value: number;

  @Column()
  quantity_uom: string;

  @Column()
  received_at: Date;

  @Column()
  zone_name: string;

  @Column()
  aisle: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  reserved_qty: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  free_qty: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Item, item => item.stockLocations)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Location, location => location.stockLocations)
  @JoinColumn({ name: 'location_id' })
  location: Location;
}
