import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ShippingOrderLine } from './shipping-order-line.entity';
import { Team } from './team.entity';

export type ShippingOrderStatus = 'DRAFT' | 'CREATED' | 'ASSIGNED' | 'PICKING' | 'STAGED' | 'LOADED' | 'COMPLETED' | 'CLOSED' | 'ON_HOLD' | 'CANCELLED';

@Entity({ name: 'shipping_orders' })
export class ShippingOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  order_number: string;

  @Column()
  customer_name: string;

  @Column({ type: 'varchar', length: 16 })
  status: ShippingOrderStatus;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'assigned_user_id' })
  assigned_user?: User | null;

  @Column({ type: 'integer', nullable: true })
  assigned_user_id?: number | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  started_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  staged_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  loaded_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completed_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  closed_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  document_date?: Date | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  store_name?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  responsible_person?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  invoice_number?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'text', nullable: true })
  discrepancy_note?: string | null;

  @Column({ type: 'boolean', default: false })
  has_discrepancy?: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  on_hold_since?: Date | null;

  @ManyToOne(() => Team, { eager: true, nullable: true })
  @JoinColumn({ name: 'assigned_team_id' })
  assigned_team?: Team | null;

  @Column({ type: 'integer', nullable: true })
  assigned_team_id?: number | null;

  @OneToMany(() => ShippingOrderLine, l => l.order, { cascade: true })
  lines: ShippingOrderLine[];
}


