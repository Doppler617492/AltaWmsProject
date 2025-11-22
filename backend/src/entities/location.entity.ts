import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Rack } from './rack.entity';
import { LocationStatus } from './location-status.entity';
import { StockLocation } from './stock-location.entity';
import { ReceivingItem } from './receiving-item.entity';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  rack_id: number;

  @Column({ length: 20 })
  code: string;

  @Column()
  row: number;

  @Column()
  column: number;

  @Column({ type: 'float' })
  x: number;

  @Column({ type: 'float' })
  y: number;

  @Column({ type: 'float' })
  width: number;

  @Column({ type: 'float' })
  height: number;

  @Column()
  capacity: number;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  created_at: Date;

  @ManyToOne(() => Rack, rack => rack.locations)
  @JoinColumn({ name: 'rack_id' })
  rack: Rack;

  @OneToMany(() => LocationStatus, status => status.location)
  statuses: LocationStatus[];

  @OneToMany(() => StockLocation, stockLocation => stockLocation.location)
  stockLocations: StockLocation[];

  @OneToMany(() => ReceivingItem, receivingItem => receivingItem.location)
  receivingItems: ReceivingItem[];
}
