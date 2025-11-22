import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Item } from './item.entity';
import { ReceivingDocument } from './receiving-document.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  country: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Item, item => item.supplier)
  items: Item[];

  @OneToMany(() => ReceivingDocument, document => document.supplier)
  receivingDocuments: ReceivingDocument[];
}
