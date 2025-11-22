import { Controller, Get, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RelayoutService, PressureMapItem, RelayoutRecommendation } from './relayout.service';

@UseGuards(JwtAuthGuard)
@Controller('relayout')
export class RelayoutController {
  constructor(private readonly relayoutService: RelayoutService) {}

  @Get('pressure-map')
  async getPressureMap(@Req() req: any): Promise<PressureMapItem[]> {
    const allowed = ['admin', 'menadzer', 'sef_magacina'];
    const normalizedRole = (req.user?.role || '').toLowerCase();
    if (!allowed.map(r => r.toLowerCase()).includes(normalizedRole)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }

    return this.relayoutService.getPressureMap();
  }

  @Get('recommendations')
  async getRecommendations(@Req() req: any): Promise<RelayoutRecommendation[]> {
    const allowed = ['admin', 'menadzer', 'sef_magacina'];
    const normalizedRole = (req.user?.role || '').toLowerCase();
    if (!allowed.map(r => r.toLowerCase()).includes(normalizedRole)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }

    return this.relayoutService.getRecommendations();
  }
}

