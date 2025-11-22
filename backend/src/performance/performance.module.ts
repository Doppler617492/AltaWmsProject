import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { PerformanceGateway } from './performance.gateway';
import { User } from '../entities/user.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingOrderLine } from '../entities/shipping-order-line.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { TaskAssignmentInfo } from '../entities/task-assignment-info.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      User,
      TaskAssignee,
      ReceivingItem,
      ReceivingDocument,
      ShippingOrder,
      ShippingOrderLine,
      InventoryMovement,
      Team,
      TeamMember,
      TaskAssignmentInfo,
    ]),
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService, PerformanceGateway],
  exports: [PerformanceService],
})
export class PerformanceModule {}
