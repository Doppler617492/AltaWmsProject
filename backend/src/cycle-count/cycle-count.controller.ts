import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CycleCountService } from './cycle-count.service';

@UseGuards(JwtAuthGuard)
@Controller('cycle-count')
export class CycleCountController {
  constructor(private readonly svc: CycleCountService) {}

  @Post('task')
  async createTask(@Req() req: any, @Body() body: { scope: 'LOKACIJA'|'ZONA'; target_code: string; assign_to_user_id?: number }) {
    return this.svc.createTask({ id: req.user?.id, role: req.user?.role }, body);
  }

  @Get('tasks')
  async list(@Req() req: any, @Query('status') status?: string, @Query('assigned_to_user_id') assigned?: string) {
    return this.svc.listTasks({ role: req.user?.role }, { status, assigned_to_user_id: assigned ? parseInt(assigned) : undefined });
  }

  @Get('my-tasks')
  async myTasks(@Req() req: any) {
    return this.svc.myTasks(req.user?.id);
  }

  @Get('task/:id')
  async getTask(@Param('id') id: string) {
    return this.svc.getTask(parseInt(id));
  }

  @Patch('line/:lineId')
  async updateLine(@Req() req: any, @Param('lineId') lineId: string, @Body('counted_qty') counted_qty: number) {
    return this.svc.updateLine({ id: req.user?.id, role: req.user?.role }, parseInt(lineId), counted_qty);
  }

  @Patch('task/:id/start')
  async start(@Req() req: any, @Param('id') id: string) {
    return this.svc.startTask({ id: req.user?.id, role: req.user?.role }, parseInt(id));
  }

  @Patch('task/:id/complete')
  async complete(@Req() req: any, @Param('id') id: string) {
    return this.svc.completeTask({ id: req.user?.id, role: req.user?.role }, parseInt(id));
  }

  @Post('task/:id/reconcile')
  async reconcile(@Req() req: any, @Param('id') id: string) {
    return this.svc.reconcile({ id: req.user?.id, role: req.user?.role }, parseInt(id));
  }

  @Delete('task/:id')
  async deleteTask(@Req() req: any, @Param('id') id: string) {
    return this.svc.deleteTask({ id: req.user?.id, role: req.user?.role }, parseInt(id));
  }
}
