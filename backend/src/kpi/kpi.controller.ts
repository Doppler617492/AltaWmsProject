import { Controller, Get, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KpiService } from './kpi.service';

@UseGuards(JwtAuthGuard)
@Controller('kpi')
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  @Get('overview')
  async overview(@Req() req: any) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'komercijalista', 'logistika'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.kpiService.getOverview();
  }

  @Get('workers')
  async workers(@Req() req: any) {
    const allowed = ['admin', 'menadzer', 'sef_magacina'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.kpiService.getWorkers();
  }

  @Get('workers/:userId')
  async workerDetail(@Param('userId') userId: string, @Req() req: any) {
    const id = Number(userId);
    // Allow workers to see only their own data
    if (req.user.role === 'magacioner' && req.user.id !== id) {
      throw new ForbiddenException('Nemate dozvolu za pregled podataka drugog radnika');
    }
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'magacioner'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.kpiService.getWorkerById(id);
  }

  @Get('warehouse-heatmap')
  async warehouseHeatmap(@Req() req: any) {
    const allowed = ['admin', 'menadzer', 'sef_magacina'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.kpiService.getWarehouseHeatmap();
  }

  @Get('timeline')
  async timeline(@Req() req: any) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'komercijalista', 'logistika'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }
    return this.kpiService.getTimeline();
  }
}

