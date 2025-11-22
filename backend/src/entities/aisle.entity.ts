import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Zone } from './zone.entity';
import { Rack } from './rack.entity';

@Entity('aisles')
export class Aisle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  zone_id: number;

  @Column({ length: 20 })
  code: string;

  @Column()
  order_index: number;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  created_at: Date;

  @ManyToOne(() => Zone, zone => zone.aisles)
  @JoinColumn({ name: 'zone_id' })
  zone: Zone;

  @OneToMany(() => Rack, rack => rack.aisle)
  racks: Rack[];
}
