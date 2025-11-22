import { Controller, Get, Post, Body, UseGuards, Req, ForbiddenException, Param } from '@nestjs/common';
import { WorkforceService } from './workforce.service';
import { ApiOrJwtGuard } from '../auth/api-or-jwt.guard';
import { AnalyticsPushService } from '../analytics/analytics-push.service';

@UseGuards(ApiOrJwtGuard)
@Controller('workforce')
export class WorkforceController {
  constructor(private readonly service: WorkforceService, private readonly analytics: AnalyticsPushService) {}

  private ensureRole(req: any, allowed: string[]) {
    const role = (req.user?.role || '').toString().toLowerCase();
    const allowedSet = allowed.map(r => r.toLowerCase());
    if (!allowedSet.includes(role)) {
      throw new ForbiddenException('Zabranjen pristup');
    }
  }

  @Get('overview')
  async overview(@Req() req: any) {
    // admin, sef_magacina, menadzer
    this.ensureRole(req, ['admin','sef_magacina','menadzer']);
    return this.service.overview(req.user?.role || '');
  }

  @Get('shift-types')
  async shiftTypes(@Req() req: any) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer']);
    return this.service.shiftTypes();
  }

  @Post('shift-assign')
  async assign(@Req() req: any, @Body() body: { user_id: number; shift_type: string }) {
    // Only admin and sef_magacina can assign
    this.ensureRole(req, ['admin','sef_magacina']);
    return this.service.assignShift({ id: req.user?.id, role: req.user?.role }, body);
  }

  // Assign tasks to users or team
  @Post('assign-task')
  async assignTask(
    @Req() req: any,
    @Body() body: { type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'|'SKART'|'POVRACAJ'; task_id: number; assignees?: number[]; team_id?: number; policy?: 'ANY_DONE'|'ALL_DONE' },
  ) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer']);
    return this.service.assignTask({ id: req.user?.id, role: req.user?.role }, body);
  }

  @Post('assignee/:id/start')
  async startAssignee(@Req() req: any, @Param('id') id: string) {
    // Worker can start his own assignment; supervisors can start any
    return this.service.assigneeStart({ id: req.user?.id, role: req.user?.role }, parseInt(id));
  }

  @Post('assignee/:id/complete')
  async completeAssignee(@Req() req: any, @Param('id') id: string) {
    return this.service.assigneeComplete({ id: req.user?.id, role: req.user?.role }, parseInt(id));
  }

  @Get('task-assignees/:type/:id')
  async taskAssignees(@Req() req: any, @Param('type') type: 'RECEIVING'|'SHIPPING'|'PUTAWAY'|'SKART'|'POVRACAJ', @Param('id') id: string) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer']);
    return this.service.listTaskAssignees(type, parseInt(id));
  }

  @Get('analytics/summary')
  async analyticsSummary(@Req() req: any) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer']);
    const from = req.query?.from as string | undefined;
    const to = req.query?.to as string | undefined;
    return this.service.analyticsSummary(from, to);
  }

  @Get('analytics/status')
  async analyticsStatus(@Req() req: any) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer','analytics']);
    return this.analytics.status();
  }

  @Get('analytics/facts')
  async analyticsFacts(@Req() req: any) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer']);
    const from = req.query?.from as string | undefined;
    const to = req.query?.to as string | undefined;
    return this.service.analyticsFacts(from, to);
  }

  @Get('analytics/facts/receiving')
  async analyticsFactsReceiving(@Req() req: any) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer','analytics']);
    const from = req.query?.from as string | undefined;
    const to = req.query?.to as string | undefined;
    return this.service.analyticsFactsByType('RECEIVING', from, to);
  }

  @Get('analytics/facts/shipping')
  async analyticsFactsShipping(@Req() req: any) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer','analytics']);
    const from = req.query?.from as string | undefined;
    const to = req.query?.to as string | undefined;
    return this.service.analyticsFactsByType('SHIPPING', from, to);
  }

  @Get('analytics/facts/putaway')
  async analyticsFactsPutaway(@Req() req: any) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer','analytics']);
    const from = req.query?.from as string | undefined;
    const to = req.query?.to as string | undefined;
    return this.service.analyticsFactsByType('PUTAWAY', from, to);
  }

  // Teams ranking for Analytics (admin-safe; no kiosk token)
  @Get('analytics/teams')
  async analyticsTeams(@Req() req: any) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer']);
    const from = req.query?.from as string | undefined;
    const to = req.query?.to as string | undefined;
    return this.service.analyticsTeams(from, to);
  }

  @Get('team/:id/tasks')
  async teamTasks(@Req() req: any, @Param('id') id: string) {
    this.ensureRole(req, ['admin','sef_magacina','menadzer']);
    return this.service.teamTasks(parseInt(id));
  }
}
