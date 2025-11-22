import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { User } from '../entities/user.entity';
import { UserShift } from '../entities/user-shift.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Location } from '../entities/location.entity';
import { CycleCountTask } from '../cycle-count/cycle-count-task.entity';
import { CycleCountLine } from '../cycle-count/cycle-count-line.entity';
import { AuthModule } from '../auth/auth.module';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { SkartDocument, SkartStatus } from '../skart/entities/skart-document.entity';
import { PovracajDocument } from '../povracaj/entities/povracaj-document.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ReceivingDocument,
      ReceivingItem,
      User,
      UserShift,
      Inventory,
      InventoryMovement,
      Location,
      CycleCountTask,
      CycleCountLine,
      ShippingOrder,
      SkartDocument,
      PovracajDocument,
      AuditLog,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
