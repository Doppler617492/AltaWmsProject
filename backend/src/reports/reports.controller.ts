import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('task-history')
  async getTaskHistory(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('worker_id') workerId?: string,
    @Query('team_id') teamId?: string,
    @Query('task_type') taskType?: string,
    @Query('sku') sku?: string,
    @Query('location') location?: string,
  ) {
    return this.reportsService.getTaskHistory({
      from,
      to,
      workerId: workerId ? parseInt(workerId) : undefined,
      teamId: teamId ? parseInt(teamId) : undefined,
      taskType,
      sku,
      location,
    });
  }

  @Get('workers-summary')
  async getWorkersSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getWorkersSummary({ from, to });
  }

  @Get('teams-summary')
  async getTeamsSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getTeamsSummary({ from, to });
  }

  @Get('export-excel')
  async exportExcel(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const buffer = await this.reportsService.generateExcelReport({ from, to });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=alta-wms-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  }
}
