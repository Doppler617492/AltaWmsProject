import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ShippingOrder } from './shipping-order.entity';
import { User } from './user.entity';

@Entity({ name: 'shipping_load_photos' })
export class ShippingLoadPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ShippingOrder)
  order: ShippingOrder;

  @Column()
  file_path: string;

  @ManyToOne(() => User, { eager: true })
  uploaded_by: User;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  uploaded_at: Date;
}


