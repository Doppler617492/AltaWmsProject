import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkartController } from './skart.controller';
import { SkartService } from './skart.service';
import { SkartDocument } from './entities/skart-document.entity';
import { SkartItem } from './entities/skart-item.entity';
import { SkartPhoto } from './entities/skart-photo.entity';
import { Store } from '../entities/store.entity';
import { Item } from '../entities/item.entity';
import { Inventory } from '../entities/inventory.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SkartDocument,
      SkartItem,
      SkartPhoto,
      Store,
      Item,
      Inventory,
      AuditLog,
      User,
    ]),
    AuthModule,
    forwardRef(() => WorkforceModule),
  ],
  controllers: [SkartController],
  providers: [SkartService],
  exports: [SkartService],
})
export class SkartModule {}


