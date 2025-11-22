import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
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
import { UserShift } from './entities/user-shift.entity';
import { CycleCountTask } from './cycle-count/cycle-count-task.entity';
import { CycleCountLine } from './cycle-count/cycle-count-line.entity';
import { ExceptionAckLog } from './entities/exception-ack-log.entity';
import { OrchestrationActionLog } from './entities/orchestration-action-log.entity';
import { SlaEvent } from './entities/sla-event.entity';
import { SlaComplianceCache } from './entities/sla-compliance-cache.entity';
import { LocationLabel } from './entities/location-label.entity';
import { PrintJob } from './entities/print-job.entity';
import { Store } from './entities/store.entity';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskAssignmentInfo } from './entities/task-assignment-info.entity';
import { SkartDocument } from './skart/entities/skart-document.entity';
import { SkartItem } from './skart/entities/skart-item.entity';
import { SkartPhoto } from './skart/entities/skart-photo.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  url: process.env.DB_URL || undefined,
  entities: [
    Supplier,
    Item,
    StockLocation,
    Zone,
    Aisle,
    Rack,
    Location,
    LocationStatus,
    User,
    ReceivingDocument,
    ReceivingItem,
    ReceivingPhoto,
    InventoryMovement,
    Inventory,
    PutawayTask,
    ShippingOrder,
    ShippingOrderLine,
    ShippingLoadPhoto,
    UserShift,
    CycleCountTask,
    CycleCountLine,
    ExceptionAckLog,
    OrchestrationActionLog,
    SlaEvent,
    SlaComplianceCache,
    LocationLabel,
    PrintJob,
    Store,
    Team,
    TeamMember,
    TaskAssignee,
    TaskAssignmentInfo,
    SkartDocument,
    SkartItem,
    SkartPhoto,
    AuditLog,
    Role,
    Permission,
    RolePermission,
    UserRole,
    join(__dirname, '**/*.entity.js'),
  ],
  migrations: [join(__dirname, 'migrations/*.js')],
  synchronize: false,
  migrationsRun: false,
  logging: false,
});

export default AppDataSource;
