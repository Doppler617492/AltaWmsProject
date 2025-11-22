import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { PutawayTask } from '../entities/putaway-task.entity';
import { CycleCountTask } from '../cycle-count/cycle-count-task.entity';
import { Inventory } from '../entities/inventory.entity';
import { Location } from '../entities/location.entity';
import { User } from '../entities/user.entity';
import { UserShift } from '../entities/user-shift.entity';
import { ExceptionAckLog } from '../entities/exception-ack-log.entity';
import { ReceivingModule } from '../receiving/receiving.module';
import { SlaModule } from '../sla/sla.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { ExceptionsService } from './exceptions.service';
import { ExceptionsController } from './exceptions.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ReceivingDocument,
      ReceivingItem,
      ShippingOrder,
      PutawayTask,
      CycleCountTask,
      Inventory,
      Location,
      User,
      UserShift,
      ExceptionAckLog,
    ]),
    ReceivingModule,
    WorkforceModule,
    forwardRef(() => SlaModule),
  ],
  controllers: [ExceptionsController],
  providers: [ExceptionsService],
  exports: [ExceptionsService],
})
export class ExceptionsModule {}

