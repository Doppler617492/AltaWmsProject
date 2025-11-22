import { Controller, Get, Redirect } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'wms-api',
      time: new Date().toISOString(),
    };
  }

  @Get('/')
  root() {
    return this.check();
  }

  @Get('/healthz')
  healthz() {
    return this.check();
  }
}
