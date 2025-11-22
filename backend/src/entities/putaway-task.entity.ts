import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Item } from './item.entity';
import { User } from './user.entity';
import { ReceivingDocument } from './receiving-document.entity';

export type PutawayStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

@Entity({ name: 'putaway_tasks' })
export class PutawayTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  pallet_id: string;

  @ManyToOne(() => Item, { eager: true })
  item: Item;

  @Column({ type: 'numeric', precision: 14, scale: 3 })
  quantity: string;

  @Column({ type: 'varchar', length: 16 })
  uom: string;

  @Column({ type: 'varchar', length: 64 })
  from_location_code: string;

  @Column({ type: 'varchar', length: 64 })
  to_location_code: string;

  @Column({ type: 'varchar', length: 16 })
  status: PutawayStatus;

  @ManyToOne(() => User, { eager: true, nullable: true })
  assigned_user?: User | null;

  @ManyToOne(() => User, { eager: true })
  created_by: User;

  @ManyToOne(() => ReceivingDocument, { eager: true, nullable: true })
  reference_receiving_document?: ReceivingDocument | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  started_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completed_at?: Date | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}


