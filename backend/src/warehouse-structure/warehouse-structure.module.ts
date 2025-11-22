import { Module } from '@nestjs/common';
import { WarehouseStructureService } from './warehouse-structure.service';
import { WarehouseStructureController } from './warehouse-structure.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [WarehouseStructureService],
  controllers: [WarehouseStructureController],
})
export class WarehouseStructureModule {}


