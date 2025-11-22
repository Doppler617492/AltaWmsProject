import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Aisle } from './aisle.entity';
import { Location } from './location.entity';

@Entity('racks')
export class Rack {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  aisle_id: number;

  @Column({ length: 20 })
  name: string;

  @Column({ length: 1 })
  side: string;

  @Column({ type: 'float' })
  length: number;

  @Column({ type: 'float' })
  height: number;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  created_at: Date;

  @ManyToOne(() => Aisle, aisle => aisle.racks)
  @JoinColumn({ name: 'aisle_id' })
  aisle: Aisle;

  @OneToMany(() => Location, location => location.rack)
  locations: Location[];
}
