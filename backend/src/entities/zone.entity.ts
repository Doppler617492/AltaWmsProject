import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Aisle } from './aisle.entity';

@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ length: 7 })
  color: string;

  @Column({ default: false })
  is_virtual: boolean;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  created_at: Date;

  @OneToMany(() => Aisle, aisle => aisle.zone)
  aisles: Aisle[];
}
