import { Controller, Get, Post, Body, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SlaService } from './sla.service';

@UseGuards(JwtAuthGuard)
@Controller('sla')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('history')
  async getHistory(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('worker_id') workerId?: string,
    @Query('zone') zone?: string,
  ) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'logistika'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }

    return this.slaService.getHistory({
      from,
      to,
      type,
      worker_id: workerId ? parseInt(workerId) : undefined,
      zone,
    });
  }

  @Get('stats')
  async getStats(@Req() req: any, @Query('worker_id') workerId?: string) {
    const role = req.user.role;

    // Magacioner can only see their own stats
    if (role === 'magacioner') {
      return this.slaService.getStats({
        worker_id: req.user.id,
      });
    } else if (!['admin', 'menadzer', 'sef_magacina', 'logistika'].includes(role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }

    return this.slaService.getStats({
      worker_id: workerId ? parseInt(workerId) : undefined,
    });
  }

  @Get('trends')
  async getTrends(@Req() req: any, @Query('period') period?: string) {
    const allowed = ['admin', 'menadzer', 'sef_magacina', 'logistika'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za pristup');
    }

    const validPeriod = (period === '7d' || period === '30d' || period === '90d') ? period : '30d';
    return this.slaService.getTrends(validPeriod);
  }

  @Post('comment')
  async addComment(
    @Body() body: { exception_id: string; comment: string },
    @Req() req: any,
  ) {
    const allowed = ['admin', 'menadzer', 'sef_magacina'];
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Nemate dozvolu za dodavanje komentara');
    }

    return this.slaService.addComment(body.exception_id, body.comment);
  }
}

