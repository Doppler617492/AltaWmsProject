import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Supplier } from './supplier.entity';
import { StockLocation } from './stock-location.entity';
import { ReceivingItem } from './receiving-item.entity';

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @Column()
  supplier_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  barcode: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Supplier, supplier => supplier.items)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @OneToMany(() => StockLocation, stockLocation => stockLocation.item)
  stockLocations: StockLocation[];

  @OneToMany(() => ReceivingItem, receivingItem => receivingItem.item)
  receivingItems: ReceivingItem[];
}
