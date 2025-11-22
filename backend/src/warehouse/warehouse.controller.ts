import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  // Map endpoints removed

  @Get('location/:code')
  async getLocationDetails(@Param('code') code: string) {
    return this.warehouseService.getLocationDetails(code);
  }

  @Get('location/:code/stock')
  async getLocationStock(@Param('code') code: string) {
    return this.warehouseService.getLocationStock(code);
  }

  @Get('overview')
  async getWarehouseOverview() {
    return this.warehouseService.getWarehouseOverview();
  }

  @Get('path/:sku')
  async getPathToItem(@Param('sku') sku: string) {
    return this.warehouseService.getPathToItem(sku);
  }

  @Post('update-coords')
  async updateLocationCoordinates(@Body() body: { locationId: number; x: number; y: number }) {
    return this.warehouseService.updateLocationCoordinates(body.locationId, body.x, body.y);
  }
}
