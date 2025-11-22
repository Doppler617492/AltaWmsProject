import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlaEvent } from '../entities/sla-event.entity';
import { SlaComplianceCache } from '../entities/sla-compliance-cache.entity';
import { SlaService } from './sla.service';
import { SlaController } from './sla.controller';
import { ExceptionsModule } from '../exceptions/exceptions.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { OrchestrationActionLog } from '../entities/orchestration-action-log.entity';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([SlaEvent, SlaComplianceCache, OrchestrationActionLog, ReceivingDocument, ShippingOrder]),
    forwardRef(() => ExceptionsModule),
    forwardRef(() => OrchestrationModule),
    WorkforceModule,
  ],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}

