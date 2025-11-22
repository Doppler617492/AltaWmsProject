import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PutawayTask } from '../entities/putaway-task.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { User } from '../entities/user.entity';
import { Item } from '../entities/item.entity';
import { Location } from '../entities/location.entity';
import { PutawayService } from './putaway.service';
import { PutawayController } from './putaway.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PutawayTask, Inventory, InventoryMovement, User, Item, Location]),
    AuthModule,
  ],
  controllers: [PutawayController],
  providers: [PutawayService],
  exports: [PutawayService]
})
export class PutawayModule {}


