import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  item_id: number;

  @Column({ nullable: true })
  from_location_id: number;

  @Column({ nullable: true })
  to_location_id: number;

  @Column('numeric')
  quantity_change: number;

  @Column({ length: 30 })
  reason: string; // e.g., RECEIVING

  @Column()
  reference_document_id: number;

  @Column()
  created_by: number;

  @CreateDateColumn()
  created_at: Date;
}
