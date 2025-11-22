import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingOrderLine } from '../entities/shipping-order-line.entity';
import { ShippingLoadPhoto } from '../entities/shipping-load-photo.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Item } from '../entities/item.entity';
import { User } from '../entities/user.entity';
import { Location } from '../entities/location.entity';
import { Supplier } from '../entities/supplier.entity';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { AuthModule } from '../auth/auth.module';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { TaskAssignmentInfo } from '../entities/task-assignment-info.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { PerformanceModule } from '../performance/performance.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { AuditLog } from '../entities/audit-log.entity';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShippingOrder, ShippingOrderLine, ShippingLoadPhoto, Inventory, InventoryMovement, Item, User, Location, Supplier, TaskAssignee, TaskAssignmentInfo, Team, TeamMember, AuditLog]),
    AuthModule,
    PerformanceModule,
    forwardRef(() => WorkforceModule),
  ],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}

