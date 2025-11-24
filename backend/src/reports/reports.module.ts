import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AuthModule } from '../auth/auth.module';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { CycleCountTask } from '../cycle-count/cycle-count-task.entity';
import { CycleCountLine } from '../cycle-count/cycle-count-line.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { User } from '../entities/user.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { SkartDocument } from '../skart/entities/skart-document.entity';
import { SkartItem } from '../skart/entities/skart-item.entity';
import { PovracajDocument } from '../povracaj/entities/povracaj-document.entity';
import { PovracajItem } from '../povracaj/entities/povracaj-item.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingOrderLine } from '../entities/shipping-order-line.entity';
import { Item } from '../entities/item.entity';
import { Store } from '../entities/store.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ReceivingDocument,
      ReceivingItem,
      CycleCountTask,
      CycleCountLine,
      InventoryMovement,
      User,
      Team,
      TeamMember,
      SkartDocument,
      SkartItem,
      PovracajDocument,
      PovracajItem,
      ShippingOrder,
      ShippingOrderLine,
      Item,
      Store,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
