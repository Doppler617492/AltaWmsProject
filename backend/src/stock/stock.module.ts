import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { StockSchedulerService } from './stock-scheduler.service';
import { SyncProgressService } from './sync-progress.service';
import { StockLocation } from '../entities/stock-location.entity';
import { Item } from '../entities/item.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Location } from '../entities/location.entity';
import { Inventory } from '../entities/inventory.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { Store } from '../entities/store.entity';
import { StoreInventory } from '../entities/store-inventory.entity';
import { AuthModule } from '../auth/auth.module';
import { PantheonItem } from '../entities/pantheon-item.entity';
import { PantheonCatalogService } from './pantheon-catalog.service';
import { CunguModule } from '../integrations/cungu/cungu.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockLocation, Item, InventoryMovement, Location, Inventory, ReceivingItem, PantheonItem, Store, StoreInventory]),
    AuthModule,
    CunguModule,
  ],
  controllers: [StockController],
  providers: [StockService, PantheonCatalogService, StockSchedulerService, SyncProgressService],
  exports: [StockService, PantheonCatalogService],
})
export class StockModule {}
