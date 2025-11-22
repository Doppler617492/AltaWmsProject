import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrchestrationActionLog } from '../entities/orchestration-action-log.entity';
import { OrchestrationService } from './orchestration.service';
import { OrchestrationController } from './orchestration.controller';
import { ReceivingModule } from '../receiving/receiving.module';
import { ExceptionsModule } from '../exceptions/exceptions.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { StockModule } from '../stock/stock.module';
import { ShippingModule } from '../shipping/shipping.module';
import { SlaModule } from '../sla/sla.module';
import { Location } from '../entities/location.entity';
import { Inventory } from '../entities/inventory.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([OrchestrationActionLog, Location, Inventory, ShippingOrder]),
    ReceivingModule,
    forwardRef(() => ExceptionsModule),
    WorkforceModule,
    StockModule,
    ShippingModule,
    forwardRef(() => SlaModule),
  ],
  controllers: [OrchestrationController],
  providers: [OrchestrationService],
})
export class OrchestrationModule {}

