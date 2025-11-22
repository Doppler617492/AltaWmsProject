import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceivingService } from './receiving.service';
import { ReceivingController } from './receiving.controller';
import { ReceivingUsersController } from './users.controller';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { ReceivingPhoto } from '../entities/receiving-photo.entity';
import { Item } from '../entities/item.entity';
import { Supplier } from '../entities/supplier.entity';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { Inventory } from '../entities/inventory.entity';
import { PutawayOptimizerModule } from '../putaway-optimizer/putaway-optimizer.module';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { TaskAssignmentInfo } from '../entities/task-assignment-info.entity';
import { PerformanceModule } from '../performance/performance.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReceivingDocument, ReceivingItem, ReceivingPhoto, Item, Supplier, User, Inventory, TaskAssignee, TaskAssignmentInfo, AuditLog]),
    AuthModule,
    forwardRef(() => PutawayOptimizerModule),
    PerformanceModule,
    forwardRef(() => WorkforceModule),
  ],
  providers: [ReceivingService],
  controllers: [ReceivingController, ReceivingUsersController],
  exports: [ReceivingService]
})
export class ReceivingModule {}
