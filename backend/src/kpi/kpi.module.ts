import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { PutawayTask } from '../entities/putaway-task.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingOrderLine } from '../entities/shipping-order-line.entity';
import { CycleCountTask } from '../cycle-count/cycle-count-task.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Inventory } from '../entities/inventory.entity';
import { Location } from '../entities/location.entity';
import { User } from '../entities/user.entity';
import { UserShift } from '../entities/user-shift.entity';
import { Zone } from '../entities/zone.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { Item } from '../entities/item.entity';
import { KpiService } from './kpi.service';
import { KpiController } from './kpi.controller';
import { AuthModule } from '../auth/auth.module';
import { SkartDocument, SkartStatus } from '../skart/entities/skart-document.entity';
import { SkartItem } from '../skart/entities/skart-item.entity';
import { PovracajDocument } from '../povracaj/entities/povracaj-document.entity';
import { PovracajItem } from '../povracaj/entities/povracaj-item.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
    ReceivingDocument,
    ReceivingItem,
    PutawayTask,
    ShippingOrder,
    ShippingOrderLine,
    CycleCountTask,
    InventoryMovement,
    Inventory,
    Location,
    User,
    UserShift,
    Zone,
    TaskAssignee,
    Item,
    SkartDocument,
    SkartItem,
    PovracajDocument,
    PovracajItem,
  ])],
  controllers: [KpiController],
  providers: [KpiService],
})
export class KpiModule {}

