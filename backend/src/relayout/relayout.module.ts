import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelayoutService } from './relayout.service';
import { RelayoutController } from './relayout.controller';
import { Location } from '../entities/location.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Item } from '../entities/item.entity';
import { Aisle } from '../entities/aisle.entity';
import { Rack } from '../entities/rack.entity';
import { Zone } from '../entities/zone.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Location,
      Inventory,
      InventoryMovement,
      Item,
      Aisle,
      Rack,
      Zone,
    ]),
  ],
  controllers: [RelayoutController],
  providers: [RelayoutService],
})
export class RelayoutModule {}

