import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { WarehouseMapService, WarehouseStructureDto, AisleDto } from './warehouse-map.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse/map')
export class WarehouseMapController {
  constructor(private readonly svc: WarehouseMapService) {}

  @Get('overview-structure')
  getOverview(): WarehouseStructureDto {
    return this.svc.getOverviewStructure();
  }

  @Get('aisle/:aisleCode')
  getAisle(@Param('aisleCode') aisleCode: string): AisleDto {
    return this.svc.getAisle(aisleCode);
  }

  @Get('live-stock')
  getLiveStock() {
    return this.svc.getLiveStock();
  }
}


