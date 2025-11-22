import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PovracajController } from './povracaj.controller';
import { PovracajService } from './povracaj.service';
import { PovracajDocument } from './entities/povracaj-document.entity';
import { PovracajItem } from './entities/povracaj-item.entity';
import { PovracajPhoto } from './entities/povracaj-photo.entity';
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
      PovracajDocument,
      PovracajItem,
      PovracajPhoto,
      Store,
      Item,
      Inventory,
      AuditLog,
      User,
    ]),
    AuthModule,
    forwardRef(() => WorkforceModule),
  ],
  controllers: [PovracajController],
  providers: [PovracajService],
  exports: [PovracajService],
})
export class PovracajModule {}

