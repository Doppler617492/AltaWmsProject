import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelsService } from './labels.service';
import { LabelsController } from './labels.controller';
import { LocationLabel } from '../entities/location-label.entity';
import { PrintJob } from '../entities/print-job.entity';
import { Location } from '../entities/location.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([LocationLabel, PrintJob, Location]),
  ],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}

