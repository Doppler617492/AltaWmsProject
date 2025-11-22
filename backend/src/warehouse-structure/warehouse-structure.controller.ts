import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { WarehouseStructureService } from './warehouse-structure.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse')
export class WarehouseStructureController {
  constructor(private readonly svc: WarehouseStructureService) {}

  @Get('structure/overview')
  getOverview() {
    return this.svc.getOverview();
  }

  @Get('structure/aisle/:code')
  getAisle(@Param('code') code: string) {
    return this.svc.getAisle(code);
  }

  @Get('slot/:slot_code/stock')
  getSlot(@Param('slot_code') slotCode: string) {
    return this.svc.getSlotStock(slotCode);
  }

  @Get('zone/:zoneKey/stock')
  getZone(@Param('zoneKey') zoneKey: string) {
    return this.svc.getZoneStock(zoneKey);
  }
}


