import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { AiAgentModule } from './aiAgent/aiAgent.module';
import { ItemsModule } from './items/items.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { StockModule } from './stock/stock.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { ReceivingModule } from './receiving/receiving.module';
import { DatabaseService } from './database.service';
import { PwaController } from './pwa.controller';
import { Supplier } from './entities/supplier.entity';
import { Item } from './entities/item.entity';
import { StockLocation } from './entities/stock-location.entity';
import { Zone } from './entities/zone.entity';
import { Aisle } from './entities/aisle.entity';
import { Rack } from './entities/rack.entity';
import { Location } from './entities/location.entity';
import { LocationStatus } from './entities/location-status.entity';
import { User } from './entities/user.entity';
import { ReceivingDocument } from './entities/receiving-document.entity';
import { ReceivingItem } from './entities/receiving-item.entity';
import { ReceivingPhoto } from './entities/receiving-photo.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { Inventory } from './entities/inventory.entity';
import { PutawayTask } from './entities/putaway-task.entity';
import { ShippingOrder } from './entities/shipping-order.entity';
import { ShippingOrderLine } from './entities/shipping-order-line.entity';
import { ShippingLoadPhoto } from './entities/shipping-load-photo.entity';
import { ShippingModule } from './shipping/shipping.module';
import { PutawayModule } from './putaway/putaway.module';
import { UsersModule } from './users/users.module';
import { UserShift } from './entities/user-shift.entity';
import { WorkforceModule } from './workforce/workforce.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CycleCountModule } from './cycle-count/cycle-count.module';
import { CycleCountTask } from './cycle-count/cycle-count-task.entity';
import { CycleCountLine } from './cycle-count/cycle-count-line.entity';
import { ExceptionAckLog } from './entities/exception-ack-log.entity';
import { WarehouseStructureModule } from './warehouse-structure/warehouse-structure.module';
import { WarehouseMapModule } from './warehouse-map/warehouse-map.module';
import { KpiModule } from './kpi/kpi.module';
import { ExceptionsModule } from './exceptions/exceptions.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { OrchestrationActionLog } from './entities/orchestration-action-log.entity';
import { SlaModule } from './sla/sla.module';
import { SlaEvent } from './entities/sla-event.entity';
import { SlaComplianceCache } from './entities/sla-compliance-cache.entity';
import { PutawayOptimizerModule } from './putaway-optimizer/putaway-optimizer.module';
import { RelayoutModule } from './relayout/relayout.module';
import { LabelsModule } from './labels/labels.module';
import { LocationLabel } from './entities/location-label.entity';
import { PrintJob } from './entities/print-job.entity';
import { Store } from './entities/store.entity';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskAssignmentInfo } from './entities/task-assignment-info.entity';
import { StoresModule } from './stores/stores.module';
import { TeamsModule } from './teams/teams.module';
import { PerformanceModule } from './performance/performance.module';
import { CunguModule } from './integrations/cungu/cungu.module';
import { SkartDocument } from './skart/entities/skart-document.entity';
import { SkartItem } from './skart/entities/skart-item.entity';
import { SkartPhoto } from './skart/entities/skart-photo.entity';
import { AuditLog } from './entities/audit-log.entity';
import { PantheonItem } from './entities/pantheon-item.entity';
import { SkartModule } from './skart/skart.module';
import { PovracajModule } from './povracaj/povracaj.module';
import { PovracajDocument } from './povracaj/entities/povracaj-document.entity';
import { PovracajItem } from './povracaj/entities/povracaj-item.entity';
import { PovracajPhoto } from './povracaj/entities/povracaj-photo.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DB_URL || 'postgresql://wms_user:wms_password@localhost:5432/wms',
      entities: [Supplier, Item, StockLocation, Zone, Aisle, Rack, Location, LocationStatus, User, ReceivingDocument, ReceivingItem, ReceivingPhoto, InventoryMovement, Inventory, UserShift, CycleCountTask, CycleCountLine, PutawayTask, ShippingOrder, ShippingOrderLine, ShippingLoadPhoto, ExceptionAckLog, OrchestrationActionLog, SlaEvent, SlaComplianceCache, LocationLabel, PrintJob, Store, Team, TeamMember, TaskAssignee, TaskAssignmentInfo, SkartDocument, SkartItem, SkartPhoto, AuditLog, PantheonItem, PovracajDocument, PovracajItem, PovracajPhoto, Role, Permission, RolePermission, UserRole],
      synchronize: false,
      logging: false,
    }),
    TypeOrmModule.forFeature([Supplier, Item, StockLocation, Zone, Aisle, Rack, Location, LocationStatus, User, ReceivingDocument, ReceivingItem, ReceivingPhoto, InventoryMovement, Inventory, UserShift, CycleCountTask, CycleCountLine, PutawayTask, ShippingOrder, ShippingOrderLine, ShippingLoadPhoto, ExceptionAckLog, OrchestrationActionLog, SlaEvent, SlaComplianceCache, LocationLabel, PrintJob, Store, Team, TeamMember, TaskAssignee, TaskAssignmentInfo, SkartDocument, SkartItem, SkartPhoto, AuditLog, PantheonItem, PovracajDocument, PovracajItem, PovracajPhoto, Role, Permission, RolePermission, UserRole]),
    AuthModule, 
    HealthModule, 
    AiAgentModule,
    ItemsModule,
    SuppliersModule,
    StockModule,
    WarehouseModule,
    ReceivingModule,
    UsersModule,
    WorkforceModule,
    DashboardModule,
    CycleCountModule,
    WarehouseStructureModule,
    WarehouseMapModule,
    PutawayModule,
    ShippingModule,
    KpiModule,
    ExceptionsModule,
    OrchestrationModule,
    SlaModule,
    PutawayOptimizerModule,
    RelayoutModule,
    LabelsModule,
    StoresModule,
    TeamsModule,
    PerformanceModule,
    CunguModule,
    SkartModule,
    PovracajModule,
  ],
  controllers: [PwaController],
  providers: [DatabaseService],
})
export class AppModule {}
