import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkforceController } from './workforce.controller';
import { WorkforceService } from './workforce.service';
import { User } from '../entities/user.entity';
import { UserShift } from '../entities/user-shift.entity';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { Supplier } from '../entities/supplier.entity';
import { CycleCountTask } from '../cycle-count/cycle-count-task.entity';
import { PutawayTask } from '../entities/putaway-task.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { AuthModule } from '../auth/auth.module';
import { ApiOrJwtGuard } from '../auth/api-or-jwt.guard';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { TaskAssignmentInfo } from '../entities/task-assignment-info.entity';
import { AnalyticsPushService } from '../analytics/analytics-push.service';
import { AssignmentsGateway } from './assignments.gateway';
import { SkartDocument } from '../skart/entities/skart-document.entity';
import { PovracajDocument } from '../povracaj/entities/povracaj-document.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User, UserShift, ReceivingDocument, ReceivingItem, Supplier, CycleCountTask, PutawayTask, ShippingOrder, Team, TeamMember, TaskAssignee, TaskAssignmentInfo, SkartDocument, PovracajDocument])],
  controllers: [WorkforceController],
  providers: [WorkforceService, ApiOrJwtGuard, AnalyticsPushService, AssignmentsGateway],
  exports: [WorkforceService, AssignmentsGateway],
})
export class WorkforceModule {}
