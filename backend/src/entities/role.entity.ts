import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { UserRole } from './user-role.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => RolePermission, rp => rp.role)
  rolePermissions: RolePermission[];

  @OneToMany(() => UserRole, ur => ur.role)
  userRoles: UserRole[];
}
