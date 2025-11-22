import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('user_shifts')
@Unique(['user_id', 'shift_date'])
export class UserShift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ length: 10 })
  shift_type: string; // PRVA | DRUGA | OFF

  @Column({ type: 'date' })
  shift_date: string; // YYYY-MM-DD

  @Column()
  assigned_by_user_id: number;

  @CreateDateColumn()
  created_at: Date;
}

