import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PutawayOptimizerService } from './putaway-optimizer.service';
import { PutawayOptimizerController } from './putaway-optimizer.controller';
import { ReceivingModule } from '../receiving/receiving.module';
import { Item } from '../entities/item.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { Location } from '../entities/location.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Item,
      ReceivingItem,
      Location,
      Inventory,
      InventoryMovement,
      ReceivingDocument,
    ]),
    forwardRef(() => ReceivingModule),
  ],
  controllers: [PutawayOptimizerController],
  providers: [PutawayOptimizerService],
  exports: [PutawayOptimizerService],
})
export class PutawayOptimizerModule {}

