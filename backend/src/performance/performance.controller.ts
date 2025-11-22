import { Controller, Get, Headers, ForbiddenException } from '@nestjs/common';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly perf: PerformanceService) {}

  @Get('overview')
  async overview(@Headers('x-kiosk-token') kiosk: string) {
    const expected = process.env.TV_KIOSK_TOKEN || '';
    if (!expected || kiosk !== expected) {
      throw new ForbiddenException('Invalid kiosk token');
    }
    return this.perf.getOverview();
  }
}

