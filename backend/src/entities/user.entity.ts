import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ReceivingDocument } from './receiving-document.entity';
import { ReceivingPhoto } from './receiving-photo.entity';
import { Store } from './store.entity';
import { UserRole } from './user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ length: 100 })
  name: string;

  // FAZA 4.A: puno ime i prezime (ostavljamo postojeće name polje)
  @Column({ length: 150, nullable: true })
  full_name: string;

  @Column({ length: 20 })
  role: string;

  // FAZA 4.A: smena (PRVA/DRUGA/OFF)
  @Column({ length: 10, nullable: true })
  shift: string;

  @Column({ length: 255 })
  email: string;

  @Column({ default: true })
  is_active: boolean;

  // FAZA 4.A: alias za aktivnost (ne diramo postojeće is_active)
  @Column({ default: true })
  active: boolean;

  // FAZA 4.A: hash lozinke
  @Column({ nullable: true })
  password_hash: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // FAZA 3.C: poslednja aktivnost PWA uređaja
  @Column({ type: 'timestamp', nullable: true })
  last_activity: Date | null;

  @Column({ type: 'int', nullable: true })
  store_id: number | null;

  @ManyToOne(() => Store, { nullable: true })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  @OneToMany(() => ReceivingDocument, document => document.assignedUser)
  receivingDocuments: ReceivingDocument[];

  @OneToMany(() => ReceivingDocument, document => document.createdBy)
  createdReceivingDocuments: ReceivingDocument[];

  @OneToMany(() => ReceivingPhoto, photo => photo.uploader)
  receivingPhotos: ReceivingPhoto[];

  @OneToMany(() => UserRole, userRole => userRole.user)
  userRoles: UserRole[];
}
