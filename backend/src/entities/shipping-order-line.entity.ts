import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ShippingOrder } from './shipping-order.entity';
import { Item } from './item.entity';

export type ShippingLineStatus = 'PENDING' | 'PICKING' | 'PICKED' | 'STAGED' | 'LOADED' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';

@Entity({ name: 'shipping_order_lines' })
export class ShippingOrderLine {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ShippingOrder, o => o.lines)
  order: ShippingOrder;

  @ManyToOne(() => Item, { eager: true })
  item: Item;

  @Column('numeric', { precision: 14, scale: 3 })
  requested_qty: string;

  @Column('numeric', { precision: 14, scale: 3, default: 0 })
  picked_qty: string;

  @Column({ length: 16 })
  uom: string;

  @Column({ length: 64, nullable: true })
  pick_from_location_code: string;

  @Column({ length: 64, nullable: true })
  staged_location_code?: string | null;

  @Column({ type: 'varchar', length: 16 })
  status_per_line: ShippingLineStatus;

  @Column('text', { nullable: true })
  condition_notes?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  discrepancy_type?: string | null;

  @Column({ type: 'boolean', default: false })
  has_discrepancy?: boolean;
}


