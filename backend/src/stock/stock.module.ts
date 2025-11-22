import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { StockLocation } from '../entities/stock-location.entity';
import { Item } from '../entities/item.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Location } from '../entities/location.entity';
import { Inventory } from '../entities/inventory.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { AuthModule } from '../auth/auth.module';
import { PantheonItem } from '../entities/pantheon-item.entity';
import { PantheonCatalogService } from './pantheon-catalog.service';
import { CunguModule } from '../integrations/cungu/cungu.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockLocation, Item, InventoryMovement, Location, Inventory, ReceivingItem, PantheonItem]),
    AuthModule,
    CunguModule,
  ],
  controllers: [StockController],
  providers: [StockService, PantheonCatalogService],
  exports: [StockService, PantheonCatalogService],
})
export class StockModule {}
