import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
@Unique(['user', 'role'])
export class UserRole {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Role, role => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
