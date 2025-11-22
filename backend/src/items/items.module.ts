import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { Item } from '../entities/item.entity';
import { StockLocation } from '../entities/stock-location.entity';
import { Inventory } from '../entities/inventory.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, StockLocation, Inventory]),
    AuthModule
  ],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
