import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('inventory')
@Unique(['item_id', 'location_id'])
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  item_id: number;

  @Column()
  location_id: number;

  @Column('numeric', { precision: 14, scale: 3, default: 0 })
  quantity: string;

  @UpdateDateColumn({ name: 'last_updated_at' })
  last_updated_at: Date;

  @CreateDateColumn()
  created_at: Date;
}

