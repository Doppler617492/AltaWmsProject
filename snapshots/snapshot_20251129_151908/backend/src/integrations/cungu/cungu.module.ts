import { Module, forwardRef } from '@nestjs/common';
import { CunguClient } from './cungu.client';
import { CunguReceivingService } from './cungu-receiving.service';
import { CunguShippingService } from './cungu-shipping.service';
import { CunguStockService } from './cungu-stock.service';
import { CunguSyncService } from './cungu-sync.service';
import { CunguSyncController } from './cungu-sync.controller';
import { CunguSchedulerService } from './cungu-scheduler.service';
import { ShippingModule } from '../../shipping/shipping.module';
import { ReceivingModule } from '../../receiving/receiving.module';

@Module({
  imports: [
    forwardRef(() => ShippingModule),
    forwardRef(() => ReceivingModule),
  ],
  providers: [
    CunguClient,
    CunguReceivingService,
    CunguShippingService,
    CunguStockService,
    CunguSyncService,
    CunguSchedulerService,
  ],
  controllers: [CunguSyncController],
  exports: [
    CunguClient,
    CunguReceivingService,
    CunguShippingService,
    CunguStockService,
    CunguSyncService,
  ],
})
export class CunguModule {}


