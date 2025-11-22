import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import { Zone } from '../entities/zone.entity';
import { Aisle } from '../entities/aisle.entity';
import { Rack } from '../entities/rack.entity';
import { Location } from '../entities/location.entity';
import { LocationStatus } from '../entities/location-status.entity';
import { StockLocation } from '../entities/stock-location.entity';
import { Item } from '../entities/item.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Zone, Aisle, Rack, Location, LocationStatus, StockLocation, Item]),
    AuthModule
  ],
  controllers: [WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
