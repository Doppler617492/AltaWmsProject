import { Controller, Get, Req, Query, UseGuards, ForbiddenException, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  private ensureRole(role: string) {
    const allowed = ['admin','menadzer','sef_magacina'];
    if (!allowed.includes(role)) throw new ForbiddenException('Zabranjen pristup');
  }

  @Get('overview')
  async overview(@Req() req: any) {
    this.ensureRole(req.user?.role || '');
    return this.svc.getOverview();
  }

  @Get('live-events')
  async liveEvents(@Req() req: any, @Query('limit') limit?: string) {
    this.ensureRole(req.user?.role || '');
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.svc.getLiveEvents(limitNum);
  }

  @Delete('live-events')
  async clearLiveEvents(@Req() req: any) {
    this.ensureRole(req.user?.role || '');
    return this.svc.clearLiveEvents();
  }
}

