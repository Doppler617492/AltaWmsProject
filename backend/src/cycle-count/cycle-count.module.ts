import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CycleCountTask } from './cycle-count-task.entity';
import { CycleCountLine } from './cycle-count-line.entity';
import { CycleCountService } from './cycle-count.service';
import { CycleCountController } from './cycle-count.controller';
import { Location } from '../entities/location.entity';
import { Inventory } from '../entities/inventory.entity';
import { Item } from '../entities/item.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Zone } from '../entities/zone.entity';
import { Rack } from '../entities/rack.entity';
import { Aisle } from '../entities/aisle.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CycleCountTask, CycleCountLine, Location, Inventory, Item, InventoryMovement, Zone, Rack, Aisle]),
    AuthModule,
  ],
  providers: [CycleCountService],
  controllers: [CycleCountController],
  exports: [TypeOrmModule],
})
export class CycleCountModule {}

