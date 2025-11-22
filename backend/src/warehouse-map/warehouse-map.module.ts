import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseMapService } from './warehouse-map.service';
import { WarehouseMapController } from './warehouse-map.controller';
import { AuthModule } from '../auth/auth.module';
import { Location } from '../entities/location.entity';
import { LocationLabel } from '../entities/location-label.entity';
import { Inventory } from '../entities/inventory.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, LocationLabel, Inventory]),
    AuthModule,
  ],
  controllers: [WarehouseMapController],
  providers: [WarehouseMapService],
  exports: [WarehouseMapService],
})
export class WarehouseMapModule {}


