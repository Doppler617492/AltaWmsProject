import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgentController } from './aiAgent.controller';
import { AiAgentService } from './aiAgent.service';
import { Item } from '../entities/item.entity';
import { StockLocation } from '../entities/stock-location.entity';
import { Location } from '../entities/location.entity';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { WarehouseModule } from '../warehouse/warehouse.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, StockLocation, Location, ReceivingDocument, ReceivingItem]),
    WarehouseModule
  ],
  controllers: [AiAgentController],
  providers: [AiAgentService],
})
export class AiAgentModule {}
