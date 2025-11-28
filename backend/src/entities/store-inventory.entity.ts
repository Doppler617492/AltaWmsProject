import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';
import { Store } from './store.entity';

@Entity('store_inventory')
@Unique(['store', 'item_ident'])
@Index(['store'])
@Index(['item_ident'])
@Index(['last_synced_at'])
export class StoreInventory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'store_id' })
  store_id: number;

  @Column({ length: 50 })
  item_ident: string;

  @Column({ length: 255, nullable: true })
  item_name: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_synced_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
