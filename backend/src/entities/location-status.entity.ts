import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Location } from './location.entity';

export enum OccupancyStatus {
  EMPTY = 'empty',
  PARTIAL = 'partial',
  FULL = 'full'
}

@Entity('location_status')
export class LocationStatus {
  @PrimaryColumn()
  location_id: number;

  @Column({
    type: 'enum',
    enum: OccupancyStatus,
    default: OccupancyStatus.EMPTY
  })
  occupancy: OccupancyStatus;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  last_updated: Date;

  @ManyToOne(() => Location, location => location.statuses)
  @JoinColumn({ name: 'location_id' })
  location: Location;
}
