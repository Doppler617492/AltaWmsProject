import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Team } from './team.entity';
import { User } from './user.entity';

@Entity({ name: 'team_members' })
@Unique(['team_id', 'user_id'])
export class TeamMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  team_id: number;

  @Column()
  user_id: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Team, t => t.members, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

